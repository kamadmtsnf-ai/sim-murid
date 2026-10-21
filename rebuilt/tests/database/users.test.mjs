import {test,after} from 'node:test';
import assert from 'node:assert/strict';
import {randomUUID as uuid} from 'node:crypto';
import {createIsolatedDatabase} from '../../scripts/database/harness.mjs';
const {db}=await createIsolatedDatabase();after(()=>db.close());
const val=async(q,p=[])=>Object.values((await db.query(q,p)).rows[0])[0];
async function actor(name,role){const id=uuid(),session=uuid();await db.query('insert into auth.users values($1)',[id]);await db.query('insert into auth.sessions(id,user_id) values($1,$2)',[session,id]);await db.query('insert into public.profiles(id,username,full_name) values($1,$2,$2)',[id,name]);await db.query('insert into public.user_roles(user_id,role_code) values($1,$2)',[id,role]);await db.query('insert into sim_murid_private.auth_accounts(user_id,must_change_password,profile_completed_at) values($1,false,now())',[id]);await db.query("insert into sim_murid_private.security_questions(user_id,question_code,answer_hash) values($1,'q1',repeat('0',64))",[id]);await db.query('select public.app_auth_claim($1,$2,false)',[id,session]);return {id,session};}
const admin=await actor('admin','admin'),other=await actor('other','admin'),student=await actor('student','student');
const cmd={username:'0012',fullName:'New student',role:'student',contactEmail:''},hash='a'.repeat(64);
const begin=(id,command=cmd,a=admin,fingerprint=hash)=>val('select public.app_user_provision_begin($1,$2,$3,$4::jsonb,$5)',[a.id,a.session,id,JSON.stringify(command),fingerprint]);
const finish=(id,a=admin,fingerprint=hash)=>val('select public.app_user_provision_finish($1,$2,$3,$4)',[a.id,a.session,id,fingerprint]);
test('service-only RPC and private table deny browser roles',async()=>{
 for(const role of ['anon','authenticated']){
  assert.equal(await val("select has_function_privilege($1,'public.app_user_provision_begin(uuid,uuid,uuid,jsonb,text)','execute')",[role]),false);
  assert.equal(await val("select has_function_privilege($1,'public.app_user_provision_finish(uuid,uuid,uuid,text)','execute')",[role]),false);
  assert.equal(await val("select has_table_privilege($1,'sim_murid_private.user_provisions','select')",[role]),false);
 }
});
test('admin only; exact username reservation, retry identity and atomic mandatory onboarding',async()=>{
 const id=uuid();assert.equal((await begin(id,cmd,student)).code,'denied');assert.equal((await begin(id,cmd,{...admin,session:uuid()})).code,'denied');
 assert.equal((await begin(id)).code,'pending');assert.equal((await begin(id)).code,'pending');assert.equal((await begin(id,cmd,other)).code,'request_conflict');assert.equal((await begin(id,cmd,admin,'b'.repeat(64))).code,'request_conflict');assert.equal((await begin(uuid())).code,'duplicate');assert.equal((await finish(id)).code,'pending');
 await db.query('insert into auth.users values($1)',[id]);assert.equal((await finish(id,other)).code,'request_conflict');assert.equal((await finish(id)).code,'created');assert.equal((await finish(id)).code,'created');assert.equal((await begin(id)).code,'created');
 assert.equal(await val('select username from public.profiles where id=$1',[id]),'0012');assert.equal(await val('select must_change_password from sim_murid_private.auth_accounts where user_id=$1',[id]),true);assert.equal(await val('select profile_completed_at from sim_murid_private.auth_accounts where user_id=$1',[id]),null);assert.equal(await val('select count(*)::int from public.user_roles where user_id=$1',[id]),1);assert.equal(await val("select count(*)::int from sim_murid_private.activity_logs where request_id=$1 and action='user.created'",[id]),1);
 assert.equal((await begin(uuid(),{...cmd,username:'12'})).code,'pending');
});
test('existing Auth identities cannot be reserved; finish rechecks admin and transactions roll back conflict',async()=>{
 assert.equal((await begin(student.id,{...cmd,username:'other-name'})).code,'request_conflict');
 const id=uuid();assert.equal((await begin(id,{...cmd,username:'reserved'})).code,'pending');await db.query('insert into auth.users values($1)',[id]);
 await db.query("update public.user_roles set role_code='customer' where user_id=$1",[admin.id]);assert.equal((await finish(id)).code,'denied');await db.query("update public.user_roles set role_code='admin' where user_id=$1",[admin.id]);
 const external=uuid();await db.query('insert into auth.users values($1)',[external]);await db.query("insert into public.profiles(id,username,full_name) values($1,'reserved','CLI race')",[external]);assert.equal((await finish(id)).code,'duplicate');assert.equal(await val('select count(*)::int from public.profiles where id=$1',[id]),0);assert.equal(await val('select completed_at from sim_murid_private.user_provisions where id=$1',[id]),null);
});
test('reservations rate-limit each admin and invalid commands never reserve usernames',async()=>{
 for(const command of [{...cmd,username:' x'},{...cmd,role:'service_role'},{...cmd,extra:true},{...cmd,fullName:''}])assert.equal((await begin(uuid(),command)).code,'invalid');
 for(let i=0;i<20;i++)assert.equal((await begin(uuid(),{...cmd,username:'rate-'+i},other)).code,'pending');
 assert.equal((await begin(uuid(),{...cmd,username:'over-limit'},other)).code,'rate_limited');
 assert.equal(await val("select count(*)::int from sim_murid_private.user_provisions where username='over-limit'"),0);
});
