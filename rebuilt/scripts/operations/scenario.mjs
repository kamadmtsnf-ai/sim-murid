import { randomUUID } from "node:crypto";
import {
  createIsolatedDatabase,
  freezeSchoolDay,
} from "../database/harness.mjs";
export async function createScenario() {
  const { db, migrations } = await createIsolatedDatabase();
  await freezeSchoolDay(db);
  const val = async (sql, args = []) =>
      Object.values((await db.query(sql, args)).rows[0])[0],
    users = {};
  for (const [name, role] of [
    ["admin", "admin"],
    ["teacher", "teacher"],
    ["head", "teacher"],
    ["student", "student"],
    ["sibling", "student"],
    ["foreign", "student"],
    ["parent", "parent"],
    ["alumni", "alumni"],
    ["customer", "customer"],
    ["applicant", "applicant"],
  ]) {
    const id = randomUUID(),
      session = randomUUID();
    users[name] = { id, session, role };
    await db.query("insert into auth.users values($1)", [id]);
    await db.query("insert into auth.sessions(id,user_id) values($1,$2)", [
      session,
      id,
    ]);
    await db.query(
      "insert into public.profiles(id,username,full_name,contact_email) values($1,$2,$2,$3)",
      [id, "P10_" + name, "fixture@example.test"],
    );
    await db.query(
      "insert into public.user_roles(user_id,role_code) values($1,$2)",
      [id, role],
    );
    await db.query(
      "insert into sim_murid_private.auth_accounts(user_id,must_change_password,profile_completed_at,verified_contact_email) values($1,false,now(),'fixture@example.test')",
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
  const year = randomUUID(),
    cls = randomUUID(),
    foreignClass = randomUUID();
  await db.query(
    "insert into public.academic_years(id,start_year,is_active) values($1,2026,true)",
    [year],
  );
  await db.query(
    "insert into public.classes(id,academic_year_id,level,name,homeroom_teacher_id) values($1,$2,7,'P10-A',$3),($4,$2,8,'P10-B',$5)",
    [cls, year, users.teacher.id, foreignClass, users.head.id],
  );
  for (const name of ["student", "sibling", "foreign"])
    await db.query(
      "insert into sim_murid_private.enrollments(student_id,class_id,academic_year_id,starts_on,created_by) values($1,$2,$3,'2026-07-01',$4)",
      [
        users[name].id,
        name === "foreign" ? foreignClass : cls,
        year,
        users.admin.id,
      ],
    );
  for (const name of ["student", "sibling"])
    await db.query(
      "insert into sim_murid_private.student_guardians(student_id,parent_id,relationship,verified_by) values($1,$2,'father',$3)",
      [users[name].id, users.parent.id, users.admin.id],
    );
  await db.query(
    "insert into public.user_assignments(user_id,assignment_code,valid_from) values($1,'school_head','2026-07-01')",
    [users.head.id],
  );
  const subject = await val("select id from public.subjects where code='IPS'");
  await db.query(
    "insert into sim_murid_private.lesson_schedules(class_id,academic_year_id,subject_id,teacher_id,weekday,start_minute,duration_minutes,jtm,created_by) values($1,$2,$3,$4,3,420,40,1,$5)",
    [cls, year, subject, users.teacher.id, users.admin.id],
  );
  const revision = () =>
    val("select revision from sim_murid_private.operations_state");
  const learning = async (command, request = randomUUID(), v = null) =>
    val("select public.app_learning_write($1,$2,$3,$4,'grades',$5::jsonb)", [
      users.admin.id,
      users.admin.session,
      request,
      v ?? (await revision()),
      JSON.stringify(command),
    ]);
  for (const [kind, value] of [
    ["PH", 80],
    ["ATS", 70],
    ["ASAS", 90],
    ["Praktik", 0],
  ]) {
    const r = await learning({
      type: "batch",
      id: null,
      classId: cls,
      subjectId: subject,
      date: "2026-10-21",
      kind,
      items: ["student", "sibling"].map((n) => ({
        studentId: users[n].id,
        value,
        notes: "",
      })),
    });
    if (r.code !== "saved") throw Error("Fixture grade failed: " + r.code);
  }
  const report = await val(
    "select public.app_learning_write($1,$2,$3,$4,'reports',$5::jsonb)",
    [
      users.admin.id,
      users.admin.session,
      randomUUID(),
      await revision(),
      JSON.stringify({
        type: "publish",
        classId: cls,
        semester: 1,
        studentIds: [users.student.id],
      }),
    ],
  );
  if (report.code !== "saved")
    throw Error("Fixture report failed: " + report.code);
  const account = randomUUID();
  await db.query(
    "insert into sim_murid_private.savings_accounts(id,owner_id,category,created_by) values($1,$2,'S',$3)",
    [account, users.student.id, users.admin.id],
  );
  const deposit = await val(
    "select public.app_operations_write($1,$2,$3,$4,'savings',$5::jsonb)",
    [
      users.admin.id,
      users.admin.session,
      randomUUID(),
      await revision(),
      JSON.stringify({
        type: "transaction",
        id: null,
        accountId: account,
        date: "2026-10-21",
        kind: "deposit",
        amount: 200000,
        feeApplied: false,
        reason: "Synthetic P10 deposit",
      }),
    ],
  );
  if (deposit.code !== "saved")
    throw Error("Fixture ledger failed: " + deposit.code);
  return {
    db,
    migrations,
    users,
    year,
    cls,
    foreignClass,
    subject,
    account,
    val,
    revision,
    learning,
  };
}
export async function fingerprints(db) {
  const tables = (
    await db.query(
      "select table_schema,table_name from information_schema.tables where table_schema in('public','sim_murid_private','auth') and table_type='BASE TABLE' order by table_schema,table_name",
    )
  ).rows;
  const { createHash } = await import("node:crypto");
  const entities = {};
  for (const t of tables) {
    const name = t.table_schema + "." + t.table_name;
    const rows = (
      await db.query(
        `select to_jsonb(t)::text value from "${t.table_schema}"."${t.table_name}" t order by to_jsonb(t)::text`,
      )
    ).rows;
    entities[name] = {
      count: rows.length,
      sha256: createHash("sha256").update(JSON.stringify(rows)).digest("hex"),
    };
  }
  return entities;
}

export async function schemaFingerprint(db) {
  const { createHash } = await import("node:crypto");
  const schema = {};
  schema.tables = (
    await db.query(
      "select n.nspname,c.relname,c.relrowsecurity,c.relforcerowsecurity from pg_class c join pg_namespace n on n.oid=c.relnamespace where n.nspname in('public','sim_murid_private','auth') and c.relkind='r' order by 1,2",
    )
  ).rows;
  schema.policies = (
    await db.query(
      "select * from pg_policies where schemaname in('public','sim_murid_private') order by schemaname,tablename,policyname",
    )
  ).rows;
  schema.triggers = (
    await db.query(
      "select n.nspname,c.relname,t.tgname,t.tgenabled,pg_get_triggerdef(t.oid) definition from pg_trigger t join pg_class c on c.oid=t.tgrelid join pg_namespace n on n.oid=c.relnamespace where not t.tgisinternal and n.nspname in('public','sim_murid_private') order by 1,2,3",
    )
  ).rows;
  schema.routines = (
    await db.query(
      "select n.nspname,p.proname,pg_get_function_identity_arguments(p.oid) args,p.prosecdef,p.proconfig,p.proacl,md5(p.prosrc) body from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname in('public','sim_murid_private','auth') order by 1,2,3",
    )
  ).rows;
  schema.grants = (
    await db.query(
      "select table_schema,table_name,grantee,privilege_type from information_schema.role_table_grants where table_schema in('public','sim_murid_private','auth') order by 1,2,3,4",
    )
  ).rows;
  return {
    sha256: createHash("sha256").update(JSON.stringify(schema)).digest("hex"),
    tables: schema.tables.length,
    policies: schema.policies.length,
    triggers: schema.triggers.length,
    routines: schema.routines.length,
    grants: schema.grants.length,
  };
}
