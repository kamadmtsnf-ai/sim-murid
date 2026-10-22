import { test, after } from "node:test";
import assert from "node:assert/strict";
import { randomUUID as uuid } from "node:crypto";
import { createIsolatedDatabase } from "../../scripts/database/harness.mjs";
const { db } = await createIsolatedDatabase();
after(() => db.close());
const val = async (q, p = []) =>
  Object.values((await db.query(q, p)).rows[0])[0];
const today = await val("select public.app_ops_today()::text");
const year = Number(today.slice(0, 4)),
  startYear = Number(today.slice(5, 7)) < 7 ? year - 1 : year;
const A = {};
for (const [name, role, task] of [
  ["admin", "admin"],
  ["duty", "teacher", "duty_teacher"],
  ["sub", "teacher"],
  ["mentor", "teacher", "student_mentor"],
  ["other", "teacher", "student_mentor"],
  ["head", "teacher", "school_head"],
  ["treasurer", "teacher", "committee_treasurer"],
  ["manager", "teacher", "savings_manager"],
  ["s1", "student"],
  ["s2", "student"],
  ["s3", "student"],
  ["parent", "parent"],
  ["stranger", "parent"],
  ["customer", "customer"],
]) {
  let id = uuid(),
    session = uuid();
  A[name] = { id, session };
  await db.query("insert into auth.users values($1)", [id]);
  await db.query("insert into auth.sessions(id,user_id) values($1,$2)", [
    session,
    id,
  ]);
  await db.query(
    "insert into public.profiles(id,username,full_name,contact_email) values($1,$2,$2,$3)",
    [id, name, name + "@example.org"],
  );
  await db.query(
    "insert into public.user_roles(user_id,role_code) values($1,$2)",
    [id, role],
  );
  await db.query(
    "insert into sim_murid_private.auth_accounts(user_id,must_change_password,profile_completed_at,verified_contact_email) values($1,false,now(),$2)",
    [id, name + "@example.org"],
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
  if (task)
    await db.query(
      "insert into public.user_assignments(user_id,assignment_code,valid_from) values($1,$2,public.app_ops_today()-1)",
      [id, task],
    );
  await db.query("select public.app_auth_claim($1,$2,false)", [id, session]);
}
const args = (a) => [a.id, a.session];
const rev = () =>
  val("select revision::int from sim_murid_private.operations_state");
const write = async (
  module,
  command,
  a = A.admin,
  revision = undefined,
  request = uuid(),
) =>
  val("select public.app_operations_write($1,$2,$3,$4,$5,$6::jsonb)", [
    ...args(a),
    request,
    revision ?? (await rev()),
    module,
    JSON.stringify(command),
  ]);
const read = (module, a = A.admin, filters = {}) =>
  val("select public.app_operations_read($1,$2,$3,$4::jsonb)", [
    ...args(a),
    module,
    JSON.stringify(filters),
  ]);
const y = uuid(),
  c = uuid(),
  c2 = uuid();
await db.query(
  "insert into public.academic_years(id,start_year,is_active) values($1,$2,true)",
  [y, startYear],
);
await db.query(
  "insert into public.classes(id,academic_year_id,level,name,homeroom_teacher_id) values($1,$2,7,'7A',$3),($4,$2,9,'9A',$5)",
  [c, y, A.mentor.id, c2, A.other.id],
);
for (const [name, cls] of [
  ["s1", c],
  ["s2", c2],
  ["s3", c2],
])
  await db.query(
    "insert into sim_murid_private.enrollments(student_id,class_id,academic_year_id,starts_on,created_by) values($1,$2,$3,$4,$5)",
    [A[name].id, cls, y, startYear + "-07-01", A.admin.id],
  );
await db.query(
  "insert into sim_murid_private.student_guardians(student_id,parent_id,relationship,verified_by) values($1,$2,'father',$3)",
  [A.s1.id, A.parent.id, A.admin.id],
);

const learn = async (
  module,
  command,
  a = A.admin,
  revision = undefined,
  request = uuid(),
) =>
  val("select public.app_learning_write($1,$2,$3,$4,$5,$6::jsonb)", [
    ...args(a),
    request,
    revision ?? (await rev()),
    module,
    JSON.stringify(command),
  ]);
const learning = (module, a = A.admin, filters = {}) =>
  val("select public.app_learning_read($1,$2,$3,$4::jsonb)", [
    ...args(a),
    module,
    JSON.stringify(filters),
  ]);
const subject = await val(
  "select id from public.subjects order by sort_order limit 1",
);
const otherSubject = await val(
  "select id from public.subjects order by sort_order offset 1 limit 1",
);
await db.query(
  "insert into sim_murid_private.lesson_schedules(class_id,subject_id,teacher_id,weekday,start_minute,duration_minutes,jtm,academic_year_id,created_by) values($1,$2,$3,1,480,40,1,$7,$4),($1,$5,$6,2,480,40,1,$7,$4)",
  [c, subject, A.sub.id, A.admin.id, otherSubject, A.other.id, y],
);
const sem = Number(today.slice(5, 7)) >= 7 ? 1 : 2;
let account, slip, assessment, book;
const gradeCmd = (kind, value) => ({
  type: "batch",
  id: null,
  classId: c,
  subjectId: subject,
  date: today,
  kind,
  items: [{ studentId: A.s1.id, value, notes: "" }],
});
const asset = (action, data, a = A.admin) =>
  val("select public.app_asset_write($1,$2,$3,$4::jsonb)", [
    ...args(a),
    action,
    JSON.stringify(data),
  ]);
test("21: overlap brackets, half-up thousand rounding and disabled fee", async () => {
  assert.equal(
    (
      await write("savings", {
        type: "bracket",
        id: null,
        minimum: 1000,
        maximum: null,
        percent: 1,
        active: true,
      })
    ).code,
    "saved",
  );
  assert.equal(
    (
      await write("savings", {
        type: "bracket",
        id: null,
        minimum: 10000,
        maximum: 20000,
        percent: 2,
        active: true,
      })
    ).code,
    "overlap",
  );
  let q = await val(
    "select public.app_fee_quote($1,$2,123000,true)",
    args(A.admin),
  );
  assert.equal(Number(q.fee), 1000);
  assert.equal(Number(q.cash), 122000);
  q = await val(
    "select public.app_fee_quote($1,$2,150000,true)",
    args(A.admin),
  );
  assert.equal(Number(q.fee), 2000);
  q = await val(
    "select public.app_fee_quote($1,$2,123000,false)",
    args(A.admin),
  );
  assert.equal(Number(q.fee), 0);
  assert.equal(
    await val("select public.app_fee_quote($1,$2,123000,true)", args(A.s1)),
    null,
  );
});
test("21: gross debit, immutable slip snapshot and verified recipient queue dedup", async () => {
  account = (
    await write("savings", { type: "account", ownerId: A.s1.id, category: "S" })
  ).id;
  const cmd = {
    type: "transaction",
    id: null,
    accountId: account,
    date: today,
    kind: "deposit",
    amount: 200000,
    reason: "Initial deposit",
  };
  assert.equal((await write("savings", cmd)).code, "saved");
  let w = await write("savings", {
    ...cmd,
    kind: "withdrawal",
    amount: 123000,
    feeApplied: true,
  });
  assert.equal(w.code, "saved");
  slip = await val(
    "select id from sim_murid_private.withdrawal_slips where transaction_id=$1",
    [w.id],
  );
  let r = await val("select public.app_slip_read($1,$2,$3)", [
    ...args(A.s1),
    slip,
  ]);
  assert.equal(Number(r.snapshot.fee.cash), 122000);
  assert.equal((await read("savings", A.s1)).summary.balance, 77000);
  assert.equal(
    await val("select public.app_slip_read($1,$2,$3)", [
      ...args(A.stranger),
      slip,
    ]),
    null,
  );
  await db.exec("update sim_murid_private.fee_brackets set percent=2");
  r = await val("select public.app_slip_read($1,$2,$3)", [...args(A.s1), slip]);
  assert.equal(Number(r.snapshot.fee.fee), 1000);
  await assert.rejects(
    db.query(
      "update sim_murid_private.withdrawal_slips set number='forged' where id=$1",
      [slip],
    ),
    (e) => e.message.toLowerCase().includes("immutable"),
  );
  const delivery = (act) =>
    val("select public.app_slip_delivery($1,$2,$3,$4)", [
      ...args(A.admin),
      slip,
      act,
    ]);
  await delivery("queue");
  let count = await val(
    "select count(*)::int from sim_murid_private.slip_deliveries",
  );
  assert.ok(count >= 1);
  await delivery("queue");
  assert.equal(
    await val("select count(*)::int from sim_murid_private.slip_deliveries"),
    count,
  );
  let claimed = await delivery("claim");
  assert.ok(claimed);
  assert.equal(
    await val(
      "select count(*)::int from sim_murid_private.slip_deliveries where status='sending'",
    ),
    1,
  );
});
test("22: schedule scope, batch atomic enrollment checks, zero differs from missing", async () => {
  assert.equal(
    (await learn("grades", gradeCmd("PH", 80), A.mentor)).code,
    "denied",
  );
  assert.equal(
    (
      await learn(
        "grades",
        {
          ...gradeCmd("PH", 80),
          items: [
            { studentId: A.s1.id, value: 80 },
            { studentId: A.s2.id, value: 90 },
          ],
        },
        A.sub,
      )
    ).code,
    "invalid",
  );
  assert.equal(
    await val("select count(*)::int from sim_murid_private.assessments"),
    0,
  );
  let r = await learn("grades", gradeCmd("PH", 0), A.sub);
  assert.equal(r.code, "saved");
  assessment = r.id;
  assert.equal(
    Number(
      await val(
        "select value from sim_murid_private.assessment_scores where assessment_id=$1",
        [assessment],
      ),
    ),
    0,
  );
  assert.equal(
    (await learn("grades", { ...gradeCmd("PH", null), id: assessment }, A.sub))
      .code,
    "saved",
  );
  assert.equal(
    await val(
      "select value from sim_murid_private.assessment_scores where assessment_id=$1",
      [assessment],
    ),
    null,
  );
  assert.equal(
    (await learn("grades", gradeCmd("PH", 101), A.sub)).code,
    "invalid",
  );
  assert.equal((await learning("grades", A.stranger)).rows.length, 0);
});
test("22: PH sequence never reused, ownership, KKM frozen on assessment, nonPH upsert", async () => {
  assert.equal(
    (
      await learn(
        "grades",
        { type: "void", id: assessment, reason: "Correction" },
        A.other,
      )
    ).code,
    "denied",
  );
  assert.equal(
    (
      await learn(
        "grades",
        { type: "void", id: assessment, reason: "Correction" },
        A.sub,
      )
    ).code,
    "saved",
  );
  assessment = (await learn("grades", gradeCmd("PH", 80), A.sub)).id;
  assert.equal(
    await val(
      "select ph_number from sim_murid_private.assessments where id=$1",
      [assessment],
    ),
    2,
  );
  assert.equal(
    (
      await learn(
        "grades",
        { type: "kkm", classId: c, subjectId: subject, date: today, value: 90 },
        A.sub,
      )
    ).code,
    "saved",
  );
  assert.equal(
    Number(
      await val(
        "select kkm_snapshot from sim_murid_private.assessments where id=$1",
        [assessment],
      ),
    ),
    75,
  );
  const ats = (await learn("grades", gradeCmd("ATS", 60), A.sub)).id;
  assert.ok(ats);
  assert.equal((await learn("grades", gradeCmd("ATS", 70), A.sub)).id, ats);
  await learn("grades", gradeCmd("ASAS", 90), A.sub);
  await learn("grades", gradeCmd("Praktik", 0), A.sub);
  assert.equal(
    await val(
      "select count(*)::int from sim_murid_private.assessments where kind='ATS' and voided_at is null",
    ),
    1,
  );
});
test("23: weighted report, practice separate, subject restriction and incomplete batch cannot publish", async () => {
  let d = await val("select public.app_report_draft($1,$2,$3,$4,$5)", [
    ...args(A.s1),
    A.s1.id,
    c,
    sem,
  ]);
  const s = d.subjects.find((x) => x.subject_id === subject);
  assert.equal(Number(s.final), 82);
  assert.equal(Number(s.practice), 0);
  assert.equal(s.complete, true);
  assert.ok(s.sources.length >= 4);
  const scoped = await val("select public.app_report_draft($1,$2,$3,$4,$5)", [
    ...args(A.sub),
    A.s1.id,
    c,
    sem,
  ]);
  assert.deepEqual(
    scoped.subjects.map((x) => x.subject_id),
    [subject],
  );
  assert.equal(
    (
      await learn(
        "reports",
        { type: "publish", classId: c, semester: sem, studentIds: [A.s1.id] },
        A.sub,
      )
    ).code,
    "denied",
  );
  assert.equal(
    (
      await learn("reports", {
        type: "publish",
        classId: c,
        semester: sem,
        studentIds: [A.s1.id],
      })
    ).code,
    "incomplete",
  );
  for (const [kind, value] of [
    ["PH", 100],
    ["ATS", 100],
    ["ASAS", 100],
  ])
    assert.equal(
      (
        await learn("grades", {
          ...gradeCmd(kind, value),
          subjectId: otherSubject,
        })
      ).code,
      "saved",
    );
  assert.equal(
    (
      await learn(
        "reports",
        { type: "publish", classId: c, semester: sem, studentIds: [A.s1.id] },
        A.mentor,
      )
    ).code,
    "saved",
  );
});
test("23: published archive immutable across score and KKM changes, per-subject published scope", async () => {
  const frozen = await val(
    "select snapshot from sim_murid_private.report_snapshots where student_id=$1",
    [A.s1.id],
  );
  await learn("grades", gradeCmd("ATS", 0), A.sub);
  assert.deepEqual(
    await val(
      "select snapshot from sim_murid_private.report_snapshots where student_id=$1",
      [A.s1.id],
    ),
    frozen,
  );
  assert.equal(
    (
      await learn("reports", {
        type: "publish",
        classId: c,
        semester: sem,
        studentIds: [A.s1.id],
      })
    ).code,
    "published",
  );
  await assert.rejects(
    db.exec("delete from sim_murid_private.report_snapshots"),
    (e) => e.message.toLowerCase().includes("immutable"),
  );
  const r = (await learning("reports", A.sub, { classId: c, semester: sem }))
    .rows[0];
  assert.deepEqual(
    r.published.snapshot.subjects.map((x) => x.subject_id),
    [subject],
  );
  assert.equal(
    await val("select public.app_report_draft($1,$2,$3,$4,$5)", [
      A.mentor.id,
      uuid(),
      A.s1.id,
      c,
      sem,
    ]),
    null,
  );
});
let nextYear, nextClass, next7;
test("24: promotion mapping validates whole batch before writes, history and duplicate protection", async () => {
  nextYear = uuid();
  nextClass = uuid();
  next7 = uuid();
  await db.query(
    "insert into public.academic_years(id,start_year) values($1,$2)",
    [nextYear, startYear + 1],
  );
  await db.query(
    "insert into public.classes(id,academic_year_id,level,name) values($1,$2,8,'8A'),($3,$2,7,'7A')",
    [nextClass, nextYear, next7],
  );
  const command = {
    type: "promote",
    sourceYearId: y,
    targetYearId: nextYear,
    reason: "Annual promotion",
    items: [
      { studentId: A.s1.id, classId: nextClass, expectedClassId: c },
      { studentId: A.s2.id, classId: next7, expectedClassId: c2 },
    ],
  };
  assert.equal((await learn("promotions", command)).code, "invalid");
  assert.equal(
    await val("select count(*)::int from sim_murid_private.promotion_history"),
    0,
  );
  command.items[1].classId = null;
  assert.equal((await learn("promotions", command)).code, "saved");
  assert.equal(
    await val("select role_code from public.user_roles where user_id=$1", [
      A.s2.id,
    ]),
    "alumni",
  );
  assert.equal((await learn("promotions", command)).code, "stale");
  assert.equal(
    await val("select count(*)::int from sim_murid_private.promotion_history"),
    2,
  );
  assert.equal((await read("savings", A.s1)).summary.balance, 77000);
  assert.equal(
    await val("select count(*)::int from sim_murid_private.report_snapshots"),
    1,
  );
});
test("24: new diploma default deny; individual override wins global, view/download independent", async () => {
  const allow = (download = false) =>
    val("select public.app_diploma_allowed($1,$2,$3,$4)", [
      ...args(A.s2),
      A.s2.id,
      download,
    ]);
  assert.equal(await allow(), false);
  await learn("promotions", {
    type: "access",
    scope: "global",
    view: true,
    download: true,
  });
  assert.equal(await allow(), false);
  await learn("promotions", {
    type: "access",
    scope: "individual",
    studentIds: [A.s2.id],
    view: "inherit",
    download: "deny",
  });
  assert.equal(await allow(), true);
  assert.equal(await allow(true), false);
  assert.equal(
    await val("select public.app_diploma_allowed($1,$2,$3,false)", [
      ...args(A.s1),
      A.s2.id,
    ]),
    false,
  );
  const list = await learning("promotions", A.s2);
  assert.equal(list.rows.length, 1);
  assert.equal(list.rows[0].canDownload, false);
});
test("24: diploma three slots, pending denied, replacement race protected and removed assets hidden", async () => {
  const ids = [];
  for (const slot of ["IJAZAH", "TRANSKRIP", "SKL"]) {
    const id = uuid();
    ids.push(id);
    assert.equal(
      (
        await asset("prepare", {
          id,
          kind: "diploma",
          targetId: A.s2.id,
          slot,
          mime: "application/pdf",
          size: 100,
          filename: slot + ".pdf",
        })
      ).code,
      "saved",
    );
    assert.equal(
      await val("select public.app_asset_get($1,$2,$3,false)", [
        ...args(A.s2),
        id,
      ]),
      null,
    );
    assert.equal(
      (await asset("ready", { id, sha256: "a".repeat(64) })).code,
      "saved",
    );
  }
  assert.equal(
    await val(
      "select count(*)::int from sim_murid_private.learning_assets where state='ready'",
    ),
    3,
  );
  assert.ok(
    await val("select public.app_asset_get($1,$2,$3,false)", [
      ...args(A.s2),
      ids[0],
    ]),
  );
  assert.equal(
    await val("select public.app_asset_get($1,$2,$3,true)", [
      ...args(A.s2),
      ids[0],
    ]),
    null,
  );
  const a = uuid(),
    b = uuid();
  for (const id of [a, b])
    await asset("prepare", {
      id,
      kind: "diploma",
      targetId: A.s2.id,
      slot: "IJAZAH",
      mime: "application/pdf",
      size: 100,
      filename: "replacement.pdf",
    });
  assert.equal(
    (await asset("ready", { id: a, sha256: "b".repeat(64) })).code,
    "saved",
  );
  assert.equal(
    (await asset("ready", { id: b, sha256: "c".repeat(64) })).code,
    "stale",
  );
  assert.equal(
    await val("select public.app_asset_get($1,$2,$3,false)", [
      ...args(A.s2),
      ids[0],
    ]),
    null,
  );
});
test("24: manual alumni restore keeps archive, revokes diploma access when no longer alumni", async () => {
  assert.equal(
    (
      await learn("promotions", {
        type: "place",
        sourceYearId: nextYear,
        targetYearId: nextYear,
        items: [
          { studentId: A.s2.id, classId: nextClass, expectedClassId: null },
        ],
        reason: "Restore enrollment",
      })
    ).code,
    "saved",
  );
  assert.equal(
    await val("select role_code from public.user_roles where user_id=$1", [
      A.s2.id,
    ]),
    "student",
  );
  assert.equal(
    await val("select public.app_diploma_allowed($1,$2,$3,false)", [
      ...args(A.s2),
      A.s2.id,
    ]),
    false,
  );
  assert.equal(
    await val("select count(*)::int from sim_murid_private.diplomas"),
    1,
  );
});
test("25: premium metadata and object scopes; HTTPS only, filter and page support", async () => {
  const cmd = {
    type: "book",
    id: null,
    title: "Buku Premium",
    author: "Guru",
    publisher: "Madrasah",
    year: 2026,
    version: "1",
    category: "Pelajaran",
    subjectId: subject,
    level: 7,
    url: "https://example.org/book.pdf",
    premium: true,
  };
  let r = await learn("books", cmd);
  assert.equal(r.code, "saved");
  book = r.id;
  assert.equal((await learning("books", A.s1)).rows.length, 0);
  assert.equal((await learn("books", cmd, A.s1)).code, "denied");
  await db.query(
    "insert into public.user_access_flags(user_id,premium_access) values($1,true) on conflict(user_id) do update set premium_access=true",
    [A.s1.id],
  );
  assert.equal(
    (await learning("books", A.s1, { query: "Premium", level: 7 })).rows.length,
    1,
  );
  assert.equal((await learning("books", A.s1, { page: 2 })).rows.length, 0);
  assert.equal(
    (await learn("books", { ...cmd, url: "http://example.org/unsafe" })).code,
    "invalid",
  );
  const id = uuid();
  await asset("prepare", {
    id,
    kind: "book",
    targetId: book,
    mime: "application/pdf",
    size: 100,
    filename: "book.pdf",
  });
  await asset("ready", { id, sha256: "a".repeat(64) });
  assert.ok(
    await val("select public.app_asset_get($1,$2,$3)", [...args(A.s1), id]),
  );
  assert.equal(
    await val("select public.app_asset_get($1,$2,$3)", [...args(A.s3), id]),
    null,
  );
  await learn("books", { type: "void", id: book, reason: "Archive book" });
  assert.equal(
    await val("select public.app_asset_get($1,$2,$3)", [...args(A.s1), id]),
    null,
  );
});
test("21–25: receipt replay once, stale data rejected, public tables/RPC denied and revoked sessions fail closed", async () => {
  let cmd = gradeCmd("ATS", 70),
    request = uuid(),
    version = await rev(),
    r = await learn("grades", cmd, A.sub, version, request);
  assert.equal(r.code, "saved");
  assert.deepEqual(await learn("grades", cmd, A.sub, version, request), r);
  assert.equal(
    (
      await learn(
        "grades",
        { ...cmd, items: [{ studentId: A.s1.id, value: 1 }] },
        A.sub,
        version,
        request,
      )
    ).code,
    "request_conflict",
  );
  assert.equal((await learn("grades", cmd, A.sub, version)).code, "stale");
  assert.equal(
    await val(
      "select count(*)::int from sim_murid_private.activity_logs where request_id=$1",
      [request],
    ),
    1,
  );
  for (const role of ["anon", "authenticated"]) {
    await db.exec("set role " + role);
    await assert.rejects(
      db.query("select public.app_learning_read($1,$2,'books')", args(A.admin)),
      (e) => e.code === "42501",
    );
    await assert.rejects(
      db.exec("select * from sim_murid_private.report_snapshots"),
      (e) => e.code === "42501",
    );
    await db.exec("reset role");
  }
  await db.query("select public.app_auth_revoke($1,$2)", args(A.sub));
  assert.equal(await learning("grades", A.sub), null);
  assert.equal(
    (await learn("grades", cmd, A.sub, await rev(), request)).code,
    "denied",
  );
});

test('Academic boundaries keep KKM in Ganjil/Genap of the selected class year and reject outside dates',async()=>{
 const academic=uuid(),cls=uuid();await db.query('insert into public.academic_years(id,start_year) values($1,2071)',[academic]);await db.query("insert into public.classes(id,academic_year_id,level,name) values($1,$2,7,'Boundary class')",[cls,academic]);
 for(const [date,semester,value] of [['2071-07-01',1,71],['2071-12-31',1,72],['2072-01-01',2,73],['2072-02-29',2,74],['2072-06-30',2,75]]){
  assert.equal((await learn('grades',{type:'kkm',classId:cls,subjectId:subject,date,value})).code,'saved');assert.equal(Number(await val('select value from sim_murid_private.minimum_grades where class_id=$1 and semester=$2',[cls,semester])),value);
 }
 for(const date of ['2071-06-30','2072-07-01'])assert.equal((await learn('grades',{type:'kkm',classId:cls,subjectId:subject,date,value:80})).code,'invalid');
});

test('Grades correction preserves omitted scores and KKM changes do not rewrite prior snapshots',async()=>{
 const make={type:'batch',id:null,classId:c2,subjectId:subject,date:today,kind:'PH',items:[{studentId:A.s2.id,value:0,notes:'Zero retained'},{studentId:A.s3.id,value:null,notes:'Unfilled retained'}]};
 const created=await learn('grades',make);assert.equal(created.code,'saved');
 const before=await val('select to_jsonb(a) from sim_murid_private.assessments a where id=$1',[created.id]);
 assert.equal((await learn('grades',{...make,id:created.id,reason:'Correct one student',items:[{studentId:A.s2.id,value:45.25,notes:'Corrected'}]})).code,'saved');
 const scores=await val('select jsonb_object_agg(student_id::text,jsonb_build_object(\'value\',value,\'notes\',notes)) from sim_murid_private.assessment_scores where assessment_id=$1',[created.id]);
 assert.equal(scores[A.s2.id].value,45.25);assert.equal(scores[A.s3.id].value,null);assert.equal(scores[A.s3.id].notes,'Unfilled retained');
 assert.equal((await learn('grades',{type:'kkm',classId:c2,subjectId:subject,date:today,value:100})).code,'saved');
 assert.equal(Number(await val('select kkm_snapshot from sim_murid_private.assessments where id=$1',[created.id])),Number(before.kkm_snapshot));
 const next=await learn('grades',make);assert.equal(next.code,'saved');assert.equal(Number(await val('select kkm_snapshot from sim_murid_private.assessments where id=$1',[next.id])),100);
 const frozen=await val('select snapshot from sim_murid_private.report_snapshots where student_id=$1',[A.s1.id]);
 assert.equal((await learn('grades',{type:'kkm',classId:c,subjectId:subject,date:today,value:100})).code,'saved');
 assert.deepEqual(await val('select snapshot from sim_murid_private.report_snapshots where student_id=$1',[A.s1.id]),frozen);
 const draftForStudent=()=>val('select public.app_report_draft($1,$2,$3,$4,$5)',[...args(A.admin),A.s1.id,c,sem]);
 assert.equal((await learn('grades',gradeCmd('Praktik',0))).code,'saved');
 const zero=(await draftForStudent()).subjects.find(s=>s.subject_id===subject);
 assert.equal(zero.practice,0);
 assert.equal((await learn('grades',gradeCmd('Praktik',100))).code,'saved');
 const hundred=(await draftForStudent()).subjects.find(s=>s.subject_id===subject);
 assert.equal(hundred.practice,100);assert.equal(hundred.final,zero.final);
 assert.deepEqual(await val('select snapshot from sim_murid_private.report_snapshots where student_id=$1',[A.s1.id]),frozen);

});
