import assert from 'node:assert/strict';
import {test,after} from 'node:test';
import {randomUUID} from 'node:crypto';
import {createIsolatedDatabase} from '../../scripts/database/harness.mjs';
const {db}=await createIsolatedDatabase();after(()=>db.close());
const admin=randomUUID(),session=randomUUID(),other=randomUUID(),otherSession=randomUUID();
const val=async(q,p=[])=>Object.values((await db.query(q,p)).rows[0])[0];
for(const [u,s,role] of [[admin,session,'admin'],[other,otherSession,'parent']]){
 await db.query('insert into auth.users values($1)',[u]);await db.query('insert into auth.sessions(id,user_id) values($1,$2)',[s,u]);await db.query('insert into public.profiles(id,username,full_name) values($1,$2,$2)',[u,role]);await db.query('insert into public.user_roles(user_id,role_code) values($1,$2)',[u,role]);await db.query('insert into sim_murid_private.auth_accounts(user_id,must_change_password) values($1,false)',[u]);await db.query("insert into sim_murid_private.security_questions(user_id,question_code,answer_hash) values($1,'q1',repeat('0',64))",[u]);await db.query('select public.app_auth_claim($1,$2,false)',[u,s]);
}
const rev=()=>val('select revision::int from sim_murid_private.settings_state');
const write=async(command,revision=undefined,request=randomUUID(),u=admin,s=session)=>val('select public.app_settings_write($1,$2,$3,$4,$5::jsonb)',[u,s,request,revision??await rev(),JSON.stringify(command)]);
const read=()=>val('select public.app_settings_read($1,$2)',[admin,session]);
const profile={name:'MTs Test',identity_data:{head_name:'Kepala',head_nip:'00123',phone:'0812',npsn:'00001'},address_data:{street:'Jl. Test',province_id:'01',province:'P',regency_id:'',regency:'R',district_id:'',district:'D',village_id:'',village:'V'}};
test('SET01: only current ready Admin can read/write; direct client RPC and table mutations denied',async()=>{
 assert.equal(await val('select public.app_settings_read($1,$2)',[other,otherSession]),null);
 assert.equal((await write({type:'profile',profile},0,randomUUID(),other,otherSession)).code,'denied');
 for(const role of ['anon','authenticated']){await db.exec('set role '+role);await assert.rejects(db.query('select public.app_settings_read($1,$2)',[admin,session]),e=>e.code==='42501');await assert.rejects(db.exec("update public.subjects set name='Injected'"),e=>e.code==='42501');await db.exec('reset role');}
 assert.equal((await write({type:'profile',profile})).code,'saved');assert.equal((await read()).school.identity_data.npsn,'00001');
 await db.query("update public.user_roles set role_code='parent' where user_id=$1",[admin]);assert.equal((await write({type:'profile',profile})).code,'denied');await db.query("update public.user_roles set role_code='admin' where user_id=$1",[admin]);
});
test('SET02: request replay is idempotent, stale writes and reused UUID with different payload are rejected; audit atomic',async()=>{
 const request=randomUUID(),version=await rev(),command={type:'memorization',id:null,name:'Doa; makan',active:true};
 const first=await write(command,version,request);assert.equal(first.code,'saved');assert.deepEqual(await write(command,version,request),first);
 assert.equal((await write({...command,name:'Other'},version,request)).code,'request_conflict');assert.equal((await write({...command,name:'Other'},version)).code,'stale');
 assert.equal(await val('select count(*)::int from sim_murid_private.activity_logs where request_id=$1',[request]),1);
 assert.equal(await val('select actor_id from sim_murid_private.activity_logs where request_id=$1',[request]),admin);
});
test('SET03: master identity and code survive rename/deactivation; case-insensitive duplicates roll back revision',async()=>{
 assert.equal((await write({type:'subject',id:null,name:'Pengetahuan Sosial',active:true})).code,'saved');const original=(await read()).subjects.find(x=>x.name==='Pengetahuan Sosial');assert.ok(original);
 assert.equal((await write({type:'subject',id:original.id,name:'IPS Baru',active:true})).code,'saved');assert.equal((await read()).subjects.find(x=>x.id===original.id).code,original.code);
 const version=await rev();assert.equal((await write({type:'subject',id:null,name:'ips baru',active:true})).code,'duplicate');assert.equal(await rev(),version);
 assert.equal((await write({type:'deactivate',catalog:'subject',id:original.id})).code,'saved');assert.equal((await read()).subjects.find(x=>x.id===original.id).active,false);
 assert.equal((await write({type:'subject',id:original.id,name:'IPS Baru',active:true})).code,'saved');
 const mem=(await read()).memorization.find(x=>x.name==='Doa, makan');assert.ok(mem);assert.equal((await write({type:'memorization',id:mem.id,name:'Doa Baru',active:true})).code,'saved');assert.equal((await write({type:'deactivate',catalog:'memorization',id:mem.id})).code,'saved');
});
test('SET04: holiday ranges include leap day, deduplicate overlapping dates and keep original descriptions',async()=>{
 assert.equal((await write({type:'holiday',id:null,start:'2028-02-28',end:'2028-03-01',description:'Original'})).added,3);
 const r=await write({type:'holiday',id:null,start:'2028-02-29',end:'2028-03-02',description:'New'});assert.equal(r.added,1);assert.equal(r.skipped,2);
 const all=(await read()).holidays;assert.equal(all.find(x=>x.holiday_date==='2028-02-29').description,'Original');
 const h=all.find(x=>x.holiday_date==='2028-03-02');assert.equal((await write({type:'holiday',id:h.id,start:'2028-03-03',end:'2028-03-03',description:'Edited'})).code,'saved');
 const version=await rev();assert.equal((await write({type:'holiday',id:h.id,start:'2028-02-29',end:'2028-02-29',description:'Duplicate'})).code,'duplicate');assert.equal(await rev(),version);
 assert.equal((await write({type:'holiday_delete',id:h.id})).code,'saved');assert.equal((await read()).holidays.length,3);
 for(const [start,end] of [['2026-02-29','2026-03-01'],['2028-03-01','2028-02-28'],['2026-01-01','2027-01-03']])assert.equal((await write({type:'holiday',id:null,start,end,description:'Invalid'})).code,'invalid');
});
test('SET05: logo metadata only accepts managed paths, clear preserves other slot; durable GC excludes referenced and recent staged objects',async()=>{
 const school=randomUUID()+'.png',coop=randomUUID()+'.png';
 assert.equal((await write({type:'logo',slot:'school',path:'https://evil/file.svg'})).code,'invalid');
 await val('select public.app_settings_asset_gc($1,$2,null,$3)',[admin,session,school]);
 assert.equal((await write({type:'logo',slot:'school',path:school})).code,'saved');assert.equal((await write({type:'logo',slot:'cooperative',path:coop})).code,'saved');
 await db.exec("update sim_murid_private.school_asset_gc set created_at=now()-interval '2 hours'");assert.deepEqual(await val('select public.app_settings_asset_gc($1,$2)',[admin,session]),[]);
 assert.equal((await write({type:'logo_clear',slot:'school'})).code,'saved');assert.equal((await read()).school.asset_data.cooperative,coop);
 assert.deepEqual(await val('select public.app_settings_asset_gc($1,$2)',[admin,session]),[school]);
 await val('select public.app_settings_asset_gc($1,$2,$3)',[admin,session,school]);assert.equal(await val('select count(*)::int from sim_murid_private.school_asset_gc where path=$1',[school]),0);
});
test('SET06: revoked sessions and pending-password Admin cannot mutate settings',async()=>{
 await db.query('update sim_murid_private.auth_accounts set must_change_password=true where user_id=$1',[admin]);assert.equal((await write({type:'profile',profile})).code,'denied');await db.query('update sim_murid_private.auth_accounts set must_change_password=false where user_id=$1',[admin]);await db.query('select public.app_auth_revoke($1,$2)',[admin,session]);assert.equal(await read(),null);assert.equal((await write({type:'profile',profile})).code,'denied');
});
