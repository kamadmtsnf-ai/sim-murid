-- Disposable D10 fixtures only. No provider, scheduler, financial transaction or real account is touched.
-- Run on staging after the D10 migration. Production execution requires the explicit scoped approval recorded in the release report.
begin;
set local statement_timeout='30s';
do $$
declare actor uuid:=gen_random_uuid();teacher uuid:=gen_random_uuid();student uuid:=gen_random_uuid();asession uuid:=gen_random_uuid();tsession uuid:=gen_random_uuid();ssession uuid:=gen_random_uuid();person uuid;sid uuid;role_code text;yr uuid;cls uuid;subject uuid;assessment uuid;request uuid;revision bigint;command jsonb;result jsonb;frozen jsonb;published jsonb;kind text;checks integer:=0;sem integer:=case when extract(month from public.app_ops_today())>=7 then 1 else 2 end;sy integer:=extract(year from public.app_ops_today())::integer-case when extract(month from public.app_ops_today())<7 then 1 else 0 end;
begin
 for person,sid,role_code in select * from(values(actor,asession,'admin'),(teacher,tsession,'teacher'),(student,ssession,'student')) fixture loop
  insert into auth.users(id) values(person);
  insert into auth.sessions(id,user_id) values(sid,person);
  insert into public.profiles(id,username,full_name,contact_email) values(person,'d10-'||replace(person::text,'-',''),'D10 disposable validation','d10-'||person||'@example.invalid');
  insert into public.user_roles(user_id,role_code) values(person,role_code);
  insert into sim_murid_private.auth_accounts(user_id,must_change_password,profile_completed_at,verified_contact_email) values(person,false,now(),'d10-'||person||'@example.invalid');
  insert into sim_murid_private.security_questions(user_id,question_code,answer_hash) values(person,'q1',repeat('0',64));
  if role_code='teacher' then insert into public.user_access_flags(user_id,teacher_email_verified_at) values(person,now());end if;
  perform public.app_auth_claim(person,sid,false);
 end loop;
 select id into yr from public.academic_years where start_year=sy;
 if yr is null then insert into public.academic_years(start_year) values(sy) returning id into yr;end if;
 insert into public.classes(academic_year_id,name,level,homeroom_teacher_id) values(yr,'D10-VALID-'||left(actor::text,8),7,teacher) returning id into cls;
 insert into sim_murid_private.enrollments(student_id,class_id,academic_year_id,starts_on,created_by) values(student,cls,yr,make_date(sy,7,1),actor);
 select id into subject from public.subjects order by sort_order limit 1;
 insert into sim_murid_private.lesson_schedules(class_id,academic_year_id,subject_id,teacher_id,weekday,start_minute,duration_minutes,jtm,created_by) values(cls,yr,subject,teacher,1,480,40,1,actor);
 execute 'set local role service_role';
 foreach kind in array array['PH','ATS','ASAS'] loop
  select s.revision into revision from sim_murid_private.operations_state s;
  result=public.app_learning_write(teacher,tsession,gen_random_uuid(),revision,'grades',jsonb_build_object('type','batch','id',null,'classId',cls,'subjectId',subject,'date',public.app_ops_today(),'kind',kind,'items',jsonb_build_array(jsonb_build_object('studentId',student,'value',80))));
  if result->>'code'<>'saved' then raise exception 'D10 grade setup failed';end if;
  if kind='ATS' then assessment=(result->>'id')::uuid;end if;
 end loop;
 select s.revision into revision from sim_murid_private.operations_state s;
 result=public.app_learning_write(teacher,tsession,gen_random_uuid(),revision,'reports',jsonb_build_object('type','publish','classId',cls,'semester',sem,'studentIds',jsonb_build_array(student)));
 if result->>'code'<>'saved' then raise exception 'D10 base publication failed';end if;checks=checks+1;
 select snapshot into frozen from sim_murid_private.report_snapshots where student_id=student;
 select s.revision into revision from sim_murid_private.operations_state s;
 result=public.app_learning_write(teacher,tsession,gen_random_uuid(),revision,'grades',jsonb_build_object('type','batch','id',assessment,'classId',cls,'subjectId',subject,'date',public.app_ops_today(),'kind','ATS','reason','D10 controlled correction','items',jsonb_build_array(jsonb_build_object('studentId',student,'value',90))));
 if result->>'code'<>'saved' then raise exception 'D10 grade correction failed';end if;
 select s.revision into revision from sim_murid_private.operations_state s;
 command=jsonb_build_object('type','revise','classId',cls,'semester',sem,'studentId',student,'expectedVersion',1,'reason','D10 controlled report correction');request=gen_random_uuid();
 result=public.app_learning_write(teacher,tsession,request,revision,'reports',command);
 if result->>'code'<>'saved' or result->>'version'<>'2' then raise exception 'D10 revision failed';end if;checks=checks+1;
 if public.app_learning_write(teacher,tsession,request,revision,'reports',command) is distinct from result then raise exception 'D10 replay failed';end if;checks=checks+1;
 if (select snapshot from sim_murid_private.report_snapshots where student_id=student) is distinct from frozen then raise exception 'D10 base archive changed';end if;checks=checks+1;
 published=public.app_learning_read(actor,asession,'reports',jsonb_build_object('classId',cls,'semester',sem,'reportVersion',1));
 if published#>'{rows,0,published,snapshot}' is distinct from frozen then raise exception 'D10 historical read failed';end if;checks=checks+1;
 select s.revision into revision from sim_murid_private.operations_state s;
 if public.app_learning_write(student,ssession,gen_random_uuid(),revision,'reports',command)->>'code'<>'denied' then raise exception 'D10 student write allowed';end if;checks=checks+1;
 if has_table_privilege('authenticated','sim_murid_private.report_revisions','select') or has_function_privilege('authenticated','public.app_learning_write(uuid,uuid,uuid,bigint,text,jsonb)','execute') then raise exception 'D10 direct access allowed';end if;checks=checks+1;
 perform set_config('app.d10.verification',jsonb_build_object('status','passed','assertions',checks,'mode','SQL fixture rollback; not browser Auth UAT')::text,true);
end$$;
select current_setting('app.d10.verification')::jsonb verification;
rollback;
