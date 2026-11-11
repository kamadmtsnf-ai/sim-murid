-- Managed Supabase only. Install AFTER core migration; NOT part of local/PGlite replay.
-- Requires WP-08 core migration. No credential literal and no activation. An operator must provision the scoped worker
-- secret in Vault as sim_murid_push_worker_secret; pin the exact worker_url also in
-- Vault sim_murid_push_worker_url. Destination restricted to Vercel HTTPS hosts.
begin;
create extension if not exists pg_net;
-- Supabase Vault and pg_cron must already be installed in the target environment.
-- Only the privileged cron owner can decrypt this single purpose secret.
create or replace function sim_murid_private.push_schedule_tick() returns bigint language plpgsql security invoker set search_path='' as $$
declare s sim_murid_private.push_worker_state%rowtype;secret text;bypass text;pinned_url text;h jsonb;rid bigint;c sim_murid_private.push_settings%rowtype;response record;begin
 -- Every cron tick is observable, including idle and disabled ticks. No credentials/body logged.
 update sim_murid_private.push_worker_state set last_tick_at=now() where singleton=true;
 select * into s from sim_murid_private.push_worker_state where singleton=true;
 if not s.scheduler_enabled then return null;end if;
 if s.last_http_request_id is not null then
  select status_code,timed_out,error_msg is not null has_error,created into response from net._http_response where id=s.last_http_request_id;
  if found then
   update sim_murid_private.push_worker_state set last_http_response_at=response.created,last_http_status=response.status_code,
    last_tick_error=case when response.timed_out then 'http_timeout' when response.has_error or response.status_code is null or response.status_code not between 200 and 299 then 'http_error' else null end where singleton=true;
  elsif s.last_http_dispatched_at>now()-interval '65 seconds' then return null;
  else update sim_murid_private.push_worker_state set last_tick_error='http_missing' where singleton=true;end if;
 end if;
 if s.locked_until>now() then return null;end if;
 select * into c from sim_murid_private.push_settings where singleton=true;
 -- Idle heartbeat/maintenance at least every two minutes; no need for a browser tab.
 if not s.wake_requested and s.last_started>now()-interval '2 minutes'
 and not(c.enabled and c.dispatch_enabled and 'surveys'=any(c.categories) and 'surveys'=any(c.expanded_pilot_categories))
 and not exists(select 1 from sim_murid_private.push_deliveries where (status in('queued','retry_wait') and available_at<=now()) or (status='processing' and locked_until<=now())) then return null;end if;
 -- The HTTP worker owns maintenance. Do not lock delivery rows while holding
 -- worker state, which is also locked by the domain wake trigger.
 -- Compare the exact operator-pinned destination BEFORE decrypting a bearer.
 select decrypted_secret into pinned_url from vault.decrypted_secrets where name='sim_murid_push_worker_url';
 if s.worker_url is null or s.worker_url is distinct from pinned_url or s.worker_url !~ '^https://[a-z0-9][a-z0-9.-]*\.vercel\.app/api/push/worker$' then
  update sim_murid_private.push_worker_state set last_tick_error='url_invalid' where singleton=true;return null;end if;
 select decrypted_secret into secret from vault.decrypted_secrets where name='sim_murid_push_worker_secret';
 if secret is null or secret !~ '^[A-Za-z0-9_-]{43,128}$' then update sim_murid_private.push_worker_state set last_tick_error='secret_missing' where singleton=true;return null;end if;
 select decrypted_secret into bypass from vault.decrypted_secrets where name='sim_murid_push_deployment_bypass';
 h=jsonb_build_object('Content-Type','application/json','Authorization','Bearer '||secret);
 if bypass is not null then h=h||jsonb_build_object('x-vercel-protection-bypass',bypass);end if;
 -- Queued transactionally; pg_net sends AFTER COMMIT. Error text/response body is never persisted.
 begin
  select net.http_post(url:=s.worker_url,headers:=h,body:='{}'::jsonb,timeout_milliseconds:=50000) into rid;
 exception when others then
  update sim_murid_private.push_worker_state set last_tick_error='queue_error' where singleton=true;return null;
 end;
 update sim_murid_private.push_worker_state set wake_requested=false,last_http_request_id=rid,last_http_dispatched_at=now() where singleton=true;
 return rid;end$$;
revoke all on function sim_murid_private.push_schedule_tick() from public,anon,authenticated,service_role;
-- This app had no pg_net consumer at baseline. Keep its request queue/credentials privileged.
revoke all on schema net from public,anon,authenticated,service_role;
revoke all on all tables in schema net from public,anon,authenticated,service_role;
revoke all on all functions in schema net from public,anon,authenticated,service_role;
revoke all on all sequences in schema net from public,anon,authenticated,service_role;
-- Create/update only this app's job, atomically inactive before COMMIT.
-- The operator activates BOTH the cron job and scheduler_enabled only after staging UAT.
do $$declare jid bigint;begin
 select jobid into jid from cron.job where jobname='sim-murid-web-push-sweep' and username=current_user;
 if jid is null then select cron.schedule('sim-murid-web-push-sweep','* * * * *','select sim_murid_private.push_schedule_tick()') into jid;
 else perform cron.alter_job(jid,schedule:='* * * * *',command:='select sim_murid_private.push_schedule_tick()',active:=false);end if;
 perform cron.alter_job(jid,active:=false);
end$$;
-- Cron polls the durable transaction wake flag AND ready rows, recovering lost HTTP wakes.
commit;
