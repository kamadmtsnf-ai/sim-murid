-- Preserve stored periods; validate all new/edited survey windows against the selected academic semester.
begin;
create or replace function public.app_survey_mutate(p_actor uuid,p_session uuid,p_command jsonb) returns jsonb language plpgsql security invoker set search_path='' as $$
#variable_conflict use_variable
declare p sim_murid_private.survey_periods%rowtype;r sim_murid_private.survey_respondents%rowtype;id uuid;item jsonb;q jsonb;answers jsonb;peer uuid;missing jsonb:='[]';v jsonb;begin
 if not public.app_onboarding_ready(p_actor,p_session) then return jsonb_build_object('code','denied');end if;
 id=(p_command->>'periodId')::uuid;
 if p_command->>'type'='period' then
 if not public.app_survey_manager(p_actor,p_session) then return jsonb_build_object('code','denied');end if;
 -- A survey belongs to one academic semester; never reinterpret an existing period silently.
 if id is not null then
  select * into p from sim_murid_private.survey_periods where survey_periods.id=id for update;
  if not found then return jsonb_build_object('code','not_found');end if;
  if p.academic_year_id is distinct from (p_command->>'yearId')::uuid or p.semester is distinct from (p_command->>'semester')::integer then return jsonb_build_object('code','invalid');end if;
 end if;
 if not exists(select 1 from public.academic_years y where y.id=(p_command->>'yearId')::uuid and (p_command->>'semester')::integer in(1,2)
  and (p_command->>'start')::date <= (p_command->>'end')::date
  and (p_command->>'start')::date >= case when (p_command->>'semester')::integer=1 then y.starts_on else make_date(y.start_year+1,1,1) end
  and (p_command->>'end')::date <= case when (p_command->>'semester')::integer=1 then make_date(y.start_year,12,31) else y.ends_on end)
 then return jsonb_build_object('code','invalid');end if;
 if exists(select 1 from public.holidays where holiday_date between(p_command->>'start')::date and(p_command->>'start')::date+13 and description~*'(ujian|asesmen|ATS|ASAS|PTS|PAS)') and length(btrim(coalesce(p_command->>'examOverride','')))<3 then return jsonb_build_object('code','exam_warning');end if;
 if id is not null and exists(select 1 from sim_murid_private.survey_respondents where period_id=id) then return jsonb_build_object('code','locked');end if;
 if id is null then insert into sim_murid_private.survey_periods(title,academic_year_id,semester,starts_on,ends_on,targets,kind,questions,exam_override,created_by) values(p_command->>'title',(p_command->>'yearId')::uuid,(p_command->>'semester')::integer,(p_command->>'start')::date,(p_command->>'end')::date,array(select jsonb_array_elements_text(p_command->'targets')),p_command->>'kind',p_command->'questions',p_command->>'examOverride',p_actor) returning survey_periods.id into id;
 else update sim_murid_private.survey_periods set title=p_command->>'title',starts_on=(p_command->>'start')::date,ends_on=(p_command->>'end')::date,targets=array(select jsonb_array_elements_text(p_command->'targets')),exam_override=p_command->>'examOverride' where survey_periods.id=id;end if;return jsonb_build_object('code','saved','id',id);
 elsif p_command->>'type'='close' then
 if not public.app_survey_manager(p_actor,p_session) then return jsonb_build_object('code','denied');end if;
 update sim_murid_private.survey_periods set status='closed' where survey_periods.id=id;return jsonb_build_object('code','saved','id',id);
 elsif p_command->>'type'='start' then return public.app_survey_start(p_actor,p_session,id);
 end if;
 select * into p from sim_murid_private.survey_periods where survey_periods.id=id;
 select * into r from sim_murid_private.survey_respondents where period_id=id and user_id=p_actor for update;
 if not found or not public.app_survey_open(id) or r.submitted_at is not null then return jsonb_build_object('code','locked');end if;
 if r.revision is distinct from(p_command->>'version')::bigint then return jsonb_build_object('code','stale');end if;
 if p_command->>'type' in('save','submit') then
 answers=p_command->'answers';if jsonb_typeof(answers)<>'object' then return jsonb_build_object('code','invalid');end if;
 for item in select to_jsonb(x) from jsonb_each(answers)x loop
 select value into q from jsonb_array_elements(r.instrument) where value->>'code'=item->>'key';if not found then return jsonb_build_object('code','invalid');end if;
 v=item->'value';if q->>'kind'='likert' and(jsonb_typeof(v)<>'number' or(v#>>'{}')::numeric not between 1 and 5 or(v#>>'{}')::numeric<>trunc((v#>>'{}')::numeric)) then return jsonb_build_object('code','invalid');end if;
 if q->>'kind'='essay' and(jsonb_typeof(v)<>'string' or length(v#>>'{}')>10000) then return jsonb_build_object('code','invalid');end if;
 end loop;
 if p_command->>'type'='submit' then
 for q in select value from jsonb_array_elements(r.instrument) loop if coalesce((q->>'required')::boolean,true) and (answers->>(q->>'code') is null or btrim(answers->>(q->>'code'))='') then missing=missing||jsonb_build_array(q->>'code');end if;end loop;
 if jsonb_array_length(missing)>0 then return jsonb_build_object('code','incomplete','missing',missing);end if;
 if r.role='teacher' and p.kind='main' and cardinality(r.peers)>0 and r.peer_submitted_at is null then return jsonb_build_object('code','peer_incomplete');end if;
 end if;
 update sim_murid_private.survey_respondents set answers=answers,revision=revision+1,submitted_at=case when p_command->>'type'='submit' then now() else null end,flags=case when p_command->>'type'='submit' then public.app_survey_flags(r.instrument,answers,extract(epoch from now()-r.started_at),r.role) else null end where period_id=id and user_id=p_actor;
 elsif p_command->>'type' in('peer_save','peer_submit') then
 if r.role<>'teacher' or p.kind<>'main' or r.peer_submitted_at is not null then return jsonb_build_object('code','denied');end if;
 answers=p_command->'answers';if jsonb_typeof(answers)<>'object' then return jsonb_build_object('code','invalid');end if;
 for item in select to_jsonb(x) from jsonb_each(answers)x loop peer=(item->>'key')::uuid;if not peer=any(r.peers) then return jsonb_build_object('code','denied');end if;
 for q in select value from jsonb_array_elements(jsonb_build_array(1,2,3,4,5,6)) loop v=item->'value'->('PTS-'||(q#>>'{}'));if v is not null and v<>'"TT"'::jsonb and(jsonb_typeof(v)<>'number' or(v#>>'{}')::numeric not between 1 and 5 or(v#>>'{}')::numeric<>trunc((v#>>'{}')::numeric)) then return jsonb_build_object('code','invalid');end if;end loop;
 if length(coalesce(item->'value'->>'PTS-7',''))>10000 then return jsonb_build_object('code','invalid');end if;end loop;
 if p_command->>'type'='peer_submit' then foreach peer in array r.peers loop for q in select value from jsonb_array_elements(jsonb_build_array(1,2,3,4,5,6)) loop if answers->peer::text->('PTS-'||(q#>>'{}')) is null then return jsonb_build_object('code','peer_incomplete');end if;end loop;end loop;end if;
 update sim_murid_private.survey_respondents set peer_answers=answers,revision=revision+1,peer_submitted_at=case when p_command->>'type'='peer_submit' then now() else null end where period_id=id and user_id=p_actor;
 else return jsonb_build_object('code','invalid');end if;
 return jsonb_build_object('code','saved','version',r.revision+1);end$$;
commit;
