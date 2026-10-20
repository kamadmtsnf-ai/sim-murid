begin;
create function public.app_directory_allowed(p_actor uuid,p_session uuid,p_target uuid) returns boolean language plpgsql stable security invoker set search_path='' as $$
declare target_role text;role text;begin
 if not public.app_onboarding_ready(p_actor,p_session) then return false;end if;
 if p_actor=p_target or public.app_education_admin(p_actor,p_session) or public.app_education_task(p_actor,'school_head') then return true;end if;
 select role_code into target_role from public.user_roles where user_id=p_target;select role_code into role from public.user_roles where user_id=p_actor;
 if role='parent' then return target_role in('student','applicant','alumni') and exists(select 1 from sim_murid_private.student_guardians where parent_id=p_actor and student_id=p_target and revoked_at is null);end if;
 if role='teacher' and target_role='student' then return exists(select 1 from sim_murid_private.enrollments e where e.student_id=p_target and e.ended_at is null and public.app_class_access(p_actor,p_session,e.class_id,false));end if;
 return false;
end;$$;
create function public.app_directory_read(p_actor uuid,p_session uuid,p_role text,p_query text default '',p_page integer default 1,p_status text default 'active') returns jsonb language plpgsql stable security invoker set search_path='' as $$
declare total integer;rows jsonb;begin
 if not public.app_onboarding_ready(p_actor,p_session) then return null;end if;
 if p_role not in('teacher','student','applicant','parent','alumni') or p_page not between 1 and 2000 or length(coalesce(p_query,''))>100 or p_status not in('active','inactive','all') then return null;end if;
 select count(*) into total from public.profiles p join public.user_roles r on r.user_id=p.id where r.role_code=p_role and (p_status='all' or p.status=p_status) and (p.status='active' or public.app_education_admin(p_actor,p_session)) and public.app_directory_allowed(p_actor,p_session,p.id) and (p.full_name ilike '%'||coalesce(p_query,'')||'%' or p.username ilike '%'||coalesce(p_query,'')||'%');
 select coalesce(jsonb_agg(x.row order by x.name,x.id),'[]') into rows from(
 select p.full_name name,p.id,jsonb_build_object('id',p.id,'username',p.username,'name',p.full_name,'role',r.role_code,'status',p.status,
 'progress',case when r.role_code in('student','applicant') then public.app_student_progress(p.id) else null end,
 'classes',(select coalesce(jsonb_agg(jsonb_build_object('id',c.id,'name',c.name,'level',c.level,'year',y.start_year) order by y.start_year desc,c.name),'[]') from sim_murid_private.enrollments e join public.classes c on c.id=e.class_id join public.academic_years y on y.id=c.academic_year_id where e.student_id=p.id and e.ended_at is null),
 'assignments',(select coalesce(jsonb_agg(jsonb_build_object('code',a.assignment_code,'class_id',a.scope_class_id)),'[]') from public.user_assignments a where a.user_id=p.id and a.revoked_at is null and a.valid_from<=(now() at time zone 'Asia/Jakarta')::date and (a.valid_until is null or a.valid_until>=(now() at time zone 'Asia/Jakarta')::date)),
 'homerooms',(select coalesce(jsonb_agg(jsonb_build_object('id',c.id,'name',c.name)),'[]') from public.classes c where c.homeroom_teacher_id=p.id and c.archived_at is null),
 'schedule_count',(select count(*) from sim_murid_private.lesson_schedules l join public.classes c on c.id=l.class_id join public.academic_years y on y.id=c.academic_year_id where l.teacher_id=p.id and l.archived_at is null and c.archived_at is null and y.is_active)) row
 from public.profiles p join public.user_roles r on r.user_id=p.id where r.role_code=p_role and (p_status='all' or p.status=p_status) and (p.status='active' or public.app_education_admin(p_actor,p_session)) and public.app_directory_allowed(p_actor,p_session,p.id) and (p.full_name ilike '%'||coalesce(p_query,'')||'%' or p.username ilike '%'||coalesce(p_query,'')||'%') order by p.full_name,p.id limit 50 offset (p_page-1)*50)x;
 return jsonb_build_object('rows',rows,'page',p_page,'page_size',50,'total',total);
end;$$;
create function public.app_directory_detail(p_actor uuid,p_session uuid,p_target uuid) returns jsonb language plpgsql stable security invoker set search_path='' as $$
declare result jsonb;role text;begin
 if not public.app_directory_allowed(p_actor,p_session,p_target) then return null;end if;
 select role_code into role from public.user_roles where user_id=p_target;
 select jsonb_build_object('id',p.id,'username',p.username,'name',p.full_name,'role',role,'status',p.status,
 'contact',case when public.app_education_admin(p_actor,p_session) or p_actor=p_target then jsonb_build_object('phone',p.phone,'email',p.contact_email,'bio',p.bio) else null end,
 'student',case when role in('student','applicant','alumni') then public.app_student_read(p_actor,p_session,p_target) else null end,
 'documents',case when role in('student','applicant','alumni') then public.app_document_list(p_actor,p_session,p_target) else null end,
 'children',(select coalesce(jsonb_agg(jsonb_build_object('id',q.id,'username',q.username,'name',q.full_name,'relationship',g.relationship) order by q.full_name,q.id),'[]') from sim_murid_private.student_guardians g join public.profiles q on q.id=g.student_id where g.parent_id=p_target and g.revoked_at is null and (public.app_directory_allowed(p_actor,p_session,q.id) or public.app_education_admin(p_actor,p_session))),
 'siblings',(select coalesce(jsonb_agg(jsonb_build_object('id',q.id,'username',q.username,'name',q.full_name,'legacy_order',b.legacy_order) order by b.legacy_order),'[]') from sim_murid_private.family_members a join sim_murid_private.family_members b on b.family_id=a.family_id join public.profiles q on q.id=b.student_id where a.student_id=p_target and a.revoked_at is null and b.revoked_at is null and b.student_id<>p_target and public.app_directory_allowed(p_actor,p_session,b.student_id)),
 'enrollments',(select coalesce(jsonb_agg(jsonb_build_object('id',e.id,'class_name',c.name,'year',y.start_year,'starts_on',e.starts_on,'ended_at',e.ended_at) order by y.start_year desc,e.created_at desc),'[]') from sim_murid_private.enrollments e join public.classes c on c.id=e.class_id join public.academic_years y on y.id=e.academic_year_id where e.student_id=p_target),
 'assignments',(select coalesce(jsonb_agg(jsonb_build_object('code',assignment_code,'class_id',scope_class_id,'valid_from',valid_from,'valid_until',valid_until,'revoked_at',revoked_at)),'[]') from public.user_assignments where user_id=p_target),
 'homerooms',(select coalesce(jsonb_agg(jsonb_build_object('id',c.id,'name',c.name)),'[]') from public.classes c where c.homeroom_teacher_id=p_target and c.archived_at is null),
 'lessons',(select coalesce(jsonb_agg(jsonb_build_object('id',l.id,'class_name',c.name,'subject',s.name,'weekday',l.weekday,'start_minute',l.start_minute,'end_minute',l.end_minute,'jtm',l.jtm,'break_minutes',l.break_minutes) order by l.weekday,l.start_minute),'[]') from sim_murid_private.lesson_schedules l join public.classes c on c.id=l.class_id join public.subjects s on s.id=l.subject_id join public.academic_years y on y.id=c.academic_year_id where l.teacher_id=p_target and l.archived_at is null and c.archived_at is null and y.is_active),
 'mentoring_status','Tahap 18','finance_attendance_status','Modul keuangan dan absensi mengikuti tahap terkait') into result from public.profiles p where p.id=p_target;
 return result;
end;$$;
revoke all on function public.app_directory_allowed(uuid,uuid,uuid),public.app_directory_read(uuid,uuid,text,text,integer,text),public.app_directory_detail(uuid,uuid,uuid) from public,anon,authenticated;
grant execute on function public.app_directory_allowed(uuid,uuid,uuid),public.app_directory_read(uuid,uuid,text,text,integer,text),public.app_directory_detail(uuid,uuid,uuid) to service_role;
commit;
