
begin;
create table sim_murid_private.student_attendance(id uuid primary key default gen_random_uuid(),student_id uuid not null references public.profiles(id),class_id uuid not null references public.classes(id),attendance_date date not null,status text not null check(status in('Hadir','Sakit','Izin','Alpha')),notes text not null default '' check(length(notes)<=2000),recorded_by uuid not null references public.profiles(id),created_at timestamptz not null default now(),updated_at timestamptz not null default now(),voided_at timestamptz);
create unique index student_attendance_daily on sim_murid_private.student_attendance(student_id,attendance_date) where voided_at is null;
create index attendance_class_date on sim_murid_private.student_attendance(class_id,attendance_date);
create index attendance_recorder on sim_murid_private.student_attendance(recorded_by);
create function public.app_attendance_access(p_actor uuid,p_session uuid,p_student uuid,p_class uuid,p_date date,p_write boolean default false) returns boolean language sql stable security invoker set search_path='' as $$
select public.app_onboarding_ready(p_actor,p_session) and (public.app_education_admin(p_actor,p_session) or case when p_write then public.app_duty_confirmed(p_actor,p_date) else public.app_ops_student(p_actor,p_session,p_student) or public.app_duty_confirmed(p_actor,public.app_ops_today()) or exists(select 1 from public.classes c where c.id=p_class and (c.homeroom_teacher_id=p_actor or public.app_education_task(p_actor,'homeroom_teacher',p_class))) end)$$;
create function public.app_attendance_mutate(p_actor uuid,p_session uuid,p_command jsonb) returns jsonb language plpgsql security invoker set search_path='' as $$
declare item jsonb;sid uuid;cid uuid;dt date;target uuid;row sim_murid_private.student_attendance%rowtype;begin
 if p_command->>'type'='batch' then
 if jsonb_typeof(p_command->'items') is distinct from 'array' or jsonb_array_length(p_command->'items') not between 1 and 500 then return jsonb_build_object('code','invalid');end if;
 if exists(select 1 from jsonb_array_elements(p_command->'items') x group by x->>'studentId',x->>'date' having count(*)>1) then return jsonb_build_object('code','duplicate');end if;
 for item in select value from jsonb_array_elements(p_command->'items') loop
 sid=(item->>'studentId')::uuid;cid=(item->>'classId')::uuid;dt=(item->>'date')::date;
 if not public.app_attendance_access(p_actor,p_session,sid,cid,dt,true) then return jsonb_build_object('code','denied');end if;
 if dt>public.app_ops_today() or extract(isodow from dt)=7 or exists(select 1 from public.holidays where holiday_date=dt) or not public.app_ops_role(sid,'student') or not exists(select 1 from sim_murid_private.enrollments e where e.student_id=sid and e.class_id=cid and e.starts_on<=dt and (e.ended_at is null or (e.ended_at at time zone 'Asia/Jakarta')::date>dt)) or item->>'status' not in('Hadir','Sakit','Izin','Alpha') then return jsonb_build_object('code','invalid');end if;
 if exists(select 1 from sim_murid_private.student_attendance where student_id=sid and attendance_date=dt and voided_at is null) then return jsonb_build_object('code','duplicate');end if;
 end loop;
 insert into sim_murid_private.student_attendance(student_id,class_id,attendance_date,status,notes,recorded_by) select (x->>'studentId')::uuid,(x->>'classId')::uuid,(x->>'date')::date,x->>'status',coalesce(x->>'notes',''),p_actor from jsonb_array_elements(p_command->'items')x;
 elsif p_command->>'type' in('edit','void') then
 target=(p_command->>'id')::uuid;select * into row from sim_murid_private.student_attendance where id=target and voided_at is null;if not found then return jsonb_build_object('code','not_found');end if;
 if not public.app_attendance_access(p_actor,p_session,row.student_id,row.class_id,row.attendance_date,true) or (not public.app_education_admin(p_actor,p_session) and row.recorded_by<>p_actor) then return jsonb_build_object('code','denied');end if;
 if p_command->>'type'='void' then update sim_murid_private.student_attendance set voided_at=now(),updated_at=now() where id=target;
 else if p_command->>'status' not in('Hadir','Sakit','Izin','Alpha') then return jsonb_build_object('code','invalid');end if;update sim_murid_private.student_attendance set status=p_command->>'status',notes=coalesce(p_command->>'notes',''),updated_at=now() where id=target;end if;
 else return jsonb_build_object('code','invalid');end if;return jsonb_build_object('code','saved','id',target);end$$;
do $$declare t text;r record;begin foreach t in array array['student_attendance'] loop execute format('alter table sim_murid_private.%I enable row level security',t);execute format('revoke all on table sim_murid_private.%I from public,anon,authenticated',t);execute format('grant select,insert,update,delete on table sim_murid_private.%I to service_role',t);end loop;
 for r in select p.oid::regprocedure as signature from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='public' and p.proname in('app_ops_today','app_ops_role','app_ops_manager','app_ops_student','app_duty_confirmed','app_duty_mutate','app_attendance_access','app_attendance_mutate','app_mentor_access','app_mentoring_mutate','app_natural_key','app_fee_waiver_student','app_fees_mutate') loop execute format('revoke all on function %s from public,anon,authenticated',r.signature);execute format('grant execute on function %s to service_role',r.signature);end loop;end$$;
commit;
