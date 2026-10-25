import { test, after } from "node:test";
import assert from "node:assert/strict";
import { randomUUID as uuid } from "node:crypto";
import {
  createIsolatedDatabase,
  freezeSchoolDay,
} from "../../scripts/database/harness.mjs";
const { db } = await createIsolatedDatabase();
await freezeSchoolDay(db);
after(() => db.close());
const val = async (q, p = []) =>
  Object.values((await db.query(q, p)).rows[0])[0];
const today = await val("select public.app_ops_today()::text");
const year = Number(today.slice(0, 4)),
  startYear = Number(today.slice(5, 7)) < 7 ? year - 1 : year,
  month = today.slice(0, 7) + "-01";
const day = await val(
  "select extract(isodow from public.app_ops_today())::int",
);
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

const setTask = async (a, code, state = "active") => {
  await db.query(
    "delete from public.user_assignments where user_id=$1 and assignment_code=$2",
    [a.id, code],
  );
  await db.query(
    "insert into public.user_assignments(user_id,assignment_code,valid_from,valid_until,revoked_at) values($1,$2,(now() at time zone 'Asia/Jakarta')::date+$3::int,case when $4 then (now() at time zone 'Asia/Jakarta')::date-1 end,case when $5 then now() end)",
    [
      a.id,
      code,
      state === "future" ? 1 : -10,
      state === "expired",
      state === "revoked",
    ],
  );
};
const confirmed = (a) =>
  val("select public.app_duty_confirmed($1,public.app_ops_today())", [a.id]);
const access = async (a) => {
  await db.query("select set_config('request.jwt.claims',$1,false)", [
    JSON.stringify({ sub: a.id, session_id: a.session }),
  ]);
  await db.exec("set role authenticated");
  try {
    return await val("select public.app_access_context()");
  } finally {
    await db.exec("reset role");
  }
};
test("expired/revoked/future principal duty cannot be replaced, even with a leftover roster", async () => {
  await write("duty", {
    type: "roster",
    teacherId: A.duty.id,
    weekdays: [day],
  });
  for (const state of ["expired", "revoked", "future"]) {
    await setTask(A.duty, "duty_teacher", state);
    assert.equal(
      (
        await write("duty", {
          type: "appoint",
          teacherId: A.sub.id,
          replacesId: A.duty.id,
        })
      ).code,
      "invalid",
      state,
    );
    assert.equal(
      (await read("duty")).extra.roster.find((r) => r.teacher_id === A.duty.id)
        .active,
      false,
    );
  }
  await setTask(A.duty, "duty_teacher");
});
test("substitute confirm rechecks source task and roster; confirmed access stops when either disappears", async () => {
  const r = await write("duty", {
    type: "appoint",
    teacherId: A.sub.id,
    replacesId: A.duty.id,
  });
  assert.equal(r.code, "saved");
  await setTask(A.duty, "duty_teacher", "revoked");
  assert.equal(
    (
      await write("duty", {
        type: "confirm",
        id: r.id,
        reason: "Arrival verified",
      })
    ).code,
    "invalid",
  );
  await setTask(A.duty, "duty_teacher");
  assert.equal(
    (
      await write("duty", {
        type: "confirm",
        id: r.id,
        reason: "Arrival verified",
      })
    ).code,
    "saved",
  );
  assert.equal(await confirmed(A.sub), true);
  await db.query(
    "delete from sim_murid_private.teacher_duty_roster where teacher_id=$1",
    [A.duty.id],
  );
  assert.equal(await confirmed(A.sub), false);
  await write("duty", {
    type: "roster",
    teacherId: A.duty.id,
    weekdays: [day],
  });
  await setTask(A.duty, "duty_teacher", "expired");
  assert.equal(await confirmed(A.sub), false);
  await setTask(A.duty, "duty_teacher");
  await write("duty", { type: "cancel", id: r.id, reason: "Duty ended" });
});
test("cancelled substitute cannot be resurrected with unconfirm; pending primary actions reject invalid transitions", async () => {
  const r = await write("duty", {
    type: "appoint",
    teacherId: A.sub.id,
    replacesId: A.duty.id,
  });
  assert.equal(r.code, "saved");
  await write("duty", {
    type: "cancel",
    id: r.id,
    reason: "Cancelled appointment",
  });
  const version = await rev();
  assert.equal(
    (
      await write("duty", {
        type: "unconfirm",
        id: r.id,
        reason: "Forged state transition",
      })
    ).code,
    "invalid",
  );
  assert.equal(
    (
      await write("duty", {
        type: "confirm",
        id: r.id,
        reason: "Forged state transition",
      })
    ).code,
    "invalid",
  );
  assert.equal(await rev(), version);
});
test("empty roster and empty mentoring links clean up expired tasks without granting the task again", async () => {
  await setTask(A.duty, "duty_teacher", "expired");
  assert.equal(
    (
      await write("duty", {
        type: "roster",
        teacherId: A.duty.id,
        weekdays: [],
        assignTask: true,
      })
    ).code,
    "saved",
  );
  assert.equal(
    await val("select public.app_education_task($1,'duty_teacher')", [
      A.duty.id,
    ]),
    false,
  );
  await write("mentoring", {
    type: "assign",
    teacherId: A.mentor.id,
    studentIds: [A.s1.id],
  });
  await setTask(A.mentor, "student_mentor", "expired");
  assert.equal(
    (
      await write("mentoring", {
        type: "assign",
        teacherId: A.mentor.id,
        studentIds: [],
        assignTask: true,
      })
    ).code,
    "saved",
  );
  assert.equal(
    await val("select public.app_education_task($1,'student_mentor')", [
      A.mentor.id,
    ]),
    false,
  );
  assert.equal(
    await val(
      "select count(*)::int from sim_murid_private.mentor_students where teacher_id=$1 and revoked_at is null",
      [A.mentor.id],
    ),
    0,
  );
});
test("homeroom reads fees only for own current class, never receives finance write permission", async () => {
  const result = await write("fees", {
    type: "payment",
    id: null,
    studentId: A.s1.id,
    date: today,
    allocations: [{ month, amount: 20000 }],
    notes: "",
  });
  assert.equal(result.code, "saved");
  await write("fees", {
    type: "payment",
    id: null,
    studentId: A.s2.id,
    date: today,
    allocations: [{ month, amount: 30000 }],
    notes: "",
  });
  const own = await read("fees", A.mentor);
  assert.deepEqual(
    own.people.map((p) => p.id),
    [A.s1.id],
  );
  assert.equal(own.rows.length, 1);
  assert.equal(own.summary.cashReceived, 20000);
  assert.equal(own.canManage, false);
  assert.equal(
    (await read("fees", A.mentor, { studentId: A.s2.id })).rows.length,
    0,
  );
  assert.equal(
    (
      await write(
        "fees",
        { type: "tariff", classId: c, month, amount: 20000 },
        A.mentor,
      )
    ).code,
    "denied",
  );
  assert.ok(
    (await access(A.mentor)).grants.some(
      (g) => g.capability === "fees.read" && g.class_id === c,
    ),
  );
});
test("stale homeroom reference does not give a former teacher class attendance or fees", async () => {
  await write("attendance", {
    type: "batch",
    items: [
      {
        studentId: A.s1.id,
        classId: c,
        date: today,
        status: "Hadir",
        notes: "",
      },
    ],
  });
  await db.query(
    "update public.user_roles set role_code='student' where user_id=$1",
    [A.mentor.id],
  );
  assert.equal((await read("attendance", A.mentor)).rows.length, 0);
  assert.equal(
    await val("select public.app_report_draft($1,$2,$3,$4,1)", [
      ...args(A.mentor),
      A.s1.id,
      c,
    ]),
    null,
  );
  const learning = await val(
    "select public.app_learning_read($1,$2,'reports',$3::jsonb)",
    [...args(A.mentor), JSON.stringify({ classId: c, semester: 1 })],
  );
  assert.ok(
    learning === null ||
      (learning.classes.length === 0 && learning.rows.length === 0),
  );
  const publish = await val(
    "select public.app_learning_write($1,$2,$3,$4,'reports',$5::jsonb)",
    [
      ...args(A.mentor),
      uuid(),
      await rev(),
      JSON.stringify({
        type: "publish",
        classId: c,
        semester: 1,
        studentIds: [A.s1.id],
      }),
    ],
  );
  assert.equal(publish.code, "denied");
  assert.equal((await read("fees", A.mentor)).rows.length, 0);
  await db.query(
    "update public.user_roles set role_code='teacher' where user_id=$1",
    [A.mentor.id],
  );
});
test("all additional tasks honour date/revoke/session and combine without granting admin", async () => {
  for (const [a, code, module] of [
    [A.head, "school_head", "fees"],
    [A.treasurer, "committee_treasurer", "fees"],
    [A.manager, "savings_manager", "savings"],
    [A.other, "student_mentor", "mentoring"],
  ]) {
    for (const state of ["active", "future", "expired", "revoked"]) {
      await setTask(a, code, state);
      assert.equal(
        await val("select public.app_education_task($1,$2)", [a.id, code]),
        state === "active",
        code + state,
      );
      const r = await read(module, a);
      assert.equal(r.canManage, state === "active" && code !== "school_head");
      assert.equal(
        await val("select public.app_education_admin($1,$2)", args(a)),
        false,
      );
    }
  }
  await setTask(A.head, "school_head");
  await setTask(A.head, "committee_treasurer");
  assert.equal((await read("fees", A.head)).canManage, true);
  assert.equal((await read("savings", A.head)).canManage, false);
  await setTask(A.other, "counselor");
  const context = await access(A.other);
  assert.ok(context.assignments.some((a) => a.code === "counselor"));
  assert.ok(context.grants.some((g) => g.capability === "discipline.read"));
  assert.equal(
    await val("select public.app_point_access($1,$2,$3,false)", [
      ...args(A.head),
      A.s1.id,
    ]),
    true,
  );
  assert.equal(
    await val("select public.app_ops_manager($1,$2,'committee_treasurer')", [
      A.head.id,
      uuid(),
    ]),
    false,
  );
  for (const role of ["anon", "authenticated"])
    assert.equal(
      await val(
        "select has_function_privilege($1,'public.app_duty_mutate(uuid,uuid,jsonb)','execute')",
        [role],
      ),
      false,
    );
});

test("implicit duty/mentor grants end before an already scheduled future assignment", async () => {
  for (const [a, code, module, command] of [
    [
      A.duty,
      "duty_teacher",
      "duty",
      {
        type: "roster",
        teacherId: A.duty.id,
        weekdays: [day],
        assignTask: true,
      },
    ],
    [
      A.mentor,
      "student_mentor",
      "mentoring",
      {
        type: "assign",
        teacherId: A.mentor.id,
        studentIds: [A.s1.id],
        assignTask: true,
      },
    ],
  ]) {
    await setTask(a, code, "future");
    assert.equal((await write(module, command)).code, "saved");
    const rows = (
      await db.query(
        "select valid_from::text,valid_until::text from public.user_assignments where user_id=$1 and assignment_code=$2 and revoked_at is null order by valid_from",
        [a.id, code],
      )
    ).rows;
    assert.equal(rows.length, 2);
    assert.ok(rows[0].valid_until < rows[1].valid_from);
    assert.equal(
      await val("select public.app_education_task($1,$2)", [a.id, code]),
      true,
    );
  }
});

test("new scope predicates remain invoker-only and inaccessible to browser roles",async()=>{
 for(const fn of ['sim_murid_private.duty_eligible(uuid,date)','sim_murid_private.homeroom_access(uuid,uuid)','sim_murid_private.homeroom_fee_access(uuid,uuid,uuid)']){
  for(const role of ['anon','authenticated'])assert.equal(await val("select has_function_privilege($1,$2,'execute')",[role,fn]),false);
  assert.equal(await val("select has_function_privilege('service_role',$1,'execute')",[fn]),true);
  assert.equal(await val('select prosecdef from pg_proc where oid=$1::regprocedure',[fn]),false);
 }
});

test("explicit homeroom task scopes fees to its class and revocation takes effect immediately", async () => {
  const task = uuid();
  await db.query(
    "insert into public.user_assignments(id,user_id,assignment_code,scope_class_id,valid_from) values($1,$2,'homeroom_teacher',$3,(now() at time zone 'Asia/Jakarta')::date)",
    [task, A.sub.id, c],
  );
  assert.deepEqual(
    (await read("fees", A.sub)).people.map((p) => p.id),
    [A.s1.id],
  );
  assert.equal((await read("fees", A.sub, { classId: c2 })).rows.length, 0);
  await db.query(
    "update public.user_assignments set revoked_at=now() where id=$1",
    [task],
  );
  assert.equal((await read("fees", A.sub)).rows.length, 0);
});

test("discipline notifications exclude stale homeroom/BK roles and inactive counselors", async () => {
  await setTask(A.other, "counselor");
  await setTask(A.duty, "counselor");
  await setTask(A.manager, "counselor");
  await db.query(
    "update public.user_roles set role_code='student' where user_id=any($1::uuid[])",
    [[A.other.id, A.mentor.id]],
  );
  await db.query("update public.profiles set status='inactive' where id=$1", [
    A.manager.id,
  ]);
  const event = uuid();
  await db.query(
    "insert into sim_murid_private.point_events(id,student_id,class_id,event_date,code,catalog_snapshot,base_points,notes,created_by) select $1,$2,$3,public.app_ops_today(),code,to_jsonb(p),points,'Test',$4 from sim_murid_private.point_catalog p where points<0 limit 1",
    [event, A.s1.id, c, A.admin.id],
  );
  await db.exec(
    "update sim_murid_private.service_settings set point_threshold=0",
  );
  await db.query("select public.app_point_notify($1,$2,$3)", [
    A.s1.id,
    month,
    event,
  ]);
  const recipients = (
    await db.query(
      "select recipient_id from sim_murid_private.inbox where entity_id=$1",
      [event],
    )
  ).rows.map((r) => r.recipient_id);
  assert.ok(recipients.includes(A.duty.id));
  assert.ok(recipients.includes(A.s1.id));
  assert.ok(recipients.includes(A.parent.id));
  for (const a of [A.other, A.mentor, A.manager])
    assert.ok(!recipients.includes(a.id));
});
