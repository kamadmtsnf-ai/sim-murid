import assert from 'node:assert/strict';
import {after,test} from 'node:test';
import {createIsolatedDatabase} from '../../scripts/database/harness.mjs';
const {db}=await createIsolatedDatabase();after(()=>db.close());
const id=n=>`00000000-0000-4000-8000-${String(n).padStart(12,'0')}`;
const admin=id(701),head=id(702),student=id(703),teacher=id(704),parent=id(705),year=id(710),ca=id(711),cb=id(712);
for(const [uid,role] of [[admin,'admin'],[head,'teacher'],[student,'student'],[teacher,'teacher'],[parent,'parent']]){
 await db.query('insert into auth.users values($1)',[uid]);await db.query('insert into auth.sessions(id,user_id) values($1,$2)',[id(Number(uid.slice(-12))+100),uid]);await db.query('insert into public.profiles(id,username,full_name) values($1,$2,$2)',[uid,role+uid.slice(-3)]);await db.query('insert into public.user_roles(user_id,role_code) values($1,$2)',[uid,role]);await db.query('select public.app_auth_claim($1,$2,false)',[uid,id(Number(uid.slice(-12))+100)]);
}
// Completed prerequisite markers for isolated permission/session tests only.
for(const uid of [admin,head,student,teacher,parent]){
 await db.query("insert into sim_murid_private.auth_accounts(user_id,must_change_password,profile_completed_at,verified_contact_email) values($1,false,now(),'unit@example.org')",[uid]);
 await db.query("insert into sim_murid_private.security_questions(user_id,question_code,answer_hash) values($1,'q1',repeat('0',64))",[uid]);
 await db.query("update public.profiles set contact_email='unit@example.org' where id=$1",[uid]);
 await db.query("insert into public.user_access_flags(user_id,teacher_email_verified_at) values($1,now())",[uid]);
}
await db.query('insert into public.academic_years(id,start_year) values($1,2026)',[year]);
await db.query("insert into public.classes(id,academic_year_id,level,name) values($1,$3,7,'A'),($2,$3,7,'B')",[ca,cb,year]);
await db.query("insert into public.user_assignments(user_id,assignment_code,valid_from) values($1,'school_head',current_date-1)",[head]);
const val=async(sql,args=[])=>Object.values((await db.query(sql,args)).rows[0])[0];
async function as(uid,fn,extra={}){await db.query("select set_config('request.jwt.claims',$1,false)",[JSON.stringify({sub:uid,session_id:id(Number(uid.slice(-12))+100),user_metadata:{role:'admin'},...extra})]);await db.exec('set role authenticated');try{return await fn();}finally{await db.exec('reset role');await db.query("select set_config('request.jwt.claims','',false)");}}
const can=(cap,owner=null,cls=null)=>val('select public.app_access_check($1,$2,$3)',[cap,owner,cls]);
test('AZ01: own data only despite forged metadata; private tables and mutations denied',async()=>{
 await as(student,async()=>{assert.equal(await val('select count(*)::int from public.profiles'),1);assert.equal(await can('profiles.read',admin),false);assert.equal(await can('profiles.read',student),true);assert.equal(await val('select count(*)::int from public.subjects'),16);await assert.rejects(db.query("update public.user_roles set role_code='admin' where user_id=$1",[student]),e=>e.code==='42501');await assert.rejects(db.query('select * from sim_murid_private.permission_rules'),e=>e.code==='42501');});
 await db.exec('set role anon');await assert.rejects(db.query('select public.app_access_context()'),e=>e.code==='42501');await assert.rejects(db.query('select * from public.profiles'),e=>e.code==='42501');await db.exec('reset role');
});
test('AZ02: admin sees managed records, cannot write action plan without school-head task, stale role revoked',async()=>{
 await as(admin,async()=>{assert.equal(await val('select count(*)::int from public.profiles'),5);assert.equal(await can('accounts.manage'),true);assert.equal(await can('action_plan.write'),false);});
 await db.query("update public.user_roles set role_code='student' where user_id=$1",[admin]);await as(admin,async()=>{assert.equal(await can('accounts.manage'),false);assert.equal(await val('select count(*)::int from public.profiles'),1);});await db.query("update public.user_roles set role_code='admin' where user_id=$1",[admin]);
});
test('AZ03: school head read-only fees; task union and expiry/revocation are immediate',async()=>{
 await as(head,async()=>{assert.equal(await can('fees.read'),true);assert.equal(await can('fees.manage'),false);assert.equal(await can('action_plan.write'),true);assert.equal(await can('accounts.manage'),false);});
 await db.query("insert into public.user_assignments(user_id,assignment_code,valid_from) values($1,'committee_treasurer',current_date-1)",[head]);await as(head,async()=>assert.equal(await can('fees.manage'),true));
 await db.query("update public.user_assignments set revoked_at=now() where user_id=$1 and assignment_code='committee_treasurer'",[head]);await as(head,async()=>assert.equal(await can('fees.manage'),false));
});
test('AZ04: class scope has no global/null escalation; future/expired task ignored',async()=>{
 await db.query("insert into public.user_assignments(user_id,assignment_code,scope_class_id,valid_from) values($1,'homeroom_teacher',$2,current_date-1)",[teacher,ca]);
 await as(teacher,async()=>{assert.equal(await can('classes.manage',null,ca),true);assert.equal(await can('classes.manage',null,cb),false);assert.equal(await can('classes.manage'),false);assert.equal(await val('select count(*)::int from public.classes'),1);});
 await db.query("update public.user_assignments set valid_until=current_date-1,valid_from=current_date-2 where user_id=$1",[teacher]);await as(teacher,async()=>assert.equal(await can('classes.manage',null,ca),false));
 await db.query("insert into public.user_assignments(user_id,assignment_code,valid_from) values($1,'savings_manager',current_date+1)",[teacher]);await as(teacher,async()=>assert.equal(await can('savings.manage'),false));
});
test('AZ05: savings flag is own read, never manage; premium checked and parent child access denied',async()=>{
 await db.query('update public.user_access_flags set savings_access=true,premium_access=true where user_id=$1',[teacher]);
 await as(teacher,async()=>{assert.equal(await can('savings.read',teacher),true);assert.equal(await can('savings.manage'),false);assert.equal(await can('savings.read',student),false);assert.equal(await can('books.read'),true);});await db.query('update public.user_access_flags set savings_access=false,premium_access=false where user_id=$1',[teacher]);await as(teacher,async()=>{assert.equal(await can('savings.read',teacher),false);assert.equal(await can('books.read'),false);});await as(parent,async()=>assert.equal(await can('profiles.read',student),false));
});
test('AZ06: malformed/missing Auth session, expired registry, inactive and revoked sessions deny direct reads',async()=>{
 await as(student,async()=>assert.equal(await val('select public.app_access_context()'),null),{session_id:'not-a-uuid'});
 await as(student,async()=>assert.equal(await val('select public.app_access_context()'),null),{session_id:null});
 await db.query("update public.profiles set status='inactive' where id=$1",[student]);await as(student,async()=>assert.equal(await val('select count(*)::int from public.subjects'),0));await db.query("update public.profiles set status='active' where id=$1",[student]);
 await db.query('update auth.sessions set not_after=now() where user_id=$1',[student]);await as(student,async()=>assert.equal(await val('select public.app_access_context()'),null));await db.query('update auth.sessions set not_after=null where user_id=$1',[student]);
 await db.query("update sim_murid_private.app_sessions set revoked_at=now() where user_id=$1",[student]);await as(student,async()=>{assert.equal(await can('references.read'),false);assert.equal(await val('select count(*)::int from public.profiles'),0);});
});
test('AZ07: security-definer allowlist is private, no arguments and fixed search path',async()=>{
 const p=await db.query("select n.nspname,p.proname,p.proargtypes::text args,p.proconfig from pg_proc p join pg_namespace n on n.oid=p.pronamespace where p.prosecdef and n.nspname in ('public','sim_murid_private')");assert.equal(p.rows.length,1);assert.equal(p.rows[0].nspname,'sim_murid_private');assert.equal(p.rows[0].proname,'access_snapshot');assert.equal(p.rows[0].args,'');assert.ok(p.rows[0].proconfig.includes('search_path=""'));
});
