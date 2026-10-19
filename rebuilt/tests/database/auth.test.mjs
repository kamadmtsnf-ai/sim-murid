import assert from 'node:assert/strict';
import {after,test} from 'node:test';
import {createIsolatedDatabase} from '../../scripts/database/harness.mjs';
const {db}=await createIsolatedDatabase();after(()=>db.close());
const user='00000000-0000-4000-8000-000000000081',s1='00000000-0000-4000-8000-000000000082',s2='00000000-0000-4000-8000-000000000083';
const val=async(sql,args=[])=>Object.values((await db.query(sql,args)).rows[0])[0];
test('AUTH DB: service-only rate limiter has fixed window and counts denied requests',async()=>{
 await db.exec('set role service_role');
 for(let i=0;i<30;i++)assert.equal(await val('select public.app_auth_attempt($1)', ['a'.repeat(64)]),true);
 assert.equal(await val('select public.app_auth_attempt($1)', ['a'.repeat(64)]),false);
 await db.query("update sim_murid_private.auth_attempts set window_started_at=now()-interval '16 minutes'");
 assert.equal(await val('select public.app_auth_attempt($1)', ['a'.repeat(64)]),true);
 await db.exec('reset role');
});
test('AUTH DB: claim rejects active slot, checks exact session, expires/revokes and audits',async()=>{
 await db.query('insert into auth.users values($1)',[user]);
 await db.query("insert into public.profiles(id,username,full_name) values($1,'00081','Auth Test')",[user]);
 await db.query('insert into auth.sessions(id,user_id) values($1,$3),($2,$3)',[s1,s2,user]);
 await db.exec('set role service_role');
 assert.equal(await val('select public.app_auth_claim($1,$2,false)',[user,s1]),true);
 assert.equal(await val('select public.app_auth_claim($1,$2,true)',[user,s2]),false);
 assert.equal(await val('select public.app_auth_principal($1,$2)',[user,s2]),null);
 let p=await val('select public.app_auth_principal($1,$2)',[user,s1]);assert.equal(p.username,'00081');assert.equal(p.must_change_password,true);
 await db.query('select public.app_auth_revoke($1,$2)',[user,s1]);
 assert.equal(await val('select public.app_auth_principal($1,$2)',[user,s1]),null);
 assert.equal(await val('select public.app_auth_claim($1,$2,true)',[user,s2]),true);
 assert.equal(await val("select extract(epoch from expires_at-issued_at)::int from sim_murid_private.app_sessions where auth_session_id=$1",[s2]),168*3600);
 await db.query("update public.profiles set status='inactive' where id=$1",[user]);
 assert.equal(await val('select public.app_auth_principal($1,$2)',[user,s2]),null);
 await db.query('select public.app_auth_revoke($1,$2)',[user,s2]);
 assert.equal(await val('select public.app_auth_claim($1,$2,false)',[user,s1]),false);
 assert.equal(await val("select count(*)::int from sim_murid_private.activity_logs where actor_id=$1",[user]),4);
 await db.exec('reset role');
});
test('AUTH DB: anon/authenticated cannot call privileged RPC or read private auth state',async()=>{
 for(const role of ['anon','authenticated']){
  await db.exec('set role '+role);
  await assert.rejects(db.query('select public.app_auth_claim($1,$2,false)',[user,s1]),e=>e.code==='42501');
  await assert.rejects(db.query('select public.app_auth_attempt($1)',['b'.repeat(64)]),e=>e.code==='42501');
  await assert.rejects(db.query('select * from sim_murid_private.auth_accounts'),e=>e.code==='42501');
  await db.exec('reset role');
 }
});
