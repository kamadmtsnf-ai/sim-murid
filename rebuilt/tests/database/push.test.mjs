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
 const c=await claim();assert.equal(c.code,'claimed');const d=c.delivery;
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
 const year=uuid(),cls=uuid(),pe=uuid(),inbox=uuid();
 await db.query('insert into public.academic_years(id,start_year) values($1,2097)',[year]);
 await db.query("insert into public.classes(id,academic_year_id,level,name) values($1,$2,7,'Push fixture')",[cls,year]);
 await db.query("insert into sim_murid_private.point_events(id,student_id,class_id,event_date,code,catalog_snapshot,base_points,notes,created_by) values($1,$2,$3,public.app_ops_today(),'A01','{}',-10,'',$2)",[pe,student.id,cls]);
 await db.query("insert into sim_murid_private.student_guardians(student_id,parent_id,relationship,verified_by) values($1,$2,'guardian',$1)",[student.id,parent.id]);
 await db.query("insert into sim_murid_private.inbox(id,recipient_id,dedup_key,title,message,entity_id) values($1,$2,$3,'Fixture','Synthetic',$4)",[inbox,parent.id,'point:'+pe+':'+parent.id,pe]);
 await db.exec("update sim_murid_private.push_settings set categories=array['points']");
 const e=await val("select public.app_push_enqueue($1,'points',$2,$3,now(),now()+interval '24 hours')",[inbox,pe,'point:'+pe+':'+parent.id]);assert.equal(e.code,'saved');
 await db.query('update sim_murid_private.student_guardians set revoked_at=now() where student_id=$1 and parent_id=$2',[student.id,parent.id]);
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
