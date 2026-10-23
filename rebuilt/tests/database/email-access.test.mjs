import assert from 'node:assert/strict';
import {test,after} from 'node:test';
import {randomUUID} from 'node:crypto';
import {createIsolatedDatabase} from '../../scripts/database/harness.mjs';
const {db}=await createIsolatedDatabase();after(()=>db.close());
const val=async(sql,args=[])=>Object.values((await db.query(sql,args)).rows[0])[0];
const hash='hmac$v1$'+'a'.repeat(64),wrong='hmac$v1$'+'b'.repeat(64),actors={};
for(const role of ['admin','teacher','parent','customer','student','applicant','alumni']){
 const user=randomUUID(),session=randomUUID();actors[role]={user,session,email:role+'@example.org'};
 await db.query('insert into auth.users values($1)',[user]);await db.query('insert into auth.sessions(id,user_id) values($1,$2)',[session,user]);
 await db.query('insert into public.profiles(id,username,full_name,contact_email) values($1,$2,$2,$3)',[user,'email-access-'+role,role+'@example.org']);
 await db.query('insert into public.user_roles(user_id,role_code) values($1,$2)',[user,role]);
 await db.query('insert into sim_murid_private.auth_accounts(user_id,must_change_password,profile_completed_at) values($1,false,now())',[user]);
 await db.query("insert into sim_murid_private.security_questions(user_id,question_code,answer_hash) values($1,'q1',repeat('0',64))",[user]);
 await db.query('select public.app_auth_claim($1,$2,false)',[user,session]);
}
const state=a=>val('select public.app_email_state($1,$2)',[a.user,a.session]);
const gate=a=>val("select public.app_security_state($1,$2)->>'gate'",[a.user,a.session]);
const reserve=(a,email=a.email)=>val('select public.app_email_reserve($1,$2,$3,$4,$5,$6)',[a.user,a.session,'verify',randomUUID(),hash,email]);
const consume=(a,id,h=hash)=>val('select public.app_email_consume($1,$2,$3,$4)',[a.user,a.session,id,h]);
test('all ready roles can read own email status, reserve and verify; ready alone is not proof',async()=>{
 for(const [role,a] of Object.entries(actors)){
  assert.equal(await gate(a),role==='teacher'?'email_pending':'ready');
  assert.equal((await state(a)).verified,false,role+' cannot be auto-verified from ready gate');
  const r=await reserve(a);assert.equal(r.code,'reserved',role);
  assert.equal(await consume(a,r.id),false,'queued email cannot be consumed');
  assert.equal(await val("select public.app_email_delivery($1,$2,true,'synthetic-provider')",[a.user,r.id]),true);
  assert.equal(await consume(a,r.id),true,role);assert.equal(await consume(a,r.id),false,'one use');
  assert.equal((await state(a)).verified,true);assert.equal(await gate(a),'ready');
 }
});
test('contact changes remove proof for all roles; only teacher is forced through email gate',async()=>{
 for(const [role,a] of Object.entries(actors)){
  const profile=await val('select public.app_profile_read($1,$2)',[a.user,a.session]);
  const email=role+'-changed@example.org';
  assert.equal(await val('select public.app_profile_update($1,$2,$3,$4,$5,$6,$7)',[a.user,a.session,profile.updated_at,'Name','',''+email,'']),true);
  a.email=email;assert.equal((await state(a)).verified,false);assert.equal(await gate(a),role==='teacher'?'email_pending':'ready');
 }
});
test('password, biodata and security question gates still reject all OTP operations',async()=>{
 for(const role of ['admin','teacher','student']){
  const a=actors[role];await db.query('update sim_murid_private.auth_accounts set must_change_password=true where user_id=$1',[a.user]);
  assert.equal(await state(a),null);assert.equal((await reserve(a)).code,'not_allowed');
  await db.query('update sim_murid_private.auth_accounts set must_change_password=false where user_id=$1',[a.user]);
 }
 const s=actors.student;await db.query('update sim_murid_private.auth_accounts set profile_completed_at=null where user_id=$1',[s.user]);assert.equal(await state(s),null);assert.equal((await reserve(s)).code,'not_allowed');
 const a=actors.admin;await db.query('delete from sim_murid_private.security_questions where user_id=$1',[a.user]);assert.equal(await state(a),null);assert.equal((await reserve(a)).code,'not_allowed');
});
test('cooldown, wrong attempts and cross-user ownership remain enforced for non-teacher',async()=>{
 const a=actors.parent;await db.query("update sim_murid_private.email_verifications set created_at=created_at-interval '61 seconds',expires_at=expires_at-interval '61 seconds' where user_id=$1",[a.user]);
 const r=await reserve(a);assert.equal(r.code,'reserved');assert.equal((await reserve(a)).code,'cooldown');
 await val("select public.app_email_delivery($1,$2,true,'synthetic-provider')",[a.user,r.id]);
 assert.equal(await consume(actors.customer,r.id),false);
 for(let i=0;i<5;i++)assert.equal(await consume(a,r.id,wrong),false);
 assert.equal(await consume(a,r.id),false);assert.equal((await state(a)).challenge.attempts_remaining,0);
});
test('revoked/wrong sessions and public clients cannot access verification RPCs',async()=>{
 const a=actors.alumni;assert.equal(await val('select public.app_email_state($1,$2)',[a.user,actors.parent.session]),null);
 await db.query('select public.app_auth_revoke($1,$2)',[a.user,a.session]);assert.equal(await state(a),null);assert.equal((await reserve(a)).code,'not_allowed');
 for(const role of ['anon','authenticated']){await db.exec('set role '+role);await assert.rejects(db.query('select public.app_email_state($1,$2)',[a.user,a.session]),e=>e.code==='42501');await db.exec('reset role');}
});
