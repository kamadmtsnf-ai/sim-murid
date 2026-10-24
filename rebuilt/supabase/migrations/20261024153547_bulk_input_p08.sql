begin;
-- Reuse private import audit; preview never persists staged PII or domain changes.
create unique index import_p08_content_unique on sim_murid_private.import_batches(created_by,source_name,source_checksum)
where source_name in('P08:enrollment','P08:schedules','P08:grades') and status='imported';
create function public.app_bulk_input(p_actor uuid,p_session uuid,p_request uuid,p_action text,p_domain text default null,p_revision bigint default null,p_options jsonb default '{}'::jsonb,p_rows jsonb default '[]'::jsonb)
returns jsonb language plpgsql security invoker set search_path='' as $$
#variable_conflict use_variable
declare domain text:=p_domain;opts jsonb:=p_options;cached sim_murid_private.import_batches%rowtype;fingerprint text;cls uuid;sub uuid;yr uuid;sy integer;dt date;sem integer;version bigint;v bigint;row jsonb;cmd jsonb;commands jsonb:='[]';items jsonb:='[]';outcomes jsonb:='[]';answer jsonb;outcome jsonb;sid uuid;tid uuid;subject uuid;n integer:=0;j integer:=0;bad boolean:=false;code text;seen text[]:='{}';key text;ids uuid[]:='{}';is_preview boolean:=p_action='preview';begin
 if p_request is null or not public.app_onboarding_ready(p_actor,p_session) then return jsonb_build_object('code','denied');end if;
 if p_action is null or p_action not in('preview','commit','status') then return jsonb_build_object('code','invalid');end if;
 perform pg_advisory_xact_lock(hashtextextended('p08:'||p_request::text,0));
 select * into cached from sim_murid_private.import_batches where id=p_request and created_by=p_actor and source_name in('P08:enrollment','P08:schedules','P08:grades') and status='imported';
 if p_action='status' then
  if not found then return jsonb_build_object('code','not_found');end if;
  domain=substr(cached.source_name,5);opts=cached.metadata->'options';
 end if;
 if domain is null or domain not in('enrollment','schedules','grades') or jsonb_typeof(opts) is distinct from 'object' then return jsonb_build_object('code','invalid');end if;
 cls=(opts->>'classId')::uuid;sub=(opts->>'subjectId')::uuid;
 -- Reject unauthorized callers before contending on shared domain state; recheck after locks below.
 if (domain='enrollment' and not public.app_education_admin(p_actor,p_session)) or (domain='schedules' and not public.app_class_access(p_actor,p_session,cls,true)) or (domain='grades' and not public.app_teaching_access(p_actor,p_session,cls,sub,true)) then return jsonb_build_object('code','denied');end if;
 -- Composite work serializes grade/promotion and class/schedule writers in a fixed order.
 perform 1 from public.profiles where id=p_actor for share;perform 1 from public.user_roles where user_id=p_actor for share;
 perform 1 from public.user_assignments where user_id=p_actor and revoked_at is null for share;
 select revision into v from sim_murid_private.operations_state for update;
 select revision into version from sim_murid_private.education_state for update;
 if domain='grades' then version=v;end if;
 cls=(opts->>'classId')::uuid;sub=(opts->>'subjectId')::uuid;
 perform 1 from public.classes where id=cls for share;
 if (domain='enrollment' and not public.app_education_admin(p_actor,p_session)) or (domain='schedules' and not public.app_class_access(p_actor,p_session,cls,true)) or (domain='grades' and not public.app_teaching_access(p_actor,p_session,cls,sub,true)) then return jsonb_build_object('code','denied');end if;
 if p_action='status' then return cached.metadata->'result';end if;
 if jsonb_typeof(p_rows) is distinct from 'array' or jsonb_array_length(p_rows) not between 1 and 100 or octet_length(p_rows::text)>262144 then return jsonb_build_object('code','invalid');end if;
 fingerprint=encode(sha256(convert_to(jsonb_build_array(domain,opts,p_rows)::text,'UTF8')),'hex');
 if exists(select 1 from sim_murid_private.import_batches where id=p_request) then
  if cached.id is not null and cached.source_name='P08:'||domain and cached.source_checksum=fingerprint then return cached.metadata->'result';end if;
  return jsonb_build_object('code','request_conflict');
 end if;
 if exists(select 1 from sim_murid_private.import_batches where created_by=p_actor and source_name='P08:'||domain and source_checksum=fingerprint and status='imported' and source_name in('P08:enrollment','P08:schedules','P08:grades')) then return jsonb_build_object('code','duplicate');end if;
 if not is_preview and p_revision is distinct from version then return jsonb_build_object('code','stale');end if;
 select c.academic_year_id,y.start_year into yr,sy from public.classes c join public.academic_years y on y.id=c.academic_year_id where c.id=cls and c.archived_at is null;
 if yr is null then return jsonb_build_object('code','invalid');end if;
 if domain in('enrollment','grades') then
  dt=(opts->>'date')::date;
  if dt is null or dt<make_date(sy,7,1) or dt>=make_date(sy+1,7,1) then return jsonb_build_object('code','invalid');end if;
  sem=case when extract(month from dt)>=7 then 1 else 2 end;
 end if;
 if domain='grades' and (jsonb_typeof(opts->'semester') is distinct from 'number' or opts->>'semester' not in('1','2') or (opts->>'semester')::integer<>sem) then return jsonb_build_object('code','invalid');end if;
 if domain='grades' and (opts->>'kind' is null or opts->>'kind' not in('PH','ATS','ASAS','Praktik') or not exists(select 1 from public.subjects where id=sub and active)) then return jsonb_build_object('code','invalid');end if;
 -- This wizard creates only. Existing assessments/corrections remain in their original workflow.
 if domain='grades' and opts->>'kind'<>'PH' and exists(select 1 from sim_murid_private.assessments where class_id=cls and subject_id=sub and academic_year_id=yr and semester=sem and kind=opts->>'kind' and voided_at is null) then return jsonb_build_object('code','existing_assessment');end if;
 for row in select value from jsonb_array_elements(p_rows) loop
  n=n+1;code='valid';cmd=null;
  begin
   if jsonb_typeof(row) is distinct from 'object' then raise invalid_parameter_value;end if;
   if domain in('enrollment','grades') then
    if jsonb_typeof(row->'username') is distinct from 'string' or length(row->>'username') not between 1 and 100 or row->>'username'<>btrim(row->>'username') then raise invalid_parameter_value;end if;
    key=row->>'username';if key=any(seen) then code='duplicate_row';end if;seen=array_append(seen,key);
    select p.id into sid from public.profiles p join public.user_roles r on r.user_id=p.id where p.username=key and p.status='active' and r.role_code='student' for share of p,r;
    if sid is null then code='reference';end if;
    if domain='enrollment' then
     if exists(select 1 from sim_murid_private.enrollments where student_id=sid and academic_year_id=yr and ended_at is null) then code='already_enrolled';end if;
     ids=array_append(ids,sid);
    else
     if not exists(select 1 from sim_murid_private.enrollments where student_id=sid and class_id=cls and academic_year_id=yr and ended_at is null and starts_on<=dt) then code='membership';end if;
     if jsonb_typeof(row->'value') not in('number','null') or not(row ? 'value') or ((row->>'value')::numeric is not null and ((row->>'value')::numeric not between 0 and 100 or (row->>'value')::numeric<>round((row->>'value')::numeric,2))) or jsonb_typeof(row->'notes') is distinct from 'string' or length(row->>'notes')>2000 then raise invalid_parameter_value;end if;
     items=items||jsonb_build_array(jsonb_build_object('studentId',sid,'value',row->'value','notes',row->>'notes'));
    end if;
   else
    if jsonb_typeof(row->'teacher_username') is distinct from 'string' or length(row->>'teacher_username') not between 1 and 100 or row->>'teacher_username'<>btrim(row->>'teacher_username') then raise invalid_parameter_value;end if;
    select p.id into tid from public.profiles p join public.user_roles r on r.user_id=p.id where p.username=row->>'teacher_username' and p.status='active' and r.role_code='teacher' for share of p,r;
    select s.id into subject from public.subjects s where s.code=row->>'subject_code' and s.active;
    if tid is null or subject is null then code='reference';end if;
    if jsonb_typeof(row->'weekday') is distinct from 'number' or jsonb_typeof(row->'duration_minutes') is distinct from 'number' or jsonb_typeof(row->'jtm') is distinct from 'number' or jsonb_typeof(row->'break_minutes') is distinct from 'number' then raise invalid_parameter_value;end if;
    cmd=jsonb_build_object('type','lesson','id',null,'classId',cls,'subjectId',subject,'teacherId',tid,'weekday',row->'weekday','start',row->>'start','durationMinutes',row->'duration_minutes','jtm',row->'jtm','breakMinutes',row->'break_minutes');commands=commands||jsonb_build_array(cmd);
   end if;
  exception when invalid_text_representation or invalid_parameter_value or numeric_value_out_of_range then code='invalid';end;
  if code<>'valid' then bad=true;end if;
  outcomes=outcomes||jsonb_build_array(jsonb_build_object('row',n+1,'code',code));
 end loop;
 if bad then
  select jsonb_agg(jsonb_build_object('row',x->'row','code',case when x->>'code'='valid' then 'not_saved' else x->>'code' end) order by (x->>'row')::integer) into outcomes from jsonb_array_elements(outcomes)x;
  return jsonb_build_object('code','invalid','revision',version,'rows',outcomes);
 end if;
 if domain='enrollment' then commands=jsonb_build_array(jsonb_build_object('type','enrollment','classId',cls,'studentIds',to_jsonb(ids),'startsOn',dt,'remove',false));
 elsif domain='grades' then commands=jsonb_build_array(jsonb_build_object('type','batch','id',null,'classId',cls,'subjectId',sub,'date',dt,'kind',opts->>'kind','items',items));end if;
 -- A subtransaction rolls back all preceding child writes on any refusal or on preview.
 begin
  for cmd in select value from jsonb_array_elements(commands) loop
   j=j+1;
   if domain='grades' then select revision into v from sim_murid_private.operations_state;answer=public.app_learning_write(p_actor,p_session,gen_random_uuid(),v,'grades',cmd);
   else select revision into v from sim_murid_private.education_state;
    if domain='enrollment' then answer=public.app_classes_write(p_actor,p_session,gen_random_uuid(),v,cmd);
    else answer=public.app_schedules_write(p_actor,p_session,gen_random_uuid(),v,cmd);end if;
   end if;
   if answer->>'code' is distinct from 'saved' then
    code=coalesce(answer->>'code','invalid');raise sqlstate 'P0801';
   end if;
   if domain='schedules' then outcomes=jsonb_set(outcomes,array[(j-1)::text],jsonb_build_object('row',j+1,'code',case when is_preview then 'valid' else 'saved' end));end if;
  end loop;
  if is_preview then raise sqlstate 'P0802';end if;
 exception when sqlstate 'P0801' then bad=true;when sqlstate 'P0802' then null;end;
 if bad then
  select jsonb_agg(jsonb_build_object('row',x->'row','code',case when domain<>'schedules' or (x->>'row')::integer=j+1 then code else 'not_saved' end) order by (x->>'row')::integer) into outcomes from jsonb_array_elements(outcomes)x;
  return jsonb_build_object('code','invalid','revision',version,'rows',outcomes);
 end if;
 select jsonb_agg(jsonb_build_object('row',x->'row','code',case when is_preview then 'valid' else 'saved' end) order by (x->>'row')::integer) into outcomes from jsonb_array_elements(outcomes)x;
 outcome=jsonb_build_object('code',case when is_preview then 'ready' else 'saved' end,'revision',version,'requestId',p_request,'rows',outcomes);
 if not is_preview then
  insert into sim_murid_private.import_batches(id,source_name,source_checksum,status,created_by,metadata) values(p_request,'P08:'||domain,fingerprint,'imported',p_actor,jsonb_build_object('options',opts,'result',outcome));
  insert into sim_murid_private.import_rows(batch_id,sheet_name,row_number,raw_data,review_status) select p_request,'P08:'||domain,(x->>'row')::integer,'{}'::jsonb,'imported' from jsonb_array_elements(outcomes)x;
 end if;
 return outcome;
exception when unique_violation then return jsonb_build_object('code','duplicate');when invalid_text_representation or invalid_datetime_format or datetime_field_overflow or check_violation or not_null_violation or foreign_key_violation or numeric_value_out_of_range then return jsonb_build_object('code','invalid');end;$$;
revoke all on function public.app_bulk_input(uuid,uuid,uuid,text,text,bigint,jsonb,jsonb) from public,anon,authenticated;
grant execute on function public.app_bulk_input(uuid,uuid,uuid,text,text,bigint,jsonb,jsonb) to service_role;
create function public.app_bulk_catalog(p_actor uuid,p_session uuid,p_domain text,p_class uuid,p_subject uuid default null) returns jsonb language plpgsql stable security invoker set search_path='' as $$
begin
 if not public.app_onboarding_ready(p_actor,p_session) or p_domain is null or p_domain not in('enrollment','schedules','grades') or not exists(select 1 from public.classes where id=p_class and archived_at is null) then return null;end if;
 if (p_domain='enrollment' and not public.app_education_admin(p_actor,p_session)) or(p_domain='schedules' and not public.app_class_access(p_actor,p_session,p_class,true)) or(p_domain='grades' and not public.app_teaching_access(p_actor,p_session,p_class,p_subject,true)) then return null;end if;
 return jsonb_build_object('classId',p_class,'domain',p_domain,'people',(select coalesce(jsonb_agg(r),'[]') from(select p.username,p.full_name as name from public.profiles p join public.user_roles u on u.user_id=p.id where p.status='active' and u.role_code=case when p_domain='schedules' then 'teacher' else 'student' end and(p_domain<>'grades' or exists(select 1 from sim_murid_private.enrollments e where e.student_id=p.id and e.class_id=p_class and e.ended_at is null)) order by p.username limit 500)r),'subjects',case when p_domain='schedules' then(select coalesce(jsonb_agg(r),'[]') from(select code,name from public.subjects where active order by sort_order limit 100)r) else '[]'::jsonb end);
end;$$;
revoke all on function public.app_bulk_catalog(uuid,uuid,text,uuid,uuid) from public,anon,authenticated;
grant execute on function public.app_bulk_catalog(uuid,uuid,text,uuid,uuid) to service_role;
comment on function public.app_bulk_input(uuid,uuid,uuid,text,text,bigint,jsonb,jsonb) is 'P08 bounded additive imports. Preview rolls back subtransaction; commit atomic; same request/content idempotent. No raw file stored.';
commit;
