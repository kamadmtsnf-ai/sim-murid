
begin;
create table sim_murid_private.operations_state(singleton boolean primary key default true check(singleton),revision bigint not null default 0);
insert into sim_murid_private.operations_state values(true,0);
create table sim_murid_private.operations_requests(id uuid primary key,actor uuid not null references public.profiles(id),module text not null,command jsonb not null,result jsonb not null,created_at timestamptz not null default now());
create index operations_requests_actor on sim_murid_private.operations_requests(actor);
create table sim_murid_private.teacher_duty_roster(teacher_id uuid not null references public.profiles(id),weekday integer not null check(weekday between 1 and 6),created_by uuid not null references public.profiles(id),primary key(teacher_id,weekday));
create index duty_roster_actor on sim_murid_private.teacher_duty_roster(created_by);
create table sim_murid_private.teacher_duty_sessions(id uuid primary key default gen_random_uuid(),duty_date date not null,teacher_id uuid not null references public.profiles(id),kind text not null check(kind in('primary','substitute')),replaces_id uuid references public.profiles(id),status text not null check(status in('pending','confirmed','cancelled')),confirmed_by uuid references public.profiles(id),created_by uuid not null references public.profiles(id),updated_at timestamptz not null default now(),unique(duty_date,teacher_id),check((kind='primary' and replaces_id is null)or(kind='substitute' and replaces_id is not null and replaces_id<>teacher_id)));
create index duty_sessions_teacher on sim_murid_private.teacher_duty_sessions(teacher_id,duty_date);
create index duty_sessions_replaces on sim_murid_private.teacher_duty_sessions(replaces_id);
create index duty_sessions_confirmer on sim_murid_private.teacher_duty_sessions(confirmed_by);
create index duty_sessions_creator on sim_murid_private.teacher_duty_sessions(created_by);
create function public.app_ops_today() returns date language sql stable security invoker set search_path='' as $$select (now() at time zone 'Asia/Jakarta')::date$$;
create function public.app_ops_role(p_user uuid,p_role text) returns boolean language sql stable security invoker set search_path='' as $$ select exists(select 1 from public.profiles p join public.user_roles r on r.user_id=p.id where p.id=p_user and p.status='active' and r.role_code=p_role)$$;
create function public.app_ops_manager(p_actor uuid,p_session uuid,p_task text) returns boolean language sql stable security invoker set search_path='' as $$ select public.app_onboarding_ready(p_actor,p_session) and (public.app_education_admin(p_actor,p_session) or public.app_education_task(p_actor,p_task))$$;
create function public.app_ops_student(p_actor uuid,p_session uuid,p_student uuid) returns boolean language sql stable security invoker set search_path='' as $$select public.app_onboarding_ready(p_actor,p_session) and (p_actor=p_student or public.app_education_admin(p_actor,p_session) or public.app_education_task(p_actor,'school_head') or (public.app_ops_role(p_actor,'parent') and exists(select 1 from sim_murid_private.student_guardians where student_id=p_student and parent_id=p_actor and revoked_at is null)))$$;
create function public.app_duty_confirmed(p_actor uuid,p_date date) returns boolean language sql stable security invoker set search_path='' as $$select public.app_ops_role(p_actor,'teacher') and p_date=public.app_ops_today() and exists(select 1 from sim_murid_private.teacher_duty_sessions s where s.teacher_id=p_actor and s.duty_date=p_date and s.status='confirmed' and (s.kind='substitute' or (public.app_education_task(p_actor,'duty_teacher') and exists(select 1 from sim_murid_private.teacher_duty_roster r where r.teacher_id=p_actor and r.weekday=extract(isodow from p_date)))))$$;
create function public.app_duty_mutate(p_actor uuid,p_session uuid,p_command jsonb) returns jsonb language plpgsql security invoker set search_path='' as $$
declare t uuid;replaced uuid;target uuid;days integer[];d integer;row sim_murid_private.teacher_duty_sessions%rowtype;begin
 if not public.app_education_admin(p_actor,p_session) then return jsonb_build_object('code','denied');end if;
 if p_command->>'type'='roster' then
 t=(p_command->>'teacherId')::uuid;
 
 days=array(select jsonb_array_elements_text(p_command->'weekdays')::integer);
 if not public.app_ops_role(t,'teacher') or (not public.app_education_task(t,'duty_teacher') and coalesce(p_command->>'assignTask','false')<>'true') or cardinality(days)<>(select count(distinct x) from unnest(days)x) or exists(select 1 from unnest(days)x where x not between 1 and 6) then return jsonb_build_object('code','invalid');end if;
 if p_command->>'assignTask'='true' and public.app_ops_role(t,'teacher') and not public.app_education_task(t,'duty_teacher') then insert into public.user_assignments(user_id,assignment_code,valid_from,assigned_by) values(t,'duty_teacher',public.app_ops_today(),p_actor);end if;
 delete from sim_murid_private.teacher_duty_roster where teacher_id=t;
 foreach d in array days loop insert into sim_murid_private.teacher_duty_roster values(t,d,p_actor);end loop;
 elsif p_command->>'type' in('primary','appoint') then
 t=(p_command->>'teacherId')::uuid;replaced=(p_command->>'replacesId')::uuid;
 if not public.app_ops_role(t,'teacher') then return jsonb_build_object('code','invalid');end if;
 if p_command->>'type'='primary' then
 if not public.app_education_task(t,'duty_teacher') or not exists(select 1 from sim_murid_private.teacher_duty_roster where teacher_id=t and weekday=extract(isodow from public.app_ops_today())) then return jsonb_build_object('code','invalid');end if;replaced=null;
 else if replaced=t or not public.app_ops_role(replaced,'teacher') or not exists(select 1 from sim_murid_private.teacher_duty_roster where teacher_id=replaced and weekday=extract(isodow from public.app_ops_today())) then return jsonb_build_object('code','invalid');end if;end if;
 if exists(select 1 from sim_murid_private.teacher_duty_sessions where duty_date=public.app_ops_today() and teacher_id=t and status<>'cancelled') then return jsonb_build_object('code','duplicate');end if;
 insert into sim_murid_private.teacher_duty_sessions(duty_date,teacher_id,kind,replaces_id,status,confirmed_by,created_by) values(public.app_ops_today(),t,case when replaced is null then 'primary' else 'substitute' end,replaced,case when replaced is null then 'confirmed' else 'pending' end,case when replaced is null then p_actor end,p_actor)
 on conflict(duty_date,teacher_id) do update set kind=excluded.kind,replaces_id=excluded.replaces_id,status=excluded.status,confirmed_by=excluded.confirmed_by,updated_at=now() returning id into target;
 elsif p_command->>'type' in('confirm','unconfirm','cancel') then
 target=(p_command->>'id')::uuid;select * into row from sim_murid_private.teacher_duty_sessions where id=target and duty_date=public.app_ops_today();if not found then return jsonb_build_object('code','not_found');end if;
 if p_command->>'type'='confirm' and (row.kind<>'substitute' or row.status<>'pending' or not public.app_ops_role(row.teacher_id,'teacher')) then return jsonb_build_object('code','invalid');end if;
 update sim_murid_private.teacher_duty_sessions set status=case p_command->>'type' when 'confirm' then 'confirmed' when 'unconfirm' then case when kind='primary' then 'cancelled' else 'pending' end else 'cancelled' end,confirmed_by=case when p_command->>'type'='confirm' then p_actor end,updated_at=now() where id=target;
 else return jsonb_build_object('code','invalid');end if;return jsonb_build_object('code','saved','id',target);end$$;
do $$declare t text;r record;begin foreach t in array array['operations_state','operations_requests','teacher_duty_roster','teacher_duty_sessions'] loop execute format('alter table sim_murid_private.%I enable row level security',t);execute format('revoke all on table sim_murid_private.%I from public,anon,authenticated',t);execute format('grant select,insert,update,delete on table sim_murid_private.%I to service_role',t);end loop;
 for r in select p.oid::regprocedure as signature from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='public' and p.proname in('app_ops_today','app_ops_role','app_ops_manager','app_ops_student','app_duty_confirmed','app_duty_mutate','app_attendance_access','app_attendance_mutate','app_mentor_access','app_mentoring_mutate','app_natural_key','app_fee_waiver_student','app_fees_mutate') loop execute format('revoke all on function %s from public,anon,authenticated',r.signature);execute format('grant execute on function %s to service_role',r.signature);end loop;end$$;
commit;
