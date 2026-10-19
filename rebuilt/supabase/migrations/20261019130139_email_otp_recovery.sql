begin;
alter table sim_murid_private.email_verifications
 add column purpose text not null default 'verify' check(purpose in ('verify','recovery')),
 add column delivery_state text not null default 'queued' check(delivery_state in ('queued','accepted','failed')),
 add column provider_message_id text;
create index email_verifications_created_idx on sim_murid_private.email_verifications(created_at);
create function public.app_email_recovery_identity(p_username text) returns jsonb
language sql stable security invoker set search_path='' as $$
 select jsonb_build_object('user_id',p.id,'email',p.contact_email) from public.profiles p
 join sim_murid_private.auth_accounts a on a.user_id=p.id join public.user_access_flags f on f.user_id=p.id
 where p.username=p_username and p.status='active' and p.contact_email is not null and p.contact_email=a.verified_contact_email and f.teacher_email_verified_at is not null;
$$;
create function public.app_email_context(p_id uuid) returns jsonb
language sql stable security invoker set search_path='' as $$
 select jsonb_build_object('user_id',p.id,'username',p.username,'email',e.email_target,'purpose',e.purpose) from sim_murid_private.email_verifications e join public.profiles p on p.id=e.user_id where e.id=p_id and p.status='active';
$$;
create function public.app_email_state(p_user uuid,p_session uuid) returns jsonb
language plpgsql stable security invoker set search_path='' as $$
declare gate text; email text; latest jsonb;
begin
 gate=public.app_security_state(p_user,p_session)->>'gate';
 if gate is null or gate not in ('email_pending','ready') or not exists(select 1 from public.user_roles where user_id=p_user and role_code='teacher') then return null; end if;
 select contact_email into email from public.profiles where id=p_user;
 select jsonb_build_object('id',id,'expires_at',expires_at,'retry_at',created_at+interval '60 seconds','status',status,'delivery_state',delivery_state,'attempts_remaining',5-attempts_used) into latest from sim_murid_private.email_verifications where user_id=p_user and purpose='verify' order by created_at desc,id limit 1;
 return jsonb_build_object('email',coalesce(email,''),'verified',gate='ready','challenge',latest,'sent_today',(select count(*) from sim_murid_private.email_verifications where user_id=p_user and (created_at at time zone 'Asia/Jakarta')::date=(now() at time zone 'Asia/Jakarta')::date));
end;$$;
create function public.app_email_reserve(p_user uuid,p_session uuid,p_purpose text,p_id uuid,p_hash text,p_expected_email text) returns jsonb
language plpgsql security invoker set search_path='' as $$
declare email text; full_name text; gate text; last_sent timestamptz; lock_key text=md5('sim-murid-email-budget')||md5('v1');
begin
 if p_id is null or p_purpose is null or p_purpose not in ('verify','recovery') or p_hash is null or p_hash !~ '^hmac\$v1\$[a-f0-9]{64}$' then return jsonb_build_object('code','invalid'); end if;
 -- Global lock on an existing private rate row; acquired before identity locks everywhere.
 insert into sim_murid_private.auth_attempts(key_hash,attempts) values(lock_key,1) on conflict do nothing;
 perform 1 from sim_murid_private.auth_attempts where key_hash=lock_key for update;
 perform 1 from public.profiles where id=p_user and status='active' for update;
 if not found then return jsonb_build_object('code','not_allowed'); end if;
 if p_purpose='verify' then
 gate=public.app_security_state(p_user,p_session)->>'gate';
 if gate is null or gate not in ('email_pending','ready') or not exists(select 1 from public.user_roles where user_id=p_user and role_code='teacher') then return jsonb_build_object('code','not_allowed'); end if;
 else
 if public.app_email_recovery_identity((select username from public.profiles where id=p_user)) is null then return jsonb_build_object('code','not_allowed'); end if;
 end if;
 if exists(select 1 from sim_murid_private.auth_accounts where user_id=p_user and password_change_id is not null and password_change_started_at>now()-interval '2 minutes') then return jsonb_build_object('code','busy'); end if;
 select p.contact_email,p.full_name into email,full_name from public.profiles p where p.id=p_user;
 if email is distinct from p_expected_email then return jsonb_build_object('code','address_changed'); end if;
 if email is null or email !~ '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$' or lower(email) like '%@auth.sim-murid.invalid' then return jsonb_build_object('code','invalid_email'); end if;
 select max(created_at) into last_sent from sim_murid_private.email_verifications where user_id=p_user;
 if last_sent>now()-interval '60 seconds' then return jsonb_build_object('code','cooldown','retry_after',ceil(extract(epoch from(last_sent+interval '60 seconds'-now())))); end if;
 if (select count(*) from sim_murid_private.email_verifications where user_id=p_user and (created_at at time zone 'Asia/Jakarta')::date=(now() at time zone 'Asia/Jakarta')::date)>=5 then return jsonb_build_object('code','daily_limit'); end if;
 if (select count(*) from sim_murid_private.email_verifications where created_at>now()-interval '24 hours')>=250 then return jsonb_build_object('code','global_limit'); end if;
 update sim_murid_private.email_verifications set status='superseded' where user_id=p_user and status='pending';
 insert into sim_murid_private.email_verifications(id,user_id,email_target,otp_hash,expires_at,purpose) values(p_id,p_user,email,p_hash,now()+interval '600 seconds',p_purpose);
 insert into sim_murid_private.activity_logs(actor_kind,action,entity_type,entity_id,request_id,metadata) values('system','auth.email_reserved','profile',p_user,p_id,jsonb_build_object('purpose',p_purpose));
 return jsonb_build_object('code','reserved','id',p_id,'email',email,'name',full_name,'expires_at',now()+interval '600 seconds');
end;$$;
create function public.app_email_delivery(p_user uuid,p_id uuid,p_accepted boolean,p_message text default null) returns boolean
language plpgsql security invoker set search_path='' as $$
declare active boolean;
begin
 if p_accepted is null or (p_accepted and (p_message is null or length(p_message)=0)) then return false; end if;
 perform 1 from public.profiles where id=p_user for update;
 update sim_murid_private.email_verifications set delivery_state=case when p_accepted then 'accepted' else 'failed' end,provider_message_id=case when p_accepted then left(p_message,512) else null end,
 status=case when not p_accepted and status='pending' then 'superseded' else status end where id=p_id and user_id=p_user and delivery_state='queued';
 if not found then return false; end if;
 active=exists(select 1 from sim_murid_private.email_verifications e join public.profiles p on p.id=e.user_id where e.id=p_id and e.user_id=p_user and e.status='pending' and e.expires_at>now() and e.email_target=p.contact_email);
 insert into sim_murid_private.activity_logs(actor_kind,action,entity_type,entity_id,request_id,metadata) values('system',case when p_accepted then 'auth.email_provider_accepted' else 'auth.email_failed' end,'profile',p_user,p_id,jsonb_build_object('challenge_id',p_id));
 return p_accepted and active;
end;$$;
create function public.app_email_consume(p_user uuid,p_session uuid,p_id uuid,p_hash text,p_operation uuid default null) returns boolean
language plpgsql security invoker set search_path='' as $$
declare e sim_murid_private.email_verifications%rowtype; email text; gate text;
begin
 perform 1 from public.profiles where id=p_user and status='active' for update;
 if not found then return false; end if;
 select * into e from sim_murid_private.email_verifications where id=p_id and user_id=p_user for update;
 if not found or e.status<>'pending' or e.delivery_state<>'accepted' then return false; end if;
 select contact_email into email from public.profiles where id=p_user;
 if e.email_target is distinct from email then update sim_murid_private.email_verifications set status='superseded' where id=e.id;return false;end if;
 if e.expires_at<=now() then update sim_murid_private.email_verifications set status='expired' where id=e.id;return false;end if;
 if e.attempts_used>=5 then update sim_murid_private.email_verifications set status='locked' where id=e.id;return false;end if;
 if e.purpose='verify' then
 gate=public.app_security_state(p_user,p_session)->>'gate';
 if gate is null or gate not in ('email_pending','ready') or not exists(select 1 from public.user_roles where user_id=p_user and role_code='teacher') then return false;end if;
 else
 if p_operation is null or public.app_email_recovery_identity((select username from public.profiles where id=p_user)) is null then return false;end if;
 if exists(select 1 from sim_murid_private.auth_accounts where user_id=p_user and password_change_id is not null and password_change_started_at>now()-interval '2 minutes') then return false;end if;
 end if;
 if p_hash is null or e.otp_hash<>p_hash then
 update sim_murid_private.email_verifications set attempts_used=least(attempts_used+1,5),status=case when attempts_used+1>=5 then 'locked' else status end where id=e.id;return false;end if;
 update sim_murid_private.email_verifications set status='verified' where id=e.id;
 if e.purpose='verify' then
 insert into sim_murid_private.auth_accounts(user_id,verified_contact_email) values(p_user,email) on conflict(user_id) do update set verified_contact_email=excluded.verified_contact_email;
 insert into public.user_access_flags(user_id,teacher_email_verified_at) values(p_user,now()) on conflict(user_id) do update set teacher_email_verified_at=excluded.teacher_email_verified_at;
 else
 update sim_murid_private.auth_accounts set must_change_password=true,password_change_id=p_operation,password_change_started_at=now() where user_id=p_user;
 update sim_murid_private.app_sessions set revoked_at=now(),revocation_reason='email_recovery' where user_id=p_user and revoked_at is null;
 end if;
 insert into sim_murid_private.activity_logs(actor_kind,action,entity_type,entity_id,request_id,metadata) values('system',case when e.purpose='verify' then 'auth.email_verified' else 'auth.email_recovery_started' end,'profile',p_user,coalesce(p_operation,p_id),jsonb_build_object('challenge_id',p_id));
 return true;
end;$$;
revoke all on function public.app_email_recovery_identity(text),public.app_email_context(uuid),public.app_email_state(uuid,uuid),public.app_email_reserve(uuid,uuid,text,uuid,text,text),public.app_email_delivery(uuid,uuid,boolean,text),public.app_email_consume(uuid,uuid,uuid,text,uuid) from public,anon,authenticated;
grant execute on function public.app_email_recovery_identity(text),public.app_email_context(uuid),public.app_email_state(uuid,uuid),public.app_email_reserve(uuid,uuid,text,uuid,text,text),public.app_email_delivery(uuid,uuid,boolean,text),public.app_email_consume(uuid,uuid,uuid,text,uuid) to service_role;


create or replace function public.app_password_finish(p_user uuid,p_operation uuid) returns boolean
language plpgsql security invoker set search_path='' as $$
begin
 perform 1 from public.profiles where id=p_user and status='active' for update;
 if not found then return false; end if;
 update sim_murid_private.auth_accounts set must_change_password=false,password_change_id=null,password_change_started_at=null
 where user_id=p_user and password_change_id=p_operation;
 if not found then return false; end if;
 update sim_murid_private.email_verifications set status='superseded' where user_id=p_user and purpose='recovery' and status='pending';
 insert into sim_murid_private.activity_logs(actor_id,actor_kind,action,entity_type,entity_id,request_id) values(p_user,'user','auth.password_changed','profile',p_user,p_operation);
 return true;
end;
$$;

create or replace function public.app_recovery_finish(p_actor uuid,p_session uuid,p_request uuid,p_operation uuid) returns boolean
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
 update sim_murid_private.email_verifications set status='superseded' where user_id=target and purpose='recovery' and status='pending';
 insert into sim_murid_private.activity_logs(actor_id,actor_kind,action,entity_type,entity_id,request_id,metadata)
 values(p_actor,'user','auth.recovery_password_completed','profile',target,p_operation,jsonb_build_object('recovery_id',p_request));
 return true;
end;$$;

commit;
