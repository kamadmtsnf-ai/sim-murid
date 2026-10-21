begin;
-- D10: published archives are immutable. Corrections append a new audited version.
create table sim_murid_private.report_revisions (
 id uuid primary key default gen_random_uuid(),
 report_id uuid not null references sim_murid_private.report_snapshots(id),
 version integer not null check(version >= 2),
 snapshot jsonb not null,
 reason text not null check(length(btrim(reason)) between 5 and 2000),
 published_by uuid not null references public.profiles(id),
 published_at timestamptz not null default now(),
 unique(report_id,version)
);
create index report_revisions_publisher on sim_murid_private.report_revisions(published_by);
create trigger report_revision_immutable before update or delete on sim_murid_private.report_revisions for each row execute function sim_murid_private.deny_mutation();
alter table sim_murid_private.report_revisions enable row level security;
revoke all on sim_murid_private.report_revisions from public,anon,authenticated;
grant select,insert on sim_murid_private.report_revisions to service_role;

alter function public.app_learning_write(uuid,uuid,uuid,bigint,text,jsonb) rename to app_learning_write_v30;
create function public.app_learning_write(p_actor uuid,p_session uuid,p_request uuid,p_revision bigint,p_module text,p_command jsonb) returns jsonb language plpgsql security invoker set search_path='' as $$
declare base sim_murid_private.report_snapshots%rowtype; old sim_murid_private.operations_requests%rowtype; v_revision bigint; current_version integer; draft jsonb; previous_snapshot jsonb; result jsonb; target uuid;
begin
 if p_module<>'reports' or p_command->>'type'<>'revise' then
  return public.app_learning_write_v30(p_actor,p_session,p_request,p_revision,p_module,p_command);
 end if;
 if not public.app_onboarding_ready(p_actor,p_session) then return jsonb_build_object('code','denied');end if;
 if not(public.app_education_admin(p_actor,p_session) or exists(select 1 from public.classes where id=(p_command->>'classId')::uuid and homeroom_teacher_id=p_actor)) then return jsonb_build_object('code','denied');end if;
 select s.revision into v_revision from sim_murid_private.operations_state s for update;
 select * into old from sim_murid_private.operations_requests where id=p_request;
 if found then
  if old.actor=p_actor and old.module='learning:reports' and old.command=p_command then return old.result;end if;
  return jsonb_build_object('code','request_conflict');
 end if;
 if v_revision is distinct from p_revision then return jsonb_build_object('code','stale');end if;
 if length(btrim(coalesce(p_command->>'reason',''))) not between 5 and 2000 then return jsonb_build_object('code','invalid');end if;
 select * into base from sim_murid_private.report_snapshots where student_id=(p_command->>'studentId')::uuid and class_id=(p_command->>'classId')::uuid and semester=(p_command->>'semester')::integer;
 if not found then return jsonb_build_object('code','not_found');end if;
 select coalesce(max(version),1) into current_version from sim_murid_private.report_revisions where report_id=base.id;
 if current_version is distinct from (p_command->>'expectedVersion')::integer then return jsonb_build_object('code','stale');end if;
 draft=public.app_report_draft(p_actor,p_session,base.student_id,base.class_id,base.semester);
 if draft is null or jsonb_array_length(draft->'subjects')=0 or exists(select 1 from jsonb_array_elements(draft->'subjects') s where s->>'complete' is distinct from 'true') then return jsonb_build_object('code','incomplete');end if;
 select coalesce((select snapshot from sim_murid_private.report_revisions where report_id=base.id order by version desc limit 1),base.snapshot) into previous_snapshot;
 if jsonb_set(draft,'{draft}','false')=previous_snapshot then return jsonb_build_object('code','unchanged');end if;
 insert into sim_murid_private.report_revisions(report_id,version,snapshot,reason,published_by)
 values(base.id,current_version+1,jsonb_set(draft,'{draft}','false'),btrim(p_command->>'reason'),p_actor) returning id into target;
 result=jsonb_build_object('code','saved','id',target,'version',current_version+1);
 update sim_murid_private.operations_state set revision=revision+1;
 insert into sim_murid_private.operations_requests(id,actor,module,command,result) values(p_request,p_actor,'learning:reports',p_command,result);
 insert into sim_murid_private.activity_logs(actor_id,actor_kind,action,entity_type,entity_id,request_id,metadata)
 values(p_actor,'user','reports.revise','reports',target,p_request,jsonb_build_object('report_id',base.id,'previous_version',current_version,'version',current_version+1,'reason',btrim(p_command->>'reason')));
 return result;
exception when unique_violation then return jsonb_build_object('code','duplicate');when invalid_text_representation or check_violation or not_null_violation or foreign_key_violation or numeric_value_out_of_range then return jsonb_build_object('code','invalid');
end$$;

alter function public.app_learning_read(uuid,uuid,text,jsonb) rename to app_learning_read_v30;
create function public.app_learning_read(p_actor uuid,p_session uuid,p_module text,p_filters jsonb default '{}') returns jsonb language plpgsql stable security invoker set search_path='' as $$
declare result jsonb; item jsonb; history jsonb; published jsonb; items jsonb:='[]'; wanted integer;
begin
 result=public.app_learning_read_v30(p_actor,p_session,p_module,p_filters);
 if result is null or p_module<>'reports' then return result;end if;
 wanted=(p_filters->>'reportVersion')::integer;
 for item in select value from jsonb_array_elements(result->'rows') loop
  select jsonb_agg(jsonb_build_object('id',v.id,'version',v.version,'reason',v.reason,'published_at',v.published_at,
   'snapshot',jsonb_set(v.snapshot,'{subjects}',coalesce((select jsonb_agg(s) from jsonb_array_elements(v.snapshot->'subjects') s where public.app_ops_student(p_actor,p_session,b.student_id) or exists(select 1 from public.classes where id=b.class_id and homeroom_teacher_id=p_actor) or public.app_teaching_access(p_actor,p_session,b.class_id,(s->>'subject_id')::uuid,false)),'[]'))) order by v.version desc)
  into history from sim_murid_private.report_snapshots b cross join lateral (
   select b.id,1 version,b.snapshot,null::text reason,b.published_at
   union all select r.id,r.version,r.snapshot,r.reason,r.published_at from sim_murid_private.report_revisions r where r.report_id=b.id
  ) v where b.student_id=(item->>'student_id')::uuid and b.class_id=(p_filters->>'classId')::uuid and b.semester=(result->>'semester')::integer;
  if wanted is null then published=history->0;
  else select value into published from jsonb_array_elements(coalesce(history,'[]')) where (value->>'version')::integer=wanted;end if;
  if wanted is not null and published is null then continue;end if;
  items=items||jsonb_build_array(item||jsonb_build_object('published',published,'reportVersions',coalesce(history,'[]')));
 end loop;
 return jsonb_set(jsonb_set(result,'{rows}',items),'{extra}',coalesce(result->'extra','{}')||jsonb_build_object('reportRevisions',true));
end$$;

do $$declare name text;sig regprocedure;begin
 foreach name in array array['app_learning_write','app_learning_write_v30','app_learning_read','app_learning_read_v30'] loop
 for sig in select p.oid::regprocedure from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='public' and p.proname=name loop
 execute format('revoke all on function %s from public,anon,authenticated',sig);execute format('grant execute on function %s to service_role',sig);
 end loop;end loop;
end$$;
commit;
