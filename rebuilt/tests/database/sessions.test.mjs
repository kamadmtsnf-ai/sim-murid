import assert from "node:assert/strict";
import { sessionListSchema } from "../../src/lib/auth/sessions.ts";
import { after, test } from "node:test";
import { createIsolatedDatabase } from "../../scripts/database/harness.mjs";
const { db } = await createIsolatedDatabase();
after(() => db.close());
const ids = Array.from(
  { length: 8 },
  (_, i) => `00000000-0000-4000-8000-${String(601 + i).padStart(12, "0")}`,
);
const [admin, user, third, as, us, ts, next, other] = ids;
const val = async (sql, args = []) =>
  Object.values((await db.query(sql, args)).rows[0])[0];
for (const [id, name, role, sid] of [
  [admin, "admin-6", "admin", as],
  [user, "0006", "student", us],
  [third, "third", "teacher", ts],
]) {
  await db.query("insert into auth.users values($1)", [id]);
  await db.query("insert into auth.sessions(id,user_id) values($1,$2)", [
    sid,
    id,
  ]);
  await db.query(
    "insert into public.profiles(id,username,full_name) values($1,$2,$2)",
    [id, name],
  );
  await db.query(
    "insert into public.user_roles(user_id,role_code) values($1,$2)",
    [id, role],
  );
  await db.query("select public.app_auth_claim($1,$2,false)", [id, sid]);
}
// Completed prerequisite markers for isolated permission/session tests only.
for (const uid of [admin, user, third]) {
  await db.query(
    "insert into sim_murid_private.auth_accounts(user_id,must_change_password,profile_completed_at,verified_contact_email) values($1,false,now(),'unit@example.org')",
    [uid],
  );
  await db.query(
    "insert into sim_murid_private.security_questions(user_id,question_code,answer_hash) values($1,'q1',repeat('0',64))",
    [uid],
  );
  await db.query(
    "update public.profiles set contact_email='unit@example.org' where id=$1",
    [uid],
  );
  await db.query(
    "insert into public.user_access_flags(user_id,teacher_email_verified_at) values($1,now())",
    [uid],
  );
}
test("SESS01: device labels, safe own list and foreign ownership denial", async () => {
  await db.exec("set role service_role");
  await db.query("select public.app_auth_device($1,$2,$3)", [
    user,
    us,
    "Chrome · Windows",
  ]);
  const own = await val("select public.app_session_list($1,$2)", [user, us]);
  assert.equal(own.username, "0006");
  assert.equal(own.sessions[0].device, "Chrome · Windows");
  assert.equal(own.sessions[0].current, true);
  assert.ok(!JSON.stringify(own).includes(us));
  assert.equal(
    await val("select public.app_session_list($1,$2,$3)", [user, us, "third"]),
    null,
  );
  assert.equal(
    await val("select public.app_session_revoke($1,$2,$3)", [
      user,
      us,
      "third",
    ]),
    null,
  );
  assert.equal(
    await val("select public.app_session_revoke($1,$2,null,$3)", [
      user,
      us,
      (await val("select public.app_session_list($1,$2)", [third, ts]))
        .sessions[0].id,
    ]),
    null,
  );
  await db.exec("reset role");
});
test("SESS02: Admin revocation audits actor/target and rejects stale role immediately", async () => {
  await db.exec("set role service_role");
  const list = await val("select public.app_session_list($1,$2,$3)", [
    admin,
    as,
    "third",
  ]);
  const result = await val("select public.app_session_revoke($1,$2,$3,$4)", [
    admin,
    as,
    "third",
    list.sessions[0].id,
  ]);
  assert.equal(result.revoked, 1);
  assert.equal(result.signed_out, false);
  assert.equal(
    await val("select public.app_auth_principal($1,$2)", [third, ts]),
    null,
  );
  assert.equal(
    await val(
      "select metadata->>'scope' from sim_murid_private.activity_logs where actor_id=$1 and entity_id=$2 and action='auth.session_revoke'",
      [admin, third],
    ),
    "one",
  );
  await db.query(
    "update public.user_roles set role_code='teacher' where user_id=$1",
    [admin],
  );
  assert.equal(
    await val("select public.app_session_revoke($1,$2,$3)", [
      admin,
      as,
      "0006",
    ]),
    null,
  );
  await db.query(
    "update public.user_roles set role_code='admin' where user_id=$1",
    [admin],
  );
  await db.exec("reset role");
});
test("SESS03: owner revoke all denies reuse; unregistered/missing/expired Auth sessions rejected", async () => {
  await db.exec("set role service_role");
  const r = await val("select public.app_session_revoke($1,$2)", [user, us]);
  assert.equal(r.revoked, 1);
  assert.equal(r.signed_out, true);
  assert.equal(
    await val("select public.app_auth_principal($1,$2)", [user, us]),
    null,
  );
  assert.equal(
    await val("select public.app_auth_claim($1,$2,false)", [user, next]),
    false,
  );
  await db.exec("reset role");
  await db.query(
    "insert into auth.sessions(id,user_id,not_after) values($1,$2,now()-interval '1 minute')",
    [next, user],
  );
  assert.equal(
    await val("select public.app_auth_claim($1,$2,false)", [user, next]),
    false,
  );
  await db.query("update auth.sessions set not_after=null where id=$1", [next]);
  assert.equal(
    await val("select public.app_auth_claim($1,$2,false)", [user, next]),
    true,
  );
  await db.query(
    "update auth.sessions set not_after=now()-interval '1 second' where id=$1",
    [next],
  );
  assert.equal(
    await val("select public.app_auth_principal($1,$2)", [user, next]),
    null,
  );
  await db.query("insert into auth.sessions(id,user_id) values($1,$2)", [
    other,
    user,
  ]);
  assert.equal(
    await val("select public.app_auth_claim($1,$2,true)", [user, other]),
    true,
  );
  assert.equal(
    await val(
      "select count(*)::int from sim_murid_private.app_sessions where user_id=$1 and revoked_at is null",
      [user],
    ),
    1,
  );
  await db.query("delete from auth.sessions where id=$1", [other]);
  assert.equal(
    await val("select public.app_auth_principal($1,$2)", [user, other]),
    null,
  );
});
test("SESS04: expiry cannot be extended by observation; throttle writes; RLS and RPC grants stay closed", async () => {
  const before = await val(
    "select expires_at from sim_murid_private.app_sessions where user_id=$1 and revoked_at is null",
    [admin],
  );
  await db.query("select public.app_session_list($1,$2)", [admin, as]);
  assert.deepEqual(
    await val(
      "select expires_at from sim_murid_private.app_sessions where user_id=$1 and revoked_at is null",
      [admin],
    ),
    before,
  );
  for (const role of ["anon", "authenticated"]) {
    await db.exec("set role " + role);
    await assert.rejects(
      db.query("select public.app_session_list($1,$2)", [admin, as]),
      (e) => e.code === "42501",
    );
    await assert.rejects(
      db.query("select public.app_session_revoke($1,$2)", [admin, as]),
      (e) => e.code === "42501",
    );
    await assert.rejects(
      db.query("select id from auth.sessions"),
      (e) => e.code === "42501",
    );
    await db.exec("reset role");
  }
});

test("SESS05: history remains bounded and ordered; onboarding cannot be bypassed by management", async () => {
  for (let n = 1; n <= 22; n++)
    await db.query(
      "insert into sim_murid_private.app_sessions(user_id,auth_session_id,issued_at,expires_at,revoked_at,device_label) values($1,$2,now()-($3::int*interval '2 hours'),now()-($3::int*interval '2 hours')+interval '1 hour',now(),'History '||$3::text)",
      [
        admin,
        `00000000-0000-4000-8000-${String(700 + n).padStart(12, "0")}`,
        n,
      ],
    );
  const list = await val("select public.app_session_list($1,$2)", [admin, as]);
  assert.equal(sessionListSchema.safeParse(list).success, true);
  assert.equal(list.sessions.length, 20);
  assert.equal(list.sessions[0].current, true);
  assert.ok(list.sessions.slice(1).every((s) => s.status === "revoked"));
  for (let n = 1; n < list.sessions.length; n++)
    assert.ok(
      Date.parse(list.sessions[n - 1].issued_at) >=
        Date.parse(list.sessions[n].issued_at),
    );
  await db.query(
    "update sim_murid_private.auth_accounts set must_change_password=true where user_id=$1",
    [admin],
  );
  assert.equal(
    await val("select public.app_session_list($1,$2)", [admin, as]),
    null,
  );
  assert.equal(
    await val("select public.app_session_revoke($1,$2)", [admin, as]),
    null,
  );
  await db.query(
    "update sim_murid_private.auth_accounts set must_change_password=false where user_id=$1",
    [admin],
  );
});
test("SESS06: each role reads/revokes own sessions; foreign scope remains restricted", async () => {
  let n = 0;
  for (const role of [
    "admin",
    "teacher",
    "student",
    "parent",
    "alumni",
    "customer",
    "applicant",
  ]) {
    n++;
    const uid = `00000000-0000-4000-8000-${String(8000 + n).padStart(12, "0")}`,
      sid = `00000000-0000-4000-8000-${String(9000 + n).padStart(12, "0")}`;
    await db.query("insert into auth.users values($1)", [uid]);
    await db.query("insert into auth.sessions(id,user_id) values($1,$2)", [
      sid,
      uid,
    ]);
    await db.query(
      "insert into public.profiles(id,username,full_name,contact_email) values($1,$2,$2,$3)",
      [uid, "role-" + role, "unit@example.org"],
    );
    await db.query(
      "insert into public.user_roles(user_id,role_code) values($1,$2)",
      [uid, role],
    );
    await db.query("select public.app_auth_claim($1,$2,false)", [uid, sid]);
    await db.query(
      "insert into sim_murid_private.auth_accounts(user_id,must_change_password,profile_completed_at,verified_contact_email) values($1,false,now(),'unit@example.org')",
      [uid],
    );
    await db.query(
      "insert into sim_murid_private.security_questions(user_id,question_code,answer_hash) values($1,'q1',repeat('0',64))",
      [uid],
    );
    await db.query(
      "insert into public.user_access_flags(user_id,teacher_email_verified_at) values($1,now())",
      [uid],
    );
    const own = await val("select public.app_session_list($1,$2)", [uid, sid]);
    assert.equal(own.username, "role-" + role);
    assert.equal(own.sessions[0].current, true);
    const foreign = await val("select public.app_session_list($1,$2,$3)", [
      uid,
      sid,
      "admin-6",
    ]);
    assert.equal(foreign !== null, role === "admin");
    const revoked = await val(
      "select public.app_session_revoke($1,$2,null,$3)",
      [uid, sid, own.sessions[0].id],
    );
    assert.equal(revoked.revoked, 1);
    assert.equal(revoked.signed_out, true);
    assert.equal(
      await val("select public.app_auth_principal($1,$2)", [uid, sid]),
      null,
    );
  }
});
