import { test, after } from "node:test";
import assert from "node:assert/strict";
import { randomUUID as uuid } from "node:crypto";
import { createIsolatedDatabase } from "../../scripts/database/harness.mjs";
const { db } = await createIsolatedDatabase();
after(() => db.close());
const val = async (q, p = []) =>
  Object.values((await db.query(q, p)).rows[0])[0];
const users = {};
for (const [name, role, username] of [
  ["admin", "admin", "admin-qa"],
  ["teacher", "teacher", "guru-01"],
  ["other", "teacher", "guru-02"],
  ["head", "teacher", "head"],
  ["s1", "student", "001-02"],
  ["s2", "student", "1-2"],
  ["s3", "student", "003"],
  ["s4", "student", "004"],
  ["foreign", "student", "outside"],
  ["parent", "parent", "parent"],
  ["customer", "customer", "customer"],
  ["applicant", "applicant", "applicant"],
  ["alumni", "alumni", "alumni"],
]) {
  const id = uuid(),
    session = uuid();
  users[name] = { id, session, username };
  await db.query("insert into auth.users values($1)", [id]);
  await db.query("insert into auth.sessions(id,user_id) values($1,$2)", [
    session,
    id,
  ]);
  await db.query(
    "insert into public.profiles(id,username,full_name,contact_email) values($1,$2,$2,$3)",
    [id, username, "unit@example.org"],
  );
  await db.query(
    "insert into public.user_roles(user_id,role_code) values($1,$2)",
    [id, role],
  );
  await db.query(
    "insert into sim_murid_private.auth_accounts(user_id,must_change_password,profile_completed_at,verified_contact_email) values($1,false,now(),'unit@example.org')",
    [id],
  );
  await db.query(
    "insert into sim_murid_private.security_questions(user_id,question_code,answer_hash) values($1,'q1',repeat('0',64))",
    [id],
  );
  if (role === "teacher")
    await db.query(
      "insert into public.user_access_flags(user_id,teacher_email_verified_at) values($1,now())",
      [id],
    );
  await val("select public.app_auth_claim($1,$2,false)", [id, session]);
}

const A = users.admin,
  S = users.s1;
const year = uuid(),
  period = uuid();
await db.query(
  "insert into public.academic_years(id,start_year) values($1,2026)",
  [year],
);
await db.query(
  "insert into sim_murid_private.survey_periods(id,academic_year_id,semester,kind,title,starts_on,ends_on,status,created_by,targets) values($1,$2,1,'main','Synthetic',date '2026-07-01',date '2026-12-31','closed',$3,array['student'])",
  [period, year, A.id],
);
async function analysis(scope = "openai") {
  const id = uuid();
  await db.query(
    "insert into sim_murid_private.ai_analyses(id,period_id,scope,source_hash,status,model) values($1,$2,$4,$3,'running','approved-model')",
    [id, period, uuid(),scope],
  );
  return id;
}
const reserve = (id, actor = A, limit = 2) =>
  val("select public.app_ai_reserve($1,$2,$3,$4)", [
    actor.id,
    actor.session,
    id,
    limit,
  ]);
test("P12 budget denies foreign roles/revoked sessions and is service_role only", async () => {
  const id = await analysis();
  assert.equal((await reserve(id, S)).code, "denied");
  assert.equal((await reserve(id, { ...A, session: uuid() })).code, "denied");
  assert.equal((await reserve(id, A, 21)).code, "invalid");
  for (const role of ["anon", "authenticated"]) {
    await db.exec("set role " + role);
    try {
      await assert.rejects(reserve(id), (e) => e.code === "42501");
      await assert.rejects(
        db.exec("select * from sim_murid_private.ai_usage_reservations"),
        (e) => e.code === "42501",
      );
    } finally {
      await db.exec("reset role");
    }
  }
});
test("P12 atomic reservation rejects replay and simultaneous attempts; cache deletion does not refund", async () => {
  const ids = await Promise.all(["openai","gemini","anthropic","openai"].map(scope=>analysis(scope)));
  await db.exec("set role service_role");
  try {
    const outcomes = await Promise.all(ids.map((id) => reserve(id)));
    assert.equal(outcomes.filter((r) => r.code === "reserved").length, 1);
    assert.equal(outcomes.filter((r) => r.code === "cooldown").length, 3);
    assert.equal((await reserve(ids[0])).code, "already_reserved");
  } finally {
    await db.exec("reset role");
  }
  await db.exec(
    "update sim_murid_private.ai_usage_reservations set reserved_at=now()-interval '61 seconds'",
  );
  assert.equal((await reserve(await analysis())).code, "reserved");
  await db.exec("update sim_murid_private.ai_analyses set status='failed'");
  await val("select public.app_ai_run($1,$2,'invalidate',$3)", [
    A.id,
    A.session,
    JSON.stringify({ periodId: period, provider: "openai" }),
  ]);
  assert.equal((await reserve(await analysis())).code, "budget_exhausted");
  assert.equal(
    await val(
      "select count(*)::int from sim_murid_private.ai_usage_reservations",
    ),
    2,
  );
});
test("P12 WIB next-day quota and cooldown remain independent", async () => {
  await db.exec(
    "update sim_murid_private.ai_usage_reservations set reserved_at=(date_trunc('day',now() at time zone 'Asia/Jakarta') at time zone 'Asia/Jakarta')-interval '1 day'",
  );
  assert.equal((await reserve(await analysis(), A, 1)).code, "reserved");
  assert.equal(
    (await reserve(await analysis(), A, 1)).code,
    "budget_exhausted",
  );
});
test('P12 redaction dictionary covers sampled submitted respondents only and is not stored in quota row',async()=>{
 await db.exec("update sim_murid_private.ai_usage_reservations set reserved_at=now()-interval '2 days'");
 await db.query("insert into sim_murid_private.survey_respondents(period_id,user_id,role,instrument,answers,submitted_at) values($1,$2,'student',$3,$4,now())",[period,S.id,JSON.stringify([{kind:'essay',code:'A1'}]),JSON.stringify({A1:'Synthetic meaningful response'})]);
 const result=await reserve(await analysis());assert.equal(result.code,'reserved');assert.ok(result.identifiers.includes(S.username));assert.ok(!result.identifiers.includes(users.foreign.username));
 const rows=await val('select jsonb_agg(to_jsonb(r)) from sim_murid_private.ai_usage_reservations r');assert.ok(!JSON.stringify(rows).includes('unit@example.org'));
});
