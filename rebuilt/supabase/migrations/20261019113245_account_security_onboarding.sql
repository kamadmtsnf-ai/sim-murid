begin;
alter table sim_murid_private.auth_accounts
 add column password_change_id uuid,
 add column password_change_started_at timestamptz,
 add column profile_completed_at timestamptz,
 add column verified_contact_email text,
 add constraint password_change_pair check((password_change_id is null)=(password_change_started_at is null));
comment on column sim_murid_private.auth_accounts.profile_completed_at is 'Trusted completion marker maintained by the stage 11 full conditional biodata validator. No client setter.';
comment on column sim_murid_private.auth_accounts.verified_contact_email is 'Exact contact email proven by stage 9 OTP; technical Auth email is never used here.';
create function public.app_security_state(p_user uuid,p_session uuid) returns jsonb
language plpgsql stable security invoker set search_path='' as $$
declare principal jsonb; account sim_murid_private.auth_accounts%rowtype; role_code text; gate text; question text; email_ok boolean;
begin
 principal=public.app_auth_principal(p_user,p_session); if principal is null then return null; end if;
 select * into account from sim_murid_private.auth_accounts where user_id=p_user;
 select r.role_code into role_code from public.user_roles r where r.user_id=p_user;
 select question_code into question from sim_murid_private.security_questions where user_id=p_user;
 select coalesce(f.teacher_email_verified_at is not null and p.contact_email is not null and p.contact_email=account.verified_contact_email,false)
 into email_ok from public.profiles p left join public.user_access_flags f on f.user_id=p.id where p.id=p_user;
 gate=case
 when coalesce(account.must_change_password,true) or account.password_change_id is not null then 'password'
 when role_code is null then 'account_pending'
 when role_code in ('student','applicant') and account.profile_completed_at is null then 'profile_pending'
 when question is null then 'security_question'
 when role_code='teacher' and not coalesce(email_ok,false) then 'email_pending'
 else 'ready' end;
 return jsonb_build_object('gate',gate,'destination',case when gate='ready' then '/account' else '/account/security' end,
 'question_code',question,'role',role_code,'can_set_question',gate in ('security_question','email_pending','ready'));
end;
$$;
create function public.app_onboarding_ready(p_user uuid,p_session uuid) returns boolean
language sql stable security invoker set search_path='' as $$ select coalesce(public.app_security_state(p_user,p_session)->>'gate'='ready',false);$$;
create function public.app_security_rate(p_user uuid,p_session uuid) returns boolean
language plpgsql security invoker set search_path='' as $$
declare k text; n integer;
begin
 if public.app_auth_principal(p_user,p_session) is null then return false; end if;
 k=md5('security:'||p_user::text)||md5('security-v1:'||p_user::text);
 perform public.app_auth_attempt(k);
 select attempts into n from sim_murid_private.auth_attempts where key_hash=k;
 return n<=5;
end;
$$;
create function public.app_password_begin(p_user uuid,p_session uuid,p_operation uuid) returns boolean
language plpgsql security invoker set search_path='' as $$
begin
 perform 1 from public.profiles where id=p_user for update;
 if public.app_auth_principal(p_user,p_session) is null then return false; end if;
 insert into sim_murid_private.auth_accounts(user_id) values(p_user) on conflict do nothing;
 if exists(select 1 from sim_murid_private.auth_accounts where user_id=p_user and password_change_id is not null and password_change_started_at>now()-interval '2 minutes') then return false; end if;
 update sim_murid_private.auth_accounts set must_change_password=true,password_change_id=p_operation,password_change_started_at=now() where user_id=p_user;
 update sim_murid_private.app_sessions set revoked_at=now(),revocation_reason='password_change' where user_id=p_user and revoked_at is null;
 insert into sim_murid_private.activity_logs(actor_id,actor_kind,action,entity_type,entity_id,request_id) values(p_user,'user','auth.password_change_started','profile',p_user,p_operation);
 return true;
end;
$$;
create function public.app_password_finish(p_user uuid,p_operation uuid) returns boolean
language plpgsql security invoker set search_path='' as $$
begin
 perform 1 from public.profiles where id=p_user and status='active' for update;
 if not found then return false; end if;
 update sim_murid_private.auth_accounts set must_change_password=false,password_change_id=null,password_change_started_at=null
 where user_id=p_user and password_change_id=p_operation;
 if not found then return false; end if;
 insert into sim_murid_private.activity_logs(actor_id,actor_kind,action,entity_type,entity_id,request_id) values(p_user,'user','auth.password_changed','profile',p_user,p_operation);
 return true;
end;
$$;
create function public.app_security_question_save(p_user uuid,p_session uuid,p_question text,p_hash text) returns boolean
language plpgsql security invoker set search_path='' as $$
begin
 perform 1 from public.profiles where id=p_user for update;
 if not coalesce((public.app_security_state(p_user,p_session)->>'can_set_question')::boolean,false) then return false; end if;
 if p_question not in ('q1','q2','q3','q4','q5') or p_hash !~ '^scrypt\$v1\$16384\$8\$1\$[a-f0-9]{32}\$[a-f0-9]{64}$' then return false; end if;
 insert into sim_murid_private.security_questions(user_id,question_code,answer_hash) values(p_user,p_question,p_hash)
 on conflict(user_id) do update set question_code=excluded.question_code,answer_hash=excluded.answer_hash,updated_at=now();
 insert into sim_murid_private.activity_logs(actor_id,actor_kind,action,entity_type,entity_id,request_id,metadata) values(p_user,'user','auth.security_question_changed','profile',p_user,gen_random_uuid(),jsonb_build_object('question_code',p_question));
 return true;
end;
$$;
revoke all on function public.app_security_state(uuid,uuid),public.app_onboarding_ready(uuid,uuid),public.app_security_rate(uuid,uuid),public.app_password_begin(uuid,uuid,uuid),public.app_password_finish(uuid,uuid),public.app_security_question_save(uuid,uuid,text,text) from public,anon,authenticated;
grant execute on function public.app_security_state(uuid,uuid),public.app_onboarding_ready(uuid,uuid),public.app_security_rate(uuid,uuid),public.app_password_begin(uuid,uuid,uuid),public.app_password_finish(uuid,uuid),public.app_security_question_save(uuid,uuid,text,text) to service_role;
create or replace function sim_murid_private.access_snapshot() returns jsonb
language plpgsql stable security definer set search_path='' as $$
declare actor uuid; token_session uuid; role_code text; flags jsonb; tasks jsonb; grants_json jsonb;
begin
 actor=auth.uid();
 if actor is null then return null; end if;
 begin token_session=(nullif(current_setting('request.jwt.claims',true),'')::jsonb->>'session_id')::uuid;
 exception when invalid_text_representation then return null; end;
 if token_session is null then return null; end if;
 if not public.app_onboarding_ready(actor,token_session) then return null; end if;
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

create or replace function public.app_session_list(p_actor uuid,p_auth_session uuid,p_username text default null) returns jsonb
language plpgsql security invoker set search_path='' as $$
declare actor jsonb; owner_id uuid; result jsonb;
begin
 actor=public.app_auth_principal(p_actor,p_auth_session);
 if actor is null or not public.app_onboarding_ready(p_actor,p_auth_session) then return null; end if;
 select id into owner_id from public.profiles where username=coalesce(p_username,actor->>'username');
 if owner_id is null or (owner_id<>p_actor and not (actor->>'is_admin')::boolean) then return null; end if;
 update sim_murid_private.app_sessions set last_seen_at=now()
 where user_id=p_actor and auth_session_id=p_auth_session and last_seen_at<now()-interval '60 seconds';
 select coalesce(jsonb_agg(row_data order by issued_at desc,id),'[]'::jsonb) into result from (
 select s.id,s.issued_at,jsonb_build_object('id',s.id,'device',s.device_label,'issued_at',s.issued_at,
 'expires_at',s.expires_at,'last_seen_at',s.last_seen_at,'remember',s.remember_me,
 'current',s.user_id=p_actor and s.auth_session_id=p_auth_session,
 'status',case when s.revoked_at is not null then 'revoked' when s.expires_at<=now() or au.id is null or au.not_after<=now() then 'expired' else 'active' end) row_data
 from sim_murid_private.app_sessions s left join auth.sessions au on au.id=s.auth_session_id and au.user_id=s.user_id
 where s.user_id=owner_id order by s.issued_at desc,s.id limit 20
 ) h;
 return jsonb_build_object('username',coalesce(p_username,actor->>'username'),'sessions',result);
end;
$$;
create or replace function public.app_session_revoke(p_actor uuid,p_auth_session uuid,p_username text default null,p_session uuid default null) returns jsonb
language plpgsql security invoker set search_path='' as $$
declare actor jsonb; owner_id uuid; revoked integer; self_revoked boolean;
begin
 -- Serialize the caller role/session and target login/revocation using identity locks in UUID order.
 select id into owner_id from public.profiles where username=coalesce(p_username,(select username from public.profiles where id=p_actor));
 if owner_id is null then return null; end if;
 perform 1 from public.profiles where id in (p_actor,owner_id) order by id for update;
 perform 1 from public.user_roles where user_id=p_actor for update;
 actor=public.app_auth_principal(p_actor,p_auth_session);
 if actor is null or not public.app_onboarding_ready(p_actor,p_auth_session) or (owner_id<>p_actor and not (actor->>'is_admin')::boolean) then return null; end if;
 if p_session is not null and not exists(select 1 from sim_murid_private.app_sessions where id=p_session and user_id=owner_id) then return null; end if;
 self_revoked=exists(select 1 from sim_murid_private.app_sessions where user_id=p_actor and user_id=owner_id and auth_session_id=p_auth_session and (p_session is null or id=p_session));
 update sim_murid_private.app_sessions set revoked_at=now(),revocation_reason=case when owner_id=p_actor then 'owner_revoked' else 'admin_revoked' end
 where user_id=owner_id and (p_session is null or id=p_session) and revoked_at is null;
 get diagnostics revoked=row_count;
 if revoked>0 then
 insert into sim_murid_private.activity_logs(actor_id,actor_kind,action,entity_type,entity_id,request_id,metadata)
 values(p_actor,'user','auth.session_revoke','profile',owner_id,gen_random_uuid(),jsonb_build_object('count',revoked,'scope',case when p_session is null then 'all' else 'one' end));
 end if;
 return jsonb_build_object('revoked',revoked,'signed_out',self_revoked);
end;
$$;

commit;
