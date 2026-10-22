-- Keep production safeupdate enabled. Scope state/settings updates to their sole existing row.
begin;
-- Existing app_family_write; only the singleton UPDATE predicate changes.
create or replace function public.app_family_write(p_actor uuid,p_session uuid,p_request uuid,p_revision bigint,p_command jsonb) returns jsonb language plpgsql security invoker set search_path='' as $$
declare version bigint;old sim_murid_private.education_requests%rowtype;result jsonb;target uuid;student uuid;parent uuid;members uuid[];begin
 perform 1 from public.profiles where id=p_actor for share;perform 1 from public.user_roles where user_id=p_actor for share;
 if not public.app_education_admin(p_actor,p_session) then return jsonb_build_object('code','denied');end if;
 select revision into version from sim_murid_private.education_state for update;
 select * into old from sim_murid_private.education_requests where id=p_request;
 if found then if old.actor=p_actor and old.command=p_command then return old.result;end if;return jsonb_build_object('code','request_conflict');end if;
 if p_revision is distinct from version then return jsonb_build_object('code','stale');end if;
 if p_command->>'type'='guardian' then
  student=(p_command->>'studentId')::uuid;parent=(p_command->>'parentId')::uuid;
  if p_command->>'relationship' not in('father','mother','guardian') or not exists(select 1 from public.user_roles r join public.profiles p on p.id=r.user_id where p.id=student and p.status='active' and r.role_code in('student','applicant')) or not exists(select 1 from public.user_roles r join public.profiles p on p.id=r.user_id where p.id=parent and p.status='active' and r.role_code='parent') then return jsonb_build_object('code','invalid');end if;
  if (p_command->>'remove')::boolean then update sim_murid_private.student_guardians set revoked_at=now() where student_id=student and parent_id=parent and relationship=p_command->>'relationship' and revoked_at is null;
  else insert into sim_murid_private.student_guardians(student_id,parent_id,relationship,verified_by) values(student,parent,p_command->>'relationship',p_actor) on conflict(student_id,parent_id,relationship) where revoked_at is null do nothing;end if;target=student;
 elsif p_command->>'type'='family' then
  members=array(select jsonb_array_elements_text(p_command->'studentIds')::uuid);
  if cardinality(members) not between 1 and 30 or cardinality(members)<>(select count(distinct x) from unnest(members)x) or length(btrim(p_command->>'name')) not between 1 and 150 or exists(select 1 from unnest(members)x where not exists(select 1 from public.user_roles r join public.profiles p on p.id=r.user_id where p.id=x and p.status='active' and r.role_code in('student','applicant'))) then return jsonb_build_object('code','invalid');end if;
  target=(p_command->>'id')::uuid;
  if target is null then insert into sim_murid_private.family_groups(name,created_by) values(btrim(p_command->>'name'),p_actor) returning id into target;
  else update sim_murid_private.family_groups set name=btrim(p_command->>'name') where id=target;if not found then return jsonb_build_object('code','not_found');end if;end if;
  update sim_murid_private.family_members set revoked_at=now() where revoked_at is null and ((family_id=target and not(student_id=any(members))) or (family_id<>target and student_id=any(members)));
  insert into sim_murid_private.family_members(family_id,student_id,created_by) select target,x,p_actor from unnest(members)x where not exists(select 1 from sim_murid_private.family_members where family_id=target and student_id=x and revoked_at is null);
 else return jsonb_build_object('code','invalid');end if;
 update sim_murid_private.education_state set revision=revision+1 where singleton=true;
 result=jsonb_build_object('code','saved','id',target);
 insert into sim_murid_private.education_requests(id,actor,target,command,result) values(p_request,p_actor,target,p_command,result);
 insert into sim_murid_private.activity_logs(actor_id,actor_kind,action,entity_type,entity_id,request_id) values(p_actor,'user','family.'||(p_command->>'type'),'family',target,p_request);
 return result;
exception when unique_violation then return jsonb_build_object('code','duplicate');when invalid_text_representation or check_violation then return jsonb_build_object('code','invalid');end;$$;

-- Existing app_classes_write; only the singleton UPDATE predicate changes.
create or replace function public.app_classes_write(p_actor uuid,p_session uuid,p_request uuid,p_revision bigint,p_command jsonb) returns jsonb language plpgsql security invoker set search_path='' as $$
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
  if cardinality(members) not between 1 and 500 or cardinality(members)<>(select count(distinct x) from unnest(members)x) then return jsonb_build_object('code','invalid');end if;
  if (p_command->>'remove')::boolean then
   if exists(select 1 from unnest(members)x where not exists(select 1 from sim_murid_private.enrollments e where e.student_id=x and e.class_id=target and e.ended_at is null)) then return jsonb_build_object('code','not_found');end if;
   update sim_murid_private.enrollments set ended_at=now() where student_id=any(members) and class_id=target and ended_at is null;
  else
   if exists(select 1 from unnest(members)x where not exists(select 1 from public.profiles p join public.user_roles r on r.user_id=p.id where p.id=x and p.status='active' and r.role_code='student')) then return jsonb_build_object('code','invalid');end if;
   update sim_murid_private.enrollments set ended_at=now() where student_id=any(members) and academic_year_id=y and class_id<>target and ended_at is null;
   insert into sim_murid_private.enrollments(student_id,class_id,academic_year_id,starts_on,created_by) select x,target,y,(p_command->>'startsOn')::date,p_actor from unnest(members)x where not exists(select 1 from sim_murid_private.enrollments where student_id=x and academic_year_id=y and ended_at is null);
  end if;
  if to_regclass('sim_murid_private.student_duty_assignments') is not null then
   update sim_murid_private.student_duty_assignments d set archived_at=now() where d.student_id=any(members) and d.archived_at is null and not exists(select 1 from sim_murid_private.enrollments e where e.student_id=d.student_id and e.class_id=d.class_id and e.ended_at is null);
  end if;
 else return jsonb_build_object('code','invalid');end if;
 update sim_murid_private.education_state set revision=revision+1 where singleton=true;
 result=jsonb_build_object('code','saved','id',target);insert into sim_murid_private.education_requests(id,actor,target,command,result) values(p_request,p_actor,target,p_command,result);
 insert into sim_murid_private.activity_logs(actor_id,actor_kind,action,entity_type,entity_id,request_id) values(p_actor,'user','classes.'||(p_command->>'type'),'class',target,p_request);
 return result;
exception when unique_violation then return jsonb_build_object('code','duplicate');when invalid_text_representation or check_violation or invalid_datetime_format or datetime_field_overflow then return jsonb_build_object('code','invalid');end;$$;

-- Existing app_schedules_write; only the singleton UPDATE predicate changes.
create or replace function public.app_schedules_write(p_actor uuid,p_session uuid,p_request uuid,p_revision bigint,p_command jsonb) returns jsonb language plpgsql security invoker set search_path='' as $$
declare version bigint;old sim_murid_private.education_requests%rowtype;target uuid;class uuid;previous_class uuid;y uuid;teacher uuid;subject uuid;startmin integer;endmin integer;day integer;duration integer;units integer;rest integer;item jsonb;lesson_ids uuid[];duty_ids uuid[];result jsonb;begin
 perform 1 from public.profiles where id=p_actor for share;perform 1 from public.user_roles where user_id=p_actor for share;
 if not public.app_onboarding_ready(p_actor,p_session) then return jsonb_build_object('code','denied');end if;
 select revision into version from sim_murid_private.education_state for update;
 select * into old from sim_murid_private.education_requests where id=p_request;
 if found then if old.actor=p_actor and old.command=p_command then return old.result;end if;return jsonb_build_object('code','request_conflict');end if;
 if version is distinct from p_revision then return jsonb_build_object('code','stale');end if;
 if p_command->>'type' in('lesson','duties') then
  class=(p_command->>'classId')::uuid;
  if not public.app_class_access(p_actor,p_session,class,true) then return jsonb_build_object('code','denied');end if;
  select academic_year_id into y from public.classes where id=class and archived_at is null;if y is null then return jsonb_build_object('code','not_found');end if;
 end if;
 if p_command->>'type'='lesson' then
  target=(p_command->>'id')::uuid;teacher=(p_command->>'teacherId')::uuid;subject=(p_command->>'subjectId')::uuid;day=(p_command->>'weekday')::integer;duration=(p_command->>'durationMinutes')::integer;units=(p_command->>'jtm')::integer;rest=(p_command->>'breakMinutes')::integer;
  if p_command->>'start'!~'^([01][0-9]|2[0-3]):[0-5][0-9]$' or day not between 1 and 7 or duration not between 1 and 240 or units not between 1 and 12 or rest not between 0 and 240 then return jsonb_build_object('code','invalid');end if;
  startmin=split_part(p_command->>'start',':',1)::integer*60+split_part(p_command->>'start',':',2)::integer;endmin=startmin+duration*units+rest;
  if endmin>=1440 or not exists(select 1 from public.profiles p join public.user_roles r on r.user_id=p.id where p.id=teacher and p.status='active' and r.role_code='teacher') or not exists(select 1 from public.subjects where id=subject and active) then return jsonb_build_object('code','invalid');end if;
  if target is not null then select class_id into previous_class from sim_murid_private.lesson_schedules where id=target and archived_at is null;if previous_class is null then return jsonb_build_object('code','not_found');end if;if not public.app_class_access(p_actor,p_session,previous_class,true) then return jsonb_build_object('code','denied');end if;end if;
  if exists(select 1 from sim_murid_private.lesson_schedules l join public.classes c on c.id=l.class_id where l.academic_year_id=y and l.weekday=day and l.archived_at is null and c.archived_at is null and l.id is distinct from target and(l.class_id=class or l.teacher_id=teacher) and l.start_minute<endmin and l.end_minute>startmin) then return jsonb_build_object('code','overlap');end if;
  if target is null then insert into sim_murid_private.lesson_schedules(class_id,academic_year_id,subject_id,teacher_id,weekday,start_minute,duration_minutes,jtm,break_minutes,created_by) values(class,y,subject,teacher,day,startmin,duration,units,rest,p_actor) returning id into target;
  else update sim_murid_private.lesson_schedules set class_id=class,academic_year_id=y,subject_id=subject,teacher_id=teacher,weekday=day,start_minute=startmin,duration_minutes=duration,jtm=units,break_minutes=rest,updated_at=now() where id=target;end if;
 elsif p_command->>'type'='duties' then
  if jsonb_typeof(p_command->'items') is distinct from 'array' or jsonb_array_length(p_command->'items')>500 then return jsonb_build_object('code','invalid');end if;
  if exists(select 1 from jsonb_array_elements(p_command->'items')x group by x->>'studentId',x->>'weekday' having count(*)>1) then return jsonb_build_object('code','duplicate');end if;
  for item in select value from jsonb_array_elements(p_command->'items') loop
   if (item->>'weekday')::integer not between 1 and 7 or not exists(select 1 from sim_murid_private.enrollments e join public.profiles p on p.id=e.student_id join public.user_roles r on r.user_id=p.id where e.class_id=class and e.student_id=(item->>'studentId')::uuid and e.ended_at is null and r.role_code='student' and p.status='active') then return jsonb_build_object('code','invalid_membership');end if;
  end loop;
  update sim_murid_private.student_duty_assignments set archived_at=now() where class_id=class and archived_at is null;
  insert into sim_murid_private.student_duty_assignments(class_id,academic_year_id,student_id,weekday,created_by) select class,y,(x->>'studentId')::uuid,(x->>'weekday')::integer,p_actor from jsonb_array_elements(p_command->'items')x;target=class;
 elsif p_command->>'type'='schedule_delete' then
  lesson_ids=array(select jsonb_array_elements_text(p_command->'lessonIds')::uuid);duty_ids=array(select jsonb_array_elements_text(p_command->'dutyIds')::uuid);
  if cardinality(lesson_ids)+cardinality(duty_ids) not between 1 and 500 or cardinality(lesson_ids)<>(select count(distinct x) from unnest(lesson_ids)x) or cardinality(duty_ids)<>(select count(distinct x) from unnest(duty_ids)x) then return jsonb_build_object('code','invalid');end if;
  if (select count(*) from sim_murid_private.lesson_schedules where id=any(lesson_ids) and archived_at is null)<>cardinality(lesson_ids) or(select count(*) from sim_murid_private.student_duty_assignments where id=any(duty_ids) and archived_at is null)<>cardinality(duty_ids) then return jsonb_build_object('code','not_found');end if;
  if exists(select 1 from sim_murid_private.lesson_schedules where id=any(lesson_ids) and not public.app_class_access(p_actor,p_session,class_id,true)) or exists(select 1 from sim_murid_private.student_duty_assignments where id=any(duty_ids) and not public.app_class_access(p_actor,p_session,class_id,true)) then return jsonb_build_object('code','denied');end if;
  update sim_murid_private.lesson_schedules set archived_at=now(),updated_at=now() where id=any(lesson_ids);update sim_murid_private.student_duty_assignments set archived_at=now() where id=any(duty_ids);
 else return jsonb_build_object('code','invalid');end if;
 update sim_murid_private.education_state set revision=revision+1 where singleton=true;
 result=jsonb_build_object('code','saved','id',target);insert into sim_murid_private.education_requests(id,actor,target,command,result) values(p_request,p_actor,target,p_command,result);
 insert into sim_murid_private.activity_logs(actor_id,actor_kind,action,entity_type,entity_id,request_id) values(p_actor,'user','schedules.'||(p_command->>'type'),'schedule',target,p_request);
 return result;
exception when unique_violation then return jsonb_build_object('code','duplicate');when invalid_text_representation or check_violation or not_null_violation then return jsonb_build_object('code','invalid');end;$$;

-- Existing app_operations_write; only the singleton UPDATE predicate changes.
create or replace function public.app_operations_write(p_actor uuid,p_session uuid,p_request uuid,p_revision bigint,p_module text,p_command jsonb) returns jsonb language plpgsql security invoker set search_path='' as $$
declare version bigint;old sim_murid_private.operations_requests%rowtype;result jsonb;before_image jsonb;begin
 perform 1 from public.profiles where id=p_actor for share;perform 1 from public.user_roles where user_id=p_actor for share;
 if not public.app_onboarding_ready(p_actor,p_session) then return jsonb_build_object('code','denied');end if;
 if not (case p_module when 'duty' then public.app_education_admin(p_actor,p_session) when 'attendance' then public.app_education_admin(p_actor,p_session) or public.app_duty_confirmed(p_actor,public.app_ops_today()) when 'mentoring' then public.app_education_admin(p_actor,p_session) or public.app_education_task(p_actor,'student_mentor') when 'fees' then public.app_ops_manager(p_actor,p_session,'committee_treasurer') when 'savings' then public.app_ops_manager(p_actor,p_session,'savings_manager') else false end) then return jsonb_build_object('code','denied');end if;
 select revision into version from sim_murid_private.operations_state for update;
 select * into old from sim_murid_private.operations_requests where id=p_request;
 if found then if old.actor=p_actor and old.module=p_module and old.command=p_command then return old.result;end if;return jsonb_build_object('code','request_conflict');end if;
 if version is distinct from p_revision then return jsonb_build_object('code','stale');end if;
 if p_module not in('duty','attendance','mentoring','fees','savings') or jsonb_typeof(p_command) is distinct from 'object' or p_command->>'type' is null then return jsonb_build_object('code','invalid');end if;
 if p_command->>'type' in('void','edit','unconfirm','cancel') or (p_command->>'id') is not null then
 if coalesce(length(btrim(p_command->>'reason')),0) not between 3 and 2000 then return jsonb_build_object('code','invalid');end if;end if;
 if p_command->>'id' is not null then
 case p_module when 'duty' then select to_jsonb(t) into before_image from sim_murid_private.teacher_duty_sessions t where id=(p_command->>'id')::uuid;
 when 'attendance' then select to_jsonb(t) into before_image from sim_murid_private.student_attendance t where id=(p_command->>'id')::uuid;
 when 'mentoring' then select to_jsonb(t) into before_image from sim_murid_private.mentoring_reports t where id=(p_command->>'id')::uuid;
 when 'fees' then select to_jsonb(t)||jsonb_build_object('allocations',(select jsonb_agg(a) from sim_murid_private.payment_allocations a where a.payment_id=t.id and a.voided_at is null)) into before_image from sim_murid_private.committee_payments t where id=(p_command->>'id')::uuid;
 when 'savings' then select to_jsonb(t) into before_image from sim_murid_private.savings_transactions t where id=(p_command->>'id')::uuid;end case;end if;
 case p_module
 when 'duty' then result=public.app_duty_mutate(p_actor,p_session,p_command);
 when 'attendance' then result=public.app_attendance_mutate(p_actor,p_session,p_command);
 when 'mentoring' then result=public.app_mentoring_mutate(p_actor,p_session,p_command);
 when 'fees' then result=public.app_fees_mutate(p_actor,p_session,p_command);
 when 'savings' then result=public.app_savings_mutate(p_actor,p_session,p_command);end case;
 if result->>'code'='saved' then
 update sim_murid_private.operations_state set revision=revision+1 where singleton=true;
 insert into sim_murid_private.operations_requests(id,actor,module,command,result) values(p_request,p_actor,p_module,p_command,result);
 insert into sim_murid_private.activity_logs(actor_id,actor_kind,action,entity_type,entity_id,request_id,metadata) values(p_actor,'user',p_module||'.'||(p_command->>'type'),p_module,(result->>'id')::uuid,p_request,jsonb_build_object('reason',p_command->>'reason','before',before_image,'command',p_command));
 end if;return result;
exception when unique_violation then return jsonb_build_object('code','duplicate');when invalid_text_representation or check_violation or not_null_violation or foreign_key_violation or invalid_datetime_format or datetime_field_overflow or numeric_value_out_of_range then return jsonb_build_object('code','invalid');end$$;

-- Existing app_learning_write; only the singleton UPDATE predicate changes.
create or replace function public.app_learning_write(p_actor uuid,p_session uuid,p_request uuid,p_revision bigint,p_module text,p_command jsonb) returns jsonb language plpgsql security invoker set search_path='' as $$declare old sim_murid_private.operations_requests%rowtype;v bigint;r jsonb;target uuid;snap jsonb;item jsonb;cls uuid;sub uuid;before_image jsonb;begin
 if not public.app_onboarding_ready(p_actor,p_session) then return jsonb_build_object('code','denied');end if;
 if p_module in('books','promotions') and not public.app_education_admin(p_actor,p_session) then return jsonb_build_object('code','denied');end if;
 if p_module='grades' then cls=(p_command->>'classId')::uuid;sub=(p_command->>'subjectId')::uuid;if p_command->>'id' is not null then select class_id,subject_id into cls,sub from sim_murid_private.assessments where id=(p_command->>'id')::uuid;end if;if not public.app_teaching_access(p_actor,p_session,cls,sub,true) then return jsonb_build_object('code','denied');end if;end if;
 if p_module='reports' and not(public.app_education_admin(p_actor,p_session) or exists(select 1 from public.classes where id=(p_command->>'classId')::uuid and homeroom_teacher_id=p_actor)) then return jsonb_build_object('code','denied');end if;
 select revision into v from sim_murid_private.operations_state for update;
 select * into old from sim_murid_private.operations_requests where id=p_request;if found then if old.actor=p_actor and old.module='learning:'||p_module and old.command=p_command then return old.result;end if;return jsonb_build_object('code','request_conflict');end if;
 if v is distinct from p_revision then return jsonb_build_object('code','stale');end if;
 if p_module='grades' and p_command->>'id' is null and p_command->>'type'='batch' and p_command->>'kind'<>'PH' then select id into target from sim_murid_private.assessments where class_id=cls and subject_id=sub and semester=case when extract(month from (p_command->>'date')::date)>=7 then 1 else 2 end and kind=p_command->>'kind' and voided_at is null;else target=(p_command->>'id')::uuid;end if;
 if p_module='grades' and target is not null then select to_jsonb(a)||jsonb_build_object('scores',(select jsonb_agg(sc) from sim_murid_private.assessment_scores sc where sc.assessment_id=a.id)) into before_image from sim_murid_private.assessments a where a.id=target;end if;
 if p_module='grades' then r=public.app_grades_mutate(p_actor,p_session,p_command);
 elsif p_module='promotions' then r=public.app_promotions_mutate(p_actor,p_session,p_command);
 elsif p_module='reports' and p_command->>'type'='publish' then
 cls=(p_command->>'classId')::uuid;
 if not(public.app_education_admin(p_actor,p_session) or exists(select 1 from public.classes where id=cls and homeroom_teacher_id=p_actor)) then return jsonb_build_object('code','denied');end if;
 if jsonb_array_length(p_command->'studentIds') not between 1 and 500 then return jsonb_build_object('code','invalid');end if;
 for item in select value from jsonb_array_elements(p_command->'studentIds') loop
 snap=public.app_report_draft(p_actor,p_session,(item#>>'{}')::uuid,cls,(p_command->>'semester')::integer);
 if snap is null or jsonb_array_length(snap->'subjects')=0 or exists(select 1 from jsonb_array_elements(snap->'subjects')x where x->>'complete'<>'true') then return jsonb_build_object('code','incomplete');end if;
 if exists(select 1 from sim_murid_private.report_snapshots where student_id=(item#>>'{}')::uuid and class_id=cls and semester=(p_command->>'semester')::integer) then return jsonb_build_object('code','published');end if;
 end loop;
 for item in select value from jsonb_array_elements(p_command->'studentIds') loop
 snap=public.app_report_draft(p_actor,p_session,(item#>>'{}')::uuid,cls,(p_command->>'semester')::integer);
 insert into sim_murid_private.report_snapshots(student_id,class_id,academic_year_id,semester,snapshot,published_by) select (item#>>'{}')::uuid,cls,academic_year_id,(p_command->>'semester')::integer,jsonb_set(snap,'{draft}','false'),p_actor from public.classes where id=cls returning id into target;end loop;r=jsonb_build_object('code','saved','id',target);
 elsif p_module='books' then
 if not public.app_education_admin(p_actor,p_session) then return jsonb_build_object('code','denied');end if;target=(p_command->>'id')::uuid;
 if target is not null and not exists(select 1 from sim_murid_private.digital_books where id=target) then return jsonb_build_object('code','not_found');end if;
 if p_command->>'type'='void' then update sim_murid_private.digital_books set active=false,updated_at=now() where id=target;r=jsonb_build_object('code','saved','id',target);
 elsif p_command->>'type'='book' then
 if target is null then insert into sim_murid_private.digital_books(title,author,publisher,publication_year,version,category,subject_id,level,external_url,premium,created_by) values(p_command->>'title',coalesce(p_command->>'author',''),coalesce(p_command->>'publisher',''),(p_command->>'year')::integer,coalesce(p_command->>'version',''),coalesce(p_command->>'category',''),(p_command->>'subjectId')::uuid,(p_command->>'level')::integer,nullif(p_command->>'url',''),(p_command->>'premium')::boolean,p_actor) returning id into target;
 else update sim_murid_private.digital_books set title=p_command->>'title',author=coalesce(p_command->>'author',''),publisher=coalesce(p_command->>'publisher',''),publication_year=(p_command->>'year')::integer,version=coalesce(p_command->>'version',''),category=coalesce(p_command->>'category',''),subject_id=(p_command->>'subjectId')::uuid,level=(p_command->>'level')::integer,external_url=nullif(p_command->>'url',''),premium=(p_command->>'premium')::boolean,updated_at=now() where id=target;end if;r=jsonb_build_object('code','saved','id',target);
 else return jsonb_build_object('code','invalid');end if;
 else return jsonb_build_object('code','invalid');end if;
 if r->>'code'='saved' then update sim_murid_private.operations_state set revision=revision+1 where singleton=true;
 insert into sim_murid_private.operations_requests(id,actor,module,command,result) values(p_request,p_actor,'learning:'||p_module,p_command,r);
 insert into sim_murid_private.activity_logs(actor_id,actor_kind,action,entity_type,entity_id,request_id,metadata) values(p_actor,'user',p_module||'.'||(p_command->>'type'),p_module,(r->>'id')::uuid,p_request,jsonb_build_object('command',p_command,'before',before_image));end if;return r;
exception when unique_violation then return jsonb_build_object('code','duplicate');when invalid_text_representation or check_violation or not_null_violation or foreign_key_violation or datetime_field_overflow or numeric_value_out_of_range then return jsonb_build_object('code','invalid');end$$;

-- Existing app_point_admin; only the singleton UPDATE predicate changes.
create or replace function public.app_point_admin(p_actor uuid,p_session uuid,p_command jsonb) returns jsonb language plpgsql security invoker set search_path='' as $$
#variable_conflict use_variable
declare sid uuid;mo date;sub uuid;n integer:=0;r jsonb;begin
 if not public.app_education_admin(p_actor,p_session) then return jsonb_build_object('code','denied');end if;
 if p_command->>'type'='settings' then update sim_murid_private.service_settings set email_enabled=(p_command->>'email')::boolean,whatsapp_enabled=coalesce((p_command->>'whatsapp')::boolean,false),point_threshold=(p_command->>'threshold')::integer,affective_subject_id=(p_command->>'subjectId')::uuid where singleton=true;return jsonb_build_object('code','saved');
 elsif p_command->>'type'='reset' then return public.app_point_reset((p_command->>'month')::date);
 elsif p_command->>'type'='affective' then
 mo=(p_command->>'month')::date;select affective_subject_id into sub from sim_murid_private.service_settings;if sub is null then return jsonb_build_object('code','not_configured');end if;
 insert into sim_murid_private.affective_scores(student_id,month,subject_id,score,source) select student_id,month,sub,round(greatest(0,least(100,((snapshot->>'balance')::numeric+50)/150*100))),snapshot from sim_murid_private.point_month_snapshots where month=mo on conflict(student_id,month,subject_id) do nothing;get diagnostics n=row_count;return jsonb_build_object('code','saved','added',n);
 elsif p_command->>'type'='rebuild' then
 sid=(p_command->>'studentId')::uuid;mo=(p_command->>'month')::date;r=public.app_point_replay(sid,mo);return jsonb_build_object('code','saved','replay',r);
 else return jsonb_build_object('code','invalid');end if;end$$;

-- Existing app_services_write; only the singleton UPDATE predicate changes.
create or replace function public.app_services_write(p_actor uuid,p_session uuid,p_request uuid,p_revision bigint,p_module text,p_command jsonb) returns jsonb language plpgsql security invoker set search_path='' as $$
#variable_conflict use_variable
declare old sim_murid_private.operations_requests%rowtype;v bigint;r jsonb;e sim_murid_private.point_events%rowtype;begin
 if not public.app_onboarding_ready(p_actor,p_session) then return jsonb_build_object('code','denied');end if;
 if p_module not in('discipline','notifications','surveys','insights','jobs') then return jsonb_build_object('code','denied');end if;
 if p_module='discipline' and not(public.app_ops_role(p_actor,'teacher') or public.app_education_admin(p_actor,p_session)) then return jsonb_build_object('code','denied');end if;
 if p_module='surveys' and p_command->>'type' in('period','close') and not public.app_survey_manager(p_actor,p_session) then return jsonb_build_object('code','denied');end if;
 if p_module='insights' and p_command->>'type'='ai_config' and not public.app_education_admin(p_actor,p_session) then return jsonb_build_object('code','denied');end if;
 if p_module='insights' and p_command->>'type' in('plan','plan_status') and not public.app_education_task(p_actor,'school_head') then return jsonb_build_object('code','denied');end if;
 if p_module='insights' and p_command->>'type'='note' and not public.app_survey_manager(p_actor,p_session) then return jsonb_build_object('code','denied');end if;
 if p_module='jobs' and not public.app_education_admin(p_actor,p_session) then return jsonb_build_object('code','denied');end if;
 select revision into v from sim_murid_private.operations_state for update;
 select * into old from sim_murid_private.operations_requests where id=p_request;if found then if old.actor=p_actor and old.module='services:'||p_module and old.command=p_command then return old.result;end if;return jsonb_build_object('code','request_conflict');end if;
 if not(p_module='surveys' and p_command->>'type' in('start','save','submit','peer_save','peer_submit')) and v is distinct from p_revision then return jsonb_build_object('code','stale');end if;
 if p_module='discipline' then
 if p_command->>'type' in('event','cancel','catalog') then r=public.app_point_mutate(p_actor,p_session,p_command);else r=public.app_point_admin(p_actor,p_session,p_command);end if;
 if r->>'code'='saved' and p_command->>'type'='event' then select * into e from sim_murid_private.point_events where id=(r->>'id')::uuid;perform public.app_point_notify(e.student_id,date_trunc('month',e.event_date)::date,e.id);end if;
 elsif p_module='notifications' then update sim_murid_private.inbox set read_at=coalesce(read_at,now()) where recipient_id=p_actor and(p_command->>'id' is null or id=(p_command->>'id')::uuid);r=jsonb_build_object('code','saved');
 elsif p_module='surveys' then r=public.app_survey_mutate(p_actor,p_session,p_command);
 elsif p_module='insights' then r=public.app_survey_admin(p_actor,p_session,p_command);
 elsif p_module='jobs' then r=public.app_jobs_admin(p_actor,p_session,p_command);
 end if;
 if r->>'code'='saved' then if not(p_module='surveys' and p_command->>'type' in('start','save','submit','peer_save','peer_submit')) then update sim_murid_private.operations_state set revision=revision+1 where singleton=true;end if;
 insert into sim_murid_private.operations_requests(id,actor,module,command,result) values(p_request,p_actor,'services:'||p_module,p_command,r);
 insert into sim_murid_private.activity_logs(actor_id,actor_kind,action,entity_type,entity_id,request_id,metadata) values(p_actor,'user',p_module||'.'||(p_command->>'type'),p_module,(r->>'id')::uuid,p_request,jsonb_build_object('command',p_command-'encryptedKey','result',r-'response'));end if;return r;
exception when unique_violation then return jsonb_build_object('code','duplicate');when invalid_text_representation or check_violation or not_null_violation or foreign_key_violation or datetime_field_overflow or numeric_value_out_of_range then return jsonb_build_object('code','invalid');end$$;
commit;
