import {test,after} from 'node:test';
import assert from 'node:assert/strict';
import {randomUUID as uuid} from 'node:crypto';
import {createIsolatedDatabase} from '../../scripts/database/harness.mjs';
const {db}=await createIsolatedDatabase();after(()=>db.close());
const val=async(q,p=[])=>Object.values((await db.query(q,p)).rows[0])[0];
const all=async(q,p=[])=>(await db.query(q,p)).rows;
const today=await val('select public.app_ops_today()::text'),month=today.slice(0,7)+'-01',start=Number(today.slice(0,4))-(Number(today.slice(5,7))<7?1:0);
const U={};
for(const [name,role] of [['admin','admin'],['student','student'],['child2','student'],['outside','student'],['parent','parent'],['parent2','parent'],['stranger','parent'],['home','teacher'],['bk','teacher'],['teacher','teacher'],['otherhome','teacher'],['expired','teacher'],['fakebk','parent']]){
 const id=uuid(),session=uuid();U[name]={id,session};
 await db.query('insert into auth.users values($1)',[id]);await db.query('insert into auth.sessions(id,user_id) values($1,$2)',[session,id]);
 await db.query('insert into public.profiles(id,username,full_name,contact_email,phone) values($1,$2,$2,$3,$4)',[id,name,name+'@example.invalid','+628123456789']);
 await db.query('insert into public.user_roles(user_id,role_code) values($1,$2)',[id,role]);
 await db.query('insert into sim_murid_private.auth_accounts(user_id,must_change_password,profile_completed_at,verified_contact_email) values($1,false,now(),$2)',[id,name+'@example.invalid']);
 await db.query("insert into sim_murid_private.security_questions(user_id,question_code,answer_hash) values($1,'q1',repeat('0',64))",[id]);
 if(role==='teacher')await db.query('insert into public.user_access_flags(user_id,teacher_email_verified_at) values($1,now())',[id]);
 assert.equal(await val('select public.app_auth_claim($1,$2,false)',[id,session]),true);
}
const year=uuid(),cls=uuid(),othercls=uuid();await db.query('insert into public.academic_years(id,start_year,is_active) values($1,$2,true)',[year,start]);
await db.query("insert into public.classes(id,academic_year_id,level,name,homeroom_teacher_id) values($1,$2,7,'Pilot A',$3),($4,$2,8,'Outside B',$5)",[cls,year,U.home.id,othercls,U.otherhome.id]);
for(const [name,c] of [['student',cls],['child2',cls],['outside',othercls]])await db.query('insert into sim_murid_private.enrollments(student_id,class_id,academic_year_id,starts_on,created_by) values($1,$2,$3,$4,$5)',[U[name].id,c,year,start+'-07-01',U.admin.id]);
for(const [s,p] of [['student','parent'],['child2','parent'],['student','parent2']])await db.query("insert into sim_murid_private.student_guardians(student_id,parent_id,relationship,verified_by) values($1,$2,'guardian',$3)",[U[s].id,U[p].id,U.admin.id]);
for(const name of ['bk','expired','fakebk'])await db.query("insert into public.user_assignments(user_id,assignment_code,valid_from,valid_until) values($1,'counselor',public.app_ops_today()-10,public.app_ops_today()+$2::int)",[U[name].id,name==='expired'?-1:10]);
// Synthetic envelopes only: no real endpoints/keys/provider IO in these domain tests.
const cipher={iv:'AAAAAAAAAAAAAAAA',ciphertext:'c3ludGhldGlj',tag:'AAAAAAAAAAAAAAAAAAAAAA'};
await db.exec("update sim_murid_private.push_settings set enabled=true,test_enabled=true,dispatch_enabled=true,categories=array['points']");
const devices={};for(const [name,u] of Object.entries(U)){
 const d={installation_id:uuid(),endpoint_hash:uuid().replaceAll('-','').repeat(2),subscription_hash:'b'.repeat(64),endpoint_ciphertext:cipher,keys_ciphertext:cipher,encryption_key_version:'fixture-v1',vapid_key_version:'fixture-v1',binding_secret_hash:'c'.repeat(64),label:'Synthetic'};
 const r=await val('select public.app_push_register($1,$2,$3)',[u.id,u.session,d]);assert.equal(r.code,'saved');devices[name]=r.id;
 await val('select public.app_push_preferences($1,$2)',[u.id,u.session]);await val('select public.app_push_preferences($1,$2,0,$3)',[u.id,u.session,{categories:['points'],quiet_start:'00:00',quiet_end:'00:00',timezone:'Asia/Jakarta'}]);
 await db.query("insert into sim_murid_private.push_point_pilot_members(user_id,expires_at) values($1,now()+interval '1 day')",[u.id]);
}
await db.exec("update sim_murid_private.service_settings set point_threshold=2,email_enabled=true,whatsapp_enabled=true;update sim_murid_private.point_catalog set points=-25 where code='C01'");
const revision=()=>val('select revision::int from sim_murid_private.operations_state');
async function write(command,request=uuid(),rev=undefined,actor=U.admin){return val('select public.app_services_write($1,$2,$3,$4,$5,$6)',[actor.id,actor.session,request,rev??await revision(),'discipline',command]);}
const record=(student='student',code='C01',request=uuid(),rev=undefined)=>write({type:'event',studentId:U[student].id,date:today,code,notes:'Synthetic pilot'},request,rev);
const pushRecipients=e=>all('select recipient_id from sim_murid_private.push_events where source_id=$1 order by recipient_id',[e]).then(x=>x.map(r=>r.recipient_id).sort());
const inboxRecipients=e=>all('select recipient_id from sim_murid_private.inbox where entity_id=$1 order by recipient_id',[e]).then(x=>x.map(r=>r.recipient_id).sort());
const expected=names=>names.map(n=>U[n].id).sort();
const count=(table)=>val('select count(*)::int from sim_murid_private.'+table);
const enable=()=>db.exec("update sim_murid_private.push_settings set enabled=true,dispatch_enabled=true,categories=array['points'],points_pilot_enabled=true");
async function scenario(name,run){test(name,async()=>{await db.exec('begin');try{await run();}finally{await db.exec('rollback');}});}
await scenario('WP06 defaults and browser grants fail closed; point/email/WA behavior remains when pilot is off',async()=>{
 assert.equal(await val('select points_pilot_enabled from sim_murid_private.push_settings'),false);
 const r=await record();assert.equal(r.code,'saved');assert.deepEqual(await inboxRecipients(r.id),expected(['student','parent','parent2','home','bk']));assert.equal(await count('push_events'),0);
 assert.equal(await val("select count(*)::int from sim_murid_private.outbox where channel='email' and aggregate_id=$1",[r.id]),5);assert.equal(await val("select count(*)::int from sim_murid_private.outbox where channel='whatsapp' and aggregate_id=$1",[r.id]),5);
 for(const role of ['anon','authenticated']){for(const q of ['select * from sim_murid_private.push_point_pilot_members',"select sim_murid_private.push_point_pilot_allowed('00000000-0000-4000-8000-000000000001',now())"]){await db.exec('savepoint denied_role;set local role '+role);await assert.rejects(()=>db.exec(q));await db.exec('rollback to denied_role;reset role');}}
});
await scenario('WP06 domain resolver intersects explicit pilot members; unrelated teacher/parent/class and inactive assignment never fan out',async()=>{
 await enable();await db.query('delete from sim_murid_private.push_point_pilot_members where user_id=$1',[U.parent2.id]);
 const r=await record();assert.equal(r.code,'saved');assert.deepEqual(await pushRecipients(r.id),expected(['student','parent','home','bk']));assert.deepEqual(await inboxRecipients(r.id),expected(['student','parent','parent2','home','bk']));
 const rows=await all("select e.*,o.payload from sim_murid_private.push_events e join sim_murid_private.outbox o on o.id=e.outbox_id where e.source_id=$1",[r.id]);assert.equal(rows.length,4);
 for(const e of rows){assert.equal(e.dedup_key,'point:'+r.id+':'+e.recipient_id);assert.equal(await val("select expires_at=occurred_at+interval '24 hours' from sim_murid_private.push_events where id=$1",[e.id]),true);assert.deepEqual(Object.keys(e.payload).sort(),['inbox_id','recipient_id']);}
 assert.equal(await val('select wake_requested from sim_murid_private.push_worker_state'),true);
});
await scenario('WP06 threshold, positive points, R02/R03 and admin level retain existing business semantics',async()=>{
 await enable();let r=await record('student','A01');assert.equal(r.code,'saved');assert.equal((await inboxRecipients(r.id)).length,0);assert.equal((await pushRecipients(r.id)).length,0);
 await db.exec('update sim_murid_private.service_settings set point_threshold=5');
 await record('student','A01');r=await record('student','A01');assert.equal((await inboxRecipients(r.id)).length,5);assert.equal((await pushRecipients(r.id)).length,5); // multiplier 3 -> R02
 r=await record('student','A01');assert.deepEqual(await pushRecipients(r.id),expected(['student','parent','parent2','home','bk','admin'])); // R03 level 5
 const before=await count('push_events');r=await record('student','F01');assert.equal(r.code,'saved');assert.equal(await count('push_events'),before);
 const replay=await val('select public.app_point_replay($1,$2)',[U.student.id,month]);assert.equal(replay.balance,5);
});
await scenario('WP06 guardian of multiple children receives separate scoped events, never a stranger child',async()=>{
 await enable();const a=await record(),b=await record('child2'),c=await record('outside');assert.equal(a.code,'saved');assert.equal(b.code,'saved');assert.equal(c.code,'saved');
 assert.ok((await pushRecipients(a.id)).includes(U.parent.id));assert.ok((await pushRecipients(b.id)).includes(U.parent.id));assert.ok(!(await pushRecipients(c.id)).includes(U.parent.id));
 const r=await val("select public.app_push_open($1,$2,d.delivery_ref) from sim_murid_private.push_deliveries d join sim_murid_private.push_events e on e.id=d.event_id where e.source_id=$3 and e.recipient_id=$4 limit 1",[U.stranger.id,U.stranger.session,a.id,U.parent.id]);assert.equal(r,null);
});
await scenario('WP06 same request/notify replay deduplicates inbox/event/device, and new subscription never backfills old event',async()=>{
 await enable();const req=uuid(),rev=await revision(),a=await record('student','C01',req,rev);assert.equal(a.code,'saved');const before=await count('push_deliveries');assert.equal((await record('student','C01',req,rev)).id,a.id);
 await val('select public.app_point_notify($1,$2,$3)',[U.student.id,month,a.id]);assert.equal(await count('push_deliveries'),before);
 await db.query("insert into sim_murid_private.push_subscriptions(installation_id,user_id,endpoint_hash,subscription_hash,endpoint_ciphertext,keys_ciphertext,encryption_key_version,vapid_key_version,binding_secret_hash,last_authorized_session_id) values($1,$2,$3,$4,$5,$5,'fixture-v1','fixture-v1',$4,$6)",[uuid(),U.student.id,uuid().replaceAll('-','').repeat(2),'d'.repeat(64),cipher,U.student.session]);
 await val('select public.app_point_notify($1,$2,$3)',[U.student.id,month,a.id]);assert.equal(await count('push_deliveries'),before);
});
await scenario('WP06 rollback removes domain event, inbox/outbox/delivery, request/audit and durable wake together',async()=>{
 await enable();await db.exec('update sim_murid_private.push_worker_state set wake_requested=false');const tables=['point_events','inbox','outbox','push_events','push_deliveries','operations_requests','activity_logs'];const before=await Promise.all(tables.map(count));
 await db.exec('savepoint domain_write');assert.equal((await record()).code,'saved');assert.equal(await val('select wake_requested from sim_murid_private.push_worker_state'),true);await db.exec('rollback to domain_write');assert.deepEqual(await Promise.all(tables.map(count)),before);assert.equal(await val('select wake_requested from sim_murid_private.push_worker_state'),false);
 // A failure after producer work is also atomic inside the existing domain RPC.
 await db.exec("create function sim_murid_private.pilot_test_failure() returns trigger language plpgsql as $$begin raise exception 'synthetic audit failure';end$$;create trigger pilot_test_failure before insert on sim_murid_private.activity_logs for each row execute function sim_murid_private.pilot_test_failure()");
 await db.exec('savepoint failed_audit');await assert.rejects(()=>record(),/synthetic audit failure/);await db.exec('rollback to failed_audit');assert.deepEqual(await Promise.all(tables.map(count)),before);
});
await scenario('WP06 revoked guardian cancels processing immediately and stale completion cannot revive it; other recipients survive',async()=>{
 await enable();const r=await record();let c;for(let i=0;i<5;i++){const x=await val('select public.app_push_claim()');assert.equal(x.code,'claimed');if(x.subscription.user_id===U.parent.id)c=x;}
 assert.ok(c);await db.query('update sim_murid_private.student_guardians set revoked_at=now() where student_id=$1 and parent_id=$2',[U.student.id,U.parent.id]);
 assert.equal(await val('select status from sim_murid_private.push_deliveries where id=$1',[c.delivery.id]),'cancelled');assert.equal((await val('select public.app_push_complete($1,$2,$3,$4,$5)',[c.delivery.id,c.delivery.claim_token,c.delivery.binding_version,'accepted',201])).code,'stale');
 assert.equal(await val("select count(*)::int from sim_murid_private.push_deliveries d join sim_murid_private.push_events e on e.id=d.event_id where e.source_id=$1 and d.status='processing'",[r.id]),4);
});
await scenario('WP06 source cancellation, homeroom removal, BK assignment/role removal cancel only ineligible pending recipients',async()=>{
 await enable();const r=await record();await db.query('update public.classes set homeroom_teacher_id=null where id=$1',[cls]);await db.query("update public.user_assignments set revoked_at=now() where user_id=$1 and assignment_code='counselor'",[U.bk.id]);
 assert.deepEqual((await all("select e.recipient_id from sim_murid_private.push_deliveries d join sim_murid_private.push_events e on e.id=d.event_id where e.source_id=$1 and d.status='cancelled'",[r.id])).map(x=>x.recipient_id).sort(),expected(['home','bk']));
 assert.equal((await write({type:'cancel',id:r.id,reason:'Synthetic correction'})).code,'saved');assert.equal(await val("select count(*)::int from sim_murid_private.push_deliveries d join sim_murid_private.push_events e on e.id=d.event_id where e.source_id=$1 and d.status<>'cancelled'",[r.id]),0);
});
await scenario('WP06 pilot withdrawal stops pending transport but preserves otherwise authorized inbox/click and never resets read',async()=>{
 await enable();await record();const x=await val("select jsonb_build_object('ref',d.delivery_ref,'id',d.id,'inbox',e.inbox_id) from sim_murid_private.push_deliveries d join sim_murid_private.push_events e on e.id=d.event_id where e.recipient_id=$1",[U.student.id]);
 await db.query('update sim_murid_private.push_point_pilot_members set revoked_at=now() where user_id=$1',[U.student.id]);assert.equal(await val('select status from sim_murid_private.push_deliveries where id=$1',[x.id]),'cancelled');
 assert.ok(await val('select public.app_push_open($1,$2,$3)',[U.student.id,U.student.session,x.ref]));assert.equal(await val('select read_at from sim_murid_private.inbox where id=$1',[x.inbox]),null);
 assert.ok(await val('select public.app_push_open($1,$2,$3,true)',[U.student.id,U.student.session,x.ref]));
 await db.exec('update sim_murid_private.push_settings set points_pilot_enabled=false');assert.ok(await val('select public.app_push_open($1,$2,$3)',[U.student.id,U.student.session,x.ref]));
});
await scenario('WP06 expired membership, opt-out and inactive account stop dispatch; membership window is bounded',async()=>{
 await enable();const r=await record();await db.query("update sim_murid_private.push_point_pilot_members set created_at=now()-interval '2 days',expires_at=now()-interval '1 day' where user_id=$1",[U.parent.id]);
 await db.query("update sim_murid_private.push_preferences set categories='{}' where user_id=$1",[U.parent2.id]);await db.query("update public.profiles set status='inactive' where id=$1",[U.student.id]);
 assert.equal(await val("select count(*)::int from sim_murid_private.push_deliveries d join sim_murid_private.push_events e on e.id=d.event_id where e.source_id=$1 and d.status='cancelled'",[r.id]),3);
 await assert.rejects(()=>db.query("insert into sim_murid_private.push_point_pilot_members(user_id,expires_at) values($1,now()+interval '31 days') on conflict(user_id) do update set expires_at=excluded.expires_at",[U.stranger.id]));
});
await scenario('WP06 category/pilot kill switch cancels pending; repeated producer cannot resurrect old events and diagnostics expose only counts',async()=>{
 await enable();const r=await record();await db.exec('update sim_murid_private.push_settings set points_pilot_enabled=false');assert.equal(await val("select count(*)::int from sim_murid_private.push_deliveries where status='cancelled'"),5);
 await enable();await val('select public.app_point_notify($1,$2,$3)',[U.student.id,month,r.id]);assert.equal(await val("select count(*)::int from sim_murid_private.push_deliveries where status='queued'"),0);
 const status=await val('select public.app_push_status($1,$2)',[U.admin.id,U.admin.session]);assert.equal(status.points_pilot.enabled,true);assert.equal(status.points_pilot.active_members,Object.keys(U).length);assert.equal(JSON.stringify(status).includes(U.student.id),false);
});
await scenario('WP06 late pilot enrolment and source older than transport TTL never backfill via direct enqueue',async()=>{
 await db.exec("update sim_murid_private.push_settings set points_pilot_enabled=false");const r=await record();assert.equal(r.code,'saved');
 await db.query('update sim_murid_private.push_point_pilot_members set created_at=now()+interval \'1 minute\',expires_at=now()+interval \'1 day\' where user_id=$1',[U.student.id]);await enable();
 const i=await val('select id from sim_murid_private.inbox where entity_id=$1 and recipient_id=$2',[r.id,U.student.id]);
 assert.equal((await val("select public.app_push_enqueue($1,'points',$2,$3,now(),now()+interval '24 hours')",[i,r.id,'point:'+r.id+':'+U.student.id])).code,'disabled');assert.equal(await count('push_events'),0);
 await val('select public.app_point_notify($1,$2,$3)',[U.child2.id,month,r.id]);assert.equal(await count('push_events'),0); // mismatched source student
 await db.query("update sim_murid_private.point_events set created_at=now()-interval '2 days' where id=$1",[r.id]);
 await db.query('delete from sim_murid_private.inbox where entity_id=$1 and recipient_id=$2',[r.id,U.student.id]);
 await db.query("update sim_murid_private.push_point_pilot_members set created_at=now()-interval '3 days' where user_id=$1",[U.student.id]);
 await val('select public.app_point_notify($1,$2,$3)',[U.student.id,month,r.id]);assert.equal(await count('push_events'),0); // source-based TTL is already expired
});
await scenario('WP06 passage of time is checked again at preflight; opt-out never waits for a future provider call',async()=>{
 await enable();await record();let target;for(let i=0;i<5;i++){const c=await val('select public.app_push_claim()');if(c.subscription.user_id===U.parent.id)target=c;}
 // Simulate clock passage without firing the edit-trigger (test database only).
 await db.exec('alter table sim_murid_private.push_point_pilot_members disable trigger push_points_scope');await db.query("update sim_murid_private.push_point_pilot_members set created_at=now()-interval '2 days',expires_at=now()-interval '1 day' where user_id=$1",[U.parent.id]);await db.exec('alter table sim_murid_private.push_point_pilot_members enable trigger push_points_scope');
 assert.equal((await val('select public.app_push_preflight($1,$2,$3)',[target.delivery.id,target.delivery.claim_token,target.delivery.binding_version])).code,'cancelled');
});
await scenario('WP06 role or enrolment removal cancels pending but accepted transport history remains immutable',async()=>{
 await enable();const r=await record();let accepted;for(let i=0;i<5;i++){const c=await val('select public.app_push_claim()');if(c.subscription.user_id===U.student.id){accepted=c;assert.equal((await val('select public.app_push_complete($1,$2,$3,$4,$5)',[c.delivery.id,c.delivery.claim_token,c.delivery.binding_version,'accepted',201])).status,'accepted');}}
 await db.query("update public.user_roles set role_code='parent' where user_id=$1",[U.bk.id]);await db.query('update sim_murid_private.enrollments set ended_at=now() where student_id=$1',[U.student.id]);
 assert.equal(await val("select count(*)::int from sim_murid_private.push_deliveries d join sim_murid_private.push_events e on e.id=d.event_id where e.source_id=$1 and e.recipient_id in($2,$3) and d.status='cancelled'",[r.id,U.bk.id,U.home.id]),2);
 await write({type:'cancel',id:r.id,reason:'Synthetic cancellation'});assert.equal(await val('select status from sim_murid_private.push_deliveries where id=$1',[accepted.delivery.id]),'accepted');
});

// Real Next route -> actual validation/server reader -> actual domain RPC -> pilot queue.
// Only Auth and SDK network boundaries are replaced, never the domain SQL.
const {registerAuditHooks}=await import('../audit-loader.mjs');
const {NextRequest,NextResponse}=await import('next/server.js');
globalThis.pilotReply=(body,status=200)=>NextResponse.json(body,{status});globalThis.pilotCaller={principal:{id:U.admin.id},sessionId:U.admin.session};
globalThis.pilotRpc=async(name,args)=>{try{assert.match(name,/^app_[a-z_]+$/);const keys=Object.keys(args),params=keys.map(k=>typeof args[k]==='object'&&args[k]!==null?JSON.stringify(args[k]):args[k]);const q='select public.'+name+'('+keys.map((k,i)=>k+' => $'+(i+1)).join(',')+')';return {data:await val(q,params),error:null};}catch(e){return {data:null,error:{message:e.message}};}};
registerAuditHooks({'server-only':'export {};','@/lib/auth/admin':'export const createAuthAdmin=()=>({rpc:(name,args)=>globalThis.pilotRpc(name,args)});','@/lib/auth/http':"export const privateJson=(body,status=200)=>globalThis.pilotReply(body,status);export const requestAuth=()=>({});export const verifiedPrincipal=async()=>globalThis.pilotCaller;export const sameOrigin=r=>r.headers.get('origin')===r.nextUrl.origin;",'@/lib/settings/server':'export const readBounded=async r=>new Uint8Array(await r.arrayBuffer());'});
const {POST}=await import('../../src/app/api/services/[module]/route.ts');
await scenario('WP06 real API under service_role preserves server actor and rejects recipient injection, wrong origin and anonymous caller before domain writes',async()=>{
 await db.exec('set local role service_role');await enable();const req=uuid(),rev=await revision();const command={type:'event',studentId:U.student.id,date:today,code:'C01',notes:'Synthetic API pilot'};
 const post=(cmd,origin='https://pilot.example.invalid')=>POST(new NextRequest('https://pilot.example.invalid/api/services/discipline',{method:'POST',headers:{origin,'content-type':'application/json'},body:JSON.stringify({requestId:req,revision:rev,command:cmd})}),{params:Promise.resolve({module:'discipline'})});
 const bad=await post({...command,recipientId:U.stranger.id});assert.equal(bad.status,400);assert.equal(await count('point_events'),0);
 assert.equal((await post(command,'https://foreign.invalid')).status,403);globalThis.pilotCaller=null;assert.equal((await post(command)).status,401);globalThis.pilotCaller={principal:{id:U.admin.id},sessionId:U.admin.session};
 const saved=await post(command),body=await saved.json();assert.equal(saved.status,200,JSON.stringify(body));assert.equal(body.result.code,'saved');
 const e=await val('select id from sim_murid_private.point_events');assert.deepEqual(await pushRecipients(e),expected(['student','parent','parent2','home','bk']));assert.equal(await val('select created_by from sim_murid_private.point_events'),U.admin.id);
 assert.equal((await post(command)).status,200);assert.equal(await count('point_events'),1);assert.equal(await count('push_events'),5);
});
