/** Production PostgREST enables pg-safeupdate; PGlite does not load native C extensions. */
import {test,after} from 'node:test';
import assert from 'node:assert/strict';
import {randomUUID as uuid} from 'node:crypto';
import {createIsolatedDatabase} from '../../scripts/database/harness.mjs';
const {db}=await createIsolatedDatabase();after(()=>db.close());
const val=async(sql,p=[])=>Object.values((await db.query(sql,p)).rows[0])[0];
test('singleton UPDATEs have real row predicates required by production safeupdate',async()=>{
 const rows=(await db.query("select proname,prosrc from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='public' and prosrc ~* 'update sim_murid_private\\.(education_state|operations_state|service_settings) set'")).rows;
 assert.equal(rows.length,7);
 for(const row of rows){for(const statement of row.prosrc.match(/update sim_murid_private\.(?:education_state|operations_state|service_settings) set[^;]+;/gi)??[]){assert.match(statement,/\bwhere\s+singleton\s*=\s*true\s*;/i,row.proname+' must scope the existing singleton row');}}
});
test('service-role year creation commits both semesters, confirms snapshot, and replays once',async()=>{
 const actor=uuid(),session=uuid(),request=uuid();await db.query('insert into auth.users values($1)',[actor]);await db.query('insert into auth.sessions(id,user_id) values($1,$2)',[session,actor]);await db.query("insert into public.profiles(id,username,full_name,contact_email) values($1,'singleton-year-admin','Test Admin','test@example.invalid')",[actor]);await db.query("insert into public.user_roles values($1,'admin')",[actor]);await db.query("insert into sim_murid_private.auth_accounts(user_id,must_change_password,profile_completed_at,verified_contact_email) values($1,false,now(),'test@example.invalid')",[actor]);await db.query("insert into sim_murid_private.security_questions(user_id,question_code,answer_hash) values($1,'q1',repeat('0',64))",[actor]);await db.query('select public.app_auth_claim($1,$2,false)',[actor,session]);
 await db.exec('set role service_role');
 try{
  const command=JSON.stringify({type:'year',startYear:2026});const write=(req=request,revision=0)=>val('select public.app_classes_write($1,$2,$3,$4,$5::jsonb)',[actor,session,req,revision,command]);const result=await write();assert.equal(result.code,'saved');assert.equal((await write()).id,result.id);const snapshot=await val('select public.app_classes_read($1,$2)',[actor,session]);assert.equal(snapshot.revision,1);assert.equal(snapshot.years.length,1);assert.equal(snapshot.years[0].start_year,2026);assert.equal(await val('select count(*)::int from sim_murid_private.education_requests'),1);assert.equal(await val('select count(*)::int from sim_murid_private.activity_logs where request_id=$1',[request]),1);
  const dates=(await db.query('select number,starts_on::text,ends_on::text from public.semesters where academic_year_id=$1 order by number',[result.id])).rows;assert.deepEqual(dates,[{number:1,starts_on:'2026-07-01',ends_on:'2026-12-31'},{number:2,starts_on:'2027-01-01',ends_on:'2027-06-30'}]);assert.equal((await write(uuid(),1)).code,'duplicate');assert.equal((await write(uuid(),0)).code,'stale');assert.equal((await val('select public.app_classes_read($1,$2)',[actor,session])).revision,1);
 }finally{await db.exec('reset role');}
});


test('settings writes scope singleton state and logo metadata for production safeupdate',async()=>{
 const source=await val("select prosrc from pg_proc where oid='public.app_settings_write(uuid,uuid,uuid,bigint,jsonb)'::regprocedure");
 assert.match(source,/update sim_murid_private\.settings_state set revision=revision\+1 where singleton=true returning/i);
 assert.match(source,/update public\.school_profile set asset_data=[^;]+where singleton_key='main' returning/i);
});
