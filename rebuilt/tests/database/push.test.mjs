import {test,after} from 'node:test';
import assert from 'node:assert/strict';
import {randomUUID as uuid} from 'node:crypto';
import {createIsolatedDatabase} from '../../scripts/database/harness.mjs';
const {db}=await createIsolatedDatabase();
after(()=>db.close());
const val=async(q,p=[])=>Object.values((await db.query(q,p)).rows[0])[0];
async function account(name){
 const id=uuid(),session=uuid();
 await db.query('insert into auth.users values($1)',[id]);
 await db.query('insert into auth.sessions(id,user_id) values($1,$2)',[session,id]);
 await db.query('insert into public.profiles(id,username,full_name,contact_email) values($1,$2,$2,$3)',[id,name,name+'@example.invalid']);
 await db.query("insert into public.user_roles(user_id,role_code) values($1,'student')",[id]);
 await db.query('insert into sim_murid_private.auth_accounts(user_id,must_change_password,profile_completed_at,verified_contact_email) values($1,false,now(),$2)',[id,name+'@example.invalid']);
 await db.query("insert into sim_murid_private.security_questions(user_id,question_code,answer_hash) values($1,'q1',repeat('0',64))",[id]);
 assert.equal(await val('select public.app_auth_claim($1,$2,false)',[id,session]),true);
 return {id,session};
}
const a=await account('push-a'),b=await account('push-b');
// Syntactic encrypted-envelope fixtures; cryptographic authenticity belongs to WP-03.
const cipher={iv:'AAAAAAAAAAAAAAAA',ciphertext:'c3ludGhldGlj',tag:'AAAAAAAAAAAAAAAAAAAAAA'};
function data(){return {installation_id:uuid(),endpoint_hash:uuid().replaceAll('-','').repeat(2),subscription_hash:'b'.repeat(64),endpoint_ciphertext:cipher,keys_ciphertext:cipher,encryption_key_version:'fixture-v1',vapid_key_version:'fixture-v1',binding_secret_hash:'c'.repeat(64),label:'Fixture'};}
const register=(u,d)=>val('select public.app_push_register($1,$2,$3)',[u.id,u.session,d]);
async function setup(){const d=data(),r=await register(a,d);assert.equal(r.code,'saved');return {d,id:r.id,version:r.binding_version};}
async function event(sub,key=uuid()){
 const inbox=uuid();await db.query("insert into sim_murid_private.inbox(id,recipient_id,dedup_key,title,message) values($1,$2,$3,'Fixture','Synthetic')",[inbox,a.id,key]);
 const args=[inbox,'test',inbox,key,sub];
 const r=await val("select public.app_push_enqueue($1,$2,$3,$4,now(),now()+interval '5 minutes',$5)",args);
 return {...r,args,inbox};
}
const claim=()=>val('select public.app_push_claim()');
const complete=(d,status='accepted',token=d.claim_token,binding=d.binding_version,code=201)=>val('select public.app_push_complete($1,$2,$3,$4,$5)',[d.id,token,binding,status,code]);
const disableSubs=()=>db.exec("update sim_murid_private.push_subscriptions set status='disabled'");

test('migration defaults fail closed and private tables/RPCs deny browser roles',async()=>{
 assert.equal((await register(a,data())).code,'disabled');
 for(const role of ['anon','authenticated']){
  await db.exec('set role '+role);
  try{await assert.rejects(()=>db.query('select * from sim_murid_private.push_subscriptions'));await assert.rejects(()=>val('select public.app_push_claim()'));await assert.rejects(()=>val('select public.app_push_devices($1,$2)',[a.id,a.session]));}finally{await db.exec('reset role');}
 }
 const r=(await db.query("select c.relname,c.relrowsecurity from pg_class c join pg_namespace n on n.oid=c.relnamespace where n.nspname='sim_murid_private' and c.relname in('push_settings','push_subscriptions','push_preferences','push_events','push_deliveries')")).rows;
 assert.equal(r.length,5);assert.ok(r.every(x=>x.relrowsecurity));
 const funcs=(await db.query("select p.proname,p.prosecdef,has_function_privilege('anon',p.oid,'EXECUTE') as anon,has_function_privilege('authenticated',p.oid,'EXECUTE') as authenticated,has_function_privilege('service_role',p.oid,'EXECUTE') as service from pg_proc p where p.pronamespace='public'::regnamespace and p.proname like 'app_push_%'")).rows;
 assert.ok(funcs.length>=8);assert.ok(funcs.every(x=>!x.prosecdef&&!x.anon&&!x.authenticated&&x.service));
 await db.exec('set role service_role');try{assert.deepEqual(await val('select public.app_push_devices($1,$2)',[a.id,a.session]),[]);}finally{await db.exec('reset role');}
 await db.exec('update sim_murid_private.push_settings set enabled=true,dispatch_enabled=true,test_enabled=true');
});
test('registration validates identity and ownership, stable retries preserve generation and public projection redacts secrets',async()=>{
 const s=await setup();assert.equal((await register(a,s.d)).binding_version,1);
 assert.equal((await register(b,s.d)).code,'conflict');
 assert.equal((await val('select public.app_push_register($1,$2,$3)',[a.id,b.session,data()])).code,'denied');
 const list=await val('select public.app_push_devices($1,$2)',[a.id,a.session]);
 assert.ok(list.some(x=>x.id===s.id));assert.equal(JSON.stringify(list).includes('synthetic-encrypted'),false);assert.equal(JSON.stringify(list).includes('endpoint_hash'),false);
 assert.equal((await val('select public.app_push_revoke($1,$2,$3)',[b.id,b.session,s.id])).code,'not_found');
 assert.equal((await register(a,{...data(),endpoint_ciphertext:{...cipher,endpoint:'https://private.invalid'}})).code,'invalid');
 assert.equal((await register(a,{...data(),expires_at:'2000-01-01T00:00:00Z'})).code,'invalid');
 const updated=await register(a,{...s.d,endpoint_hash:'e'.repeat(64)});assert.equal(updated.binding_version,2);assert.equal(updated.id,s.id);
 await disableSubs();
});
test('five active devices maximum is enforced without replacing an existing device',async()=>{
 for(let i=0;i<5;i++)await setup();assert.equal((await register(a,data())).code,'device_limit');await disableSubs();
});
test('installation capability only releases its binding; cross-account rebinding requires release and old proof, stale proof cannot revoke new owner',async()=>{
 const s=await setup();
 await val('select public.app_push_release($1,$2)',[s.d.installation_id,'0'.repeat(64)]);assert.equal(await val('select status from sim_murid_private.push_subscriptions where id=$1',[s.id]),'active');
 await val('select public.app_push_release($1,$2)',[s.d.installation_id,s.d.binding_secret_hash]);
 assert.equal((await register(b,s.d)).code,'conflict');
 const switched=await register(b,{...s.d,previous_binding_secret_hash:s.d.binding_secret_hash,binding_secret_hash:'f'.repeat(64)});assert.equal(switched.code,'saved');assert.equal(switched.binding_version,2);
 await val('select public.app_push_release($1,$2)',[s.d.installation_id,s.d.binding_secret_hash]);assert.equal(await val('select status from sim_murid_private.push_subscriptions where id=$1',[s.id]),'active');
 assert.equal((await val('select public.app_push_devices($1,$2)',[a.id,a.session])).some(x=>x.id===s.id),false);await disableSubs();
});
test('enqueue is atomic/idempotent and fan-out excludes later installations',async()=>{
 const s=await setup(),e=await event(s.id);assert.equal(e.code,'saved');
 const repeat=await val("select public.app_push_enqueue($1,$2,$3,$4,now(),now()+interval '5 minutes',$5)",e.args);assert.equal(repeat.code,'duplicate');
 assert.equal((await val("select public.app_push_enqueue($1,$2,$3,$4,now(),now()+interval '5 minutes',$5)",[e.inbox,'test',e.inbox,'other-key',s.id])).code,'request_conflict');
 assert.equal(await val('select count(*)::int from sim_murid_private.push_deliveries where event_id=$1',[e.id]),1);
 await setup();assert.equal(await val('select count(*)::int from sim_murid_private.push_deliveries where event_id=$1',[e.id]),1);
 await db.exec('begin');const rollback=await event(s.id);await db.exec('rollback');assert.equal(await val('select count(*)::int from sim_murid_private.push_events where id=$1',[rollback.id]),0);
 await disableSubs();
});
test('preferences use optimistic revision, validate timezone and compute quiet hours crossing midnight',async()=>{
 const get=await val('select public.app_push_preferences($1,$2)',[a.id,a.session]);assert.equal(get.preferences.revision,0);
 const d={categories:['points'],quiet_start:'21:00',quiet_end:'06:00',timezone:'Asia/Jakarta'};
 const write=()=>val('select public.app_push_preferences($1,$2,$3,$4)',[a.id,a.session,0,d]);assert.equal((await write()).code,'saved');assert.equal((await write()).code,'stale');
 assert.equal((await val('select public.app_push_preferences($1,$2,$3,$4)',[a.id,a.session,1,{...d,timezone:'invalid'}])).code,'invalid');
 assert.equal(await val("select sim_murid_private.push_not_before($1,'2026-11-07T15:00:00Z')=timestamptz '2026-11-07T23:00:00Z'",[a.id]),true);
});
test('claim ownership/generation are fenced; accepted is not read; ordinary retry is separate from ambiguous',async()=>{
 const s=await setup(),e=await event(s.id);assert.equal(e.code,'saved');
 const c=await claim();assert.equal(c.code,'claimed');assert.equal(c.subscription.installation_id,s.d.installation_id);assert.equal(c.subscription.user_id,a.id);const d=c.delivery;
 assert.equal((await complete(d,'accepted',uuid())).code,'stale');assert.equal((await complete(d,'accepted',d.claim_token,d.binding_version+1)).code,'stale');
 assert.equal((await complete(d,'accepted',d.claim_token,d.binding_version,410)).code,'invalid');
 assert.equal((await complete(d)).status,'accepted');assert.equal((await complete(d)).code,'stale');
 assert.equal(await val('select read_at from sim_murid_private.inbox where id=$1',[e.inbox]),null);
 await event(s.id);const x=await claim();assert.equal((await complete(x.delivery,'ambiguous',x.delivery.claim_token,x.delivery.binding_version,null)).status,'ambiguous');
 assert.equal((await claim()).code,'empty');await disableSubs();
});
test('subscription change cancels processing and completion cannot revive the old generation',async()=>{
 const s=await setup();await event(s.id);const c=await claim();
 const changed=await register(a,{...s.d,subscription_hash:'d'.repeat(64)});assert.equal(changed.binding_version,2);
 assert.equal((await complete(c.delivery)).code,'stale');assert.equal(await val('select status from sim_murid_private.push_deliveries where id=$1',[c.delivery.id]),'cancelled');await disableSubs();
});
test('endpoint 410 invalidates subscription and cancels its other pending deliveries',async()=>{
 const s=await setup();await event(s.id);await event(s.id);const c=await claim();
 assert.equal((await complete(c.delivery,'failed_permanent',c.delivery.claim_token,c.delivery.binding_version,410)).code,'saved');
 assert.equal(await val('select status from sim_murid_private.push_subscriptions where id=$1',[s.id]),'invalid');assert.equal((await claim()).code,'empty');await disableSubs();
});
test('expired lease becomes ambiguous and stale worker cannot complete it',async()=>{
 const s=await setup();await event(s.id);const c=await claim();await db.query("update sim_murid_private.push_deliveries set locked_until=now()-interval '1 second' where id=$1",[c.delivery.id]);
 assert.equal((await claim()).code,'empty');assert.equal(await val('select status from sim_murid_private.push_deliveries where id=$1',[c.delivery.id]),'ambiguous');assert.equal((await complete(c.delivery)).code,'stale');await disableSubs();
});
test('revocation cancels pending even with global flags off and cannot affect another owner',async()=>{
 const s=await setup();await event(s.id);await db.exec('update sim_murid_private.push_settings set enabled=false');
 assert.equal((await val('select public.app_push_revoke($1,$2,$3)',[a.id,a.session,s.id])).code,'saved');
 assert.equal((await claim()).code,'empty');await db.exec('update sim_murid_private.push_settings set enabled=true');
});
test('two outstanding claims are distinct; retry-after delays redelivery and retry ceiling is terminal',async()=>{
 const s=await setup();await event(s.id);await event(s.id);
 const [x,y]=await Promise.all([claim(),claim()]);assert.equal(x.code,'claimed');assert.equal(y.code,'claimed');assert.notEqual(x.delivery.id,y.delivery.id);
 await complete(y.delivery);
 assert.equal((await val('select public.app_push_complete($1,$2,$3,$4,$5,$6)',[x.delivery.id,x.delivery.claim_token,x.delivery.binding_version,'retry_wait',429,1800])).status,'retry_wait');
 assert.equal((await claim()).code,'empty');
 assert.equal(await val("select available_at>now()+interval '29 minutes' from sim_murid_private.push_deliveries where id=$1",[x.delivery.id]),true);
 await db.query("update sim_murid_private.push_deliveries set attempts=5,available_at=now() where id=$1",[x.delivery.id]);assert.equal((await claim()).code,'empty');assert.equal(await val('select status from sim_murid_private.push_deliveries where id=$1',[x.delivery.id]),'failed_permanent');await disableSubs();
});
test('TTL expires rather than extending lifetime; accepted child updates legacy outbox transport status',async()=>{
 const s=await setup(),e=await event(s.id);const c=await claim();await complete(c.delivery);
 assert.equal(await val('select o.status from sim_murid_private.outbox o join sim_murid_private.push_events e on e.outbox_id=o.id where e.id=$1',[e.id]),'sent');
 const exp=await event(s.id);await db.query("update sim_murid_private.push_events set occurred_at=now()-interval '10 minutes',expires_at=now()-interval '1 second' where id=$1",[exp.id]);
 assert.equal((await claim()).code,'empty');assert.equal(await val('select status from sim_murid_private.push_deliveries where event_id=$1',[exp.id]),'expired');await disableSubs();
});
test('point events require authentic inbox provenance and guardian revocation cancels pending',async()=>{
 const parent=await account('push-parent'),student=await account('push-child');
 await db.query("update public.user_roles set role_code='parent' where user_id=$1",[parent.id]);
 const sub=await register(parent,data());assert.equal(sub.code,'saved');
 await val('select public.app_push_preferences($1,$2)',[parent.id,parent.session]);
 await val('select public.app_push_preferences($1,$2,0,$3)',[parent.id,parent.session,{categories:['points'],quiet_start:'00:00',quiet_end:'00:00',timezone:'Asia/Jakarta'}]);
 await db.query("insert into sim_murid_private.push_point_pilot_members(user_id,expires_at) values($1,now()+interval '1 day')",[parent.id]);await db.exec('update sim_murid_private.push_settings set points_pilot_enabled=true');
 const year=uuid(),cls=uuid(),pe=uuid(),inbox=uuid();
 await db.query('insert into public.academic_years(id,start_year) values($1,2097)',[year]);
 await db.query("insert into public.classes(id,academic_year_id,level,name) values($1,$2,7,'Push fixture')",[cls,year]);
 await db.query("insert into sim_murid_private.point_events(id,student_id,class_id,event_date,code,catalog_snapshot,base_points,notes,created_by) values($1,$2,$3,public.app_ops_today(),'A01','{}',-10,'',$2)",[pe,student.id,cls]);
 await db.query("insert into sim_murid_private.student_guardians(student_id,parent_id,relationship,verified_by) values($1,$2,'guardian',$1)",[student.id,parent.id]);
 await db.query("insert into sim_murid_private.inbox(id,recipient_id,dedup_key,title,message,entity_id) values($1,$2,$3,'Fixture','Synthetic',$4)",[inbox,parent.id,'point:'+pe+':'+parent.id,pe]);
 await db.exec("update sim_murid_private.push_settings set categories=array['points']");
 const e=await val("select public.app_push_enqueue($1,'points',$2,$3,now(),now()+interval '24 hours')",[inbox,pe,'point:'+pe+':'+parent.id]);assert.equal(e.code,'saved');
 const pending=await claim();assert.equal(pending.delivery.event_id,e.id);
 await db.query("update sim_murid_private.push_preferences set quiet_start=(now() at time zone 'Asia/Jakarta'-interval '1 minute')::time,quiet_end=(now() at time zone 'Asia/Jakarta'+interval '10 minutes')::time where user_id=$1",[parent.id]);
 assert.equal((await val('select public.app_push_preflight($1,$2,$3)',[pending.delivery.id,pending.delivery.claim_token,pending.delivery.binding_version])).code,'deferred');
 assert.equal(await val('select attempts from sim_murid_private.push_deliveries where id=$1',[pending.delivery.id]),0);
 const clickRef=await val('select delivery_ref from sim_murid_private.push_deliveries where event_id=$1',[e.id]);assert.ok(await val('select public.app_push_open($1,$2,$3)',[parent.id,parent.session,clickRef]));
 await db.query('update sim_murid_private.student_guardians set revoked_at=now() where student_id=$1 and parent_id=$2',[student.id,parent.id]);
 assert.equal(await val('select public.app_push_open($1,$2,$3)',[parent.id,parent.session,clickRef]),null);
 assert.equal((await claim()).code,'empty');assert.equal(await val('select status from sim_murid_private.push_deliveries where event_id=$1',[e.id]),'cancelled');
 const count=await val("select count(*)::int from sim_murid_private.outbox where channel='push'");
 const fake=uuid();await db.query("insert into sim_murid_private.inbox(id,recipient_id,dedup_key,title,message,entity_id) values($1,$2,$3,'Fake','Synthetic',$4)",[fake,parent.id,'fake:'+fake,pe]);
 const denied=await val("select public.app_push_enqueue($1,'points',$2,$3,now(),now()+interval '24 hours')",[fake,pe,'different-event-key']);assert.equal(denied.code,'denied');assert.equal(await val("select count(*)::int from sim_murid_private.outbox where channel='push'"),count);await disableSubs();
});
test('explicit revoke-all covers bindings attached to expired sessions without changing normal expiry policy',async()=>{
 const u=await account('push-revoke-all');const s=await register(u,data());assert.equal(s.code,'saved');
 await db.query("update sim_murid_private.app_sessions set issued_at=now()-interval '2 hours',revoked_at=now(),revocation_reason='expired',expires_at=now()-interval '1 hour' where auth_session_id=$1",[u.session]);
 const fresh=uuid();await db.query('insert into auth.sessions(id,user_id) values($1,$2)',[fresh,u.id]);assert.equal(await val('select public.app_auth_claim($1,$2,false)',[u.id,fresh]),true);
 assert.equal(await val('select status from sim_murid_private.push_subscriptions where id=$1',[s.id]),'active');
 assert.equal((await val('select public.app_session_revoke($1,$2)',[u.id,fresh])).signed_out,true);
 assert.equal(await val('select status from sim_murid_private.push_subscriptions where id=$1',[s.id]),'revoked');
});
test('non-active account revokes subscriptions; expired registry cleanup alone does not revoke opt-in',async()=>{
 const s=await setup();await db.query("update sim_murid_private.app_sessions set revoked_at=now(),revocation_reason='expired' where auth_session_id=$1",[a.session]);
 assert.equal(await val('select status from sim_murid_private.push_subscriptions where id=$1',[s.id]),'active');
 await db.query("update public.profiles set status='inactive' where id=$1",[a.id]);assert.equal(await val('select status from sim_murid_private.push_subscriptions where id=$1',[s.id]),'revoked');
});
test('WP03 rate buckets are durable, bounded, authenticated and private',async()=>{
 const u=await account('push-rate');
 for(let i=0;i<10;i++)assert.equal((await val("select public.app_push_rate($1,$2,'subscriptions')",[u.id,u.session])).code,'saved');
 assert.equal((await val("select public.app_push_rate($1,$2,'subscriptions')",[u.id,u.session])).code,'rate_limited');
 assert.equal((await val("select public.app_push_rate($1,$2,'subscriptions')",[u.id,uuid()])).code,'denied');
 await db.query("update sim_murid_private.push_api_limits set window_start=now()-interval '2 minutes' where user_id=$1",[u.id]);
 assert.equal((await val("select public.app_push_rate($1,$2,'subscriptions')",[u.id,u.session])).code,'saved');
 assert.equal(await val('select count(*)::int from sim_murid_private.push_api_limits where user_id=$1',[u.id]),1);
 for(const role of ['anon','authenticated']){await db.exec('set role '+role);try{await assert.rejects(()=>db.query('select * from sim_murid_private.push_api_limits'));await assert.rejects(()=>val("select public.app_push_rate($1,$2,'test')",[u.id,u.session]));await assert.rejects(()=>val('select public.app_push_test($1,$2,$3,$4)',[u.id,u.session,uuid(),uuid()]));}finally{await db.exec('reset role');}}
});
test('WP03 own-device test creates inbox/outbox atomically, replays safely, limits account across devices, never broadcasts',async()=>{
 const u=await account('push-api-test'),other=await account('push-api-other');
 await db.exec('update sim_murid_private.push_settings set enabled=true,test_enabled=true');
 const s=await register(u,data()),s2=await register(u,data());assert.equal(s.code,'saved');assert.equal(s2.code,'saved');
 const invoke=(actor,sub,request)=>val('select public.app_push_test($1,$2,$3,$4)',[actor.id,actor.session,sub,request]);
 assert.equal((await invoke(other,s.id,uuid())).code,'not_found');
 const req=uuid(),first=await invoke(u,s.id,req);assert.equal(first.code,'saved');assert.equal((await invoke(u,s.id,req)).code,'duplicate');assert.equal((await invoke(u,s2.id,req)).code,'request_conflict');
 assert.equal(await val('select count(*)::int from sim_murid_private.push_deliveries where event_id=$1',[first.id]),1);
 for(let i=0;i<2;i++)assert.equal((await invoke(u,s.id,uuid())).code,'saved');
 assert.equal((await invoke(u,s2.id,uuid())).code,'rate_limited');
 assert.equal(await val("select count(*)::int from sim_murid_private.push_events where recipient_id=$1 and category='test'",[u.id]),3);
 assert.equal((await invoke(u,s.id,req)).code,'duplicate');
 await db.exec('update sim_murid_private.push_settings set test_enabled=false');assert.equal((await invoke(u,s.id,uuid())).code,'disabled');
 const cfg=await val('select public.app_push_config($1,$2)',[u.id,u.session]);assert.equal(cfg.test_enabled,false);
 assert.equal(await val('select public.app_push_config($1,$2)',[u.id,uuid()]),null);
});
test('WP04 click resolver enforces latest session, recipient and source; direct lookup is independent from latest 200 and GET never reads',async()=>{
 const u=await account('push-open'),other=await account('push-open-other');
 await db.exec('update sim_murid_private.push_settings set enabled=true,test_enabled=true');
 const sub=await register(u,data());assert.equal(sub.code,'saved');
 const req=uuid(),e=await val('select public.app_push_test($1,$2,$3,$4)',[u.id,u.session,sub.id,req]);assert.equal(e.code,'saved');
 const ref=await val('select delivery_ref from sim_murid_private.push_deliveries where event_id=$1',[e.id]);
 const open=(actor,mark=false)=>val('select public.app_push_open($1,$2,$3,$4)',[actor.id,actor.session,ref,mark]);
 assert.equal(await open(other),null);assert.equal(await open({id:u.id,session:uuid()}),null);
 const first=await open(u);assert.ok(first);assert.equal(first.read_at,null);
 for(let i=0;i<205;i++)await db.query("insert into sim_murid_private.inbox(recipient_id,dedup_key,title,message) values($1,$2,'Newer','Synthetic')",[u.id,uuid()]);
 assert.equal((await open(u)).id,first.id);assert.equal((await open(u)).read_at,null);
 const revision=await val('select revision from sim_murid_private.operations_state');
 assert.ok((await open(u,true)).read_at);assert.equal(await val('select revision from sim_murid_private.operations_state'),revision+1);
 await open(u,true);assert.equal(await val('select revision from sim_murid_private.operations_state'),revision+1);
 await db.query("update public.profiles set status='inactive' where id=$1",[u.id]);assert.equal(await open(u),null);
 for(const role of ['anon','authenticated']){await db.exec('set role '+role);try{await assert.rejects(()=>open(other));}finally{await db.exec('reset role');}}
});
test('WP05 worker control persists one lease, enforces rate, fences late owners and only stores numeric metrics',async()=>{
 const enter=()=>val("select public.app_push_worker('enter')"),leave=(token,metrics={claimed:1})=>val("select public.app_push_worker('leave',$1,$2)",[token,metrics]);
 const a=await enter();assert.equal(a.code,'acquired');assert.equal((await enter()).code,'busy');assert.equal((await leave(uuid())).code,'stale');assert.equal((await leave(a.token,{endpoint:'never-store-credentials'})).code,'invalid');assert.equal((await leave(a.token)).code,'saved');assert.equal((await enter()).code,'rate_limited');
 await db.exec("update sim_murid_private.push_worker_state set last_started=now()-interval '11 seconds' where singleton=true");const b=await enter();assert.equal(b.code,'acquired');await db.exec("update sim_murid_private.push_worker_state set locked_until=now()-interval '1 second',last_started=now()-interval '11 seconds' where singleton=true");const c=await enter();assert.equal(c.code,'acquired');assert.notEqual(c.token,b.token);assert.equal((await leave(b.token)).code,'stale');assert.equal((await leave(c.token,{claimed:0})).code,'saved');
 for(const role of ['anon','authenticated']){await db.exec('set role '+role);try{await assert.rejects(()=>enter());await assert.rejects(()=>db.query('select * from sim_murid_private.push_worker_state'));await assert.rejects(()=>val('select public.app_push_status($1,$2)',[a.id,a.session]));}finally{await db.exec('reset role');}}
});
test('WP05 preflight rechecks binding/flags/expiry, maintenance reaps crashes, and completions sanitize errors',async()=>{
 await db.exec("update sim_murid_private.push_deliveries set status='cancelled',claim_token=null,locked_until=null where status in('queued','retry_wait','processing');update sim_murid_private.push_settings set enabled=true,test_enabled=true,dispatch_enabled=true");
 const u=await account('push-worker');let s=await register(u,data());assert.equal(s.code,'saved');
 async function queue(){const inbox=uuid();await db.query("insert into sim_murid_private.inbox(id,recipient_id,dedup_key,title,message) values($1::uuid,$2::uuid,$1::uuid::text,'Synthetic','Generic')",[inbox,u.id]);return val("select public.app_push_enqueue($1::uuid,'test',$1::uuid,$1::uuid::text,now(),now()+interval '5 minutes',$2)",[inbox,s.id]);}
 const check=d=>val('select public.app_push_preflight($1,$2,$3)',[d.id,d.claim_token,d.binding_version]);
 const e=await queue(),c=await claim();assert.equal(c.code,'claimed');const ready=await check(c.delivery);assert.equal(ready.code,'ready');assert.equal(ready.event_ref,e.id);assert.equal(ready.delivery_ref,c.delivery.delivery_ref);
 assert.equal((await val('select public.app_push_result($1,$2,$3,$4,$5,$6,$7)',[c.delivery.id,c.delivery.claim_token,c.delivery.binding_version,'failed_permanent',401,null,'https://credential.invalid'])).code,'invalid');
 assert.equal((await val('select public.app_push_result($1,$2,$3,$4,$5,$6,$7)',[c.delivery.id,c.delivery.claim_token,c.delivery.binding_version,'failed_permanent',401,null,'provider_unauthorized'])).code,'saved');assert.equal(await val('select status from sim_murid_private.push_subscriptions where id=$1',[s.id]),'active');
 await queue();const crash=await claim();await db.query("update sim_murid_private.push_deliveries set locked_until=now()-interval '1 second' where id=$1",[crash.delivery.id]);await val('select public.app_push_maintenance(true,true,$1)',[[]]);assert.equal(await val('select status from sim_murid_private.push_deliveries where id=$1',[crash.delivery.id]),'ambiguous');assert.equal((await complete(crash.delivery)).code,'stale');assert.equal((await claim()).code,'empty');
 await queue();const disabled=await claim();await db.exec('update sim_murid_private.push_settings set dispatch_enabled=false');assert.equal((await check(disabled.delivery)).code,'cancelled');await db.exec('update sim_murid_private.push_settings set dispatch_enabled=true');
 await queue();const ttl=await claim();await db.query("update sim_murid_private.push_events set occurred_at=now()-interval '10 minutes',expires_at=now()-interval '1 second' where id=$1",[ttl.delivery.event_id]);assert.equal((await check(ttl.delivery)).code,'expired');
 await queue();await val('select public.app_push_maintenance(false,true,$1)',[[]]);assert.equal((await claim()).code,'empty');
 assert.equal(await val('select public.app_push_status($1,$2)',[u.id,u.session]),null);await db.query("update public.user_roles set role_code='admin' where user_id=$1",[u.id]);const status=await val('select public.app_push_status($1,$2)',[u.id,u.session]);assert.equal(status.alarm,true);assert.ok(status.errors.provider_unauthorized>=1);assert.equal(JSON.stringify(status).includes('ciphertext'),false);assert.equal(JSON.stringify(status).includes('token'),false);
});
test('WP05 durable wake rolls back with enqueue; privileged scheduler coalesces, uses Vault and sweeps lost wake',async()=>{
 const {readFile}=await import('node:fs/promises');
 await db.exec("create schema net;create schema vault;create table net._http_response(id bigint,status_code int,timed_out boolean,error_msg text,created timestamptz default now());create table net.requests(id bigint generated always as identity primary key,url text,headers jsonb,body jsonb);create table vault.decrypted_secrets(name text,decrypted_secret text);create function net.http_post(url text,headers jsonb,body jsonb,timeout_milliseconds integer) returns bigint language sql as 'insert into net.requests(url,headers,body) values(url,headers,body) returning id';");
 await db.exec("create schema cron;create table cron.job(jobid bigint generated always as identity primary key,jobname text,username text,schedule text,command text,active boolean default true);create function cron.schedule(job_name text,schedule text,command text) returns bigint language sql as 'insert into cron.job(jobname,username,schedule,command) values(job_name,current_user,schedule,command) returning jobid';create function cron.alter_job(job_id bigint,schedule text default null,command text default null,active boolean default null) returns void language sql as 'update cron.job set schedule=coalesce(alter_job.schedule,cron.job.schedule),command=coalesce(alter_job.command,cron.job.command),active=coalesce(alter_job.active,cron.job.active) where jobid=job_id';");
 const install=(await readFile('supabase/operations/web-push-scheduler.sql','utf8')).replace('create extension if not exists pg_net;','');await db.exec(install);assert.equal(await val("select active from cron.job where jobname='sim-murid-web-push-sweep'"),false);
 await db.exec("update sim_murid_private.push_worker_state set wake_requested=false,scheduler_enabled=false,worker_url='https://sim-muridv2-staging.vercel.app/api/push/worker' where singleton=true");
 const u=await account('push-scheduler'),s=await register(u,data());assert.equal(s.code,'saved');
 const queue=()=>val('select public.app_push_test($1,$2,$3,$4)',[u.id,u.session,s.id,uuid()]);
 await db.exec('begin');assert.equal((await queue()).code,'saved');assert.equal(await val('select wake_requested from sim_murid_private.push_worker_state'),true);await db.exec('rollback');assert.equal(await val('select wake_requested from sim_murid_private.push_worker_state'),false);assert.equal(await val('select count(*)::int from net.requests'),0);
 await db.exec('set role service_role');try{assert.equal((await queue()).code,'saved');await assert.rejects(()=>val('select sim_murid_private.push_schedule_tick()'));}finally{await db.exec('reset role');}
 assert.equal(await val('select sim_murid_private.push_schedule_tick()'),null);
 await db.exec("insert into vault.decrypted_secrets values('sim_murid_push_worker_url','https://sim-muridv2-staging.vercel.app/api/push/worker'),('sim_murid_push_worker_secret',repeat('s',43)),('sim_murid_push_deployment_bypass','synthetic-bypass');update sim_murid_private.push_worker_state set scheduler_enabled=true where singleton=true");
 await db.exec('begin');assert.ok(await val('select sim_murid_private.push_schedule_tick()'));await db.exec('rollback');assert.equal(await val('select count(*)::int from net.requests'),0);
 assert.ok(await val('select sim_murid_private.push_schedule_tick()'));assert.equal(await val('select count(*)::int from net.requests'),1);assert.equal(await val('select wake_requested from sim_murid_private.push_worker_state'),false);
 assert.equal(await val("select headers->>'x-vercel-protection-bypass' from net.requests limit 1"),'synthetic-bypass');
 await db.exec("update sim_murid_private.push_worker_state set last_http_dispatched_at=now()-interval '80 seconds'");
 // Lost/failed HTTP wake is recovered from the durable ready delivery, not a browser timer.
 assert.ok(await val('select sim_murid_private.push_schedule_tick()'));assert.equal(await val('select count(*)::int from net.requests'),2);
 for(const role of ['anon','authenticated','service_role']){await db.exec('set role '+role);try{await assert.rejects(()=>db.query('select * from net.requests'));}finally{await db.exec('reset role');}}
 await db.exec("insert into net._http_response(id,status_code,timed_out) select last_http_request_id,200,false from sim_murid_private.push_worker_state");
 // WP07: surveys wake the worker even when the daily queue has not been materialized yet.
 const beforeSurveyWake=await val('select count(*)::int from net.requests');await db.exec("update sim_murid_private.push_deliveries set status='cancelled',claim_token=null,locked_until=null where status in('queued','retry_wait','processing');update sim_murid_private.push_settings set enabled=true,dispatch_enabled=true,categories=array['surveys'],expanded_pilot_categories=array['surveys'];update sim_murid_private.push_worker_state set wake_requested=false where singleton=true");assert.ok(await val('select sim_murid_private.push_schedule_tick()'));assert.equal(await val('select count(*)::int from net.requests'),beforeSurveyWake+1);

});
test('WP05 isolated end-to-end uses actual RPC repository, AES/VAPID sender, pinned transport double, accepted and click/read',async()=>{
 const {registerAuditHooks}=await import('../audit-loader.mjs');registerAuditHooks({'server-only':'export {};','@/lib/auth/admin':'export const createAuthAdmin=()=>globalThis.pushIntegratedAdmin;'});
 const {createECDH,randomBytes}=await import('node:crypto');const {EventEmitter}=await import('node:events');const {PassThrough}=await import('node:stream');
 const {pushRepository}=await import('../../src/lib/push/repository.ts'),{runPushWorker}=await import('../../src/lib/push/worker.ts'),{sendClaim}=await import('../../src/lib/push/sender.ts'),{pinnedRequest}=await import('../../src/lib/push/transport.ts'),{encrypt,validateEndpoint}=await import('../../src/lib/push/security.ts');
 const rpcNames=new Set(['app_push_worker','app_push_maintenance','app_push_cleanup','app_push_claim','app_push_preflight','app_push_result']);
 globalThis.pushIntegratedAdmin={rpc:(name,args={})=>{assert.ok(rpcNames.has(name));const run=async()=>{try{return {data:await val('select public.'+name+'('+Object.keys(args).map((k,i)=>k+'=> $'+(i+1)).join(',')+')',Object.values(args)),error:null};}catch(error){return {data:null,error};}};return {abortSignal:signal=>{assert.ok(signal instanceof AbortSignal);return run();}};}};
 await db.exec("update sim_murid_private.push_deliveries set status='cancelled',claim_token=null,locked_until=null where status in('queued','retry_wait','processing');update sim_murid_private.push_settings set enabled=true,dispatch_enabled=true,test_enabled=true;update sim_murid_private.push_worker_state set token=null,locked_until=null,last_started=now()-interval '11 seconds' where singleton=true");
 const u=await account('push-integrated'),d=data(),key=randomBytes(32),priv=Buffer.alloc(32);priv[31]=1;const vapid=createECDH('prime256v1');vapid.setPrivateKey(priv);const browser=createECDH('prime256v1');browser.generateKeys();const aad=`sim-push-v1:${d.installation_id}:${u.id}:fixture-v1`;
 d.endpoint_ciphertext=encrypt('https://fcm.googleapis.com/fcm/send/synthetic',key,aad+':endpoint');d.keys_ciphertext=encrypt(JSON.stringify({p256dh:browser.getPublicKey().toString('base64url'),auth:randomBytes(16).toString('base64url')}),key,aad+':keys');
 const s=await register(u,d);assert.equal(s.code,'saved');const event=await val('select public.app_push_test($1,$2,$3,$4)',[u.id,u.session,s.id,uuid()]);assert.equal(event.code,'saved');
 const cfg={enabled:true,dispatch:true,test:true,categories:[],publicKey:vapid.getPublicKey().toString('base64url'),privateKey:priv.toString('base64url'),key,encryptionVersion:'fixture-v1',vapidVersion:'fixture-v1',subject:'mailto:fixture@example.invalid'};let requests=0;
 const request=(options,callback)=>{requests++;assert.equal(options.hostname,'142.250.1.1');assert.equal(options.servername,'fcm.googleapis.com');assert.equal(options.rejectUnauthorized,true);const req=new EventEmitter();req.destroy=()=>{};req.end=body=>{assert.ok(body.length>0);assert.equal(body.includes(Buffer.from('Generic')),false);queueMicrotask(()=>{req.emit('finish');const res=new PassThrough();res.statusCode=201;res.headers={};callback(res);});};return req;};
 const send=(claim,config,preflight,signal)=>sendClaim(claim,config,preflight,signal,(target,address,headers,body,abort)=>pinnedRequest(target,address,headers,body,abort,request),ep=>validateEndpoint(ep,async()=>[{address:'142.250.1.1',family:4}]));
 const result=await runPushWorker(pushRepository(),cfg,send);assert.equal(result.code,'processed');assert.equal(result.metrics.accepted,1);assert.equal(result.metrics.providerAccepted,1);assert.equal(requests,1);
 assert.equal(await val('select status from sim_murid_private.push_deliveries where event_id=$1',[event.id]),'accepted');const ref=await val('select delivery_ref from sim_murid_private.push_deliveries where event_id=$1',[event.id]);const open=await val('select public.app_push_open($1,$2,$3)',[u.id,u.session,ref]);assert.equal(open.read_at,null);assert.ok((await val('select public.app_push_open($1,$2,$3,true)',[u.id,u.session,ref])).read_at);assert.equal((await runPushWorker(pushRepository(),cfg,send)).code,'rate_limited');assert.equal(requests,1);
});
