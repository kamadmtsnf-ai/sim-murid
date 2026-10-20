begin;
create table sim_murid_private.enrollments(id uuid primary key default gen_random_uuid(),student_id uuid not null references public.profiles(id),class_id uuid not null,academic_year_id uuid not null references public.academic_years(id),starts_on date not null default ((now() at time zone 'Asia/Jakarta')::date),ended_at timestamptz,created_by uuid not null references public.profiles(id),created_at timestamptz not null default now(),foreign key(class_id,academic_year_id) references public.classes(id,academic_year_id));
create unique index enrollments_current on sim_murid_private.enrollments(student_id,academic_year_id) where ended_at is null;
create index enrollments_class on sim_murid_private.enrollments(class_id,academic_year_id);
create index enrollments_year on sim_murid_private.enrollments(academic_year_id);
create index enrollments_actor on sim_murid_private.enrollments(created_by);
alter table sim_murid_private.enrollments enable row level security;
revoke all on sim_murid_private.enrollments from public,anon,authenticated;
grant select,insert,update,delete on sim_murid_private.enrollments to service_role;
create unique index classes_name_canonical on public.classes(academic_year_id,lower(regexp_replace(name,'\s+','','g')));
create function public.app_class_access(p_actor uuid,p_session uuid,p_class uuid,p_write boolean default false) returns boolean language plpgsql stable security invoker set search_path='' as $$
declare c public.classes%rowtype;role text;begin
 if not public.app_onboarding_ready(p_actor,p_session) then return false;end if;
 select * into c from public.classes where id=p_class;if not found then return false;end if;
 if public.app_education_admin(p_actor,p_session) then return true;end if;
 select role_code into role from public.user_roles where user_id=p_actor;
 if not p_write and public.app_education_task(p_actor,'school_head') then return true;end if;
 if c.archived_at is not null then return false;end if;
 if role='teacher' and (c.homeroom_teacher_id=p_actor or public.app_education_task(p_actor,'homeroom_teacher',c.id)) then return true;end if;
 if p_write then return false;end if;
 if role='teacher' and to_regclass('sim_murid_private.lesson_schedules') is not null then
  if exists(select 1 from sim_murid_private.lesson_schedules where class_id=p_class and teacher_id=p_actor and archived_at is null) then return true;end if;
 end if;
 if role='student' then return exists(select 1 from sim_murid_private.enrollments e join public.academic_years y on y.id=e.academic_year_id where e.class_id=p_class and e.student_id=p_actor and e.ended_at is null and e.starts_on<=(now() at time zone 'Asia/Jakarta')::date and y.is_active);end if;
 if role='parent' then return exists(select 1 from sim_murid_private.enrollments e join public.academic_years y on y.id=e.academic_year_id join sim_murid_private.student_guardians g on g.student_id=e.student_id where e.class_id=p_class and g.parent_id=p_actor and g.revoked_at is null and e.ended_at is null and e.starts_on<=(now() at time zone 'Asia/Jakarta')::date and y.is_active);end if;
 return false;
end;$$;
create function public.app_classes_read(p_actor uuid,p_session uuid,p_year uuid default null) returns jsonb language plpgsql stable security invoker set search_path='' as $$
declare admin boolean;begin
 if not public.app_onboarding_ready(p_actor,p_session) then return null;end if;admin=public.app_education_admin(p_actor,p_session);
 return jsonb_build_object('revision',(select revision from sim_murid_private.education_state),'can_manage',admin,
 'years',(select coalesce(jsonb_agg(to_jsonb(y) order by y.start_year desc),'[]') from public.academic_years y),
 'classes',(select coalesce(jsonb_agg(jsonb_build_object('id',c.id,'year_id',c.academic_year_id,'level',c.level,'name',c.name,'teacher_id',c.homeroom_teacher_id,'teacher_name',p.full_name,'archived',c.archived_at is not null,'can_schedule',public.app_class_access(p_actor,p_session,c.id,true),'students',(select coalesce(jsonb_agg(jsonb_build_object('id',q.id,'username',q.username,'name',q.full_name,'enrollment_id',e.id,'starts_on',e.starts_on,'status',q.status) order by q.full_name,q.id),'[]') from sim_murid_private.enrollments e join public.profiles q on q.id=e.student_id where e.class_id=c.id and e.ended_at is null and (admin or public.app_education_task(p_actor,'school_head') or exists(select 1 from public.user_roles where user_id=p_actor and role_code='teacher') or q.id=p_actor or exists(select 1 from sim_murid_private.student_guardians where parent_id=p_actor and student_id=q.id and revoked_at is null)))) order by c.level,c.name,c.id),'[]') from public.classes c left join public.profiles p on p.id=c.homeroom_teacher_id where (p_year is null or c.academic_year_id=p_year) and public.app_class_access(p_actor,p_session,c.id,false)),
 'teachers',case when admin then (select coalesce(jsonb_agg(jsonb_build_object('id',p.id,'username',p.username,'name',p.full_name) order by p.full_name,p.id),'[]') from public.profiles p join public.user_roles r on r.user_id=p.id where p.status='active' and r.role_code='teacher') else '[]'::jsonb end,
 'students',case when admin then (select coalesce(jsonb_agg(jsonb_build_object('id',p.id,'username',p.username,'name',p.full_name) order by p.full_name,p.id),'[]') from public.profiles p join public.user_roles r on r.user_id=p.id where p.status='active' and r.role_code='student') else '[]'::jsonb end);
end;$$;
create function public.app_classes_write(p_actor uuid,p_session uuid,p_request uuid,p_revision bigint,p_command jsonb) returns jsonb language plpgsql security invoker set search_path='' as $$
declare version bigint;old sim_murid_private.education_requests%rowtype;target uuid;y uuid;teacher uuid;members uuid[];result jsonb;startyear integer;begin
 perform 1 from public.profiles where id=p_actor for share;perform 1 from public.user_roles where user_id=p_actor for share;
 if not public.app_education_admin(p_actor,p_session) then return jsonb_build_object('code','denied');end if;
 select revision into version from sim_murid_private.education_state for update;
 select * into old from sim_murid_private.education_requests where id=p_request;
 if found then if old.actor=p_actor and old.command=p_command then return old.result;end if;return jsonb_build_object('code','request_conflict');end if;
 if version is distinct from p_revision then return jsonb_build_object('code','stale');end if;
 if p_command->>'type'='year' then
  startyear=(p_command->>'startYear')::integer;if startyear not between 1900 and 2199 then return jsonb_build_object('code','invalid');end if;
  insert into public.academic_years(start_year) values(startyear) returning id into target;
  insert into public.semesters(academic_year_id,year_start,number) values(target,startyear,1),(target,startyear,2);
 elsif p_command->>'type'='year_activate' then
  target=(p_command->>'id')::uuid;if not exists(select 1 from public.academic_years where id=target) then return jsonb_build_object('code','not_found');end if;
  update public.academic_years set is_active=false where is_active;update public.academic_years set is_active=true where id=target;
 elsif p_command->>'type'='class' then
  target=(p_command->>'id')::uuid;y=(p_command->>'yearId')::uuid;teacher=(p_command->>'teacherId')::uuid;
  if (p_command->>'level')::integer not in(7,8,9) or length(btrim(p_command->>'name')) not between 1 and 50 or not exists(select 1 from public.academic_years where id=y) or (teacher is not null and not exists(select 1 from public.profiles p join public.user_roles r on r.user_id=p.id where p.id=teacher and p.status='active' and r.role_code='teacher')) then return jsonb_build_object('code','invalid');end if;
  if target is null then insert into public.classes(academic_year_id,level,name,homeroom_teacher_id) values(y,(p_command->>'level')::integer,btrim(p_command->>'name'),teacher) returning id into target;
  else update public.classes set level=(p_command->>'level')::integer,name=btrim(p_command->>'name'),homeroom_teacher_id=teacher where id=target and academic_year_id=y and archived_at is null;if not found then return jsonb_build_object('code','not_found');end if;end if;
 elsif p_command->>'type'='class_archive' then
  target=(p_command->>'id')::uuid;
  if exists(select 1 from sim_murid_private.enrollments where class_id=target and ended_at is null) then return jsonb_build_object('code','class_in_use');end if;
  update public.classes set archived_at=now() where id=target and archived_at is null;if not found then return jsonb_build_object('code','not_found');end if;
 elsif p_command->>'type'='enrollment' then
  target=(p_command->>'classId')::uuid;select academic_year_id into y from public.classes where id=target and archived_at is null;if y is null then return jsonb_build_object('code','not_found');end if;
  members=array(select jsonb_array_elements_text(p_command->'studentIds')::uuid);
  if cardinality(members) not between 1 and 500 or cardinality(members)<>(select count(distinct x) from unnest(members)x) or exists(select 1 from unnest(members)x where not exists(select 1 from public.profiles p join public.user_roles r on r.user_id=p.id where p.id=x and p.status='active' and r.role_code='student')) then return jsonb_build_object('code','invalid');end if;
  if (p_command->>'remove')::boolean then update sim_murid_private.enrollments set ended_at=now() where student_id=any(members) and class_id=target and ended_at is null;
  else
   update sim_murid_private.enrollments set ended_at=now() where student_id=any(members) and academic_year_id=y and class_id<>target and ended_at is null;
   insert into sim_murid_private.enrollments(student_id,class_id,academic_year_id,starts_on,created_by) select x,target,y,(p_command->>'startsOn')::date,p_actor from unnest(members)x where not exists(select 1 from sim_murid_private.enrollments where student_id=x and academic_year_id=y and ended_at is null);
  end if;
  if to_regclass('sim_murid_private.student_duty_assignments') is not null then
   update sim_murid_private.student_duty_assignments d set archived_at=now() where d.student_id=any(members) and d.archived_at is null and not exists(select 1 from sim_murid_private.enrollments e where e.student_id=d.student_id and e.class_id=d.class_id and e.ended_at is null);
  end if;
 else return jsonb_build_object('code','invalid');end if;
 update sim_murid_private.education_state set revision=revision+1;
 result=jsonb_build_object('code','saved','id',target);insert into sim_murid_private.education_requests(id,actor,target,command,result) values(p_request,p_actor,target,p_command,result);
 insert into sim_murid_private.activity_logs(actor_id,actor_kind,action,entity_type,entity_id,request_id) values(p_actor,'user','classes.'||(p_command->>'type'),'class',target,p_request);
 return result;
exception when unique_violation then return jsonb_build_object('code','duplicate');when invalid_text_representation or check_violation or invalid_datetime_format or datetime_field_overflow then return jsonb_build_object('code','invalid');end;$$;
revoke all on function public.app_class_access(uuid,uuid,uuid,boolean),public.app_classes_read(uuid,uuid,uuid),public.app_classes_write(uuid,uuid,uuid,bigint,jsonb) from public,anon,authenticated;
grant execute on function public.app_class_access(uuid,uuid,uuid,boolean),public.app_classes_read(uuid,uuid,uuid),public.app_classes_write(uuid,uuid,uuid,bigint,jsonb) to service_role;
commit;
