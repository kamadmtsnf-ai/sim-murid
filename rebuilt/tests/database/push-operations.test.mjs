import {test,after} from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {randomUUID as uuid} from 'node:crypto';
import {createIsolatedDatabase} from '../../scripts/database/harness.mjs';
const {db}=await createIsolatedDatabase();after(()=>db.close());
const val=async(q,p=[])=>Object.values((await db.query(q,p)).rows[0])[0];
const accounts={};
for(const role of ['admin','student']){
 const id=uuid(),session=uuid();accounts[role]={id,session};
 await db.query('insert into auth.users values($1)',[id]);await db.query('insert into auth.sessions(id,user_id) values($1,$2)',[session,id]);
 await db.query('insert into public.profiles(id,username,full_name,contact_email) values($1,$2,$2,$3)',[id,role,role+'@example.invalid']);
 await db.query('insert into public.user_roles(user_id,role_code) values($1,$2)',[id,role]);
 await db.query('insert into sim_murid_private.auth_accounts(user_id,must_change_password,profile_completed_at,verified_contact_email) values($1,false,now(),$2)',[id,role+'@example.invalid']);
 await db.query("insert into sim_murid_private.security_questions(user_id,question_code,answer_hash) values($1,'q1',repeat('0',64))",[id]);await val('select public.app_auth_claim($1,$2,false)',[id,session]);
}
const student=accounts.student,admin=accounts.admin;
const cipher={iv:'A'.repeat(16),ciphertext:'c3ludGhldGlj',tag:'A'.repeat(22)};
await db.exec('update sim_murid_private.push_settings set enabled=true,dispatch_enabled=true,test_enabled=true');
const subData={installation_id:uuid(),endpoint_hash:'a'.repeat(64),subscription_hash:'b'.repeat(64),endpoint_ciphertext:cipher,keys_ciphertext:cipher,encryption_key_version:'fixture',vapid_key_version:'fixture',binding_secret_hash:'c'.repeat(64)};
const sub=(await val('select public.app_push_register($1,$2,$3)',[student.id,student.session,subData])).id;
async function event(){const id=uuid();await db.query("insert into sim_murid_private.inbox(id,recipient_id,dedup_key,title,message) values($1,$2,$3,'Synthetic','Synthetic')",[id,student.id,id]);return val("select public.app_push_enqueue($1,'test',$1,$2,now(),now()+interval '5 minutes',$3)",[id,id,sub]);}
const snapshot=()=>val('select public.app_push_operations($1,$2)',[admin.id,admin.session]);
// Managed SQL is executed unchanged apart from unsupported extension installation.
// These boundary tables/functions model pg_net/cron/Vault; no network or managed scheduler proof.
await db.exec(`create schema net;create schema vault;create schema cron;
 create table vault.decrypted_secrets(name text primary key,decrypted_secret text);
 create table net._http_response(id bigint,status_code int,timed_out boolean,error_msg text,created timestamptz default now());
 create table net.requests(id bigint generated always as identity,url text,headers jsonb,body jsonb,timeout_ms int);
 create function net.http_post(url text,headers jsonb,body jsonb,timeout_milliseconds int) returns bigint language plpgsql as $$declare i bigint;begin insert into net.requests(url,headers,body,timeout_ms) values(url,headers,body,timeout_milliseconds) returning id into i;return i;end$$;
 create table cron.job(jobid bigint generated always as identity,jobname text,username text,schedule text,command text,active boolean default true);
 create function cron.schedule(n text,s text,c text) returns bigint language plpgsql as $$declare i bigint;begin insert into cron.job(jobname,username,schedule,command) values(n,current_user,s,c) returning jobid into i;return i;end$$;
 create function cron.alter_job(job_id bigint,schedule text default null,command text default null,active boolean default null) returns void language sql as $$update cron.job j set schedule=coalesce($2,j.schedule),command=coalesce($3,j.command),active=coalesce($4,j.active) where jobid=$1$$;`);
const installer=(await readFile(new URL('../../supabase/operations/web-push-scheduler.sql',import.meta.url),'utf8')).replace('create extension if not exists pg_net;','');
await db.exec(installer);
await db.exec(installer);
const tick=()=>val('select sim_murid_private.push_schedule_tick()');
const url='https://sim-muridv2-staging.vercel.app/api/push/worker';
async function scheduler(){await db.query('update sim_murid_private.push_worker_state set scheduler_enabled=true,worker_url=$1,wake_requested=true',[url]);await db.query("insert into vault.decrypted_secrets values('sim_murid_push_worker_url',$1),('sim_murid_push_worker_secret',$2)",[url,'s'.repeat(43)]);}

function scenario(name,run){return test(name,async()=>{await db.exec('begin');try{await run();}finally{await db.exec('rollback');}});}
scenario('WP08 ops policy is opt-in, RLS/invoker service-only and admin/onboarding identity enforced',async()=>{
 assert.equal((await val('select public.app_push_cleanup()')).code,'disabled');assert.equal((await snapshot()).retention.enabled,false);
 assert.equal(await val('select public.app_push_operations($1,$2)',[student.id,student.session]),null);assert.equal(await val('select public.app_push_operations($1,$2)',[admin.id,student.session]),null);
 for(const role of ['anon','authenticated'])for(const q of ['select * from sim_murid_private.push_operations_policy','select * from sim_murid_private.push_worker_runs','select public.app_push_cleanup()',`select public.app_push_operations('${admin.id}','${admin.session}')`]){await db.exec('savepoint r;set local role '+role);await assert.rejects(()=>db.exec(q));await db.exec('rollback to r;reset role');}
 await db.exec('set local role service_role');assert.equal((await snapshot()).queue.ready,0);
});
scenario('WP08 scheduler flag is not execution evidence; stale tick and worker produce independent alarms',async()=>{
 await db.exec('update sim_murid_private.push_worker_state set scheduler_enabled=true');let s=await snapshot();assert.equal(s.scheduler.observed_recently,false);assert.ok(s.alarms.includes('scheduler_stale')&&s.alarms.includes('worker_stale'));
 await db.exec('update sim_murid_private.push_worker_state set last_tick_at=now(),last_finished=now()');s=await snapshot();assert.equal(s.scheduler.observed_recently,true);assert.equal(s.alarms.length,0);
 await db.exec("update sim_murid_private.push_worker_state set last_tick_at=now()-interval '4 minutes',last_tick_error='http_timeout'");s=await snapshot();assert.ok(s.alarms.includes('scheduler_error')&&s.alarms.includes('scheduler_stale'));
});
scenario('WP08 per-run history protects worker ownership and records crash recovery without false success',async()=>{
 const a=await val("select public.app_push_worker('enter')");assert.equal(a.code,'acquired');assert.equal((await val("select public.app_push_worker('enter')")).code,'busy');assert.equal((await val("select public.app_push_worker('leave',$1,'{}')",[uuid()])).code,'stale');
 assert.equal((await val("select public.app_push_worker('leave',$1,'{\"endpoint\":1}')",[a.token])).code,'invalid');
 await db.exec("update sim_murid_private.push_worker_state set locked_until=now()-interval '1 second',last_started=now()-interval '80 seconds'");const b=await val("select public.app_push_worker('enter')");assert.notEqual(b.token,a.token);assert.equal(await val('select status from sim_murid_private.push_worker_runs where token=$1',[a.token]),'interrupted');
 assert.equal((await val("select public.app_push_worker('leave',$1,'{\"unconfirmed\":1}')",[b.token])).code,'saved');assert.ok((await snapshot()).alarms.includes('worker_error'));
});
scenario('WP08 backlog alarms ignore future quiet/retry availability; accepted latency has true sample count',async()=>{
 await event();await db.exec("update sim_murid_private.push_deliveries set available_at=now()+interval '1 hour'");assert.equal((await snapshot()).queue.ready,0);assert.equal((await snapshot()).queue.p95_accepted_seconds,null);
 await db.exec("update sim_murid_private.push_deliveries set available_at=now()-interval '6 minutes'");assert.ok((await snapshot()).alarms.includes('backlog'));
 await db.exec("update sim_murid_private.push_deliveries set status='accepted',created_at=now()-interval '90 seconds',accepted_at=now()");const s=await snapshot();assert.equal(s.queue.accepted_samples_24h,1);assert.equal(s.queue.p95_accepted_seconds,90);
 assert.doesNotMatch(JSON.stringify(s),/endpoint_hash|ciphertext|installation_id|recipient_id|claim_token|Bearer/);
});
scenario('WP08 retention only terminal aged deliveries, bounded batches; ambiguity, inbox and dedup remain',async()=>{
 for(let i=0;i<4;i++)await event();const ids=(await db.query('select id from sim_murid_private.push_deliveries order by id')).rows.map(r=>r.id);
 await db.query("update sim_murid_private.push_deliveries set status=case when id=$1 then 'ambiguous' else 'accepted' end",[ids[0]]);
 await db.exec("update sim_murid_private.push_deliveries set status_changed_at=now()-interval '100 days';update sim_murid_private.push_operations_policy set retention_enabled=true,cleanup_batch=1");
 const before=await val('select count(*)::int from sim_murid_private.inbox');let r=await val('select public.app_push_cleanup()');assert.equal(r.deliveries,1);assert.equal(await val("select count(*)::int from sim_murid_private.push_deliveries where status='ambiguous'"),1);assert.equal(await val('select count(*)::int from sim_murid_private.inbox'),before);assert.equal(await val('select count(*)::int from sim_murid_private.push_events'),4);
 await val('select public.app_push_cleanup()');await val('select public.app_push_cleanup()');r=await val('select public.app_push_cleanup()');assert.equal(r.deliveries,0);assert.equal((await snapshot()).retention.last_counts.deliveries,0);
});
scenario('WP08 newly completed old delivery receives full retention period, not old created_at',async()=>{
 await event();await db.exec("update sim_murid_private.push_deliveries set created_at=now()-interval '200 days',status='cancelled';update sim_murid_private.push_operations_policy set retention_enabled=true");assert.equal((await val('select public.app_push_cleanup()')).deliveries,0);
});
scenario('WP08 inactive-secret cleanup preserves binding tombstone and active devices; reactivation restores usable generation',async()=>{
 await db.exec("update sim_murid_private.push_operations_policy set retention_enabled=true;update sim_murid_private.push_subscriptions set last_seen_at=now()-interval '200 days'");assert.equal((await val('select public.app_push_cleanup()')).subscriptions,0);
 await db.exec("update sim_murid_private.push_subscriptions set status='revoked',revoked_at=now()-interval '200 days'");assert.equal((await val('select public.app_push_cleanup()')).subscriptions,1);
 const row=(await db.query('select * from sim_murid_private.push_subscriptions where id=$1',[sub])).rows[0];assert.equal(row.binding_secret_hash,subData.binding_secret_hash);assert.equal(row.endpoint_hash,subData.endpoint_hash);assert.ok(row.secrets_purged_at);assert.equal(row.endpoint_ciphertext.ciphertext,'AA');
 assert.equal((await val('select public.app_push_cleanup()')).subscriptions,0);const registered=await val('select public.app_push_register($1,$2,$3)',[student.id,student.session,subData]);assert.equal(registered.code,'saved');assert.equal(await val('select secrets_purged_at from sim_murid_private.push_subscriptions where id=$1',[sub]),null);
});
scenario('WP08 ambiguity prevents purging inactive endpoint evidence; run retention keeps in-progress history',async()=>{
 await event();await db.exec("update sim_murid_private.push_deliveries set status='ambiguous';update sim_murid_private.push_subscriptions set status='invalid',last_seen_at=now()-interval '200 days';update sim_murid_private.push_operations_policy set retention_enabled=true");assert.equal((await val('select public.app_push_cleanup()')).subscriptions,0);
 await db.query("insert into sim_murid_private.push_worker_runs(token,started_at,finished_at,status) values($1,now()-interval '40 days',now()-interval '40 days','finished'),($2,now()-interval '40 days',null,'running')",[uuid(),uuid()]);assert.equal((await val('select public.app_push_cleanup()')).runs,1);assert.equal(await val("select count(*)::int from sim_murid_private.push_worker_runs where status='running'"),1);
});
scenario('WP08 managed installer is idempotent and inactive; browser/service roles cannot read HTTP credentials',async()=>{
 assert.equal(await val('select count(*)::int from cron.job'),1);assert.equal(await val('select active from cron.job'),false);assert.equal(await tick(),null);
 for(const role of ['anon','authenticated','service_role']){await db.exec('savepoint p;set local role '+role);await assert.rejects(()=>db.exec('select * from net.requests'));await db.exec('rollback to p;reset role');}
});
scenario('WP08 tick pins destination and validates credential before queueing; durable wake survives failures',async()=>{
 await scheduler();await db.exec("update sim_murid_private.push_worker_state set worker_url='https://evil.vercel.app/api/push/worker'");assert.equal(await tick(),null);assert.equal((await snapshot()).scheduler.error,'url_invalid');
 await db.query('update sim_murid_private.push_worker_state set worker_url=$1',[url]);await db.exec("update vault.decrypted_secrets set decrypted_secret='bad' where name='sim_murid_push_worker_secret'");assert.equal(await tick(),null);assert.equal((await snapshot()).scheduler.error,'secret_missing');assert.equal(await val('select wake_requested from sim_murid_private.push_worker_state'),true);assert.equal(await val('select count(*)::int from net.requests'),0);
});
scenario('WP08 tick records HTTP outcome, prevents duplicate inflight wake and retries sweeper after loss',async()=>{
 await scheduler();const first=await tick();assert.equal(typeof first,'number');assert.equal(await tick(),null);assert.equal(await val('select wake_requested from sim_murid_private.push_worker_state'),false);
 await db.query('insert into net._http_response(id,status_code,timed_out,error_msg) values($1,401,false,$2)',[first,'PRIVATE_PROVIDER_BODY']);await tick();assert.equal((await snapshot()).scheduler.error,'http_error');assert.doesNotMatch(JSON.stringify(await snapshot()),/PRIVATE_PROVIDER|Bearer/);
 await db.exec("delete from net._http_response;update sim_murid_private.push_worker_state set last_http_dispatched_at=now()-interval '80 seconds',wake_requested=true");assert.notEqual(await tick(),first);assert.equal((await snapshot()).scheduler.error,'http_missing');
});
scenario('WP08 disabled dispatch still has idle heartbeat and successful HTTP response clears alarm',async()=>{
 await scheduler();await db.exec('update sim_murid_private.push_settings set enabled=false,dispatch_enabled=false');const first=await tick();assert.ok(first);await db.query('insert into net._http_response(id,status_code,timed_out) values($1,200,false)',[first]);
 await db.exec('update sim_murid_private.push_worker_state set last_started=now(),last_finished=now()');assert.equal(await tick(),null);assert.equal((await snapshot()).scheduler.error,null);
 await db.exec("update sim_murid_private.push_worker_state set last_started=now()-interval '3 minutes'");assert.ok(await tick());
});

scenario('WP08 120 recipients with two devices each drain in bounded batches with real SQL claims',async()=>{
 await db.exec(`
  create temporary table burst as select g,gen_random_uuid() recipient,gen_random_uuid() inbox,gen_random_uuid() outbox,gen_random_uuid() event from generate_series(1,120) g;
  insert into auth.users(id) select recipient from burst;
  insert into public.profiles(id,username,full_name) select recipient,'load-'||g,'Synthetic' from burst;
  insert into sim_murid_private.inbox(id,recipient_id,dedup_key,title,message)
   select inbox,recipient,'load-'||g,'Synthetic','Synthetic' from burst;
  insert into sim_murid_private.outbox(id,idempotency_key,channel,event_type,aggregate_type,aggregate_id,payload)
   select outbox,'load-'||g,'push','device.test','inbox',inbox,'{}' from burst;
  insert into sim_murid_private.push_events(id,outbox_id,inbox_id,recipient_id,category,source_id,dedup_key,occurred_at,expires_at)
   select event,outbox,inbox,recipient,'test',inbox,'load-'||g,now(),now()+interval '1 hour' from burst;
  insert into sim_murid_private.push_subscriptions(user_id,installation_id,endpoint_hash,subscription_hash,endpoint_ciphertext,keys_ciphertext,encryption_key_version,vapid_key_version,binding_secret_hash,last_authorized_session_id)
   select recipient,gen_random_uuid(),lpad((g*2+n)::text,64,'0'),repeat('b',64),'{"iv":"AAAAAAAAAAAAAAAA","ciphertext":"AA","tag":"AAAAAAAAAAAAAAAAAAAAAA"}','{"iv":"AAAAAAAAAAAAAAAA","ciphertext":"AA","tag":"AAAAAAAAAAAAAAAAAAAAAA"}','fixture','fixture',repeat('c',64),gen_random_uuid() from burst cross join generate_series(1,2) n;
  insert into sim_murid_private.push_deliveries(event_id,subscription_id,binding_version)
   select b.event,s.id,1 from burst b join sim_murid_private.push_subscriptions s on s.user_id=b.recipient;
 `);
 const {registerAuditHooks}=await import('../audit-loader.mjs');
 registerAuditHooks({'server-only':'export {};'});
 const {runPushWorker}=await import('../../src/lib/push/worker.ts');
 const config={enabled:true,dispatch:true,test:true,categories:[]};
 const repo={
  enter:()=>val("select public.app_push_worker('enter')"),
  async maintenance(){await val("select public.app_push_maintenance(true,true,'{}')");},
  async claim(){const r=await val('select public.app_push_claim()');return r.code==='claimed'?r:null;},
  async preflight(c){const d=c.delivery;const r=await val('select public.app_push_preflight($1,$2,$3)',[d.id,d.claim_token,d.binding_version]);return r.code==='ready'?r:null;},
  async complete(c,r){const d=c.delivery;return (await val('select public.app_push_result($1,$2,$3,$4,$5)',[d.id,d.claim_token,d.binding_version,r.status,201])).status;},
  async leave(t,m){return (await val("select public.app_push_worker('leave',$1,$2)",[t,m])).code==='saved';},
 };
 const elapsed=performance.now(),ids=new Set();
 const send=async(c,_config,guard)=>{assert.ok(await guard());assert.ok(!ids.has(c.delivery.id));ids.add(c.delivery.id);return {status:'accepted'};};
 for(let batch=0;batch<12;batch++){
  const r=await runPushWorker(repo,config,send);
  assert.equal(r.code,'processed');assert.equal(r.metrics.accepted,20);
  assert.equal((await snapshot()).queue.ready,240-(batch+1)*20);
  // Advance the worker rate-limiter between simulated minute ticks; no real network.
  await db.exec("update sim_murid_private.push_worker_state set last_started=now()-interval '1 minute'");
 }
 assert.equal(ids.size,240);assert.equal((await snapshot()).queue.accepted_samples_24h,240);
 console.log(JSON.stringify({scenario:'synthetic burst',recipients:120,devicesPerRecipient:2,deliveries:240,batches:12,localRuntimeMs:Math.round(performance.now()-elapsed),providerSends:0}));
});

scenario('WP08 encryption-only reconcile keeps binding and queued delivery while storing the new ciphertext generation',async()=>{
 const e=await event();assert.equal(e.code,'saved');
 const reencrypted={...subData,encryption_key_version:'fixture-v2',endpoint_ciphertext:{...cipher,ciphertext:'ZW5jcnlwdGVk'}};
 const r=await val('select public.app_push_register($1,$2,$3)',[student.id,student.session,reencrypted]);
 assert.equal(r.code,'saved');assert.equal(r.binding_version,1);
 const claimed=await val('select public.app_push_claim()');
 assert.equal(claimed.subscription.encryption_key_version,'fixture-v2');
 assert.deepEqual(claimed.subscription.endpoint_ciphertext,reencrypted.endpoint_ciphertext);
});
