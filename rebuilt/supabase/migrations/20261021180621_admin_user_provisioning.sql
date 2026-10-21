begin;
-- A durable reservation makes retries across Auth/API failures safe. No password is stored.
create table sim_murid_private.user_provisions (
 id uuid primary key, actor uuid not null references public.profiles(id),
 username text not null unique, command jsonb not null,
 fingerprint text not null check(fingerprint ~ '^[0-9a-f]{64}$'),
 created_at timestamptz not null default now(), completed_at timestamptz
);
create index user_provisions_actor_time_idx on sim_murid_private.user_provisions(actor,created_at);
alter table sim_murid_private.user_provisions enable row level security;
revoke all on sim_murid_private.user_provisions from public,anon,authenticated;
grant select,insert,update on sim_murid_private.user_provisions to service_role;
create function public.app_user_provision_begin(p_actor uuid,p_session uuid,p_request uuid,p_command jsonb,p_fingerprint text) returns jsonb
language plpgsql security invoker set search_path='' as $$
declare previous sim_murid_private.user_provisions;
begin
 if not public.app_education_admin(p_actor,p_session) then return jsonb_build_object('code','denied');end if;
 if p_request is null or p_command is null or p_fingerprint is null or p_fingerprint !~ '^[0-9a-f]{64}$'
 or jsonb_typeof(p_command)<>'object' or (p_command - array['username','fullName','role','contactEmail'])<>'{}'::jsonb
 or jsonb_typeof(p_command->'username') is distinct from 'string' or jsonb_typeof(p_command->'fullName') is distinct from 'string' or jsonb_typeof(p_command->'role') is distinct from 'string' or jsonb_typeof(p_command->'contactEmail') is distinct from 'string'
 or coalesce(length(p_command->>'username'),0) not between 1 and 100 or p_command->>'username'<>btrim(p_command->>'username') or p_command->>'username' ~ '[[:cntrl:]]'
 or coalesce(length(btrim(p_command->>'fullName')),0) not between 1 and 200
 or coalesce(p_command->>'role','') not in('admin','teacher','student','applicant','customer','alumni','parent')
 or coalesce(length(p_command->>'contactEmail'),0)>320 then return jsonb_build_object('code','invalid');end if;
 perform pg_advisory_xact_lock(hashtextextended(p_actor::text,1));
 perform pg_advisory_xact_lock(hashtextextended(p_request::text,0));
 select * into previous from sim_murid_private.user_provisions where id=p_request;
 if found then
  if previous.actor<>p_actor or previous.command<>p_command or previous.fingerprint<>p_fingerprint then return jsonb_build_object('code','request_conflict');end if;
  return jsonb_build_object('code',case when previous.completed_at is null then 'pending' else 'created' end);
 end if;
 if exists(select 1 from auth.users where id=p_request) then return jsonb_build_object('code','request_conflict');end if;
 if exists(select 1 from public.profiles where username=p_command->>'username') or exists(select 1 from sim_murid_private.user_provisions where username=p_command->>'username') then return jsonb_build_object('code','duplicate');end if;
 if (select count(*) from sim_murid_private.user_provisions where actor=p_actor and created_at>now()-interval '15 minutes')>=20 then return jsonb_build_object('code','rate_limited');end if;
 insert into sim_murid_private.user_provisions(id,actor,username,command,fingerprint) values(p_request,p_actor,p_command->>'username',p_command,p_fingerprint);
 return jsonb_build_object('code','pending');
exception when unique_violation then return jsonb_build_object('code','duplicate');
end;$$;
create function public.app_user_provision_finish(p_actor uuid,p_session uuid,p_request uuid,p_fingerprint text) returns jsonb
language plpgsql security invoker set search_path='' as $$
declare op sim_murid_private.user_provisions;
begin
 if not public.app_education_admin(p_actor,p_session) then return jsonb_build_object('code','denied');end if;
 select * into op from sim_murid_private.user_provisions where id=p_request for update;
 if not found or op.actor<>p_actor or p_fingerprint is null or op.fingerprint<>p_fingerprint then return jsonb_build_object('code','request_conflict');end if;
 if op.completed_at is not null then return jsonb_build_object('code','created');end if;
 if not exists(select 1 from auth.users where id=p_request) then return jsonb_build_object('code','pending');end if;
 insert into public.profiles(id,username,full_name,contact_email) values(p_request,op.username,op.command->>'fullName',nullif(op.command->>'contactEmail',''));
 insert into public.user_roles(user_id,role_code) values(p_request,op.command->>'role');
 insert into sim_murid_private.auth_accounts(user_id,must_change_password) values(p_request,true);
 insert into sim_murid_private.activity_logs(actor_id,actor_kind,action,entity_type,entity_id,request_id,metadata) values(p_actor,'user','user.created','profile',p_request,p_request,jsonb_build_object('role',op.command->>'role'));
 update sim_murid_private.user_provisions set completed_at=now() where id=p_request;
 return jsonb_build_object('code','created');
exception when unique_violation then return jsonb_build_object('code','duplicate');
end;$$;
revoke all on function public.app_user_provision_begin(uuid,uuid,uuid,jsonb,text),public.app_user_provision_finish(uuid,uuid,uuid,text) from public,anon,authenticated;
grant execute on function public.app_user_provision_begin(uuid,uuid,uuid,jsonb,text),public.app_user_provision_finish(uuid,uuid,uuid,text) to service_role;
commit;
