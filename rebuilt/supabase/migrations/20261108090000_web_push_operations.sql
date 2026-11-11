begin;
-- Additive operations only. No network, activation or deletion on migration replay.
create table sim_murid_private.push_operations_policy (
 singleton boolean primary key default true check(singleton),
 retention_enabled boolean not null default false,
 delivery_days integer not null default 90 check(delivery_days between 30 and 730),
 subscription_days integer not null default 180 check(subscription_days between 30 and 730),
 run_days integer not null default 30 check(run_days between 7 and 180),
 cleanup_batch integer not null default 200 check(cleanup_batch between 1 and 500)
);
insert into sim_murid_private.push_operations_policy default values;
create table sim_murid_private.push_worker_runs (
 token uuid primary key, started_at timestamptz not null default now(), finished_at timestamptz,
 status text not null default 'running' check(status in('running','finished','unconfirmed','interrupted')),
 metrics jsonb not null default '{}'
);
create index push_worker_runs_started on sim_murid_private.push_worker_runs(started_at);
alter table sim_murid_private.push_operations_policy enable row level security;
alter table sim_murid_private.push_worker_runs enable row level security;
revoke all on sim_murid_private.push_operations_policy,sim_murid_private.push_worker_runs from public,anon,authenticated;
grant select,insert,update,delete on sim_murid_private.push_operations_policy,sim_murid_private.push_worker_runs to service_role;
alter table sim_murid_private.push_worker_state
 add column last_tick_at timestamptz,
 add column last_http_dispatched_at timestamptz,
 add column last_http_response_at timestamptz,
 add column last_http_status integer check(last_http_status between 100 and 599),
 add column last_tick_error text check(last_tick_error in('secret_missing','url_invalid','http_timeout','http_error','http_missing','queue_error')),
 add column last_cleanup_at timestamptz,
 add column last_cleanup_counts jsonb not null default '{}';
alter table sim_murid_private.push_subscriptions add column secrets_purged_at timestamptz;
-- Retention ages are based on the final status transition, never old created_at alone.
alter table sim_murid_private.push_deliveries add column status_changed_at timestamptz not null default now();
create function sim_murid_private.push_status_clock() returns trigger language plpgsql security invoker set search_path='' as $$begin
 if new.status is distinct from old.status then new.status_changed_at=now();end if;return new;end$$;
create trigger push_delivery_status_clock before update of status on sim_murid_private.push_deliveries for each row execute function sim_murid_private.push_status_clock();
create function sim_murid_private.push_secret_clock() returns trigger language plpgsql security invoker set search_path='' as $$begin
 if new.status='active' then new.secrets_purged_at=null;end if;return new;end$$;
create trigger push_subscription_secret_clock before update on sim_murid_private.push_subscriptions for each row execute function sim_murid_private.push_secret_clock();
create index push_delivery_history on sim_murid_private.push_deliveries(status_changed_at,id) where status in('accepted','cancelled','expired','failed_permanent');
create index push_delivery_accepted on sim_murid_private.push_deliveries(accepted_at) where accepted_at is not null;
create index push_subscription_cleanup on sim_murid_private.push_subscriptions(last_seen_at,id) where status in('revoked','invalid','expired') and secrets_purged_at is null;

create or replace function public.app_push_worker(p_action text,p_token uuid default null,p_metrics jsonb default null) returns jsonb language plpgsql security invoker set search_path='' as $$
declare s sim_murid_private.push_worker_state%rowtype;begin
 select * into s from sim_murid_private.push_worker_state where singleton=true for update;
 if p_action='enter' then
 if s.locked_until>now() then return jsonb_build_object('code','busy');end if;
 if s.last_started>now()-interval '10 seconds' then return jsonb_build_object('code','rate_limited');end if;
 -- A crashed worker cannot be reported as successful by the next heartbeat.
 update sim_murid_private.push_worker_runs set status='interrupted',finished_at=now() where token=s.token and status='running';
 update sim_murid_private.push_worker_state set token=gen_random_uuid(),locked_until=now()+interval '70 seconds',last_started=now() where singleton=true returning * into s;
 insert into sim_murid_private.push_worker_runs(token) values(s.token);
 return jsonb_build_object('code','acquired','token',s.token);
 elsif p_action='leave' then
 if s.token is distinct from p_token or s.locked_until<=now() or p_token is null then return jsonb_build_object('code','stale');end if;
 if jsonb_typeof(p_metrics) is distinct from 'object' then return jsonb_build_object('code','invalid');end if;
 if octet_length(p_metrics::text)>1024
 or p_metrics-array['claimed','providerAccepted','accepted','retry','permanent','ambiguous','cancelled','unconfirmed','skipped']<>'{}'::jsonb
 or exists(select 1 from jsonb_each(p_metrics) where jsonb_typeof(value)<>'number' or value::text !~ '^[0-9]{1,3}$') then return jsonb_build_object('code','invalid');end if;
 update sim_murid_private.push_worker_runs set finished_at=now(),metrics=p_metrics,status=case when coalesce((p_metrics->>'unconfirmed')::int,0)>0 then 'unconfirmed' else 'finished' end where token=p_token;
 update sim_murid_private.push_worker_state set token=null,locked_until=null,last_finished=now(),last_metrics=p_metrics where singleton=true;
 return jsonb_build_object('code','saved');end if;
 return jsonb_build_object('code','invalid');end$$;

-- Explicit opt-in policy. Ambiguous/pending/processing, source ledger, events, inbox,
-- outbox and account-binding tombstones are NEVER deleted by this job.
create function public.app_push_cleanup() returns jsonb language plpgsql security invoker set search_path='' as $$
declare p sim_murid_private.push_operations_policy%rowtype;d integer:=0;s integer:=0;r integer:=0;begin
 select * into p from sim_murid_private.push_operations_policy where singleton=true;
 if not p.retention_enabled then return jsonb_build_object('code','disabled');end if;
 -- Limit each class independently; SKIP LOCKED yields to active domain/worker work.
 with picked as(select id from sim_murid_private.push_deliveries where status in('accepted','cancelled','expired','failed_permanent') and status_changed_at<now()-make_interval(days=>p.delivery_days) order by status_changed_at,id limit p.cleanup_batch for update skip locked)
 delete from sim_murid_private.push_deliveries d using picked x where d.id=x.id;
 get diagnostics d=row_count;
 with picked as(select x.id from sim_murid_private.push_subscriptions x where x.status in('revoked','invalid','expired') and x.secrets_purged_at is null and x.last_seen_at<now()-make_interval(days=>p.subscription_days) and coalesce(x.revoked_at,x.last_seen_at)<now()-make_interval(days=>p.subscription_days) and not exists(select 1 from sim_murid_private.push_deliveries d where d.subscription_id=x.id and d.status in('queued','retry_wait','processing','ambiguous')) order by x.last_seen_at,x.id limit p.cleanup_batch for update skip locked)
 update sim_murid_private.push_subscriptions x set endpoint_ciphertext=jsonb_build_object('iv',repeat('A',16),'ciphertext','AA','tag',repeat('A',22)),keys_ciphertext=jsonb_build_object('iv',repeat('A',16),'ciphertext','AA','tag',repeat('A',22)),label='',secrets_purged_at=now() from picked picked_row where picked_row.id=x.id;
 get diagnostics s=row_count;
 with picked as(select token from sim_murid_private.push_worker_runs where status<>'running' and finished_at<now()-make_interval(days=>p.run_days) order by started_at limit p.cleanup_batch for update skip locked)
 delete from sim_murid_private.push_worker_runs r using picked picked_row where r.token=picked_row.token;
 get diagnostics r=row_count;
 -- Last in lock order: delivery -> subscription -> worker state.
 update sim_murid_private.push_worker_state set last_cleanup_at=now(),last_cleanup_counts=jsonb_build_object('deliveries',d,'subscriptions',s,'runs',r) where singleton=true;
 return jsonb_build_object('code','saved','deliveries',d,'subscriptions',s,'runs',r);end$$;

create function sim_murid_private.push_operations_snapshot() returns jsonb language plpgsql stable security invoker set search_path='' as $$
declare s sim_murid_private.push_worker_state%rowtype;p sim_murid_private.push_operations_policy%rowtype;c sim_murid_private.push_settings%rowtype;
 oldest timestamptz;active boolean;alarms text[]:='{}';n integer;latency numeric;samples integer;begin
 select * into s from sim_murid_private.push_worker_state where singleton=true;
 select * into p from sim_murid_private.push_operations_policy where singleton=true;
 select * into c from sim_murid_private.push_settings where singleton=true;
 select min(available_at) into oldest from sim_murid_private.push_deliveries where status in('queued','retry_wait') and available_at<=now();
 active=s.scheduler_enabled and s.last_tick_at>now()-interval '3 minutes';
 if s.scheduler_enabled and not coalesce(active,false) then alarms=array_append(alarms,'scheduler_stale');end if;
 if s.scheduler_enabled and (s.last_finished is null or s.last_finished<now()-interval '5 minutes') then alarms=array_append(alarms,'worker_stale');end if;
 if s.scheduler_enabled and s.last_tick_error is not null then alarms=array_append(alarms,'scheduler_error');end if;
 if oldest<now()-interval '5 minutes' then alarms=array_append(alarms,'backlog');end if;
 if exists(select 1 from sim_murid_private.push_deliveries where status='processing' and locked_until<=now()) then alarms=array_append(alarms,'lease_expired');end if;
 if exists(select 1 from sim_murid_private.push_deliveries where status='ambiguous') then alarms=array_append(alarms,'ambiguous');end if;
 if exists(select 1 from sim_murid_private.push_deliveries where status='failed_permanent' and status_changed_at>now()-interval '24 hours' and last_error_code in('vapid_invalid','provider_unauthorized','key_version_unavailable','cipher_invalid')) then alarms=array_append(alarms,'keys');end if;
 select count(*) into n from sim_murid_private.push_deliveries where status='failed_permanent' and last_error_code='endpoint_invalid' and status_changed_at>now()-interval '1 hour';
 if n>=5 then alarms=array_append(alarms,'invalid_endpoints');end if;
 if exists(select 1 from sim_murid_private.push_worker_runs where status in('unconfirmed','interrupted') and coalesce(finished_at,started_at)>now()-interval '1 hour') then alarms=array_append(alarms,'worker_error');end if;
 select count(*)::int,round((percentile_cont(0.95) within group(order by extract(epoch from(accepted_at-created_at))))::numeric,3) into samples,latency from sim_murid_private.push_deliveries where accepted_at>now()-interval '24 hours';
 return jsonb_build_object('checked_at',now(),'alarms',alarms,'scheduler',jsonb_build_object('enabled',s.scheduler_enabled,'observed_recently',coalesce(active,false),'last_tick',s.last_tick_at,'last_dispatched',s.last_http_dispatched_at,'last_response',s.last_http_response_at,'http_status',s.last_http_status,'error',s.last_tick_error),
 'worker',jsonb_build_object('last_started',s.last_started,'last_finished',s.last_finished,'runs_24h',(select count(*) from sim_murid_private.push_worker_runs where started_at>now()-interval '24 hours'),'errors_1h',(select count(*) from sim_murid_private.push_worker_runs where status in('unconfirmed','interrupted') and coalesce(finished_at,started_at)>now()-interval '1 hour')),
 'queue',jsonb_build_object('ready',(select count(*) from sim_murid_private.push_deliveries where status in('queued','retry_wait') and available_at<=now()),'oldest_ready',oldest,'accepted_samples_24h',samples,'p95_accepted_seconds',latency,'invalid_endpoints_1h',n),
 'retention',jsonb_build_object('enabled',p.retention_enabled,'delivery_days',p.delivery_days,'subscription_days',p.subscription_days,'run_days',p.run_days,'batch',p.cleanup_batch,'last_cleanup',s.last_cleanup_at,'last_counts',s.last_cleanup_counts));end$$;
create function public.app_push_operations(p_actor uuid,p_session uuid) returns jsonb language sql stable security invoker set search_path='' as $$
 select case when public.app_onboarding_ready(p_actor,p_session) and public.app_education_admin(p_actor,p_session) then sim_murid_private.push_operations_snapshot() else null end$$;
revoke all on function public.app_push_cleanup(),public.app_push_operations(uuid,uuid),sim_murid_private.push_operations_snapshot(),sim_murid_private.push_status_clock(),sim_murid_private.push_secret_clock() from public,anon,authenticated;
grant execute on function public.app_push_cleanup(),public.app_push_operations(uuid,uuid),sim_murid_private.push_operations_snapshot(),sim_murid_private.push_status_clock(),sim_murid_private.push_secret_clock() to service_role;
commit;
