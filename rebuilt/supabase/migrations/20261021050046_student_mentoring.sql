
begin;
create table sim_murid_private.mentor_students(id uuid primary key default gen_random_uuid(),teacher_id uuid not null references public.profiles(id),student_id uuid not null references public.profiles(id),created_by uuid not null references public.profiles(id),created_at timestamptz not null default now(),revoked_at timestamptz);
create unique index mentor_student_active on sim_murid_private.mentor_students(student_id) where revoked_at is null;
create index mentor_teacher on sim_murid_private.mentor_students(teacher_id);
create index mentor_creator on sim_murid_private.mentor_students(created_by);
create table sim_murid_private.mentoring_reports(id uuid primary key default gen_random_uuid(),student_id uuid not null references public.profiles(id),teacher_id uuid not null references public.profiles(id),report_date date not null,kind text not null check(kind in('memorization','development')),catalog_id uuid references public.memorization_catalog(id),subject text not null check(length(btrim(subject)) between 1 and 200),predicate text not null default '' check(length(predicate)<=100),notes text not null check(length(notes)<=4000) check(kind<>'development' or length(btrim(notes))>0),created_at timestamptz not null default now(),updated_at timestamptz not null default now(),voided_at timestamptz);
create index mentoring_student_date on sim_murid_private.mentoring_reports(student_id,report_date);
create index mentoring_teacher on sim_murid_private.mentoring_reports(teacher_id);
create index mentoring_catalog on sim_murid_private.mentoring_reports(catalog_id);
create function public.app_mentor_access(p_actor uuid,p_session uuid,p_student uuid) returns boolean language sql stable security invoker set search_path='' as $$select public.app_onboarding_ready(p_actor,p_session) and public.app_ops_role(p_actor,'teacher') and public.app_education_task(p_actor,'student_mentor') and exists(select 1 from sim_murid_private.mentor_students where teacher_id=p_actor and student_id=p_student and revoked_at is null)$$;
create function public.app_mentoring_mutate(p_actor uuid,p_session uuid,p_command jsonb) returns jsonb language plpgsql security invoker set search_path='' as $$
declare t uuid;sid uuid;target uuid;ids uuid[];row sim_murid_private.mentoring_reports%rowtype;label text;cat uuid;begin
 if p_command->>'type'='assign' then
 if not public.app_education_admin(p_actor,p_session) then return jsonb_build_object('code','denied');end if;t=(p_command->>'teacherId')::uuid;
 
 ids=array(select jsonb_array_elements_text(p_command->'studentIds')::uuid);
 if not public.app_ops_role(t,'teacher') or (not public.app_education_task(t,'student_mentor') and coalesce(p_command->>'assignTask','false')<>'true') or cardinality(ids)>500 or cardinality(ids)<>(select count(distinct x) from unnest(ids)x) or exists(select 1 from unnest(ids)x where not public.app_ops_role(x,'student')) then return jsonb_build_object('code','invalid');end if;
 if p_command->>'assignTask'='true' and public.app_ops_role(t,'teacher') and not public.app_education_task(t,'student_mentor') then insert into public.user_assignments(user_id,assignment_code,valid_from,assigned_by) values(t,'student_mentor',public.app_ops_today(),p_actor);end if;
 update sim_murid_private.mentor_students set revoked_at=now() where teacher_id=t and revoked_at is null;
 if exists(select 1 from sim_murid_private.mentor_students where student_id=any(ids) and revoked_at is null and teacher_id<>t) then raise exception using errcode='23505',message='Student already has mentor';end if;
 insert into sim_murid_private.mentor_students(teacher_id,student_id,created_by) select t,x,p_actor from unnest(ids)x;
 elsif p_command->>'type' in('report','void') then
 target=(p_command->>'id')::uuid;
 if target is not null then select * into row from sim_murid_private.mentoring_reports where id=target and voided_at is null;if not found then return jsonb_build_object('code','not_found');end if;
 if not public.app_education_admin(p_actor,p_session) and (row.teacher_id<>p_actor or not public.app_mentor_access(p_actor,p_session,row.student_id)) then return jsonb_build_object('code','denied');end if;end if;
 if p_command->>'type'='void' then if target is null then return jsonb_build_object('code','invalid');end if;update sim_murid_private.mentoring_reports set voided_at=now(),updated_at=now() where id=target;
 else sid=(p_command->>'studentId')::uuid;
 if not public.app_ops_role(sid,'student') or not(public.app_education_admin(p_actor,p_session) or public.app_mentor_access(p_actor,p_session,sid)) then return jsonb_build_object('code','denied');end if;
 cat=case when p_command->>'kind'='memorization' then (p_command->>'catalogId')::uuid end;label=btrim(p_command->>'subject');if cat is not null then select name into label from public.memorization_catalog where id=cat and active;if not found then return jsonb_build_object('code','invalid');end if;end if;
 if (p_command->>'date')::date>public.app_ops_today() or p_command->>'kind' not in('memorization','development') or coalesce(length(label),0)=0 or (p_command->>'kind'='memorization' and coalesce(length(btrim(p_command->>'predicate')),0)=0) then return jsonb_build_object('code','invalid');end if;
 if target is null then insert into sim_murid_private.mentoring_reports(student_id,teacher_id,report_date,kind,catalog_id,subject,predicate,notes) values(sid,p_actor,(p_command->>'date')::date,p_command->>'kind',cat,label,coalesce(p_command->>'predicate',''),p_command->>'notes') returning id into target;
 else update sim_murid_private.mentoring_reports set student_id=sid,report_date=(p_command->>'date')::date,kind=p_command->>'kind',catalog_id=cat,subject=label,predicate=coalesce(p_command->>'predicate',''),notes=p_command->>'notes',updated_at=now() where id=target;end if;end if;
 else return jsonb_build_object('code','invalid');end if;return jsonb_build_object('code','saved','id',target);end$$;
do $$declare t text;r record;begin foreach t in array array['mentor_students','mentoring_reports'] loop execute format('alter table sim_murid_private.%I enable row level security',t);execute format('revoke all on table sim_murid_private.%I from public,anon,authenticated',t);execute format('grant select,insert,update,delete on table sim_murid_private.%I to service_role',t);end loop;
 for r in select p.oid::regprocedure as signature from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='public' and p.proname in('app_ops_today','app_ops_role','app_ops_manager','app_ops_student','app_duty_confirmed','app_duty_mutate','app_attendance_access','app_attendance_mutate','app_mentor_access','app_mentoring_mutate','app_natural_key','app_fee_waiver_student','app_fees_mutate') loop execute format('revoke all on function %s from public,anon,authenticated',r.signature);execute format('grant execute on function %s to service_role',r.signature);end loop;end$$;
commit;
