import {test,after} from 'node:test';
import assert from 'node:assert/strict';
import {randomUUID as uuid} from 'node:crypto';
import {createIsolatedDatabase} from '../../scripts/database/harness.mjs';
const {db}=await createIsolatedDatabase();after(()=>db.close());
const val=async(q,p=[])=>Object.values((await db.query(q,p)).rows[0])[0];
const all=async(q,p=[])=>(await db.query(q,p)).rows;
const today=await val('select public.app_ops_today()::text'),start=Number(today.slice(0,4))-(Number(today.slice(5,7))<7?1:0);
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
const cats=['schedule','reports','surveys','documents'];
for(const u of Object.values(U)){
 await db.query('update sim_murid_private.push_preferences set categories=$1 where user_id=$2',[cats,u.id]);
 for(const cat of cats)await db.query("insert into sim_murid_private.push_category_members(category,user_id,expires_at) values($1,$2,now()+interval '1 day')",[cat,u.id]);
}
const subject=await val('select id from public.subjects where active order by sort_order limit 1');
const sem=Number(today.slice(5,7))>=7?1:2;
const count=t=>val('select count(*)::int from sim_murid_private.'+t);
const expected=names=>names.map(n=>U[n].id).sort();
const recipients=cat=>all('select distinct recipient_id from sim_murid_private.push_events where category=$1 order by recipient_id',[cat]).then(r=>r.map(x=>x.recipient_id).sort());
const enable=(categories=cats)=>db.query('update sim_murid_private.push_settings set enabled=true,dispatch_enabled=true,categories=$1,expanded_pilot_categories=$1',[categories]);
const edRev=()=>val('select revision from sim_murid_private.education_state');
const opRev=()=>val('select revision from sim_murid_private.operations_state');
const schedule=async(cmd,request=uuid(),rev=undefined)=>val('select public.app_schedules_write($1,$2,$3,$4,$5)',[U.admin.id,U.admin.session,request,rev??await edRev(),cmd]);
const lesson=(over={})=>({type:'lesson',id:null,classId:cls,teacherId:U.teacher.id,subjectId:subject,weekday:1,start:'07:00',durationMinutes:40,jtm:1,breakMinutes:0,...over});
const learn=async(module,cmd)=>val('select public.app_learning_write($1,$2,$3,$4,$5,$6)',[U.admin.id,U.admin.session,uuid(),await opRev(),module,cmd]);
const publish=()=>learn('reports',{type:'publish',classId:cls,semester:sem,studentIds:[U.student.id]});
async function reportReady(){await schedule(lesson());for(const [kind,value] of [['PH',80],['ATS',70],['ASAS',90]])assert.equal((await learn('grades',{type:'batch',id:null,classId:cls,subjectId:subject,date:today,kind,items:[{studentId:U.student.id,value,notes:''}]})).code,'saved');}
async function period(kind='main',targets=['student']){const id=uuid();await db.query("insert into sim_murid_private.survey_periods(id,title,academic_year_id,semester,starts_on,ends_on,targets,kind,created_by) values($1,'Synthetic',$2,$3,public.app_ops_today(),public.app_ops_today(),$4,$5,$6)",[id,year,sem,targets,kind,U.admin.id]);return id;}
const remind=(enabled=true,categories=['surveys'])=>val('select public.app_push_reminders($1,$2)',[enabled,categories]);
async function document(kind='KK'){const id=uuid(),r=await val('select public.app_document_prepare($1,$2,$3,$4,$5,$6,$7,$8)',[U.admin.id,U.admin.session,U.student.id,id,kind,'synthetic.pdf','application/pdf',10]);assert.equal(r.code,'prepared');return id;}
const finish=(id,valid=true)=>val('select public.app_document_finish($1,$2,$3,$4,$5)',[U.admin.id,U.admin.session,id,'a'.repeat(64),valid]);
async function scenario(name,run){test(name,async()=>{await db.exec('begin');try{await run();}finally{await db.exec('rollback');}});}
await scenario('WP07 all expanded flags default off; source writes do not enqueue or backfill when enabled later',async()=>{
 assert.deepEqual(await val('select expanded_pilot_categories from sim_murid_private.push_settings'),[]);const r=await schedule(lesson());assert.equal(r.code,'saved');assert.equal(await count('push_sources'),0);await enable();assert.equal(await count('push_events'),0);
 for(const role of ['anon','authenticated'])for(const q of ['select * from sim_murid_private.push_sources','select * from sim_murid_private.push_category_members',"select public.app_push_reminders(true,array['surveys'])"]){await db.exec('savepoint denied_role;set local role '+role);await assert.rejects(()=>db.exec(q));await db.exec('rollback to denied_role;reset role');}
});
await scenario('WP07 schedule real mutation uses affected class scope, explicit membership and preference; not admin/teacher role fanout',async()=>{
 await enable(['schedule']);await db.query("delete from sim_murid_private.push_category_members where category='schedule' and user_id=$1",[U.parent2.id]);
 const r=await schedule(lesson());assert.equal(r.code,'saved');assert.deepEqual(await recipients('schedule'),expected(['student','child2','parent','home','teacher']));
 assert.equal(await val("select bool_and(d.available_at>=e.occurred_at+interval '60 seconds' and e.expires_at=e.occurred_at+interval '1 hour') from sim_murid_private.push_deliveries d join sim_murid_private.push_events e on e.id=d.event_id"),true);
 assert.equal((await val('select public.app_push_claim()')).code,'empty');
});
await scenario('WP07 rapid schedule edits merge one unread/unattempted event; duplicate, no-op and failed save produce no extra push',async()=>{
 await enable(['schedule']);const req=uuid(),rev=await edRev(),a=await schedule(lesson(),req,rev);assert.equal(a.code,'saved');assert.equal((await schedule(lesson(),req,rev)).id,a.id);const n=await count('push_events');
 assert.equal((await schedule(lesson({id:a.id,start:'07:10'}))).code,'saved');assert.equal(await count('push_sources'),1);assert.equal(await count('push_events'),n);assert.equal(await val('select latest_version>version from sim_murid_private.push_sources'),true);
 await schedule(lesson({id:a.id,start:'07:10'}));assert.equal(await count('push_events'),n);
 assert.equal((await schedule(lesson({classId:othercls,start:'07:20'}))).code,'overlap');assert.equal(await count('push_events'),n);
});
await scenario('WP07 read or attempted schedule events are never merged; older pending deliveries cancel and stale completion stays fenced',async()=>{
 await enable(['schedule']);const a=await schedule(lesson());const old=await val('select id from sim_murid_private.push_sources');
 await db.exec("update sim_murid_private.push_deliveries set available_at=now()");const claim=await val('select public.app_push_claim()');assert.equal(claim.code,'claimed');
 assert.equal((await schedule(lesson({id:a.id,start:'07:10'}))).code,'saved');assert.equal(await count('push_sources'),2);
 assert.equal(await val("select count(*)::int from sim_murid_private.push_deliveries d join sim_murid_private.push_events e on e.id=d.event_id where e.source_id=$1 and d.status<>'cancelled'",[old]),0);
 assert.equal((await val('select public.app_push_complete($1,$2,$3,$4,$5)',[claim.delivery.id,claim.delivery.claim_token,claim.delivery.binding_version,'accepted',201])).code,'stale');
});
await scenario('WP07 student duty replacement coalesces per class/revision, scope revoked by parent/enrolment changes',async()=>{
 await enable(['schedule']);assert.equal((await schedule({type:'duties',classId:cls,items:[{studentId:U.student.id,weekday:1},{studentId:U.child2.id,weekday:2}]})).code,'saved');assert.equal(await count('push_sources'),1);
 assert.deepEqual(await recipients('schedule'),expected(['student','child2','parent','parent2','home']));await db.query('update sim_murid_private.enrollments set ended_at=now() where student_id=$1',[U.student.id]);
 assert.equal(await val("select count(*)::int from sim_murid_private.push_deliveries d join sim_murid_private.push_events e on e.id=d.event_id where e.recipient_id=$1 and d.status='cancelled'",[U.parent2.id]),1);
 // This parent still has a second child in the class, so their other valid scope survives.
 assert.equal(await val("select count(*)::int from sim_murid_private.push_deliveries d join sim_murid_private.push_events e on e.id=d.event_id where e.recipient_id=$1 and d.status='queued'",[U.parent.id]),1);
});
await scenario('WP07 report emits only after actual complete publication; drafts, grade edits, incomplete and duplicate publication do not emit',async()=>{
 await enable(['reports']);assert.equal((await publish()).code,'incomplete');assert.equal(await count('push_events'),0);await reportReady();assert.equal(await count('push_events'),0);
 const draft=await val('select public.app_report_draft($1,$2,$3,$4,$5)',[U.admin.id,U.admin.session,U.student.id,cls,sem]);assert.equal(Number(draft.subjects[0].final),82);assert.equal(await count('push_events'),0);
 const pub=await publish();assert.equal(pub.code,'saved');assert.deepEqual(await recipients('reports'),expected(['student','parent','parent2']));assert.equal((await publish()).code,'published');assert.equal(await count('push_events'),3);
 assert.equal(await val("select bool_and(expires_at=occurred_at+interval '24 hours') from sim_murid_private.push_events"),true);
});
await scenario('WP07 reports respect current guardian ownership across children; kill switch stops delivery without destroying authorized inbox',async()=>{
 await enable(['reports']);await reportReady();await publish();const x=await val("select jsonb_build_object('ref',d.delivery_ref,'id',d.id) from sim_murid_private.push_deliveries d join sim_murid_private.push_events e on e.id=d.event_id where e.recipient_id=$1",[U.parent.id]);
 assert.equal(await val('select public.app_push_open($1,$2,$3)',[U.stranger.id,U.stranger.session,x.ref]),null);
 await db.exec("update sim_murid_private.push_settings set expanded_pilot_categories='{}'");assert.equal(await val('select status from sim_murid_private.push_deliveries where id=$1',[x.id]),'cancelled');assert.ok(await val('select public.app_push_open($1,$2,$3)',[U.parent.id,U.parent.session,x.ref]));
 await db.query('update sim_murid_private.student_guardians set revoked_at=now() where parent_id=$1 and student_id=$2',[U.parent.id,U.student.id]);assert.equal(await val('select public.app_push_open($1,$2,$3)',[U.parent.id,U.parent.session,x.ref]),null);
});
await scenario('WP07 survey reminder has environment/DB gates, current targets, required-main/unsubmitted semantics and one event per WIB day',async()=>{
 await enable(['surveys']);await period();await period('micro');assert.equal((await remind(false)).created,0);assert.equal(await count('push_events'),0);
 assert.equal((await remind()).code,'saved');assert.deepEqual(await recipients('surveys'),expected(['student','child2','outside']));assert.equal(await count('push_events'),3);await remind();assert.equal(await count('push_events'),3);
 assert.equal(await val("select bool_and(expires_at<=((public.app_ops_today()+1)::timestamp at time zone 'Asia/Jakarta')) from sim_murid_private.push_events"),true);
});
await scenario('WP07 survey submission, target change and closure stop pending reminders; role alone cannot select another user',async()=>{
 await enable(['surveys']);const p=await period();await remind();await db.query("insert into sim_murid_private.survey_respondents(period_id,user_id,role,instrument,submitted_at) values($1,$2,'student','[]',now())",[p,U.student.id]);
 assert.equal(await val("select d.status from sim_murid_private.push_deliveries d join sim_murid_private.push_events e on e.id=d.event_id where e.recipient_id=$1",[U.student.id]),'cancelled');
 await db.query("update sim_murid_private.survey_periods set status='closed' where id=$1",[p]);assert.equal(await val("select count(*)::int from sim_murid_private.push_deliveries where status<>'cancelled'"),0);await remind();assert.equal(await count('push_events'),3);
});
await scenario('WP07 ready document is a verified byte transition, never pending/failed or a fabricated approval; replacement cancels superseded source',async()=>{
 await enable(['documents']);const bad=await document();assert.equal(await count('push_events'),0);assert.equal((await finish(bad,false)).code,'invalid');assert.equal(await count('push_events'),0);
 const d=await document();assert.equal((await finish(d)).code,'saved');assert.deepEqual(await recipients('documents'),expected(['student','parent','parent2']));assert.equal((await finish(d)).code,'saved');assert.equal(await count('push_events'),3);
 const next=await document();assert.equal((await finish(next)).code,'saved');assert.equal(await count('push_events'),6);assert.equal(await val("select count(*)::int from sim_murid_private.push_deliveries d join sim_murid_private.push_events e on e.id=d.event_id join sim_murid_private.push_sources s on s.id=e.source_id where s.entity_id=$1 and d.status='cancelled'",[d]),3);
 const state=await val('select state from sim_murid_private.student_documents where id=$1',[next]);assert.equal(state,'ready');
});
await scenario('WP07 document deletion/relation revocation prevents dispatch and signed URLs or paths never enter push outbox',async()=>{
 await enable(['documents']);const d=await document();await finish(d);const payloads=await all("select payload from sim_murid_private.outbox where channel='push'");for(const {payload} of payloads)assert.deepEqual(Object.keys(payload).sort(),['inbox_id','recipient_id']);
 await db.query('update sim_murid_private.student_guardians set revoked_at=now() where student_id=$1 and parent_id=$2',[U.student.id,U.parent.id]);
 assert.equal((await val('select public.app_document_delete($1,$2,$3,false)',[U.admin.id,U.admin.session,d])).code,'deleting');assert.equal(await val("select count(*)::int from sim_murid_private.push_deliveries where status<>'cancelled'"),0);
});
await scenario('WP07 failed outer transaction atomically rolls back source, inbox, event/delivery and wake for every implemented category',async()=>{
 await enable();await db.exec('update sim_murid_private.push_worker_state set wake_requested=false');const before=await count('push_events');await db.exec('savepoint mutation');await schedule(lesson());await reportReady();await publish();await period();await remind();const d=await document();await finish(d);assert.ok(await count('push_events')>before);await db.exec('rollback to mutation');assert.equal(await count('push_sources'),0);assert.equal(await count('push_events'),before);assert.equal(await val('select wake_requested from sim_murid_private.push_worker_state'),false);
});
await scenario('WP07 expanded member expiry, opt-out, category disable and account disable cancel pending; follow_up cannot be enabled',async()=>{
 await enable(['schedule']);await schedule(lesson());await db.query("update sim_murid_private.push_category_members set revoked_at=now() where category='schedule' and user_id=$1",[U.parent.id]);await db.query("update sim_murid_private.push_preferences set categories='{}' where user_id=$1",[U.parent2.id]);await db.query("update public.profiles set status='inactive' where id=$1",[U.student.id]);
 assert.equal(await val("select count(*)::int from sim_murid_private.push_deliveries where status='cancelled'"),3);
 await db.exec('savepoint held');await assert.rejects(()=>db.exec("update sim_murid_private.push_settings set expanded_pilot_categories=array['follow_up']"));await db.exec('rollback to held');
 const status=await val('select public.app_push_status($1,$2)',[U.admin.id,U.admin.session]);assert.deepEqual(status.held_categories,['follow_up']);assert.deepEqual(status.expanded_pilots,['schedule']);assert.equal(JSON.stringify(status).includes(U.student.id),false);
});
await scenario('WP07 service_role domain path can enqueue schedule and surveys using private helper grants',async()=>{
 await enable();await period();await db.exec('set local role service_role');assert.equal((await schedule(lesson())).code,'saved');assert.equal((await remind()).code,'saved');assert.ok(await count('push_events')>0);
});
await scenario('WP07 new WIB day can remind again; previous day is cancelled and daily dedup remains stable',async()=>{
 await enable(['surveys']);await period();await remind();
 // Simulate persisted yesterday data while keeping today's clock authoritative.
 await db.exec("update sim_murid_private.push_sources set version=to_char(public.app_ops_today()-1,'YYYYMMDD')::bigint,latest_version=to_char(public.app_ops_today()-1,'YYYYMMDD')::bigint,occurred_at=now()-interval '24 hours',expires_at=now()-interval '1 second';update sim_murid_private.push_events set occurred_at=now()-interval '24 hours',expires_at=now()-interval '1 second',dedup_key=dedup_key||':previous';update sim_murid_private.inbox set dedup_key=dedup_key||':previous';update sim_murid_private.outbox set idempotency_key=idempotency_key||':previous' where channel='push'");
 await remind();assert.equal(await count('push_events'),6);assert.equal(await val("select count(*)::int from sim_murid_private.push_deliveries where status='queued'"),3);await remind();assert.equal(await count('push_events'),6);
});
await scenario('WP07 resolved document context names only its authorized owner; click category/context excludes signed URLs and cross-account IDs',async()=>{
 await enable(['documents']);const d=await document();await finish(d);const ref=await val('select delivery_ref from sim_murid_private.push_deliveries d join sim_murid_private.push_events e on e.id=d.event_id where e.recipient_id=$1',[U.parent.id]);
 const opened=await val('select public.app_push_open($1,$2,$3)',[U.parent.id,U.parent.session,ref]);assert.equal(opened.category,'documents');assert.deepEqual(opened.context,{owner_id:U.student.id,class_id:null,year_id:null,semester:null});assert.equal(opened.read_at,null);assert.doesNotMatch(JSON.stringify(opened),/synthetic.pdf|sha256|https:|path/);
 assert.equal(await val('select public.app_push_open($1,$2,$3)',[U.parent2.id,U.parent2.session,ref]),null);
});
await scenario('WP07 daily reminder materialization is bounded to twenty accounts per invocation and resumes without duplicates',async()=>{
 await enable(['surveys']);await period();
 for(let i=0;i<30;i++){
 const id=uuid();await db.query('insert into auth.users values($1)',[id]);await db.query('insert into public.profiles(id,username,full_name) values($1,$2,$2)',[id,'bounded-'+i]);await db.query("insert into public.user_roles values($1,'student')",[id]);
 await db.query("insert into sim_murid_private.push_preferences(user_id,categories,quiet_start,quiet_end) values($1,array['surveys'],'00:00','00:00')",[id]);await db.query("insert into sim_murid_private.push_category_members(category,user_id,expires_at) values('surveys',$1,now()+interval '1 day')",[id]);
 await db.query("insert into sim_murid_private.push_subscriptions(user_id,installation_id,endpoint_hash,subscription_hash,endpoint_ciphertext,keys_ciphertext,encryption_key_version,vapid_key_version,binding_secret_hash,last_authorized_session_id) values($1,$2,$3,$4,$5,$5,'fixture-v1','fixture-v1',$4,$6)",[id,uuid(),uuid().replaceAll('-','').repeat(2),'c'.repeat(64),cipher,uuid()]);
 }
 await remind();assert.equal(await count('push_events'),20);await remind();assert.equal(await count('push_events'),33);await remind();assert.equal(await count('push_events'),33);
});
await scenario('WP07 category cohort has an atomic hard cap',async()=>{
 const active=await val("select count(*)::int from sim_murid_private.push_category_members where category='schedule'");
 for(let i=active;i<200;i++){const id=uuid();await db.query('insert into auth.users values($1)',[id]);await db.query('insert into public.profiles(id,username,full_name) values($1,$2,$2)',[id,'capacity-'+i]);await db.query("insert into sim_murid_private.push_category_members(category,user_id,expires_at) values('schedule',$1,now()+interval '1 day')",[id]);}
 const id=uuid();await db.query('insert into auth.users values($1)',[id]);await db.query("insert into public.profiles(id,username,full_name) values($1,'over-capacity','Synthetic')",[id]);await db.exec('savepoint over_cap');await assert.rejects(()=>db.query("insert into sim_murid_private.push_category_members(category,user_id,expires_at) values('schedule',$1,now()+interval '1 day')",[id]),/capacity/);await db.exec('rollback to over_cap');assert.equal(await val("select count(*)::int from sim_murid_private.push_category_members where category='schedule'"),200);
});
// Actual worker/repository/domain SQL + encrypted sender; only Auth SDK IO and provider IO are doubled.
const {registerAuditHooks}=await import('../audit-loader.mjs');registerAuditHooks({'server-only':'export {};','@/lib/auth/admin':'export const createAuthAdmin=()=>globalThis.extendedAdmin;'});
await scenario('WP07 authenticated worker materializes daily surveys and completes actual encrypted deliveries through the actual RPC repository',async()=>{
 await enable(['surveys']);await period();
 const {createECDH}=await import('node:crypto'),{encrypt,validateEndpoint}=await import('../../src/lib/push/security.ts'),{pushRepository}=await import('../../src/lib/push/repository.ts'),{runPushWorker}=await import('../../src/lib/push/worker.ts'),{sendClaim}=await import('../../src/lib/push/sender.ts');
 const privateKey=Buffer.alloc(32);privateKey[31]=1;const vapid=createECDH('prime256v1');vapid.setPrivateKey(privateKey);const browser=createECDH('prime256v1');browser.generateKeys();const key=Buffer.alloc(32,17);
 for(const sub of await all("select * from sim_murid_private.push_subscriptions where user_id in($1,$2,$3)",[U.student.id,U.child2.id,U.outside.id])){const aad=`sim-push-v1:${sub.installation_id}:${sub.user_id}:fixture-v1`;await db.query('update sim_murid_private.push_subscriptions set endpoint_ciphertext=$1,keys_ciphertext=$2 where id=$3',[encrypt('https://fcm.googleapis.com/synthetic/'+sub.id,key,aad+':endpoint'),encrypt(JSON.stringify({p256dh:browser.getPublicKey().toString('base64url'),auth:Buffer.alloc(16,9).toString('base64url')}),key,aad+':keys'),sub.id]);}
 const names=new Set(['app_push_worker','app_push_maintenance','app_push_reminders','app_push_claim','app_push_preflight','app_push_result']);globalThis.extendedAdmin={rpc:(name,args={})=>({abortSignal:async signal=>{assert.ok(names.has(name));assert.ok(signal instanceof AbortSignal);try{return {data:await val('select public.'+name+'('+Object.keys(args).map((k,i)=>k+'=> $'+(i+1)).join(',')+')',Object.values(args)),error:null};}catch(error){return {data:null,error};}}})};
 const config={enabled:true,dispatch:true,test:false,categories:['surveys'],publicKey:vapid.getPublicKey().toString('base64url'),privateKey:privateKey.toString('base64url'),key,encryptionVersion:'fixture-v1',vapidVersion:'fixture-v1',subject:'mailto:fixture@example.invalid'};let sends=0;
 await db.exec('set local role service_role');const r=await runPushWorker(pushRepository(),config,(claim,c,preflight,signal)=>sendClaim(claim,c,preflight,signal,async(url,address,headers,body)=>{assert.equal(address.address,'142.250.1.1');assert.equal(headers['Content-Encoding'],'aes128gcm');assert.equal(body.includes(Buffer.from('Synthetic')),false);sends++;return {status:'accepted',providerCode:201};},endpoint=>validateEndpoint(endpoint,async()=>[{address:'142.250.1.1',family:4}])));
 assert.equal(r.metrics.accepted,3);assert.equal(r.metrics.providerAccepted,3);assert.equal(sends,3);assert.equal(await val("select count(*)::int from sim_murid_private.inbox where read_at is not null"),0);assert.equal(await val("select count(*)::int from sim_murid_private.push_deliveries where status='accepted'"),3);
});
await scenario('WP07 shortening an open survey clamps queued provider TTL; completing or closing never extends it',async()=>{
 await enable(['surveys']);const id=await period();await db.query('update sim_murid_private.survey_periods set ends_on=public.app_ops_today()+3 where id=$1',[id]);await remind();
 await db.query('update sim_murid_private.survey_periods set ends_on=public.app_ops_today() where id=$1',[id]);assert.equal(await val("select bool_and(expires_at<=((public.app_ops_today()+1)::timestamp at time zone 'Asia/Jakarta')) from sim_murid_private.push_events"),true);
 const before=await val('select min(expires_at)::text from sim_murid_private.push_events');await db.query('update sim_murid_private.survey_periods set ends_on=public.app_ops_today()+4 where id=$1',[id]);assert.equal(await val('select min(expires_at)::text from sim_murid_private.push_events'),before);
});
await scenario('WP07 a UUID reused by another source kind cannot leak its owner through a test/point click context',async()=>{
 const e=await val('select public.app_push_test($1,$2,$3,$4)',[U.student.id,U.student.session,devices.student,uuid()]);assert.equal(e.code,'saved');
 const x=await val("select jsonb_build_object('source',e.source_id,'ref',d.delivery_ref) from sim_murid_private.push_events e join sim_murid_private.push_deliveries d on d.event_id=e.id where e.id=$1",[e.id]);
 await db.query("insert into sim_murid_private.push_sources(id,category,kind,entity_id,version,latest_version,owner_id,occurred_at,expires_at) values($1,'documents','student_document',$2,1,1,$3,now(),now()+interval '24 hours')",[x.source,uuid(),U.outside.id]);
 const opened=await val('select public.app_push_open($1,$2,$3)',[U.student.id,U.student.session,x.ref]);assert.equal(opened.category,'test');assert.equal(opened.context,null);assert.equal(JSON.stringify(opened).includes(U.outside.id),false);
});
