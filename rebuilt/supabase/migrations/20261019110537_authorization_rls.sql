begin;
create table sim_murid_private.permission_rules (
 capability text not null, principal_kind text not null check(principal_kind in ('role','task','flag')),
 principal_code text not null, scope text not null check(scope in ('all','own','assignment')),
 primary key(capability,principal_kind,principal_code,scope)
);
alter table sim_murid_private.permission_rules enable row level security;
revoke all on sim_murid_private.permission_rules from public,anon,authenticated;
grant select on sim_murid_private.permission_rules to service_role;
insert into sim_murid_private.permission_rules values
('profiles.read','role','*','own'),
('roles.read','role','*','own'),
('assignments.read','role','*','own'),
('flags.read','role','*','own'),
('sessions.read','role','*','own'),
('sessions.revoke','role','*','own'),
('fees.read','role','*','own'),
('savings.read','role','*','own'),
('grades.read','role','*','own'),
('mentoring.read','role','*','own'),
('attendance.read','role','*','own'),
('notifications.read','role','*','own'),
('profiles.read','role','admin','all'),
('roles.read','role','admin','all'),
('assignments.read','role','admin','all'),
('flags.read','role','admin','all'),
('accounts.manage','role','admin','all'),
('sessions.read','role','admin','all'),
('sessions.revoke','role','admin','all'),
('school.read','role','admin','all'),
('classes.read','role','admin','all'),
('classes.manage','role','admin','all'),
('fees.read','role','admin','all'),
('fees.manage','role','admin','all'),
('savings.read','role','admin','all'),
('savings.manage','role','admin','all'),
('grades.read','role','admin','all'),
('grades.manage','role','admin','all'),
('mentoring.read','role','admin','all'),
('mentoring.manage','role','admin','all'),
('attendance.read','role','admin','all'),
('attendance.manage','role','admin','all'),
('graduation.manage','role','admin','all'),
('certificates.read','role','admin','all'),
('books.read','role','admin','all'),
('books.manage','role','admin','all'),
('discipline.read','role','admin','all'),
('discipline.manage','role','admin','all'),
('surveys.read','role','admin','all'),
('surveys.manage','role','admin','all'),
('action_plan.read','role','admin','all'),
('settings.manage','role','admin','all'),
('audit.read','role','admin','all'),
('survey_ai.manage','role','admin','all'),
('references.read','role','*','all'),
('books.read','flag','premium_access','all'),
('school.read','task','school_head','all'),
('classes.read','task','school_head','all'),
('fees.read','task','school_head','all'),
('savings.read','task','school_head','all'),
('grades.read','task','school_head','all'),
('mentoring.read','task','school_head','all'),
('attendance.read','task','school_head','all'),
('discipline.read','task','school_head','all'),
('surveys.read','task','school_head','all'),
('surveys.manage','task','school_head','all'),
('action_plan.read','task','school_head','all'),
('action_plan.write','task','school_head','all'),
('survey_ai.manage','task','school_head','all'),
('fees.read','task','committee_treasurer','assignment'),
('fees.manage','task','committee_treasurer','assignment'),
('savings.read','task','savings_manager','assignment'),
('savings.manage','task','savings_manager','assignment'),
('classes.read','task','homeroom_teacher','assignment'),
('classes.manage','task','homeroom_teacher','assignment'),
('fees.read','task','homeroom_teacher','assignment'),
('attendance.read','task','homeroom_teacher','assignment');
-- Isolated SECURITY DEFINER is required to read the unexposed registry without
-- exposing private tables or creating recursive policies on profiles/roles.
-- No caller argument. The signed JWT uid/session is always checked here.
create function sim_murid_private.access_snapshot() returns jsonb
language plpgsql stable security definer set search_path='' as $$
declare actor uuid; token_session uuid; role_code text; flags jsonb; tasks jsonb; grants_json jsonb;
begin
 actor=auth.uid();
 if actor is null then return null; end if;
 begin token_session=(nullif(current_setting('request.jwt.claims',true),'')::jsonb->>'session_id')::uuid;
 exception when invalid_text_representation then return null; end;
 if token_session is null then return null; end if;
 if public.app_auth_principal(actor,token_session) is null then return null; end if;
 select r.role_code into role_code from public.user_roles r where r.user_id=actor;
 if role_code is null then return null; end if;
 select jsonb_build_object('premium_access',f.premium_access,'savings_access',f.savings_access) into flags from public.user_access_flags f where f.user_id=actor;
 flags=coalesce(flags,'{"premium_access":false,"savings_access":false}'::jsonb);
 select coalesce(jsonb_agg(jsonb_build_object('code',a.assignment_code,'class_id',a.scope_class_id)),'[]'::jsonb) into tasks
 from public.user_assignments a where a.user_id=actor and role_code in ('admin','teacher') and a.revoked_at is null
 and a.valid_from<=(now() at time zone 'Asia/Jakarta')::date and (a.valid_until is null or a.valid_until>=(now() at time zone 'Asia/Jakarta')::date);
 -- homeroom_teacher_id is also an explicit class assignment, not a role inference.
 if role_code in ('admin','teacher') then
  tasks=tasks || coalesce((select jsonb_agg(jsonb_build_object('code','homeroom_teacher','class_id',c.id)) from public.classes c where c.homeroom_teacher_id=actor and c.archived_at is null),'[]'::jsonb);
 end if;
 select coalesce(jsonb_agg(distinct g),'[]'::jsonb) into grants_json from (
 select jsonb_build_object('capability',r.capability,'scope',r.scope,'class_id',null) g from sim_murid_private.permission_rules r
 where (r.principal_kind='role' and r.principal_code in ('*',role_code)
 and not (r.capability='savings.read' and r.scope='own' and role_code='teacher' and not (flags->>'savings_access')::boolean))
 or (r.principal_kind='flag' and coalesce((flags->>r.principal_code)::boolean,false))
 union all
 select jsonb_build_object('capability',r.capability,'scope',case when t->>'class_id' is null then 'all' else 'class' end,'class_id',t->>'class_id')
 from sim_murid_private.permission_rules r cross join jsonb_array_elements(tasks) t
 where r.principal_kind='task' and t->>'code'=r.principal_code
 and (r.scope='assignment' or (r.scope='all' and t->>'class_id' is null))
 and not (r.principal_code='homeroom_teacher' and t->>'class_id' is null)
 ) grants;
 return jsonb_build_object('user_id',actor,'role',role_code,'assignments',tasks,'grants',grants_json);
end;
$$;
create function sim_murid_private.access_allowed(p_capability text,p_owner uuid default null,p_class uuid default null) returns boolean
language sql stable security invoker set search_path='' as $$
 select coalesce(exists(select 1 from jsonb_array_elements(sim_murid_private.access_snapshot()->'grants') g
 where g->>'capability'=p_capability and
 (g->>'scope'='all' or (g->>'scope'='own' and p_owner=auth.uid()) or (g->>'scope'='class' and p_class::text=g->>'class_id'))),false);
$$;
revoke all on function sim_murid_private.access_snapshot(),sim_murid_private.access_allowed(text,uuid,uuid) from public,anon;
grant usage on schema sim_murid_private to authenticated;
grant execute on function sim_murid_private.access_snapshot(),sim_murid_private.access_allowed(text,uuid,uuid) to authenticated,service_role;
create function public.app_access_context() returns jsonb language sql stable security invoker set search_path='' as $$select sim_murid_private.access_snapshot();$$;
create function public.app_access_check(p_capability text,p_owner uuid default null,p_class uuid default null) returns boolean language sql stable security invoker set search_path='' as $$select sim_murid_private.access_allowed(p_capability,p_owner,p_class);$$;
revoke all on function public.app_access_context(),public.app_access_check(text,uuid,uuid) from public,anon;
grant execute on function public.app_access_context(),public.app_access_check(text,uuid,uuid) to authenticated;
-- Read-only API grants. Mutations remain denied until their audited domain RPCs exist.
grant select on public.profiles,public.user_roles,public.user_access_flags,public.user_assignments,public.classes,public.school_profile,
 public.role_catalog,public.assignment_catalog,public.academic_years,public.semesters,public.subjects,public.holidays,public.memorization_catalog,public.business_policies to authenticated;
create policy profiles_read on public.profiles for select to authenticated using ((select sim_murid_private.access_allowed('profiles.read')) or (id=(select auth.uid()) and (select sim_murid_private.access_allowed('profiles.read',auth.uid()))));
create policy user_roles_read on public.user_roles for select to authenticated using ((select sim_murid_private.access_allowed('roles.read')) or (user_id=(select auth.uid()) and (select sim_murid_private.access_allowed('roles.read',auth.uid()))));
create policy user_access_flags_read on public.user_access_flags for select to authenticated using ((select sim_murid_private.access_allowed('flags.read')) or (user_id=(select auth.uid()) and (select sim_murid_private.access_allowed('flags.read',auth.uid()))));
create policy user_assignments_read on public.user_assignments for select to authenticated using ((select sim_murid_private.access_allowed('assignments.read')) or (user_id=(select auth.uid()) and (select sim_murid_private.access_allowed('assignments.read',auth.uid()))));
create policy classes_read on public.classes for select to authenticated using (sim_murid_private.access_allowed('classes.read',null,id));
create policy school_read on public.school_profile for select to authenticated using ((select sim_murid_private.access_allowed('school.read')));
do $$declare t text;begin foreach t in array array['role_catalog','assignment_catalog','academic_years','semesters','subjects','holidays','memorization_catalog','business_policies'] loop
 execute format('create policy reference_read on public.%I for select to authenticated using ((select sim_murid_private.access_allowed(''references.read'')))',t);
end loop;end $$;
commit;
