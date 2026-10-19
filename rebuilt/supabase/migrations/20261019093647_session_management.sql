begin;
-- Only the three identity/lifetime columns needed to check Auth session validity.
grant usage on schema auth to service_role;
grant select(id,user_id,not_after) on auth.sessions to service_role;
alter table sim_murid_private.app_sessions add column last_seen_at timestamptz not null default now();
create index app_sessions_user_history_idx on sim_murid_private.app_sessions(user_id,issued_at desc,id);

create or replace function public.app_auth_principal(p_user uuid,p_session uuid) returns jsonb
language sql stable security invoker set search_path='' as $$
 select jsonb_build_object('id',p.id,'username',p.username,'full_name',p.full_name,
 'expires_at',s.expires_at,'must_change_password',coalesce(a.must_change_password,true),
 'is_admin',exists(select 1 from public.user_roles r where r.user_id=p.id and r.role_code='admin'))
 from public.profiles p join sim_murid_private.app_sessions s on s.user_id=p.id
 join auth.sessions au on au.id=s.auth_session_id and au.user_id=p.id
 left join sim_murid_private.auth_accounts a on a.user_id=p.id
 where p.id=p_user and p.status='active' and s.auth_session_id=p_session and s.revoked_at is null and s.expires_at>now()
 and (au.not_after is null or au.not_after>now());
$$;

-- Keep the existing claim API compatible while enforcing a real Auth session.
create or replace function public.app_auth_claim(p_user uuid,p_session uuid,p_remember boolean) returns boolean
language plpgsql security invoker set search_path='' as $$
begin
 perform 1 from public.profiles where id=p_user and status='active' for update;
 if not found then return false; end if;
 if not exists(select 1 from auth.sessions where id=p_session and user_id=p_user and (not_after is null or not_after>now())) then return false; end if;
 update sim_murid_private.app_sessions set revoked_at=now(),revocation_reason='expired'
 where user_id=p_user and revoked_at is null and (expires_at<=now() or not exists(
 select 1 from auth.sessions au where au.id=auth_session_id and au.user_id=p_user and (au.not_after is null or au.not_after>now())));
 if exists(select 1 from sim_murid_private.app_sessions where user_id=p_user and revoked_at is null) then return false; end if;
 insert into sim_murid_private.app_sessions(user_id,auth_session_id,expires_at,remember_me)
 values(p_user,p_session,now()+case when p_remember then interval '168 hours' else interval '1 hour' end,p_remember);
 insert into sim_murid_private.activity_logs(actor_id,actor_kind,action,entity_type,entity_id,request_id)
 values(p_user,'user','auth.login','profile',p_user,gen_random_uuid());
 return true;
end;
$$;
create function public.app_auth_device(p_user uuid,p_session uuid,p_label text) returns void
language plpgsql security invoker set search_path='' as $$
begin
 if public.app_auth_principal(p_user,p_session) is null then return; end if;
 update sim_murid_private.app_sessions set device_label=left(p_label,80)
 where user_id=p_user and auth_session_id=p_session and revoked_at is null;
end;
$$;

create function public.app_session_list(p_actor uuid,p_auth_session uuid,p_username text default null) returns jsonb
language plpgsql security invoker set search_path='' as $$
declare actor jsonb; owner_id uuid; result jsonb;
begin
 actor=public.app_auth_principal(p_actor,p_auth_session);
 if actor is null then return null; end if;
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
create function public.app_session_revoke(p_actor uuid,p_auth_session uuid,p_username text default null,p_session uuid default null) returns jsonb
language plpgsql security invoker set search_path='' as $$
declare actor jsonb; owner_id uuid; revoked integer; self_revoked boolean;
begin
 -- Serialize the caller role/session and target login/revocation using identity locks in UUID order.
 select id into owner_id from public.profiles where username=coalesce(p_username,(select username from public.profiles where id=p_actor));
 if owner_id is null then return null; end if;
 perform 1 from public.profiles where id in (p_actor,owner_id) order by id for update;
 perform 1 from public.user_roles where user_id=p_actor for update;
 actor=public.app_auth_principal(p_actor,p_auth_session);
 if actor is null or (owner_id<>p_actor and not (actor->>'is_admin')::boolean) then return null; end if;
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
create or replace function public.app_auth_revoke(p_user uuid,p_session uuid) returns void
language plpgsql security invoker set search_path='' as $$
begin
 perform 1 from public.profiles where id=p_user for update;
 update sim_murid_private.app_sessions set revoked_at=now(),revocation_reason='logout'
 where user_id=p_user and auth_session_id=p_session and revoked_at is null;
 if found then
 insert into sim_murid_private.activity_logs(actor_id,actor_kind,action,entity_type,entity_id,request_id)
 values(p_user,'user','auth.logout','profile',p_user,gen_random_uuid());
 end if;
end;
$$;
revoke all on function public.app_auth_device(uuid,uuid,text),public.app_session_list(uuid,uuid,text),public.app_session_revoke(uuid,uuid,text,uuid) from public,anon,authenticated;
grant execute on function public.app_auth_device(uuid,uuid,text),public.app_session_list(uuid,uuid,text),public.app_session_revoke(uuid,uuid,text,uuid) to service_role;
commit;
