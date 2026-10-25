-- P09: additive protection and bounded audit projection. No archive reopen/backfill.
begin;
create trigger promotion_history_immutable before update or delete on sim_murid_private.promotion_history for each row execute function sim_murid_private.deny_mutation();
create trigger promotion_history_no_truncate before truncate on sim_murid_private.promotion_history for each statement execute function sim_murid_private.deny_mutation();
create trigger report_no_truncate before truncate on sim_murid_private.report_snapshots for each statement execute function sim_murid_private.deny_mutation();
create trigger slip_no_truncate before truncate on sim_murid_private.withdrawal_slips for each statement execute function sim_murid_private.deny_mutation();
create trigger point_snapshot_no_truncate before truncate on sim_murid_private.point_month_snapshots for each statement execute function sim_murid_private.deny_mutation();
create trigger survey_no_truncate before truncate on sim_murid_private.survey_respondents for each statement execute function sim_murid_private.deny_mutation();

-- Unknown fields and free-text notes/answers/credentials are deliberately excluded.
create function sim_murid_private.audit_projection(p_data jsonb,p_depth integer default 0) returns jsonb language plpgsql immutable security invoker set search_path='' as $$
declare k text;v jsonb;out_data jsonb='{}';text_value text;
begin
 if p_depth>5 or p_data is null or pg_column_size(p_data)>1048576 then return '{}'::jsonb;end if;
 if jsonb_typeof(p_data)='array' then return coalesce((select jsonb_agg(sim_murid_private.audit_projection(x.value,p_depth+1) order by x.ord) from jsonb_array_elements(p_data) with ordinality x(value,ord) where x.ord<=500),'[]');end if;
 if jsonb_typeof(p_data)<>'object' then return '{}'::jsonb;end if;
 for k,v in select key,value from jsonb_each(p_data) loop
  text_value=v#>>'{}';
  if k in('command','before','after','result','scores','items','allocations') and jsonb_typeof(v) in('array','object') then out_data=out_data||jsonb_build_object(k,sim_murid_private.audit_projection(v,p_depth+1));
  elsif k in('id','classId','class_id','subjectId','subject_id','studentId','student_id','assessment_id','academic_year_id','sourceYearId','targetYearId','expectedClassId','from_class_id','to_class_id','account_id','reverses_id','teacherId','teacher_id','replacesId','ownerId','periodId','period_id') and (v='null'::jsonb or text_value~*'^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$') then out_data=out_data||jsonb_build_object(k,v);
  elsif k in('studentIds','lessonIds','dutyIds') and jsonb_typeof(v)='array' then out_data=out_data||jsonb_build_object(k,coalesce((select jsonb_agg(x.value order by x.ord) from jsonb_array_elements(v) with ordinality x(value,ord) where x.ord<=500 and x.value#>>'{}'~*'^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'),'[]'));
  elsif k in('value','semester','ph_number','kkm_snapshot','amount','delta','balance_before','balance_after','revision','count','rowCount','voided') and (jsonb_typeof(v) in('number','boolean') or v='null'::jsonb) then out_data=out_data||jsonb_build_object(k,v);
  elsif k in('date','assessment_date','transaction_date','month','startsOn','starts_on') and text_value~'^[0-9]{4}-[0-9]{2}-[0-9]{2}$' then out_data=out_data||jsonb_build_object(k,v);
  elsif k in('type','kind','scope','code','status','previous_role','new_role') and text_value in('batch','kkm','void','publish','promote','place','diploma','access','transaction','deposit','withdrawal','reversal','PH','ATS','ASAS','Praktik','one','own','all','other','others','current','single','global','individual','saved','student','alumni','applicant','start','save','submit','peer_save','peer_submit','enrollment','year','class','class_archive','lesson','lessons','duties','schedule_delete','roster','primary','appoint','confirm','unconfirm','cancel','edit','assign','report','payment','account','bracket','Hadir','Sakit','Izin','Alpa','pending','confirmed','cancelled','book') then out_data=out_data||jsonb_build_object(k,v);
  elsif k='reason' and jsonb_typeof(v)='string' then out_data=out_data||jsonb_build_object('reasonProvided',length(btrim(text_value))>0);
  elsif k='reasonProvided' and jsonb_typeof(v)='boolean' then out_data=out_data||jsonb_build_object(k,v);
  end if;
 end loop;
 return out_data;
end$$;
revoke all on function sim_murid_private.audit_projection(jsonb,integer) from public,anon,authenticated;
grant execute on function sim_murid_private.audit_projection(jsonb,integer) to service_role;
create function sim_murid_private.audit_insert_projection() returns trigger language plpgsql security invoker set search_path='' as $$begin new.metadata=sim_murid_private.audit_projection(new.metadata);new.description='';return new;end$$;
revoke all on function sim_murid_private.audit_insert_projection() from public,anon,authenticated;
grant execute on function sim_murid_private.audit_insert_projection() to service_role;
create trigger activity_logs_project_insert before insert on sim_murid_private.activity_logs for each row execute function sim_murid_private.audit_insert_projection();
create index activity_logs_page_p09 on sim_murid_private.activity_logs(created_at desc,id desc);
create index activity_logs_domain_page_p09 on sim_murid_private.activity_logs((split_part(action,'.',1)),created_at desc,id desc);
create function public.app_audit_read(p_actor uuid,p_session uuid,p_domain text default null,p_before timestamptz default null,p_before_id uuid default null) returns jsonb language plpgsql stable security invoker set search_path='' as $$
declare entries jsonb;next_cursor jsonb;
begin
 if not public.app_education_admin(p_actor,p_session) then return null;end if;
 if (p_before is null)<>(p_before_id is null) or (p_domain is not null and p_domain not in('grades','reports','promotions','attendance','duty','mentoring','fees','savings','discipline','surveys','classes','schedules','settings','family','auth','user','books')) then return null;end if;
 select coalesce(jsonb_agg(jsonb_build_object('id',q.id,'at',q.created_at,'actorId',q.actor_id,'actorLabel',(select p.full_name from public.profiles p where p.id=q.actor_id),'actorKind',q.actor_kind,'action',q.action,'entityType',q.entity_type,'entityId',q.entity_id,'requestId',q.request_id,'metadata',sim_murid_private.audit_projection(q.metadata)) order by q.created_at desc,q.id desc),'[]') into entries
 from(select * from sim_murid_private.activity_logs l where (p_domain is null or split_part(l.action,'.',1)=p_domain) and (p_before is null or (l.created_at,l.id)<(p_before,p_before_id)) order by l.created_at desc,l.id desc limit 26)q;
 if jsonb_array_length(entries)>25 then entries=entries-25;next_cursor=jsonb_build_object('at',entries->24->>'at','id',entries->24->>'id');end if;
 return jsonb_build_object('version',1,'domain',p_domain,'rows',entries,'next',next_cursor);
end$$;
revoke all on function public.app_audit_read(uuid,uuid,text,timestamptz,uuid) from public,anon,authenticated;
grant execute on function public.app_audit_read(uuid,uuid,text,timestamptz,uuid) to service_role;
create or replace function public.app_learning_write(p_actor uuid,p_session uuid,p_request uuid,p_revision bigint,p_module text,p_command jsonb) returns jsonb language plpgsql security invoker set search_path='' as $$declare old sim_murid_private.operations_requests%rowtype;v bigint;r jsonb;target uuid;snap jsonb;item jsonb;cls uuid;sub uuid;before_image jsonb;after_image jsonb;begin
 if not public.app_onboarding_ready(p_actor,p_session) then return jsonb_build_object('code','denied');end if;
 if p_module in('books','promotions') and not public.app_education_admin(p_actor,p_session) then return jsonb_build_object('code','denied');end if;
 if p_module='grades' then cls=(p_command->>'classId')::uuid;sub=(p_command->>'subjectId')::uuid;if p_command->>'id' is not null then select class_id,subject_id into cls,sub from sim_murid_private.assessments where id=(p_command->>'id')::uuid;end if;if not public.app_teaching_access(p_actor,p_session,cls,sub,true) then return jsonb_build_object('code','denied');end if;end if;
 if p_module='reports' and not(public.app_education_admin(p_actor,p_session) or exists(select 1 from public.classes where id=(p_command->>'classId')::uuid and homeroom_teacher_id=p_actor)) then return jsonb_build_object('code','denied');end if;
 select revision into v from sim_murid_private.operations_state for update;
 select * into old from sim_murid_private.operations_requests where id=p_request;if found then if old.actor=p_actor and old.module='learning:'||p_module and old.command=p_command then return old.result;end if;return jsonb_build_object('code','request_conflict');end if;
 if v is distinct from p_revision then return jsonb_build_object('code','stale');end if;
 if p_module='grades' and p_command->>'id' is null and p_command->>'type'='batch' and p_command->>'kind'<>'PH' then select id into target from sim_murid_private.assessments where class_id=cls and subject_id=sub and semester=case when extract(month from (p_command->>'date')::date)>=7 then 1 else 2 end and kind=p_command->>'kind' and voided_at is null;else target=(p_command->>'id')::uuid;end if;
 if p_module='grades' and target is not null then select to_jsonb(a)||jsonb_build_object('voided',a.voided_at is not null,'scores',(select jsonb_agg(sc) from sim_murid_private.assessment_scores sc where sc.assessment_id=a.id)) into before_image from sim_murid_private.assessments a where a.id=target;end if;
 if p_module='grades' and p_command->>'type'='kkm' then select to_jsonb(k) into before_image from sim_murid_private.minimum_grades k where k.class_id=cls and k.subject_id=sub and k.semester=case when extract(month from (p_command->>'date')::date)>=7 then 1 else 2 end;end if;
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
 if r->>'code'='saved' then
 if p_module='grades' and p_command->>'type'='kkm' then select to_jsonb(k) into after_image from sim_murid_private.minimum_grades k where k.class_id=cls and k.subject_id=sub and k.semester=case when extract(month from (p_command->>'date')::date)>=7 then 1 else 2 end;
 elsif p_module='grades' then select to_jsonb(a)||jsonb_build_object('voided',a.voided_at is not null,'scores',(select jsonb_agg(to_jsonb(sc) order by sc.student_id) from sim_murid_private.assessment_scores sc where sc.assessment_id=a.id)) into after_image from sim_murid_private.assessments a where a.id=(r->>'id')::uuid;end if;
 update sim_murid_private.operations_state set revision=revision+1 where singleton=true;
 insert into sim_murid_private.operations_requests(id,actor,module,command,result) values(p_request,p_actor,'learning:'||p_module,p_command,r);
 insert into sim_murid_private.activity_logs(actor_id,actor_kind,action,entity_type,entity_id,request_id,metadata) values(p_actor,'user',p_module||'.'||(p_command->>'type'),p_module,(r->>'id')::uuid,p_request,jsonb_build_object('command',p_command,'before',before_image,'after',after_image));end if;return r;
exception when unique_violation then return jsonb_build_object('code','duplicate');when invalid_text_representation or check_violation or not_null_violation or foreign_key_violation or datetime_field_overflow or numeric_value_out_of_range then return jsonb_build_object('code','invalid');end$$;


commit;
