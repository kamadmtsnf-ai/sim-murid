begin;
-- The account sidebar offers contact verification to every role.
-- Teacher verification remains mandatory in app_security_state; for other ready accounts it is optional.
-- Keep password/profile/question gates, session validation, ownership, quotas and HMAC unchanged.
create or replace function public.app_email_state(p_user uuid,p_session uuid) returns jsonb
language plpgsql stable security invoker set search_path='' as $$
declare gate text; email text; latest jsonb; email_ok boolean;
begin
 gate=public.app_security_state(p_user,p_session)->>'gate';
 if gate is null or gate not in ('email_pending','ready') then return null; end if;
 select p.contact_email,coalesce(f.teacher_email_verified_at is not null and p.contact_email is not null and p.contact_email=a.verified_contact_email,false)
 into email,email_ok from public.profiles p
 left join public.user_access_flags f on f.user_id=p.id
 left join sim_murid_private.auth_accounts a on a.user_id=p.id where p.id=p_user;
 select jsonb_build_object('id',id,'expires_at',expires_at,'retry_at',created_at+interval '60 seconds','status',status,'delivery_state',delivery_state,'attempts_remaining',5-attempts_used) into latest from sim_murid_private.email_verifications where user_id=p_user and purpose='verify' order by created_at desc,id limit 1;
 return jsonb_build_object('email',coalesce(email,''),'verified',coalesce(email_ok,false),'challenge',latest,'sent_today',(select count(*) from sim_murid_private.email_verifications where user_id=p_user and (created_at at time zone 'Asia/Jakarta')::date=(now() at time zone 'Asia/Jakarta')::date));
end;$$;

create or replace function public.app_email_reserve(p_user uuid,p_session uuid,p_purpose text,p_id uuid,p_hash text,p_expected_email text) returns jsonb
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
 if gate is null or gate not in ('email_pending','ready') then return jsonb_build_object('code','not_allowed'); end if;
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

create or replace function public.app_email_consume(p_user uuid,p_session uuid,p_id uuid,p_hash text,p_operation uuid default null) returns boolean
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
 if gate is null or gate not in ('email_pending','ready') then return false;end if;
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
revoke all on function public.app_email_state(uuid,uuid),public.app_email_reserve(uuid,uuid,text,uuid,text,text),public.app_email_consume(uuid,uuid,uuid,text,uuid) from public,anon,authenticated;
grant execute on function public.app_email_state(uuid,uuid),public.app_email_reserve(uuid,uuid,text,uuid,text,text),public.app_email_consume(uuid,uuid,uuid,text,uuid) to service_role;
commit;
