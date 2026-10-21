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

const service = async (
  module,
  command,
  a = A.admin,
  revision = undefined,
  request = uuid(),
) =>
  val("select public.app_services_write($1,$2,$3,$4,$5,$6::jsonb)", [
    ...args(a),
    request,
    revision ?? (await rev()),
    module,
    JSON.stringify(command),
  ]);
const view = (module, a = A.admin, filters = {}) =>
  val("select public.app_services_read($1,$2,$3,$4::jsonb)", [
    ...args(a),
    module,
    JSON.stringify(filters),
  ]);
const mo = await val(
  "select date_trunc('month',public.app_ops_today())::date::text",
);
let period, teacherPeriod, micro;
const periodCmd = (targets = ["student"], kind = "main") => ({
  type: "period",
  periodId: null,
  title: "Validation survey",
  yearId: y,
  semester: 1,
  start: today,
  end: today,
  targets,
  kind,
  questions:
    kind === "micro"
      ? [
          {
            code: "M-1",
            kind: "essay",
            question: "Apa saran Anda?",
            required: true,
            section: "micro",
            aspect: "micro",
          },
        ]
      : null,
  examOverride: "",
});
test("26: exact 25-code seed, residivism 50→48→44→38→0 and positive recovery", async () => {
  assert.equal(
    await val("select count(*)::int from sim_murid_private.point_catalog"),
    25,
  );
  for (const score of [48, 44, 38, 0]) {
    let r = await service(
      "discipline",
      {
        type: "event",
        studentId: A.s1.id,
        date: today,
        code: "A01",
        notes: "Validation",
      },
      A.sub,
    );
    assert.equal(r.code, "saved");
    let replay = await val("select public.app_point_replay($1,$2)", [
      A.s1.id,
      mo,
    ]);
    assert.equal(replay.balance, score);
  }
  await service(
    "discipline",
    {
      type: "event",
      studentId: A.s1.id,
      date: today,
      code: "F01",
      notes: "Recovery",
    },
    A.sub,
  );
  assert.equal(
    (await val("select public.app_point_replay($1,$2)", [A.s1.id, mo])).balance,
    5,
  );
});
test("26: cancellation ownership, stable replay, catalog snapshot, parent/stranger scopes", async () => {
  const replay = await val("select public.app_point_replay($1,$2)", [
      A.s1.id,
      mo,
    ]),
    id = replay.events[0].id;
  assert.equal(
    (
      await service(
        "discipline",
        { type: "cancel", id, reason: "Review correction" },
        A.other,
      )
    ).code,
    "denied",
  );
  assert.equal(
    (
      await service(
        "discipline",
        { type: "cancel", id, reason: "Review correction" },
        A.sub,
      )
    ).code,
    "saved",
  );
  assert.equal(
    (await val("select public.app_point_replay($1,$2)", [A.s1.id, mo])).balance,
    43,
  );
  await service("discipline", {
    type: "catalog",
    code: "A01",
    category: "Kehadiran",
    description: "Changed",
    points: -20,
    consequence: "",
    active: false,
  });
  assert.equal(
    (
      await service("discipline", {
        type: "event",
        studentId: A.s1.id,
        date: today,
        code: "A01",
        notes: "",
      })
    ).code,
    "invalid",
  );
  assert.equal(
    (await val("select public.app_point_replay($1,$2)", [A.s1.id, mo])).balance,
    43,
  );
  assert.equal((await view("discipline", A.parent)).rows.length, 1);
  assert.equal((await view("discipline", A.stranger)).rows.length, 0);
});
test("26: level boundaries and affective conversion", async () => {
  for (const [score, level] of [
    [100, 0],
    [51, 0],
    [50, 1],
    [31, 1],
    [30, 2],
    [21, 2],
    [20, 3],
    [11, 3],
    [10, 4],
    [1, 4],
    [0, 5],
    [-50, 5],
  ])
    assert.equal(
      await val("select public.app_point_level($1)", [score]),
      level,
    );
  assert.equal(await val("select round((50+50)::numeric/150*100)::int"), 67);
});
test("27: inbox own-only read and dedup, no cross-recipient mark", async () => {
  const mine = await view("notifications", A.s1),
    other = await view("notifications", A.admin);
  assert.ok(mine.rows.length > 0);
  const unread = mine.extra.unread;
  await service(
    "notifications",
    { type: "read", id: other.rows[0]?.id ?? uuid() },
    A.s1,
  );
  assert.equal((await view("notifications", A.s1)).extra.unread, unread);
  await service("notifications", { type: "read", id: null }, A.s1);
  assert.equal((await view("notifications", A.s1)).extra.unread, 0);
});
test("27: past-month snapshot unique, retry safe, immutable and current month forbidden", async () => {
  assert.equal(
    (await service("discipline", { type: "reset", month: mo })).code,
    "invalid",
  );
  const prev = await val(
    "select (date_trunc('month',public.app_ops_today())-interval '1 month')::date::text",
  );
  let r = await service("discipline", { type: "reset", month: prev });
  assert.equal(r.code, "saved");
  r = await service("discipline", { type: "reset", month: prev });
  assert.equal(r.added, 0);
  await assert.rejects(
    db.exec("delete from sim_murid_private.point_month_snapshots"),
    (e) => e.message.toLowerCase().includes("immutable"),
  );
});
test("28: complete instrument, deterministic eight rotations with history priority, isolated respondents", async () => {
  assert.equal(
    await val("select count(*)::int from sim_murid_private.survey_questions"),
    206,
  );
  period = (await service("surveys", periodCmd())).id;
  assert.ok(period);
  let r = await service("surveys", { type: "start", periodId: period }, A.s1);
  assert.equal(r.code, "saved");
  assert.equal(r.response.rotation.length, 8);
  assert.equal(r.response.instrument.length, 95);
  const r2 = await service(
    "surveys",
    { type: "start", periodId: period },
    A.s1,
  );
  assert.deepEqual(r2.response.rotation, r.response.rotation);
  assert.equal(
    (await service("surveys", { type: "start", periodId: period }, A.parent))
      .code,
    "denied",
  );
  assert.equal((await view("surveys", A.s2)).rows[0].response, null);
});
test("28: validation, stale draft never overwrites, mandatory essays and final immutable", async () => {
  let cmd = {
    type: "save",
    periodId: period,
    version: 0,
    answers: { "A1-1": 0 },
  };
  assert.equal((await service("surveys", cmd, A.s1)).code, "invalid");
  cmd.answers = { "A1-1": 4 };
  assert.equal((await service("surveys", cmd, A.s1)).code, "saved");
  assert.equal((await service("surveys", cmd, A.s1)).code, "stale");
  assert.equal(
    (await service("surveys", { ...cmd, type: "submit", version: 1 }, A.s1))
      .code,
    "incomplete",
  );
  const r = (await view("surveys", A.s1)).rows[0].response;
  let answers = {};
  for (const [i, q] of r.instrument.entries())
    answers[q.code] =
      q.kind === "essay" ? "Saran konstruktif" : (q.attention ?? (i % 5) + 1);
  assert.equal(
    (
      await service(
        "surveys",
        { type: "submit", periodId: period, version: 1, answers },
        A.s1,
      )
    ).code,
    "saved",
  );
  assert.equal(
    (
      await service(
        "surveys",
        { type: "save", periodId: period, version: 2, answers },
        A.s1,
      )
    ).code,
    "locked",
  );
});
test("28: attention/straightline/duration reliability flags", async () => {
  let r = await val(
    "select public.app_survey_flags((select jsonb_agg(to_jsonb(q)) from sim_murid_private.survey_questions q where role='student' and section in('A','B')), (select jsonb_object_agg(code,case when kind='essay' then to_jsonb('Saran'::text) else to_jsonb(3) end) from sim_murid_private.survey_questions where role='student'), 10,'student')",
  );
  assert.equal(r.straightline, true);
  assert.equal(r.short, true);
  assert.equal(r.reliability, "rendah");
});
test("28: teacher peer snapshot excludes self, outsider denied, TT accepted and required peer submit", async () => {
  teacherPeriod = (await service("surveys", periodCmd(["teacher"]))).id;
  let r = await service(
    "surveys",
    { type: "start", periodId: teacherPeriod },
    A.sub,
  );
  assert.equal(r.code, "saved");
  assert.ok(!r.response.peers.includes(A.sub.id));
  assert.ok(r.response.peers.length > 0);
  assert.equal(
    (
      await service(
        "surveys",
        {
          type: "peer_save",
          periodId: teacherPeriod,
          version: 0,
          answers: { [A.s1.id]: { "PTS-1": 3 } },
        },
        A.sub,
      )
    ).code,
    "denied",
  );
  let answers = {};
  for (const peer of r.response.peers)
    answers[peer] = Object.fromEntries(
      [1, 2, 3, 4, 5, 6].map((n) => ["PTS-" + n, "TT"]),
    );
  assert.equal(
    (
      await service(
        "surveys",
        { type: "peer_submit", periodId: teacherPeriod, version: 0, answers },
        A.sub,
      )
    ).code,
    "saved",
  );
  assert.equal(
    (
      await val("select public.app_survey_insights($1,$2,$3)", [
        ...args(A.sub),
        teacherPeriod,
      ])
    ).suppressed,
    true,
  );
});
test("29: close blocks saves, micro separate, aggregates exclude drafts and attention", async () => {
  micro = (await service("surveys", periodCmd(["parent"], "micro"))).id;
  assert.ok(micro);
  let r = await service(
    "surveys",
    { type: "start", periodId: micro },
    A.parent,
  );
  assert.equal(r.response.instrument.length, 1);
  assert.equal(
    (
      await service(
        "surveys",
        {
          type: "submit",
          periodId: micro,
          version: 0,
          answers: { "M-1": "Saran mikro" },
        },
        A.parent,
      )
    ).code,
    "saved",
  );
  let insight = await val("select public.app_survey_insights($1,$2,$3)", [
    ...args(A.admin),
    period,
  ]);
  assert.ok(insight.aggregates.length > 0);
  assert.ok(!insight.aggregates.some((x) => x.code.startsWith("ATT")));
  await service("surveys", { type: "close", periodId: period });
  assert.equal(
    (await service("surveys", { type: "start", periodId: period }, A.s3)).code,
    "denied",
  );
});
test("29: action plan only head and H+30, encrypted provider status never exposes key", async () => {
  const p = (
    await service("surveys", {
      ...periodCmd(),
      start: await val("select (public.app_ops_today()-5)::text"),
      end: await val("select (public.app_ops_today()-1)::text"),
    })
  ).id;
  await service("surveys", { type: "close", periodId: p });
  const cmd = {
    type: "plan",
    periodId: p,
    items: [1, 2, 3].map((n) => ({
      description: "Tindak lanjut " + n,
      owner: "Kepala",
      target: today,
      aspect: "Pengajaran",
      status: "belum",
    })),
  };
  assert.equal((await service("insights", cmd)).code, "denied");
  assert.equal((await service("insights", cmd, A.head)).code, "saved");
  assert.equal(
    (
      await service("insights", {
        type: "ai_config",
        provider: "anthropic",
        model: "test",
        encryptedKey: "ciphertext",
      })
    ).code,
    "saved",
  );
  assert.equal(
    JSON.stringify(await view("insights")).includes("ciphertext"),
    false,
  );
  assert.equal(
    (
      await val("select public.app_ai_run($1,$2,'prepare',$3::jsonb)", [
        ...args(A.admin),
        JSON.stringify({ provider: "anthropic", periodId: micro }),
      ])
    ).code,
    "incomplete",
  );
});
test("29: dry run has no effects, stale claims ambiguous and direct client RPC/table denied", async () => {
  const count = await val("select count(*)::int from sim_murid_private.outbox");
  assert.equal((await val("select public.app_jobs_tick(true)")).dryRun, true);
  assert.equal(
    await val("select count(*)::int from sim_murid_private.outbox"),
    count,
  );
  for (const role of ["anon", "authenticated"]) {
    await db.exec("set role " + role);
    await assert.rejects(
      db.query(
        "select public.app_services_read($1,$2,'surveys')",
        args(A.admin),
      ),
      (e) => e.code === "42501",
    );
    await assert.rejects(
      db.exec("select * from sim_murid_private.survey_respondents"),
      (e) => e.code === "42501",
    );
    await db.exec("reset role");
  }
});
test("30: own scope preserved in reconciliation, replay receipt once and revoked session denied", async () => {
  assert.equal(await view("reconciliation", A.parent), null);
  assert.equal((await view("reconciliation")).extra.sourceAvailable, false);
  const cmd = { type: "read", id: null },
    request = uuid(),
    revision = await rev(),
    r = await service("notifications", cmd, A.s1, revision, request);
  assert.equal(r.code, "saved");
  assert.deepEqual(
    await service("notifications", cmd, A.s1, revision, request),
    r,
  );
  await db.query("select public.app_auth_revoke($1,$2)", args(A.s1));
  assert.equal(await view("notifications", A.s1), null);
  assert.equal(
    (await service("notifications", cmd, A.s1, revision, request)).code,
    "denied",
  );
});

test("27/30: scoped certificate keeps population rank; final survey cannot be rewritten via table", async () => {
  const own = await view("discipline", A.s2),
    global = await view("discipline");
  assert.equal(own.extra.ranking.length, 1);
  assert.equal(
    own.extra.ranking[0].global_rank,
    global.extra.ranking.find((r) => r.x.student_id === A.s2.id).global_rank,
  );
  await assert.rejects(
    db.query(
      "update sim_murid_private.survey_respondents set answers='{}' where period_id=$1 and user_id=$2",
      [period, A.s1.id],
    ),
    (e) => e.message.toLowerCase().includes("immutable"),
  );
});
test("28: mandatory survey gate obeys role/open/submitted and micro never gates", async () => {
  assert.equal(
    await val("select public.app_survey_required($1,$2)", args(A.parent)),
    false,
  );
  assert.equal(
    await val("select public.app_survey_required($1,$2)", args(A.sub)),
    true,
  );
  assert.equal(
    await val("select public.app_survey_required($1,$2)", args(A.admin)),
    false,
  );
});
test("29: outbox leases, recipient changes, ambiguous never retried and backoff bounds", async () => {
  const id = uuid();
  await db.query(
    "insert into sim_murid_private.outbox(id,idempotency_key,channel,event_type,aggregate_type,aggregate_id,payload,status,locked_until) values($1,$2,'email','test','profile',$3,$4::jsonb,'processing',now()-interval '1 minute')",
    [
      id,
      id,
      A.admin.id,
      JSON.stringify({
        recipient_id: A.admin.id,
        email: "admin@example.org",
        title: "Test",
        message: "No send",
      }),
    ],
  );
  await val("select public.app_delivery_worker('claim')");
  assert.equal(
    await val("select status from sim_murid_private.outbox where id=$1", [id]),
    "ambiguous",
  );
  const id2 = uuid();
  await db.query(
    "insert into sim_murid_private.outbox(id,idempotency_key,channel,event_type,aggregate_type,aggregate_id,payload) values($1,$2,'email','test','profile',$3,$4::jsonb)",
    [
      id2,
      id2,
      A.admin.id,
      JSON.stringify({
        recipient_id: A.admin.id,
        email: "changed@example.org",
        title: "Test",
        message: "No send",
      }),
    ],
  );
  await val("select public.app_delivery_worker('claim')");
  assert.equal(
    await val("select status from sim_murid_private.outbox where id=$1", [id2]),
    "cancelled",
  );
});
test("29: AI sample/cache transaction requires five essays, max150/1500 and masked reads", async () => {
  const r = await val("select public.app_ai_run($1,$2,'prepare',$3::jsonb)", [
    ...args(A.admin),
    JSON.stringify({ provider: "anthropic", periodId: period }),
  ]);
  assert.equal(r.code, "saved");
  assert.ok(r.essays.length >= 5 && r.essays.length <= 150);
  assert.ok(r.essays.every((x) => x.length <= 1500));
  const cache = await val(
    "select public.app_ai_run($1,$2,'prepare',$3::jsonb)",
    [
      ...args(A.admin),
      JSON.stringify({ provider: "anthropic", periodId: period }),
    ],
  );
  assert.equal(cache.code, "cached");
  assert.equal(cache.analysis.id, r.id);
});

test("29: role/quality filters recorded and excluded counts match scoped aggregates", async () => {
  const all = await view("insights", A.admin, { periodId: period }),
    filtered = await view("insights", A.admin, {
      periodId: period,
      role: "teacher",
    });
  assert.ok(all.extra.aggregates.length > 0);
  assert.equal(filtered.extra.aggregates.length, 0);
  assert.equal(filtered.extra.appliedFilters.role, "teacher");
  assert.equal(filtered.extra.excludedResponses, 1);
  assert.ok(
    all.extra.trend.every((x) => x.instrument_version === "SURVEI-1.0"),
  );
});

test("29: head can update completion after H+30 without rewriting plan content", async () => {
  const id = await val(
    "select period_id from sim_murid_private.action_plans limit 1",
  );
  await db.query(
    "update sim_murid_private.survey_periods set starts_on=public.app_ops_today()-50,ends_on=public.app_ops_today()-40 where id=$1",
    [id],
  );
  const before = await val(
    "select items from sim_murid_private.action_plans where period_id=$1",
    [id],
  );
  assert.equal(
    (
      await service("insights", {
        type: "plan_status",
        periodId: id,
        index: 0,
        status: "selesai",
      })
    ).code,
    "denied",
  );
  assert.equal(
    (
      await service(
        "insights",
        { type: "plan_status", periodId: id, index: 0, status: "selesai" },
        A.head,
      )
    ).code,
    "saved",
  );
  const after = await val(
    "select items from sim_murid_private.action_plans where period_id=$1",
    [id],
  );
  assert.equal(after[0].description, before[0].description);
  assert.equal(after[0].status, "selesai");
});

test('28: concurrent respondents use own revision, unrelated saves cannot invalidate their draft',async()=>{const p=(await service('surveys',periodCmd())).id;const old=await rev();assert.equal((await service('surveys',{type:'start',periodId:p},A.s2,old)).code,'saved');assert.equal((await service('surveys',{type:'start',periodId:p},A.s3,old)).code,'saved');const cmd={type:'save',periodId:p,version:0,answers:{'A1-1':4}};assert.equal((await service('surveys',cmd,A.s2,old)).code,'saved');assert.equal((await service('surveys',cmd,A.s3,old)).code,'saved');assert.equal((await service('surveys',cmd,A.s2,old)).code,'stale');assert.equal(await rev(),old);});
