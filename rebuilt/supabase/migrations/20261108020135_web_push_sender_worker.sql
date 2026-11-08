begin;
create table sim_murid_private.push_worker_state(
 singleton boolean primary key default true check(singleton), token uuid, locked_until timestamptz,
 last_started timestamptz,last_finished timestamptz,last_metrics jsonb not null default '{}',
 wake_requested boolean not null default false,
 scheduler_enabled boolean not null default false,
 worker_url text check(worker_url ~ '^https://[a-z0-9.-]+/api/push/worker$'),last_http_request_id bigint,
 check((token is null)=(locked_until is null))
);
insert into sim_murid_private.push_worker_state default values;
alter table sim_murid_private.push_worker_state enable row level security;
revoke all on sim_murid_private.push_worker_state from public,anon,authenticated;
grant select,insert,update,delete on sim_murid_private.push_worker_state to service_role;
create function sim_murid_private.push_request_wake() returns trigger language plpgsql security invoker set search_path='' as $$begin
 update sim_murid_private.push_worker_state set wake_requested=true where singleton=true;return new;end$$;
revoke all on function sim_murid_private.push_request_wake() from public,anon,authenticated;
grant execute on function sim_murid_private.push_request_wake() to service_role;
create trigger push_delivery_wake after insert on sim_murid_private.push_deliveries for each statement execute function sim_murid_private.push_request_wake();
create function public.app_push_worker(p_action text,p_token uuid default null,p_metrics jsonb default null) returns jsonb language plpgsql security invoker set search_path='' as $$
declare s sim_murid_private.push_worker_state%rowtype;begin
 select * into s from sim_murid_private.push_worker_state where singleton=true for update;
 if p_action='enter' then
 if s.locked_until>now() then return jsonb_build_object('code','busy');end if;
 if s.last_started>now()-interval '10 seconds' then return jsonb_build_object('code','rate_limited');end if;
 update sim_murid_private.push_worker_state set token=gen_random_uuid(),locked_until=now()+interval '70 seconds',last_started=now() where singleton=true returning * into s;
 return jsonb_build_object('code','acquired','token',s.token);
 elsif p_action='leave' then
 if s.token is distinct from p_token or s.locked_until<=now() or p_token is null then return jsonb_build_object('code','stale');end if;
 if jsonb_typeof(p_metrics) is distinct from 'object' then return jsonb_build_object('code','invalid');end if;
 if octet_length(p_metrics::text)>1024
 or p_metrics-array['claimed','providerAccepted','accepted','retry','permanent','ambiguous','cancelled','unconfirmed','skipped']<>'{}'::jsonb
 or exists(select 1 from jsonb_each(p_metrics) where jsonb_typeof(value)<>'number' or value::text !~ '^[0-9]{1,3}$') then return jsonb_build_object('code','invalid');end if;
 update sim_murid_private.push_worker_state set token=null,locked_until=null,last_finished=now(),last_metrics=p_metrics where singleton=true;
 return jsonb_build_object('code','saved');end if;
 return jsonb_build_object('code','invalid');end$$;
create function public.app_push_maintenance(p_enabled boolean,p_test boolean,p_categories text[]) returns jsonb language plpgsql security invoker set search_path='' as $$
declare n integer;begin
 update sim_murid_private.push_deliveries set status='ambiguous',claim_token=null,locked_until=null,last_error_code='lease_expired' where status='processing' and locked_until<=now();
 update sim_murid_private.push_deliveries d set status='expired',claim_token=null,locked_until=null,last_error_code='ttl_expired' from sim_murid_private.push_events e where e.id=d.event_id and d.status in('queued','retry_wait') and e.expires_at<=now();
 update sim_murid_private.push_deliveries d set status='cancelled',claim_token=null,locked_until=null,last_error_code='channel_disabled' from sim_murid_private.push_events e,sim_murid_private.push_settings c where e.id=d.event_id and d.status in('queued','retry_wait','processing') and (not coalesce(p_enabled,false) or not c.enabled or (e.category='test' and (not coalesce(p_test,false) or not c.test_enabled)) or (e.category<>'test' and (not(e.category=any(coalesce(p_categories,'{}'))) or not(e.category=any(c.categories)))));
 get diagnostics n=row_count;return jsonb_build_object('code','saved','cancelled',n);end$$;
create function public.app_push_preflight(p_id uuid,p_token uuid,p_binding bigint) returns jsonb language plpgsql security invoker set search_path='' as $$
declare d sim_murid_private.push_deliveries%rowtype;e sim_murid_private.push_events%rowtype;s sim_murid_private.push_subscriptions%rowtype;c sim_murid_private.push_settings%rowtype;nb timestamptz;begin
 select * into d from sim_murid_private.push_deliveries where id=p_id for update;
 if not found or d.status<>'processing' or d.claim_token is distinct from p_token or d.binding_version<>p_binding or d.locked_until<=now()+interval '12 seconds' then return jsonb_build_object('code','stale');end if;
 select * into e from sim_murid_private.push_events where id=d.event_id;select * into s from sim_murid_private.push_subscriptions where id=d.subscription_id;select * into c from sim_murid_private.push_settings;
 if e.expires_at<=now()+interval '1 second' or(s.expires_at is not null and s.expires_at<=now()) then update sim_murid_private.push_deliveries set status='expired',claim_token=null,locked_until=null,last_error_code='ttl_expired' where id=d.id;return jsonb_build_object('code','expired');end if;
 if not c.enabled or not c.dispatch_enabled or (e.category='test' and not c.test_enabled) or(e.category<>'test' and (not(e.category=any(c.categories)) or not exists(select 1 from sim_murid_private.push_preferences where user_id=e.recipient_id and e.category=any(categories)))) or s.status<>'active' or s.binding_version<>p_binding or s.user_id<>e.recipient_id or not sim_murid_private.push_eligible(e.id) then
 update sim_murid_private.push_deliveries set status='cancelled',claim_token=null,locked_until=null,last_error_code='eligibility_changed' where id=d.id;return jsonb_build_object('code','cancelled');end if;
 -- Preferences may change or quiet hours may begin after claim/DNS resolution.
 nb=case when e.category='test' then now() else sim_murid_private.push_not_before(e.recipient_id,now()) end;
 if nb>now() then
 update sim_murid_private.push_deliveries set status=case when nb>=e.expires_at then 'expired' else 'retry_wait' end,available_at=nb,attempts=greatest(0,attempts-1),claim_token=null,locked_until=null,last_error_code=case when nb>=e.expires_at then 'ttl_expired' else 'quiet_hours' end where id=d.id;
 return jsonb_build_object('code','deferred');end if;
 return jsonb_build_object('code','ready','event_ref',e.id,'delivery_ref',d.delivery_ref,'category',e.category,'expires_at',e.expires_at);end$$;
create function public.app_push_result(p_id uuid,p_token uuid,p_binding bigint,p_status text,p_code integer default null,p_retry integer default null,p_error text default null) returns jsonb language plpgsql security invoker set search_path='' as $$
declare r jsonb;begin
 if p_error is not null and p_error not in('endpoint_rejected','dns_unavailable','cipher_invalid','key_version_unavailable','payload_invalid','vapid_invalid','provider_unauthorized','provider_redirect','provider_rejected','provider_unavailable','provider_rate_limited','endpoint_invalid','network_unavailable','transport_timeout','tls_rejected','send_uncertain','channel_disabled','ttl_expired') then return jsonb_build_object('code','invalid');end if;
 r=public.app_push_complete(p_id,p_token,p_binding,p_status,p_code,p_retry);
 if r->>'code'='saved' then update sim_murid_private.push_deliveries set last_error_code=p_error where id=p_id;end if;return r;end$$;
revoke all on function public.app_push_worker(text,uuid,jsonb),public.app_push_maintenance(boolean,boolean,text[]),public.app_push_preflight(uuid,uuid,bigint),public.app_push_result(uuid,uuid,bigint,text,integer,integer,text) from public,anon,authenticated;
grant execute on function public.app_push_worker(text,uuid,jsonb),public.app_push_maintenance(boolean,boolean,text[]),public.app_push_preflight(uuid,uuid,bigint),public.app_push_result(uuid,uuid,bigint,text,integer,integer,text) to service_role;

create function public.app_push_status(p_actor uuid,p_session uuid) returns jsonb language sql stable security invoker set search_path='' as $$
 select case when not public.app_onboarding_ready(p_actor,p_session) or not public.app_education_admin(p_actor,p_session) then null else jsonb_build_object(
 'counts',(select coalesce(jsonb_object_agg(status,n),'{}') from(select status,count(*)::integer n from sim_murid_private.push_deliveries group by status)x),
 'errors',(select coalesce(jsonb_object_agg(last_error_code,n),'{}') from(select last_error_code,count(*)::integer n from sim_murid_private.push_deliveries where last_error_code is not null and created_at>now()-interval '24 hours' group by last_error_code)x),
 'alarm',exists(select 1 from sim_murid_private.push_deliveries where (status in('queued','retry_wait') and available_at<now()-interval '5 minutes') or (status='failed_permanent' and last_error_code in('vapid_invalid','provider_unauthorized','key_version_unavailable') and created_at>now()-interval '24 hours')),
 'oldest_ready_at',(select min(available_at) from sim_murid_private.push_deliveries where status in('queued','retry_wait') and available_at<=now()),
 'worker',(select jsonb_build_object('last_started',last_started,'last_finished',last_finished,'last_metrics',last_metrics,'scheduler_enabled',scheduler_enabled) from sim_murid_private.push_worker_state where singleton=true),
 'database_dispatch',(select enabled and dispatch_enabled from sim_murid_private.push_settings)) end
$$;
revoke all on function public.app_push_status(uuid,uuid) from public,anon,authenticated;
grant execute on function public.app_push_status(uuid,uuid) to service_role;
commit;
