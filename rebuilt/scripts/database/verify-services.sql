begin;
do $$declare a uuid:=gen_random_uuid();t uuid:=gen_random_uuid();s uuid:=gen_random_uuid();s2 uuid:=gen_random_uuid();par uuid:=gen_random_uuid();ase uuid:=gen_random_uuid();tse uuid:=gen_random_uuid();sse uuid:=gen_random_uuid();s2se uuid:=gen_random_uuid();pse uuid:=gen_random_uuid();uid uuid;sid uuid;rol text;task text;yr uuid;c uuid;c2 uuid;family uuid;period uuid;micro uuid;v bigint;r jsonb;cmd jsonb;answers jsonb;question jsonb;request uuid;score integer;mo date:=date_trunc('month',public.app_ops_today());sy integer:=extract(year from public.app_ops_today())::integer-case when extract(month from public.app_ops_today())<7 then 1 else 0 end;checks integer:=0;
begin
 for uid,sid,rol in select * from(values(a,ase,'admin'),(t,tse,'teacher'),(s,sse,'student'),(s2,s2se,'student'),(par,pse,'parent'))x loop
 insert into auth.users(id,aud,role,email) values(uid,'authenticated','authenticated','stage30-'||uid||'@example.invalid');insert into auth.sessions(id,user_id) values(sid,uid);
 insert into public.profiles(id,username,full_name,contact_email) values(uid,'v'||replace(uid::text,'-',''),'Validation Stage 30','stage30-'||uid||'@example.invalid');
 insert into public.user_roles(user_id,role_code) values(uid,rol);insert into sim_murid_private.auth_accounts(user_id,must_change_password,profile_completed_at,verified_contact_email) values(uid,false,now(),'stage30-'||uid||'@example.invalid');insert into sim_murid_private.security_questions(user_id,question_code,answer_hash) values(uid,'q1',repeat('0',64));if rol='teacher' then insert into public.user_access_flags(user_id,teacher_email_verified_at) values(uid,now());end if;perform public.app_auth_claim(uid,sid,false);end loop;
 foreach task in array array['duty_teacher','student_mentor','committee_treasurer','savings_manager','school_head'] loop insert into public.user_assignments(user_id,assignment_code,valid_from,assigned_by) values(t,task,public.app_ops_today()-1,a);end loop;
 select id into yr from public.academic_years where start_year=sy;if yr is null then insert into public.academic_years(start_year) values(sy) returning id into yr;end if;
 insert into public.classes(academic_year_id,name,level,homeroom_teacher_id) values(yr,'VALID-30-7-'||left(a::text,8),7,t) returning id into c;insert into public.classes(academic_year_id,name,level) values(yr,'VALID-30-9-'||left(a::text,8),9) returning id into c2;
 insert into sim_murid_private.enrollments(student_id,class_id,academic_year_id,starts_on,created_by) values(s,c,yr,make_date(sy,7,1),a),(s2,c2,yr,make_date(sy,7,1),a);
 insert into sim_murid_private.student_guardians(student_id,parent_id,relationship,verified_by) values(s,par,'father',a);
 insert into sim_murid_private.family_groups(name,created_by) values('Validation siblings',a) returning id into family;insert into sim_murid_private.family_members(family_id,student_id,created_by) values(family,s,a),(family,s2,a);

 execute 'set local role service_role';
 foreach score in array array[48,44,38,0] loop
 select revision into v from sim_murid_private.operations_state;r=public.app_services_write(t,tse,gen_random_uuid(),v,'discipline',jsonb_build_object('type','event','studentId',s,'date',public.app_ops_today(),'code','A01','notes','Validation'));
 if r->>'code'<>'saved' then raise exception 'Point event %',r;end if;if(public.app_point_replay(s,mo)->>'balance')::int<>score then raise exception 'Residivism mismatch';end if;checks=checks+1;
 end loop;
 select revision into v from sim_murid_private.operations_state;r=public.app_services_write(t,tse,gen_random_uuid(),v,'discipline',jsonb_build_object('type','event','studentId',s,'date',public.app_ops_today(),'code','F01','notes','Recovery'));if(public.app_point_replay(s,mo)->>'balance')::int<>5 then raise exception 'R03 permanent clamp';end if;checks=checks+1;
 if jsonb_array_length(public.app_services_read(par,pse,'discipline')->'rows')<>1 or jsonb_array_length(public.app_services_read(s2,s2se,'discipline')->'rows')<>1 then raise exception 'Point scope';end if;checks=checks+1;
 if jsonb_array_length(public.app_services_read(s,sse,'notifications')->'rows')=0 then raise exception 'Inbox absent';end if;checks=checks+1;
 select revision into v from sim_murid_private.operations_state;r=public.app_services_write(s,sse,gen_random_uuid(),v,'notifications',jsonb_build_object('type','read','id',null));if(public.app_services_read(s,sse,'notifications')#>>'{extra,unread}')::int<>0 then raise exception 'Read notifications';end if;checks=checks+1;
 select revision into v from sim_murid_private.operations_state;r=public.app_services_write(a,ase,gen_random_uuid(),v,'surveys',jsonb_build_object('type','period','periodId',null,'title','VALID Stage30','yearId',yr,'semester',1,'start',public.app_ops_today(),'end',public.app_ops_today(),'targets',jsonb_build_array('student'),'kind','main','questions',null,'examOverride','Validation override'));period=(r->>'id')::uuid;if period is null then raise exception 'Period %',r;end if;checks=checks+1;
 if not public.app_survey_required(s,sse) or public.app_survey_required(a,ase) then raise exception 'Mandatory survey gate';end if;checks=checks+1;
 select revision into v from sim_murid_private.operations_state;r=public.app_services_write(s,sse,gen_random_uuid(),v,'surveys',jsonb_build_object('type','start','periodId',period));if r->>'code'<>'saved' or jsonb_array_length(r#>'{response,instrument}')<>95 or jsonb_array_length(r#>'{response,rotation}')<>8 then raise exception 'Survey snapshot %',r;end if;checks=checks+1;
 answers='{}';for question in select value from jsonb_array_elements(r#>'{response,instrument}') loop answers=jsonb_set(answers,array[question->>'code'],case when question->>'kind'='essay' then to_jsonb('Masukan pengujian'::text) else to_jsonb(coalesce((question->>'attention')::integer,4)) end);end loop;
 select revision into v from sim_murid_private.operations_state;request=gen_random_uuid();cmd=jsonb_build_object('type','submit','periodId',period,'version',0,'answers',answers);r=public.app_services_write(s,sse,request,v,'surveys',cmd);if r->>'code'<>'saved' then raise exception 'Submit %',r;end if;checks=checks+1;
 if public.app_services_write(s,sse,request,v,'surveys',cmd) is distinct from r then raise exception 'Receipt replay';end if;checks=checks+1;
 if public.app_survey_required(s,sse) then raise exception 'Gate remains after submit';end if;checks=checks+1;
 select revision into v from sim_murid_private.operations_state;r=public.app_services_write(s,sse,gen_random_uuid(),v,'surveys',jsonb_build_object('type','save','periodId',period,'version',1,'answers',answers));if r->>'code'<>'locked' then raise exception 'Final not locked';end if;checks=checks+1;
 r=public.app_survey_insights(t,tse,period);if jsonb_array_length(r->'aggregates')<>76 then raise exception 'Aggregates attention/draft filter %',jsonb_array_length(r->'aggregates');end if;checks=checks+1;
 if not(public.app_survey_insights(s2,s2se,period)->>'suppressed')::boolean then raise exception 'Peer minimum exposed';end if;checks=checks+1;
 r=public.app_jobs_tick(true);if r->>'dryRun'<>'true' then raise exception 'Job dry run';end if;checks=checks+1;
 if public.app_services_read(par,pse,'jobs') is not null or public.app_services_read(par,pse,'reconciliation') is not null then raise exception 'Operational data exposed';end if;checks=checks+1;
 if has_function_privilege('authenticated','public.app_services_write(uuid,uuid,uuid,bigint,text,jsonb)','execute') or has_table_privilege('authenticated','sim_murid_private.survey_respondents','select') then raise exception 'Client grant';end if;checks=checks+1;
 if exists(select 1 from pg_class c join pg_namespace n on n.oid=c.relnamespace where n.nspname in('public','sim_murid_private') and c.relkind='r' and not c.relrowsecurity) then raise exception 'RLS missing';end if;checks=checks+1;
 perform set_config('app.stage30.verification',jsonb_build_object('status','passed','assertions',checks,'mode','cloud service_role rollback','emailSent',false,'aiCalled',false)::text,true);
end$$;
select current_setting('app.stage30.verification')::jsonb verification;
rollback;
