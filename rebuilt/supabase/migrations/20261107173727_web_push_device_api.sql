begin;
-- Bounded storage: one bucket per account/action, shared by all server instances.
create table sim_murid_private.push_api_limits (
 user_id uuid not null references public.profiles(id) on delete cascade,
 action text not null check(action in('subscriptions','preferences','revoke','test')),
 window_start timestamptz not null default now(), attempts integer not null default 1,
 primary key(user_id,action)
);
alter table sim_murid_private.push_api_limits enable row level security;
revoke all on sim_murid_private.push_api_limits from public,anon,authenticated;
grant select,insert,update,delete on sim_murid_private.push_api_limits to service_role;
create function public.app_push_rate(p_actor uuid,p_session uuid,p_action text) returns jsonb language plpgsql security invoker set search_path='' as $$
declare r sim_murid_private.push_api_limits%rowtype; lim integer;begin
 perform 1 from public.profiles where id=p_actor for update;
 if public.app_auth_principal(p_actor,p_session) is null then return jsonb_build_object('code','denied');end if;
 if p_action not in('subscriptions','preferences','revoke','test') then return jsonb_build_object('code','invalid');end if;
 lim=case when p_action='revoke' then 20 else 10 end;
 insert into sim_murid_private.push_api_limits(user_id,action) values(p_actor,p_action) on conflict do nothing returning * into r;
 if found then return jsonb_build_object('code','saved');end if;
 select * into r from sim_murid_private.push_api_limits where user_id=p_actor and action=p_action for update;
 if r.window_start<=now()-interval '1 minute' then
 update sim_murid_private.push_api_limits set window_start=now(),attempts=1 where user_id=p_actor and action=p_action;
 elsif r.attempts>=lim then return jsonb_build_object('code','rate_limited');
 else update sim_murid_private.push_api_limits set attempts=attempts+1 where user_id=p_actor and action=p_action;end if;
 return jsonb_build_object('code','saved');end$$;
create function public.app_push_config(p_actor uuid,p_session uuid) returns jsonb language sql stable security invoker set search_path='' as $$
 select case when public.app_auth_principal(p_actor,p_session) is null then null else
 (select jsonb_build_object('enabled',enabled,'test_enabled',test_enabled,'categories',categories) from sim_murid_private.push_settings) end
$$;
-- Own-device test, quota and inbox/event creation are one transaction. No provider I/O.
create function public.app_push_test(p_actor uuid,p_session uuid,p_subscription uuid,p_request uuid) returns jsonb language plpgsql security invoker set search_path='' as $$
declare iid uuid; e uuid; k text; r jsonb;begin
 perform 1 from public.profiles where id=p_actor for update;
 if public.app_auth_principal(p_actor,p_session) is null then return jsonb_build_object('code','denied');end if;
 perform 1 from sim_murid_private.push_settings where enabled and test_enabled for share;
 if not found then return jsonb_build_object('code','disabled');end if;
 if p_request is null or not exists(select 1 from sim_murid_private.push_subscriptions where id=p_subscription and user_id=p_actor and status='active' and (expires_at is null or expires_at>now())) then return jsonb_build_object('code','not_found');end if;
 k='push-test:'||p_actor::text||':'||p_request::text;
 select pe.id into e from sim_murid_private.push_events pe where pe.dedup_key=k;
 if found then
 if not exists(select 1 from sim_murid_private.push_deliveries where event_id=e and subscription_id=p_subscription) then return jsonb_build_object('code','request_conflict');end if;
 return jsonb_build_object('code','duplicate','id',e);end if;
 if (select count(*) from sim_murid_private.push_events where recipient_id=p_actor and category='test' and occurred_at>now()-interval '1 hour')>=3
 or (select count(*) from sim_murid_private.push_deliveries d join sim_murid_private.push_events pe on pe.id=d.event_id where d.subscription_id=p_subscription and pe.category='test' and pe.occurred_at>now()-interval '1 hour')>=3 then return jsonb_build_object('code','rate_limited');end if;
 insert into sim_murid_private.inbox(recipient_id,dedup_key,title,message) values(p_actor,k,'Uji notifikasi','Permintaan uji notifikasi perangkat Anda.') returning id into iid;
 r=public.app_push_enqueue(iid,'test',iid,k,now(),now()+interval '5 minutes',p_subscription);
 if r->>'code'<>'saved' then raise exception 'Test enqueue unavailable';end if;
 return r;
end$$;
revoke all on function public.app_push_rate(uuid,uuid,text),public.app_push_config(uuid,uuid),public.app_push_test(uuid,uuid,uuid,uuid) from public,anon,authenticated;
grant execute on function public.app_push_rate(uuid,uuid,text),public.app_push_config(uuid,uuid),public.app_push_test(uuid,uuid,uuid,uuid) to service_role;
-- AAD context is server-only and required to authenticate WP-03 encryption at dispatch.
create or replace function public.app_push_claim() returns jsonb language plpgsql security invoker set search_path='' as $$
declare d sim_murid_private.push_deliveries%rowtype;e sim_murid_private.push_events%rowtype;s sim_murid_private.push_subscriptions%rowtype;cfg sim_murid_private.push_settings%rowtype;nb timestamptz;begin
 select * into cfg from sim_murid_private.push_settings for share;
 update sim_murid_private.push_deliveries set status='ambiguous',locked_until=null,claim_token=null,last_error_code='claim_expired' where status='processing' and locked_until<=now();
 -- Cancellation does not depend on sender flag, and never resends an uncertain attempt.
 for d in select * from sim_murid_private.push_deliveries where status in('queued','retry_wait') order by available_at,id for update skip locked limit 100 loop
 select * into e from sim_murid_private.push_events where id=d.event_id;
 select * into s from sim_murid_private.push_subscriptions where id=d.subscription_id;
 if e.expires_at<=now() or(s.expires_at is not null and s.expires_at<=now()) then
 update sim_murid_private.push_deliveries set status='expired' where id=d.id;continue;end if;
 if not cfg.enabled or s.status<>'active' or s.user_id<>e.recipient_id or s.binding_version<>d.binding_version or not sim_murid_private.push_eligible(e.id) or (e.category='test' and not cfg.test_enabled) or(e.category<>'test' and (not(e.category=any(cfg.categories)) or not exists(select 1 from sim_murid_private.push_preferences where user_id=e.recipient_id and e.category=any(categories)))) then
 update sim_murid_private.push_deliveries set status='cancelled',last_error_code='eligibility_changed' where id=d.id;continue;end if;
 if not cfg.dispatch_enabled or d.available_at>now() then continue;end if;
 nb=case when e.category='test' then now() else sim_murid_private.push_not_before(e.recipient_id,now()) end;
 if nb>now() then update sim_murid_private.push_deliveries set available_at=nb where id=d.id;continue;end if;
 if d.attempts>=5 then update sim_murid_private.push_deliveries set status='failed_permanent',last_error_code='retry_limit' where id=d.id;continue;end if;
 update sim_murid_private.push_deliveries set status='processing',attempts=attempts+1,locked_until=now()+interval '120 seconds',claim_token=gen_random_uuid() where id=d.id returning * into d;
 return jsonb_build_object('code','claimed','delivery',to_jsonb(d),'subscription',jsonb_build_object('id',s.id,'installation_id',s.installation_id,'user_id',s.user_id,'endpoint_ciphertext',s.endpoint_ciphertext,'keys_ciphertext',s.keys_ciphertext,'encryption_key_version',s.encryption_key_version,'vapid_key_version',s.vapid_key_version),'expires_at',e.expires_at);
 end loop;return jsonb_build_object('code','empty');end$$;

commit;
