import assert from 'node:assert/strict';
import {after,test} from 'node:test';
import {createIsolatedDatabase} from '../../scripts/database/harness.mjs';
const {db}=await createIsolatedDatabase();after(()=>db.close());
const id=n=>`00000000-0000-4000-8000-${String(n).padStart(12,'0')}`;
const u=id(901),session=id(902),op=id(903),next=id(904);const hash='scrypt$v1$16384$8$1$'+'a'.repeat(32)+'$'+'b'.repeat(64);
const val=async(sql,args=[])=>Object.values((await db.query(sql,args)).rows[0])[0];
await db.query('insert into auth.users values($1)',[u]);await db.query('insert into auth.sessions(id,user_id) values($1,$2),($3,$2)',[session,u,next]);await db.query("insert into public.profiles(id,username,full_name) values($1,'security901','Security Test')",[u]);await db.query("insert into public.user_roles(user_id,role_code) values($1,'admin')",[u]);await db.query('select public.app_auth_claim($1,$2,false)',[u,session]);
const state=()=>val('select public.app_security_state($1,$2)',[u,session]);
test('SEC01: default gate is password; setup cannot be skipped or leak answer hash',async()=>{
 assert.equal((await state()).gate,'password');assert.equal(await val('select public.app_onboarding_ready($1,$2)',[u,session]),false);
 assert.equal(await val('select public.app_security_question_save($1,$2,$3,$4)',[u,session,'q1',hash]),false);
 await db.query("select set_config('request.jwt.claims',$1,false)",[JSON.stringify({sub:u,session_id:session})]);await db.exec('set role authenticated');assert.equal(await val('select count(*)::int from public.profiles'),0);await db.exec('reset role');
 assert.equal(await val('select public.app_session_list($1,$2)',[u,session]),null);
});
test('SEC02: begin revokes registry; only private operation can finalize; stale finish denied',async()=>{
 assert.equal(await val('select public.app_password_begin($1,$2,$3)',[u,session,op]),true);
 assert.equal(await val('select public.app_auth_principal($1,$2)',[u,session]),null);
 assert.equal(await val('select public.app_password_finish($1,$2)',[u,id(999)]),false);
 assert.equal(await val('select public.app_password_finish($1,$2)',[u,op]),true);
 assert.equal(await val('select public.app_password_finish($1,$2)',[u,op]),false);
 assert.equal(await val('select public.app_auth_claim($1,$2,false)',[u,next]),true);
 assert.equal((await val('select public.app_security_state($1,$2)',[u,next])).gate,'security_question');
 assert.equal(await val('select public.app_security_question_save($1,$2,$3,$4)',[u,next,'q99',hash]),false);
 assert.equal(await val('select public.app_security_question_save($1,$2,$3,$4)',[u,next,'q1','plaintext']),false);
 assert.equal(await val('select public.app_security_question_save($1,$2,$3,$4)',[u,next,'q1',hash]),true);
 const result=await val('select public.app_security_state($1,$2)',[u,next]);assert.equal(result.gate,'ready');assert.ok(!JSON.stringify(result).includes(hash));
});
test('SEC03: profile gate precedes question; teacher contact proof precedes ready',async()=>{
 await db.query("update public.user_roles set role_code='student' where user_id=$1",[u]);assert.equal((await val('select public.app_security_state($1,$2)',[u,next])).gate,'profile_pending');
 await db.query('update sim_murid_private.auth_accounts set profile_completed_at=now() where user_id=$1',[u]);assert.equal((await val('select public.app_security_state($1,$2)',[u,next])).gate,'ready');
 await db.query("update public.user_roles set role_code='teacher' where user_id=$1",[u]);assert.equal((await val('select public.app_security_state($1,$2)',[u,next])).gate,'email_pending');
 await db.query("update public.profiles set contact_email='proven@example.org' where id=$1",[u]);await db.query('insert into public.user_access_flags(user_id,teacher_email_verified_at) values($1,now())',[u]);assert.equal((await val('select public.app_security_state($1,$2)',[u,next])).gate,'email_pending');
 await db.query("update sim_murid_private.auth_accounts set verified_contact_email='proven@example.org' where user_id=$1",[u]);assert.equal((await val('select public.app_security_state($1,$2)',[u,next])).gate,'ready');
 await db.query("update public.profiles set contact_email='changed@example.org' where id=$1",[u]);assert.equal((await val('select public.app_security_state($1,$2)',[u,next])).gate,'email_pending');
});
test('SEC04: rate limit is persistent; all security mutations remain service-only',async()=>{
 for(let i=0;i<5;i++)assert.equal(await val('select public.app_security_rate($1,$2)',[u,next]),true);
 assert.equal(await val('select public.app_security_rate($1,$2)',[u,next]),false);
 for(const role of ['anon','authenticated']){await db.exec('set role '+role);await assert.rejects(db.query('select public.app_password_finish($1,$2)',[u,op]),e=>e.code==='42501');await assert.rejects(db.query('select * from sim_murid_private.security_questions'),e=>e.code==='42501');await db.exec('reset role');}
 assert.equal(await val("select count(*)::int from sim_murid_private.activity_logs where actor_id=$1 and action in ('auth.password_changed','auth.security_question_changed')",[u]),2);
});
