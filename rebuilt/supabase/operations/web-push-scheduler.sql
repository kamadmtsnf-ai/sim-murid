-- Managed Supabase only. Install AFTER core migration; NOT part of local/PGlite replay.
-- No credential literal and no activation. An operator must provision the scoped worker
-- secret in Vault as sim_murid_push_worker_secret and configure the exact worker_url.
begin;
create extension if not exists pg_net;
-- Supabase Vault and pg_cron must already be installed in the target environment.
-- Only the privileged cron owner can decrypt this single purpose secret.
create or replace function sim_murid_private.push_schedule_tick() returns bigint language plpgsql security invoker set search_path='' as $$
declare s sim_murid_private.push_worker_state%rowtype;secret text;bypass text;h jsonb;rid bigint;c sim_murid_private.push_settings%rowtype;begin
 select * into s from sim_murid_private.push_worker_state where singleton=true for update;
 select * into c from sim_murid_private.push_settings;
 if not s.scheduler_enabled or s.worker_url is null then return null;end if;
 if s.locked_until>now() then return null;end if;
 if not s.wake_requested and not exists(select 1 from sim_murid_private.push_deliveries where status in('queued','retry_wait') and available_at<=now() or status='processing' and locked_until<=now()) then return null;end if;
 -- Off channels are cancelled, not accumulated for a future mass dispatch.
 perform public.app_push_maintenance(c.enabled,c.test_enabled,c.categories);
 if not c.enabled then update sim_murid_private.push_worker_state set wake_requested=false where singleton=true;return null;end if;
 select decrypted_secret into secret from vault.decrypted_secrets where name='sim_murid_push_worker_secret';
 if secret is null or secret !~ '^[A-Za-z0-9_-]{43,128}$' then raise exception 'Push scheduler credential unavailable';end if;
 select decrypted_secret into bypass from vault.decrypted_secrets where name='sim_murid_push_deployment_bypass';
 h=jsonb_build_object('Content-Type','application/json','Authorization','Bearer '||secret);
 if bypass is not null then h=h||jsonb_build_object('x-vercel-protection-bypass',bypass);end if;
 -- pg_net queues in this transaction and starts HTTP only AFTER COMMIT.
 select net.http_post(url:=s.worker_url,headers:=h,body:='{}'::jsonb,timeout_milliseconds:=50000) into rid;
 update sim_murid_private.push_worker_state set wake_requested=false,last_http_request_id=rid where singleton=true;
 return rid;end$$;
revoke all on function sim_murid_private.push_schedule_tick() from public,anon,authenticated,service_role;
-- This app had no pg_net consumer at baseline. Keep its request queue/credentials privileged.
revoke all on schema net from public,anon,authenticated,service_role;
revoke all on all tables in schema net from public,anon,authenticated,service_role;
revoke all on all functions in schema net from public,anon,authenticated,service_role;
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
