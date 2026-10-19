begin;
-- No new client table exposure. All RPCs below are service-only and invoker.
create function public.app_recovery_probe(p_key text) returns boolean
language plpgsql security invoker set search_path='' as $$
declare n integer;
begin
 if p_key is null or p_key !~ '^[a-f0-9]{64}$' then return false; end if;
 perform public.app_auth_attempt(p_key);
 select attempts into n from sim_murid_private.auth_attempts where key_hash=p_key;
 return n<=5;
end;$$;
create function public.app_recovery_identity(p_username text) returns jsonb
language sql stable security invoker set search_path='' as $$
 select jsonb_build_object('id',p.id,'question_code',q.question_code,'answer_hash',q.answer_hash)
 from public.profiles p left join sim_murid_private.security_questions q on q.user_id=p.id
 where p.username=p_username and p.status='active';
$$;
create function public.app_recovery_request(p_user uuid,p_type text,p_answer_verified boolean) returns void
language plpgsql security invoker set search_path='' as $$
begin
 if p_type is null or p_type not in ('password','session') then return; end if;
 perform 1 from public.profiles where id=p_user and status='active' for update;
 if not found then return; end if;
 update sim_murid_private.recovery_requests set status='expired',resolved_at=now()
 where user_id=p_user and status in ('pending','verified') and requested_at<=now()-interval '24 hours';
 if exists(select 1 from sim_murid_private.recovery_requests where user_id=p_user and request_type=p_type and status in ('pending','verified')) then return; end if;
 insert into sim_murid_private.recovery_requests(user_id,request_type,verification_metadata)
 values(p_user,p_type,jsonb_build_object('security_answer_verified',coalesce(p_answer_verified,false),'manual_identity_required',true));
 insert into sim_murid_private.activity_logs(actor_kind,action,entity_type,entity_id,request_id)
 values('system','auth.recovery_requested','profile',p_user,gen_random_uuid());
end;$$;
create function public.app_recovery_list(p_actor uuid,p_session uuid) returns jsonb
language plpgsql security invoker set search_path='' as $$
begin
 if not public.app_onboarding_ready(p_actor,p_session) or not exists(select 1 from public.user_roles where user_id=p_actor and role_code='admin') then return null; end if;
 return (select coalesce(jsonb_agg(x order by x->>'requested_at'),'[]'::jsonb) from (
 select jsonb_build_object('id',r.id,'username',p.username,'full_name',p.full_name,'request_type',r.request_type,
 'status',r.status,'requested_at',r.requested_at,'expires_at',r.requested_at+interval '24 hours',
 'security_answer_verified',coalesce((r.verification_metadata->>'security_answer_verified')::boolean,false),'self_request',r.user_id=p_actor) x
 from sim_murid_private.recovery_requests r join public.profiles p on p.id=r.user_id
 where r.status in ('pending','verified') and r.requested_at>now()-interval '24 hours' and p.status='active'
 order by r.requested_at,r.id limit 100) a);
end;$$;
create function public.app_recovery_begin(p_actor uuid,p_session uuid,p_request uuid,p_operation uuid,p_evidence text,p_reject boolean default false) returns jsonb
language plpgsql security invoker set search_path='' as $$
declare r sim_murid_private.recovery_requests%rowtype; target uuid;
begin
 select user_id into target from sim_murid_private.recovery_requests where id=p_request;
 if target is null or target=p_actor or p_operation is null or p_evidence is null or p_evidence !~ '^[A-Za-z0-9][A-Za-z0-9 ./_-]{7,119}$' then return null; end if;
 perform 1 from public.profiles where id in(p_actor,target) order by id for update;
 perform 1 from public.user_roles where user_id=p_actor for update;
 if not public.app_onboarding_ready(p_actor,p_session) or not exists(select 1 from public.user_roles where user_id=p_actor and role_code='admin') or not exists(select 1 from public.profiles where id=target and status='active') then return null; end if;
 select * into r from sim_murid_private.recovery_requests where id=p_request for update;
 if r.status not in ('pending','verified') then return null; end if;
 if r.requested_at<=now()-interval '24 hours' then
 update sim_murid_private.recovery_requests set status='expired',resolved_at=now() where id=r.id;return null;end if;
 if r.status='verified' and (r.verification_metadata->>'started_at')::timestamptz>now()-interval '2 minutes' then return null; end if;
 if p_reject then
 update sim_murid_private.recovery_requests set status='rejected',resolved_at=now(),resolved_by=p_actor,verification_metadata=verification_metadata||jsonb_build_object('evidence_reference',p_evidence) where id=r.id;
 else
 if r.request_type='password' then
 insert into sim_murid_private.auth_accounts(user_id) values(target) on conflict do nothing;
 if exists(select 1 from sim_murid_private.auth_accounts where user_id=target and password_change_id is not null and password_change_started_at>now()-interval '2 minutes') then return null; end if;
 update sim_murid_private.auth_accounts set must_change_password=true,password_change_id=p_operation,password_change_started_at=now() where user_id=target;
 end if;
 update sim_murid_private.app_sessions set revoked_at=now(),revocation_reason='admin_recovery' where user_id=target and revoked_at is null;
 update sim_murid_private.recovery_requests set status=case when r.request_type='session' then 'completed' else 'verified' end,
 resolved_at=case when r.request_type='session' then now() else null end,resolved_by=p_actor,
 verification_metadata=verification_metadata||jsonb_build_object('operation_id',p_operation,'started_at',now(),'evidence_reference',p_evidence,'identity_verified_by_admin',true) where id=r.id;
 end if;
 insert into sim_murid_private.activity_logs(actor_id,actor_kind,action,entity_type,entity_id,request_id,metadata)
 values(p_actor,'user',case when p_reject then 'auth.recovery_rejected' when r.request_type='session' then 'auth.session_recovered' else 'auth.recovery_password_started' end,'profile',target,p_operation,jsonb_build_object('recovery_id',r.id,'evidence_reference',p_evidence));
 return jsonb_build_object('user_id',target,'request_type',r.request_type,'rejected',p_reject);
end;$$;
create function public.app_recovery_finish(p_actor uuid,p_session uuid,p_request uuid,p_operation uuid) returns boolean
language plpgsql security invoker set search_path='' as $$
declare target uuid;
begin
 select user_id into target from sim_murid_private.recovery_requests where id=p_request;
 if target is null or target=p_actor then return false; end if;
 perform 1 from public.profiles where id in(p_actor,target) order by id for update;
 perform 1 from public.user_roles where user_id=p_actor for update;
 if not public.app_onboarding_ready(p_actor,p_session) or not exists(select 1 from public.user_roles where user_id=p_actor and role_code='admin') or not exists(select 1 from public.profiles where id=target and status='active') then return false; end if;
 perform 1 from sim_murid_private.recovery_requests where id=p_request and status='verified' and request_type='password' and verification_metadata->>'operation_id'=p_operation::text for update;
 if not found then return false; end if;
 update sim_murid_private.auth_accounts set password_change_id=null,password_change_started_at=null,must_change_password=true where user_id=target and password_change_id=p_operation;
 if not found then return false; end if;
 update sim_murid_private.recovery_requests set status='completed',resolved_at=now(),resolved_by=p_actor where id=p_request;
 insert into sim_murid_private.activity_logs(actor_id,actor_kind,action,entity_type,entity_id,request_id,metadata)
 values(p_actor,'user','auth.recovery_password_completed','profile',target,p_operation,jsonb_build_object('recovery_id',p_request));
 return true;
end;$$;
create function public.app_profile_read(p_user uuid,p_session uuid) returns jsonb
language plpgsql stable security invoker set search_path='' as $$
declare g text;
begin
 select public.app_security_state(p_user,p_session)->>'gate' into g;
 if g is null or g not in ('ready','email_pending') then return null; end if;
 return (select jsonb_build_object('username',username,'full_name',full_name,'phone',coalesce(phone,''),'contact_email',coalesce(contact_email,''),'bio',bio,'updated_at',updated_at) from public.profiles where id=p_user);
end;$$;
create function public.app_profile_update(p_user uuid,p_session uuid,p_version timestamptz,p_name text,p_phone text,p_email text,p_bio text) returns boolean
language plpgsql security invoker set search_path='' as $$
declare g text; old_email text;
begin
 perform 1 from public.profiles where id=p_user for update;
 select public.app_security_state(p_user,p_session)->>'gate' into g;
 if g is null or g not in ('ready','email_pending') then return false; end if;
 if not exists(select 1 from public.profiles where id=p_user and updated_at=p_version) then return false; end if;
 if p_name is null or length(btrim(p_name)) not between 1 and 200 or p_phone is null or length(p_phone)>40 or p_email is null or length(p_email)>320 or p_bio is null or length(p_bio)>2000 then return false; end if;
 if p_email<>'' and (p_email !~ '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$' or lower(p_email) like '%@auth.sim-murid.invalid') then return false; end if;
 select contact_email into old_email from public.profiles where id=p_user;
 update public.profiles set full_name=btrim(p_name),phone=nullif(btrim(p_phone),''),contact_email=nullif(lower(btrim(p_email)),''),bio=btrim(p_bio) where id=p_user;
 if old_email is distinct from nullif(lower(btrim(p_email)),'') then
 update sim_murid_private.email_verifications set status='superseded' where user_id=p_user and status='pending';
 update public.user_access_flags set teacher_email_verified_at=null where user_id=p_user;
 update sim_murid_private.auth_accounts set verified_contact_email=null where user_id=p_user;
 end if;
 insert into sim_murid_private.activity_logs(actor_id,actor_kind,action,entity_type,entity_id,request_id,metadata)
 values(p_user,'user','profile.basic_updated','profile',p_user,gen_random_uuid(),jsonb_build_object('contact_changed',old_email is distinct from nullif(lower(btrim(p_email)),'')));
 return true;
end;$$;
revoke all on function public.app_recovery_probe(text),public.app_recovery_identity(text),public.app_recovery_request(uuid,text,boolean),public.app_recovery_list(uuid,uuid),public.app_recovery_begin(uuid,uuid,uuid,uuid,text,boolean),public.app_recovery_finish(uuid,uuid,uuid,uuid),public.app_profile_read(uuid,uuid),public.app_profile_update(uuid,uuid,timestamptz,text,text,text,text) from public,anon,authenticated;
grant execute on function public.app_recovery_probe(text),public.app_recovery_identity(text),public.app_recovery_request(uuid,text,boolean),public.app_recovery_list(uuid,uuid),public.app_recovery_begin(uuid,uuid,uuid,uuid,text,boolean),public.app_recovery_finish(uuid,uuid,uuid,uuid),public.app_profile_read(uuid,uuid),public.app_profile_update(uuid,uuid,timestamptz,text,text,text,text) to service_role;
commit;
