import assert from 'node:assert/strict';
import {test,after} from 'node:test';
import {createIsolatedDatabase} from '../../scripts/database/harness.mjs';
const {db}=await createIsolatedDatabase();after(()=>db.close());
const id=n=>`00000000-0000-4000-8000-${String(n).padStart(12,'0')}`;
const admin=id(1001),user=id(1002),other=id(1003),as=id(1011),us=id(1012),os=id(1013),op=id(1021);
const value=async(sql,args=[])=>Object.values((await db.query(sql,args)).rows[0])[0];
for(const [uid,sid,name,role] of [[admin,as,'recovery-admin','admin'],[user,us,'00012','student'],[other,os,'recovery-other','teacher']]){
 await db.query('insert into auth.users values($1)',[uid]);await db.query('insert into auth.sessions(id,user_id) values($1,$2)',[sid,uid]);await db.query('insert into public.profiles(id,username,full_name) values($1,$2,$2)',[uid,name]);await db.query('insert into public.user_roles(user_id,role_code) values($1,$2)',[uid,role]);await db.query('insert into sim_murid_private.auth_accounts(user_id,must_change_password,profile_completed_at) values($1,false,now())',[uid]);await db.query("insert into sim_murid_private.security_questions(user_id,question_code,answer_hash) values($1,'q1',repeat('0',64))",[uid]);await db.query('select public.app_auth_claim($1,$2,false)',[uid,sid]);
}
const request=async(type='password',uid=user)=>{await db.query('select public.app_recovery_request($1,$2,true)',[uid,type]);return value("select id from sim_murid_private.recovery_requests where user_id=$1 and request_type=$2 and status in ('pending','verified') order by requested_at desc limit 1",[uid,type]);};
const begin=(rid,operation=op,reject=false)=>value('select public.app_recovery_begin($1,$2,$3,$4,$5,$6)',[admin,as,rid,operation,'BA-2026-UNIT-01',reject]);
test('REC01: rate limiter persists, exact lookup and pending request deduplication',async()=>{
 for(let n=0;n<5;n++)assert.equal(await value('select public.app_recovery_probe($1)',['a'.repeat(64)]),true);
 assert.equal(await value('select public.app_recovery_probe($1)',['a'.repeat(64)]),false);assert.equal(await value("select public.app_recovery_probe('bad')"),false);
 assert.equal((await value("select public.app_recovery_identity('00012')")).id,user);assert.equal(await value("select public.app_recovery_identity('12')"),null);
 const r=await request();assert.equal(await request(),r);assert.equal(await value('select count(*)::int from sim_murid_private.recovery_requests'),1);
 assert.equal((await value('select public.app_auth_principal($1,$2)',[user,us])).id,user);
});
test('REC02: non-admin, self target, invalid evidence and stale role denied',async()=>{
 const r=await request();assert.equal(await value('select public.app_recovery_list($1,$2)',[user,us]),null);
 assert.equal(await value('select public.app_recovery_begin($1,$2,$3,$4,$5,false)',[other,os,r,op,'BA-UNIT-00001']),null);
 const own=await request('password',admin);assert.equal(await begin(own),null);
 assert.equal(await value('select public.app_recovery_begin($1,$2,$3,$4,$5,false)',[admin,as,r,op,'bad']),null);
 await db.query("update public.user_roles set role_code='teacher' where user_id=$1",[admin]);assert.equal(await begin(r),null);await db.query("update public.user_roles set role_code='admin' where user_id=$1",[admin]);
});
test('REC03: session recovery revokes target only and cannot replay',async()=>{
 const r=await request('session');assert.equal((await begin(r)).request_type,'session');assert.equal(await value('select public.app_auth_principal($1,$2)',[user,us]),null);
 assert.ok(await value('select public.app_auth_principal($1,$2)',[admin,as]));assert.equal(await begin(r),null);assert.equal(await value('select status from sim_murid_private.recovery_requests where id=$1',[r]),'completed');
});
test('REC04: password recovery stays closed until nonce finish; always forces password change',async()=>{
 const r=await request();assert.equal((await begin(r)).request_type,'password');assert.equal(await begin(r,id(1022)),null);
 assert.equal(await value('select public.app_recovery_finish($1,$2,$3,$4)',[admin,as,r,id(1023)]),false);
 assert.equal(await value('select public.app_recovery_finish($1,$2,$3,$4)',[admin,as,r,op]),true);
 assert.equal(await value('select public.app_recovery_finish($1,$2,$3,$4)',[admin,as,r,op]),false);
 const a=(await db.query('select must_change_password,password_change_id from sim_murid_private.auth_accounts where user_id=$1',[user])).rows[0];assert.equal(a.must_change_password,true);assert.equal(a.password_change_id,null);
});
test('REC05: expiration and rejection do not reset password or revoke innocent sessions',async()=>{
 const r=await request('session',other);assert.equal((await begin(r,id(1030),true)).rejected,true);assert.ok(await value('select public.app_auth_principal($1,$2)',[other,os]));
 const old=await request('password',other);await db.query("update sim_murid_private.recovery_requests set requested_at=now()-interval '25 hours' where id=$1",[old]);assert.equal(await begin(old),null);assert.equal(await value('select status from sim_murid_private.recovery_requests where id=$1',[old]),'expired');
 assert.notEqual(await request('password',other),old);
});
test('REC06: queue excludes hashes/answers and nonprivileged clients cannot call RPCs',async()=>{
 const list=await value('select public.app_recovery_list($1,$2)',[admin,as]);assert.ok(Array.isArray(list));assert.ok(!JSON.stringify(list).includes('answer_hash'));assert.ok(!JSON.stringify(list).includes('operation_id'));
 for(const role of ['anon','authenticated']){await db.exec('set role '+role);for(const sql of ["select public.app_recovery_identity('00012')",'select public.app_recovery_list($1,$2)'])await assert.rejects(db.query(sql,sql.includes('$1')?[admin,as]:[]),e=>e.code==='42501');await db.exec('reset role');}
});
test('REC07: profile repair allowed at teacher email gate; contact change invalidates proof/OTP',async()=>{
 const p=await value('select public.app_profile_read($1,$2)',[other,os]);assert.equal(p.username,'recovery-other');
 await db.query("update public.profiles set contact_email='old@example.org' where id=$1",[other]);await db.query('insert into public.user_access_flags(user_id,teacher_email_verified_at) values($1,now())',[other]);await db.query("update sim_murid_private.auth_accounts set verified_contact_email='old@example.org' where user_id=$1",[other]);
 await db.query("insert into sim_murid_private.email_verifications(user_id,email_target,otp_hash,expires_at) values($1,'old@example.org',repeat('1',64),now()+interval '10 minutes')",[other]);
 const current=await value('select public.app_profile_read($1,$2)',[other,os]);
 assert.equal(await value('select public.app_profile_update($1,$2,$3,$4,$5,$6,$7)',[other,os,current.updated_at,'Updated Name','0812','new@example.org','New bio']),true);
 assert.equal(await value('select verified_contact_email from sim_murid_private.auth_accounts where user_id=$1',[other]),null);assert.equal(await value('select teacher_email_verified_at from public.user_access_flags where user_id=$1',[other]),null);assert.equal(await value('select status from sim_murid_private.email_verifications where user_id=$1',[other]),'superseded');
 assert.equal((await value('select public.app_security_state($1,$2)',[other,os])).gate,'email_pending');
 assert.equal(await value('select public.app_profile_update($1,$2,$3,$4,$5,$6,$7)',[other,os,current.updated_at,'Stale edit','0812','new@example.org','Bio']),false);
});
test('REC08: basic profile cannot complete mandatory student profile or bypass password gate',async()=>{
 assert.equal(await value('select public.app_profile_read($1,$2)',[user,us]),null);
 const sid=id(1050);await db.query('insert into auth.sessions(id,user_id) values($1,$2)',[sid,user]);await db.query('select public.app_auth_claim($1,$2,false)',[user,sid]);assert.equal((await value('select public.app_security_state($1,$2)',[user,sid])).gate,'password');assert.equal(await value('select public.app_profile_read($1,$2)',[user,sid]),null);
});

test('PROF01: name/bio-only changes retain verified email and pending OTP when contact is unchanged',async()=>{
 const current=await value('select public.app_profile_read($1,$2)',[other,os]);
 await db.query('update public.user_access_flags set teacher_email_verified_at=now() where user_id=$1',[other]);
 await db.query('update sim_murid_private.auth_accounts set verified_contact_email=$2 where user_id=$1',[other,current.contact_email]);
 await db.query("insert into sim_murid_private.email_verifications(user_id,email_target,otp_hash,expires_at) values($1,$2,repeat('2',64),now()+interval '10 minutes')",[other,current.contact_email]);
 const verified=await value('select teacher_email_verified_at from public.user_access_flags where user_id=$1',[other]);
 assert.equal(await value('select public.app_profile_update($1,$2,$3,$4,$5,$6,$7)',[other,os,current.updated_at,'Only name changes','+62 812',current.contact_email,'Bio\nTwo lines']),true);
 assert.deepEqual(await value('select teacher_email_verified_at from public.user_access_flags where user_id=$1',[other]),verified);
 assert.equal(await value('select verified_contact_email from sim_murid_private.auth_accounts where user_id=$1',[other]),current.contact_email);
 assert.equal(await value("select count(*)::int from sim_murid_private.email_verifications where user_id=$1 and status='pending'",[other]),1);
});

test('PROF02: private profile RPCs reject public roles and mismatched/revoked sessions',async()=>{
 for(const role of ['anon','authenticated']){await db.exec('set role '+role);await assert.rejects(db.query('select public.app_profile_read($1,$2)',[other,os]),e=>e.code==='42501');await assert.rejects(db.query('select public.app_profile_update($1,$2,now(),$3,$4,$5,$6)',[other,os,'Name','','','']),e=>e.code==='42501');await db.exec('reset role');}
 assert.equal(await value('select public.app_profile_read($1,$2)',[other,as]),null);
 await db.query('select public.app_auth_revoke($1,$2)',[other,os]);
 assert.equal(await value('select public.app_profile_read($1,$2)',[other,os]),null);
 assert.equal(await value('select public.app_profile_update($1,$2,now(),$3,$4,$5,$6)',[other,os,'Name','','','']),false);
});
