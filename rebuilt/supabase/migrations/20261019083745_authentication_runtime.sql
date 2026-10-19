begin;
create table sim_murid_private.auth_attempts (
 key_hash text primary key check(key_hash ~ '^[0-9a-f]{64}$'),
 window_started_at timestamptz not null default now(),
 attempts integer not null check(attempts between 1 and 101)
);
alter table sim_murid_private.auth_attempts enable row level security;
revoke all on sim_murid_private.auth_attempts from public,anon,authenticated;
grant select,insert,update,delete on sim_murid_private.auth_attempts to service_role;
create table sim_murid_private.auth_accounts (
 user_id uuid primary key references public.profiles(id) on delete restrict,
 must_change_password boolean not null default true
);
alter table sim_murid_private.auth_accounts enable row level security;
revoke all on sim_murid_private.auth_accounts from public,anon,authenticated;
grant select,insert,update,delete on sim_murid_private.auth_accounts to service_role;

-- Service-only RPCs bridge the unexposed schema. They do not bypass RLS.
create function public.app_auth_attempt(p_key text) returns boolean
language plpgsql security invoker set search_path='' as $$
declare n integer;
begin
 insert into sim_murid_private.auth_attempts(key_hash,attempts) values(p_key,1)
 on conflict(key_hash) do update set
 attempts=case when auth_attempts.window_started_at<=now()-interval '15 minutes' then 1 else least(auth_attempts.attempts+1,101) end,
 window_started_at=case when auth_attempts.window_started_at<=now()-interval '15 minutes' then now() else auth_attempts.window_started_at end
 returning attempts into n;
 return n<=30;
end;
$$;
create function public.app_auth_claim(p_user uuid,p_session uuid,p_remember boolean) returns boolean
language plpgsql security invoker set search_path='' as $$
begin
 -- Lock the identity row before checking/replacing an expired session slot.
 perform 1 from public.profiles where id=p_user and status='active' for update;
 if not found then return false; end if;
 update sim_murid_private.app_sessions set revoked_at=now(),revocation_reason='expired'
 where user_id=p_user and revoked_at is null and expires_at<=now();
 if exists(select 1 from sim_murid_private.app_sessions where user_id=p_user and revoked_at is null) then return false; end if;
 insert into sim_murid_private.app_sessions(user_id,auth_session_id,expires_at,remember_me)
 values(p_user,p_session,now()+case when p_remember then interval '168 hours' else interval '1 hour' end,p_remember);
 insert into sim_murid_private.activity_logs(actor_id,actor_kind,action,entity_type,entity_id,request_id)
 values(p_user,'user','auth.login','profile',p_user,gen_random_uuid());
 return true;
end;
$$;
create function public.app_auth_principal(p_user uuid,p_session uuid) returns jsonb
language sql stable security invoker set search_path='' as $$
 select jsonb_build_object('id',p.id,'username',p.username,'full_name',p.full_name,
 'expires_at',s.expires_at,'must_change_password',coalesce(a.must_change_password,true))
 from public.profiles p join sim_murid_private.app_sessions s on s.user_id=p.id
 left join sim_murid_private.auth_accounts a on a.user_id=p.id
 where p.id=p_user and p.status='active' and s.auth_session_id=p_session and s.revoked_at is null and s.expires_at>now();
$$;
create function public.app_auth_revoke(p_user uuid,p_session uuid) returns void
language plpgsql security invoker set search_path='' as $$
begin
 update sim_murid_private.app_sessions set revoked_at=now(),revocation_reason='logout'
 where user_id=p_user and auth_session_id=p_session and revoked_at is null;
 if found then
 insert into sim_murid_private.activity_logs(actor_id,actor_kind,action,entity_type,entity_id,request_id)
 values(p_user,'user','auth.logout','profile',p_user,gen_random_uuid());
 end if;
end;
$$;
revoke all on function public.app_auth_attempt(text),public.app_auth_claim(uuid,uuid,boolean),public.app_auth_principal(uuid,uuid),public.app_auth_revoke(uuid,uuid) from public,anon,authenticated;
grant execute on function public.app_auth_attempt(text),public.app_auth_claim(uuid,uuid,boolean),public.app_auth_principal(uuid,uuid),public.app_auth_revoke(uuid,uuid) to service_role;
commit;
