import assert from 'node:assert/strict';import {after,test} from 'node:test';import {createIsolatedDatabase} from '../../scripts/database/harness.mjs';
const {db}=await createIsolatedDatabase();after(()=>db.close());const id=n=>`00000000-0000-4000-8000-${String(n).padStart(12,'0')}`;const user=id(1201),session=id(1202);const hash='hmac$v1$'+'a'.repeat(64);const val=async(sql,args=[])=>Object.values((await db.query(sql,args)).rows[0])[0];let seq=1300;
await db.query('insert into auth.users values($1)',[user]);await db.query('insert into auth.sessions(id,user_id) values($1,$2)',[session,user]);await db.query("insert into public.profiles(id,username,full_name,contact_email) values($1,'otp-teacher','Teacher','owner@example.org')",[user]);await db.query("insert into public.user_roles(user_id,role_code) values($1,'teacher')",[user]);await db.query('insert into sim_murid_private.auth_accounts(user_id,must_change_password) values($1,false)',[user]);await db.query("insert into sim_murid_private.security_questions(user_id,question_code,answer_hash) values($1,'q1',repeat('0',64))",[user]);await db.query('select public.app_auth_claim($1,$2,false)',[user,session]);
const reserve=(purpose='verify',email='owner@example.org',cid=id(seq++))=>val('select public.app_email_reserve($1,$2,$3,$4,$5,$6)',[user,purpose==='verify'?session:null,purpose,cid,hash,email]);
const delivered=cid=>val("select public.app_email_delivery($1,$2,true,'provider-unit-id')",[user,cid]);
const consume=(cid,digest=hash,op=null)=>val('select public.app_email_consume($1,$2,$3,$4,$5)',[user,session,cid,digest,op]);
const age=async()=>db.query("update sim_murid_private.email_verifications set created_at=created_at-interval '61 seconds',expires_at=expires_at-interval '61 seconds' where user_id=$1",[user]);
let first;
test('OTP01: teacher gate precedes verification, rejects recovery/untrusted address and enforces cooldown',async()=>{
 assert.equal((await val('select public.app_security_state($1,$2)',[user,session])).gate,'email_pending');assert.equal(await val("select public.app_email_recovery_identity('otp-teacher')"),null);
 assert.equal((await reserve('recovery')).code,'not_allowed');assert.equal((await reserve('verify','changed@example.org')).code,'address_changed');
 first=await reserve();assert.equal(first.code,'reserved');assert.equal((await reserve()).code,'cooldown');assert.equal(await consume(first.id),false);
});
test('OTP02: provider failure cannot activate code; resend supersedes previous code',async()=>{
 assert.equal(await val('select public.app_email_delivery($1,$2,false,null)',[user,first.id]),false);assert.equal(await consume(first.id),false);
 await age();first=await reserve();assert.equal(await delivered(first.id),true);await age();const newer=await reserve();assert.equal(await consume(first.id),false);assert.equal(await delivered(newer.id),true);first=newer;
});
test('OTP03: fifth wrong attempt locks; correct code cannot bypass lock',async()=>{
 for(let i=0;i<5;i++)assert.equal(await consume(first.id,'hmac$v1$'+'b'.repeat(64)),false);
 assert.equal(await val('select attempts_used from sim_murid_private.email_verifications where id=$1',[first.id]),5);assert.equal(await val('select status from sim_murid_private.email_verifications where id=$1',[first.id]),'locked');assert.equal(await consume(first.id),false);
});
test('OTP04: correct accepted code releases gate exactly once and enables verified-contact recovery',async()=>{
 await age();first=await reserve();assert.equal(await delivered(first.id),true);assert.equal(await consume(first.id),true);assert.equal(await consume(first.id),false);
 assert.equal((await val('select public.app_security_state($1,$2)',[user,session])).gate,'ready');assert.equal((await val("select public.app_email_recovery_identity('otp-teacher')")).email,'owner@example.org');
});
test('OTP05: recovery code is consumed before Auth mutation; registry revoked and nonce finalizes once',async()=>{
 await age();first=await reserve('recovery');assert.equal(await delivered(first.id),true);const op=id(1401);assert.equal(await consume(first.id,hash,op),true);assert.equal(await val('select public.app_auth_principal($1,$2)',[user,session]),null);
 assert.equal(await consume(first.id,hash,id(1402)),false);assert.equal(await val('select public.app_password_finish($1,$2)',[user,op]),true);assert.equal(await val('select public.app_password_finish($1,$2)',[user,op]),false);
});
test('OTP06: five sends per WIB day shared across purposes; expired/resends never reset quota',async()=>{
 await age();assert.equal((await reserve('recovery')).code,'daily_limit');
 const s=await db.query('select count(*)::int n from sim_murid_private.email_verifications where user_id=$1',[user]);assert.equal(s.rows[0].n,5);
});
test('OTP07: expired, changed email, and technical Auth email never count as contact proof',async()=>{
 await db.query("update sim_murid_private.email_verifications set created_at=created_at-interval '2 days',expires_at=expires_at-interval '2 days' where user_id=$1",[user]);
 first=await reserve('recovery');assert.equal(await delivered(first.id),true);await db.query("update sim_murid_private.email_verifications set created_at=now()-interval '11 minutes',expires_at=now()-interval '1 minute' where id=$1",[first.id]);assert.equal(await consume(first.id,hash,id(1403)),false);
 await db.query("update public.profiles set contact_email='different@example.org' where id=$1",[user]);assert.equal(await val("select public.app_email_recovery_identity('otp-teacher')"),null);assert.equal((await reserve('recovery','different@example.org')).code,'not_allowed');
});
test('OTP08: RPCs and hashes remain inaccessible to public clients',async()=>{
 for(const role of ['anon','authenticated']){await db.exec('set role '+role);await assert.rejects(db.query('select public.app_email_context($1)',[first.id]),e=>e.code==='42501');await assert.rejects(db.query('select otp_hash from sim_murid_private.email_verifications'),e=>e.code==='42501');await db.exec('reset role');}
 const state=await val('select public.app_email_state($1,$2)',[user,session]);assert.equal(state,null); // Old session was revoked, despite the signed Auth session still existing.
});
test('OTP09: changing password invalidates every outstanding email recovery code',async()=>{
 await db.query("update public.profiles set contact_email='owner@example.org' where id=$1",[user]);const sid=id(1450),op=id(1451);await db.query('insert into auth.sessions(id,user_id) values($1,$2)',[sid,user]);await db.query('select public.app_auth_claim($1,$2,false)',[user,sid]);
 const pending=await reserve('recovery');assert.equal(pending.code,'reserved');assert.equal(await delivered(pending.id),true);
 assert.equal(await val('select public.app_password_begin($1,$2,$3)',[user,sid,op]),true);assert.equal(await val('select public.app_password_finish($1,$2)',[user,op]),true);assert.equal(await consume(pending.id,hash,id(1452)),false);assert.equal(await val('select status from sim_murid_private.email_verifications where id=$1',[pending.id]),'superseded');
});
test('OTP10: application rolling budget caps provider usage across users',async()=>{
 const other=id(1501),sid=id(1502);await db.query('insert into auth.users values($1)',[other]);await db.query('insert into auth.sessions(id,user_id) values($1,$2)',[sid,other]);await db.query("insert into public.profiles(id,username,full_name,contact_email) values($1,'other-otp','Other','other@example.org')",[other]);await db.query("insert into public.user_roles(user_id,role_code) values($1,'teacher')",[other]);await db.query('insert into sim_murid_private.auth_accounts(user_id,must_change_password) values($1,false)',[other]);await db.query("insert into sim_murid_private.security_questions(user_id,question_code,answer_hash) values($1,'q1',repeat('0',64))",[other]);await db.query('select public.app_auth_claim($1,$2,false)',[other,sid]);
 await db.query("insert into sim_murid_private.email_verifications(user_id,email_target,otp_hash,created_at,expires_at,status) select $1,'owner@example.org',repeat('0',64),now()-interval '15 minutes',now()-interval '5 minutes','expired' from generate_series(1,250)",[user]);
 const r=await val('select public.app_email_reserve($1,$2,$3,$4,$5,$6)',[other,sid,'verify',id(1503),hash,'other@example.org']);assert.equal(r.code,'global_limit');
});

test('OTP onboarding: password completion permits contact verification before question, without granting readiness',async()=>{
 const u=id(1901),sid=id(1902),newSid=id(1903),operation=id(1904),challenge=id(1905);
 await db.query('insert into auth.users values($1)',[u]);await db.query('insert into auth.sessions(id,user_id) values($1,$2)',[sid,u]);
 await db.query("insert into public.profiles(id,username,full_name) values($1,'first-login-teacher','New Teacher')",[u]);await db.query("insert into public.user_roles(user_id,role_code) values($1,'teacher')",[u]);await db.query('insert into sim_murid_private.auth_accounts(user_id,must_change_password) values($1,true)',[u]);await db.query('select public.app_auth_claim($1,$2,false)',[u,sid]);
 assert.equal(await val('select public.app_email_state($1,$2)',[u,sid]),null);
 assert.equal(await val('select public.app_email_address($1,$2,$3,$4)',[u,sid,'','new@example.org']),false);
 assert.equal(await val('select public.app_password_begin($1,$2,$3)',[u,sid,operation]),true);assert.equal(await val('select public.app_password_finish($1,$2)',[u,operation]),true);
 await db.query('insert into auth.sessions(id,user_id) values($1,$2)',[newSid,u]);await db.query('select public.app_auth_claim($1,$2,false)',[u,newSid]);
 assert.equal((await val('select public.app_security_state($1,$2)',[u,newSid])).gate,'security_question');
 assert.equal((await val('select public.app_email_state($1,$2)',[u,newSid])).email,'');
 assert.equal(await val('select public.app_email_address($1,$2,$3,$4)',[u,newSid,'','new@example.org']),true);
 assert.equal(await val('select public.app_email_address($1,$2,$3,$4)',[u,newSid,'','stale@example.org']),false);
 assert.equal(await val('select public.app_email_address($1,$2,$3,$4)',[u,sid,'new@example.org','stale-session@example.org']),false);
 // Earlier quota tests fill the global budget; clear only this isolated test database's synthetic history.
 await db.query('delete from sim_murid_private.email_verifications');
 const reserved=await val("select public.app_email_reserve($1,$2,'verify',$3,$4,$5)",[u,newSid,challenge,hash,'new@example.org']);assert.equal(reserved.code,'reserved');
 assert.equal(await val('select public.app_email_delivery($1,$2,true,$3)',[u,challenge,'synthetic-onboarding']),true);
 assert.equal(await val('select public.app_email_consume($1,$2,$3,$4,null)',[u,newSid,challenge,hash]),true);
 assert.equal((await val('select public.app_email_state($1,$2)',[u,newSid])).verified,true);
 assert.equal((await val('select public.app_security_state($1,$2)',[u,newSid])).gate,'security_question');
 assert.equal(await val('select public.app_onboarding_ready($1,$2)',[u,newSid]),false);
 for(const role of ['anon','authenticated']){await db.exec('set role '+role);await assert.rejects(db.query('select public.app_email_address($1,$2,$3,$4)',[u,newSid,'new@example.org','bad@example.org']),e=>e.code==='42501');await db.exec('reset role');}
});
