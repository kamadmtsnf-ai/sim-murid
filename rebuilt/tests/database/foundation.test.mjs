import assert from 'node:assert/strict';
import { after, test } from 'node:test';
import { createIsolatedDatabase } from '../../scripts/database/harness.mjs';

const { db, migrations } = await createIsolatedDatabase();
after(async () => db.close());
const alice = '00000000-0000-4000-8000-000000000001';
const bob = '00000000-0000-4000-8000-000000000002';
const carol = '00000000-0000-4000-8000-000000000003';
const year = '00000000-0000-4000-8000-000000000010';
const count = async (sql, params = []) => Number((await db.query(sql, params)).rows[0].n);
async function rejectsCode(sql, params, code) {
  await assert.rejects(db.query(sql, params), (error) => error.code === code);
}

test('DB01: migration chain creates 79 RLS-protected tables with reference catalogs only', async () => {
  assert.equal(migrations.length, 32);
  const tables = await db.query(`select c.relname,c.relrowsecurity from pg_class c join pg_namespace n on n.oid=c.relnamespace where n.nspname in ('public','sim_murid_private') and c.relkind='r'`);
  assert.equal(tables.rows.length, 79);
  assert.ok(tables.rows.every((table) => table.relrowsecurity));
  for (const [table, expected] of [['role_catalog',7],['assignment_catalog',7],['subjects',16],['business_policies',3]]) {
    assert.equal(await count(`select count(*)::int n from public.${table}`), expected);
  }
  assert.equal(await count('select count(*)::int n from auth.users'), 0);
});

test('DB02: rupiah domains reject fractional, unsafe, NaN and negative nonnegative values', async () => {
  assert.equal(String((await db.query('select 123000::public.rupiah_amount amount')).rows[0].amount), '123000');
  for (const value of ['1.5','9007199254740992','NaN','Infinity']) {
    await rejectsCode('select $1::numeric::public.rupiah_amount', [value], '23514');
  }
  await rejectsCode('select (-1)::public.nonnegative_rupiah', [], '23514');
});

test('DB03: UUID identity preserves text usernames and rejects duplicate/whitespace values', async () => {
  for (const [id,username] of [[alice,'00123'],[bob,'123'],[carol,'123abc']]) {
    await db.query('insert into auth.users(id) values($1)',[id]);
    await db.query('insert into public.profiles(id,username,full_name) values($1,$2,$3)',[id,username,'Test Account']);
  }
  assert.equal(await count('select count(*)::int n from public.profiles'),3);
  await rejectsCode('update public.profiles set username=$1 where id=$2',['00123',bob],'23505');
  await rejectsCode('update public.profiles set username=$1 where id=$2',[' 123 ',bob],'23514');
});

test('DB04: one base role per profile, catalog FK and restricted account deletion', async () => {
  await db.query('insert into public.user_roles(user_id,role_code,assigned_by) values($1,$2,$3)',[alice,'student',bob]);
  await rejectsCode('insert into public.user_roles(user_id,role_code) values($1,$2)',[alice,'teacher'],'23505');
  await rejectsCode('insert into public.user_roles(user_id,role_code) values($1,$2)',[bob,'fake_role'],'23503');
  await rejectsCode('delete from auth.users where id=$1',[alice],'23001');
});

test('DB05: academic dates and semester year cannot drift or duplicate', async () => {
  await db.query('insert into public.academic_years(id,start_year,is_active) values($1,2026,true)',[year]);
  await db.query('insert into public.semesters(academic_year_id,year_start,number) values($1,2026,1),($1,2026,2)',[year]);
  const dates = await db.query('select number,starts_on::text,ends_on::text from public.semesters order by number');
  assert.deepEqual(dates.rows,[{number:1,starts_on:'2026-07-01',ends_on:'2026-12-31'},{number:2,starts_on:'2027-01-01',ends_on:'2027-06-30'}]);
  await rejectsCode('insert into public.academic_years(start_year,is_active) values(2027,true)',[],'23505');
  await rejectsCode('update public.semesters set year_start=2027 where academic_year_id=$1 and number=1',[year],'23503');
  await rejectsCode('insert into public.semesters(academic_year_id,year_start,number) values($1,2026,1)',[year],'23505');
});

test('DB06: class identity, holiday dedup and assignment date ranges enforced', async () => {
  await db.query('insert into public.classes(academic_year_id,level,name,homeroom_teacher_id) values($1,7,$2,$3)',[year,'7A',bob]);
  await rejectsCode('insert into public.classes(academic_year_id,level,name) values($1,10,$2)',[year,'10A'],'23514');
  await db.query("insert into public.holidays(holiday_date,description) values(date '2026-10-20','Test only')");
  await rejectsCode("insert into public.holidays(holiday_date,description) values(date '2026-10-20','Duplicate')",[],'23505');
  await rejectsCode("insert into public.user_assignments(user_id,assignment_code,valid_from,valid_until) values($1,'duty_teacher','2026-10-20','2026-10-19')",[bob],'23514');
});

test('DB07: registry prevents two unrevoked sessions and enforces application TTL', async () => {
  await rejectsCode("insert into sim_murid_private.app_sessions(user_id,auth_session_id,issued_at,expires_at) values($1,gen_random_uuid(),now(),now()+interval '2 hours')",[alice],'23514');
  await db.query("insert into sim_murid_private.app_sessions(user_id,auth_session_id,expires_at) values($1,gen_random_uuid(),now()+interval '30 minutes')",[alice]);
  await rejectsCode("insert into sim_murid_private.app_sessions(user_id,auth_session_id,expires_at) values($1,gen_random_uuid(),now()+interval '30 minutes')",[alice],'23505');
  await db.query('update sim_murid_private.app_sessions set revoked_at=now() where user_id=$1',[alice]);
  await db.query("insert into sim_murid_private.app_sessions(user_id,auth_session_id,remember_me,expires_at) values($1,gen_random_uuid(),true,now()+interval '167 hours')",[alice]);
  await rejectsCode("insert into sim_murid_private.app_sessions(user_id,auth_session_id,remember_me,expires_at) values($1,gen_random_uuid(),true,now()+interval '169 hours')",[bob],'23514');
});

test('DB08: OTP table rejects excess attempts, plaintext-sized hash and invalid TTL', async () => {
  for (const [attempts,hash,seconds] of [[6,'a'.repeat(64),500],[0,'123456',500],[0,'a'.repeat(64),601]]) {
    await rejectsCode("insert into sim_murid_private.email_verifications(user_id,email_target,otp_hash,attempts_used,expires_at) values($1,'test@example.invalid',$2,$3,now()+make_interval(secs=>$4))",[alice,hash,attempts,seconds],'23514');
  }
});

test('DB09: audit rows are append-only including TRUNCATE and require user actors', async () => {
  await db.query("insert into sim_murid_private.activity_logs(actor_kind,action,request_id) values('system','TEST_ONLY',gen_random_uuid())");
  await rejectsCode("update sim_murid_private.activity_logs set action='TAMPER'",[],'55000');
  await rejectsCode('delete from sim_murid_private.activity_logs',[],'55000');
  await rejectsCode('truncate sim_murid_private.activity_logs',[],'55000');
  await rejectsCode("insert into sim_murid_private.activity_logs(actor_kind,action,request_id) values('user','TEST',gen_random_uuid())",[],'23514');
});

test('DB10: approved policies preserved, cannot be rewritten or truncated', async () => {
  const row = (await db.query("select configuration from public.business_policies where version='RAPOR-1.0'")).rows[0];
  assert.deepEqual(row.configuration.weights,{ph:20,ats:30,asas:50});
  assert.equal(row.configuration.practice,'display-separately');
  assert.equal((await db.query("select configuration->>'peer_essay_required' required from public.business_policies where policy_type='survey_required'")).rows[0].required,'false');
  await rejectsCode("update public.business_policies set version='tampered'",[],'55000');
  await rejectsCode('truncate public.business_policies',[],'55000');
});

test('DB11: outbox and scheduled job idempotency keys reject duplicates', async () => {
  const sql="insert into sim_murid_private.outbox(idempotency_key,channel,event_type,aggregate_type,aggregate_id,payload) values('test:one','email','test','test',$1,'{}')";
  await db.query(sql,[alice]);
  await rejectsCode(sql,[alice],'23505');
  await db.query("insert into sim_murid_private.job_runs(job_key,job_type,business_date) values('test:2026-10','test','2026-10-01')");
  await rejectsCode("insert into sim_murid_private.job_runs(job_key,job_type,business_date) values('test:2026-10','test','2026-10-01')",[],'23505');
});

test('DB12: import staging preserves source row and deduplicates identity mappings', async () => {
  const batch=(await db.query("insert into sim_murid_private.import_batches(source_name) values('synthetic-test') returning id")).rows[0].id;
  const sql="insert into sim_murid_private.import_rows(batch_id,sheet_name,row_number,raw_data) values($1,'Users',2,$2)";
  await db.query(sql,[batch,{username:'00123'}]);
  await rejectsCode(sql,[batch,{username:'123'}],'23505');
  const mapping="insert into sim_murid_private.legacy_id_map(batch_id,entity_type,source_key,target_id) values($1,'user','00123',$2)";
  await db.query(mapping,[batch,alice]);
  await rejectsCode(mapping,[batch,bob],'23505');
});

test('DB13: anon stays closed; authenticated reads require verified registry',async()=>{
 assert.equal((await db.query("select has_schema_privilege('anon','sim_murid_private','usage') allowed")).rows[0].allowed,false);
 for(const role of ['anon','authenticated']){
  await db.exec('set role '+role);
  if(role==='anon')await rejectsCode('select * from public.profiles',[],'42501');
  else assert.equal(await count('select count(*)::int n from public.profiles'),0);
  await rejectsCode('select * from sim_murid_private.app_sessions',[],'42501');
  await db.exec('reset role');
 }
});

test('DB14: RLS independently denies data even if SELECT/INSERT accidentally granted', async () => {
  try {
    await db.exec('begin; grant select,insert on public.profiles to authenticated; set local role authenticated;');
    assert.equal(await count('select count(*)::int n from public.profiles'),0);
    await rejectsCode('insert into public.profiles(id,username,full_name) values(gen_random_uuid(),$1,$2)',['attacker','Rejected'],'42501');
  } finally { await db.exec('rollback'); }
});

test('DB15: privileged provisioning can read but cannot overwrite audit via grant', async () => {
  try {
    await db.exec('set role service_role');
    assert.equal(await count('select count(*)::int n from public.profiles'),3);
    await rejectsCode("update sim_murid_private.activity_logs set action='TAMPER'",[],'42501');
  } finally { await db.exec('reset role'); }
});

test('DB16: helper functions are security invoker with fixed search_path and no client EXECUTE', async () => {
  const funcs=await db.query("select p.proname,p.prosecdef,p.proconfig from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='sim_murid_private' and p.proname in ('touch_updated_at','deny_mutation')");
  assert.equal(funcs.rows.length,2);
  assert.ok(funcs.rows.every((row)=>row.prosecdef===false && row.proconfig?.some((v)=>v.startsWith('search_path='))));
  assert.equal((await db.query("select has_function_privilege('authenticated','sim_murid_private.touch_updated_at()','execute') allowed")).rows[0].allowed,false);
});

test('DB17: updated_at trigger overwrites manually forged timestamps', async () => {
  await db.query("update public.profiles set bio='test',updated_at='2000-01-01' where id=$1",[alice]);
  assert.equal((await db.query("select updated_at > '2020-01-01'::timestamptz valid from public.profiles where id=$1",[alice])).rows[0].valid,true);
});

test('DB18: second fresh database can replay full migration chain with identical counts', async () => {
  const second=await createIsolatedDatabase();
  try {
    assert.equal(await count('select count(*)::int n from public.subjects'),16);
    assert.equal(Number((await second.db.query('select count(*)::int n from public.subjects')).rows[0].n),16);
    assert.equal(Number((await second.db.query('select count(*)::int n from public.profiles')).rows[0].n),0);
  } finally { await second.db.close(); }
});
