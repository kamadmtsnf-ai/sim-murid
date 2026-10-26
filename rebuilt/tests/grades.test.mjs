import "./support/next-dynamic.mjs";
/** Actual Penilaian dan KKM route, schemas and server reader with synthetic Auth/SDK boundaries. */
import test from "node:test";
import assert from "node:assert/strict";
import { registerHooks } from "node:module";
import { readFileSync, existsSync, statSync } from "node:fs";
import { resolve, dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import ts from "typescript";
import { NextRequest, NextResponse } from "next/server.js";
const mocks = {
  "server-only": "export {};",
  "next/link": "export default function Link(){};",
  "next/navigation": `export const notFound=()=>{throw Error('not found')};export const redirect=url=>{const e=Error('redirect');e.url=url;throw e};`,
  "@/lib/auth/read-server": `export const readServerPrincipal=async()=>globalThis.gradesMocks.caller;`,
  "@/lib/auth/http": `export const privateJson=(body,status=200)=>globalThis.gradesMocks.reply(body,status);export const requestAuth=()=>({});export const verifiedPrincipal=async()=>globalThis.gradesMocks.caller;export const sameOrigin=r=>r.headers.get('origin')===r.nextUrl.origin;`,
  "@/lib/auth/admin": `export const createAuthAdmin=()=>({rpc:async(fn,args)=>{const m=globalThis.gradesMocks;m.calls.push([fn,args]);if(fn==='app_survey_required')return {data:m.survey,error:null};if(fn==='app_learning_write')return {data:m.malformedResult?{}:{code:m.code},error:m.writeError};return {data:m.readSnapshots?.shift()??m.snapshot,error:m.readError};}});`,
  "@/lib/settings/server": `export const readBounded=async r=>new Uint8Array(await r.arrayBuffer());`,
};
registerHooks({
  resolve(s, c, next) {
    if (s in mocks) return { url: "grades-mock:" + s, shortCircuit: true };
    let p;
    if (s.startsWith("@/")) p = resolve("src", s.slice(2));
    else if (s.startsWith(".") && c.parentURL?.includes("/src/"))
      p = join(dirname(fileURLToPath(c.parentURL)), s);
    if (p)
      for (const ext of ["", ".ts", ".tsx"])
        if (existsSync(p + ext) && statSync(p + ext).isFile())
          return { url: new URL("file://" + p + ext).href, shortCircuit: true };
    return next(s, c);
  },
  load(url, c, next) {
    if (url.endsWith(".json") && url.includes("/src/"))
      return {
        format: "module",
        source: "export default " + readFileSync(new URL(url), "utf8"),
        shortCircuit: true,
      };
    if (url.startsWith("grades-mock:"))
      return {
        format: "module",
        source: mocks[url.slice(12)],
        shortCircuit: true,
      };
    if (/\.tsx?$/.test(url))
      return {
        format: "module",
        source: ts.transpileModule(readFileSync(new URL(url), "utf8"), {
          compilerOptions: {
            module: ts.ModuleKind.ESNext,
            target: ts.ScriptTarget.ES2022,
            jsx: ts.JsxEmit.ReactJSX,
          },
        }).outputText,
        shortCircuit: true,
      };
    return next(url, c);
  },
});
const { GET, POST } = await import("../src/app/api/learning/[module]/route.ts");
const { default: page } = await import(
  "../src/app/account/learning/[module]/page.tsx"
);
const { gradesSnapshot, gradeFilters, gradeRoster, gradeDraft } = await import(
  "../src/lib/learning/grades.ts"
);
const { commands } = await import("../src/lib/learning/validation.ts");
const { gradeInputScore } = await import("../src/lib/learning/grades.ts");
const id = (n) => `00000000-0000-4000-8000-${String(n).padStart(12, "0")}`;
const params = { params: Promise.resolve({ module: "grades" }) };
const person = (n = 10) => ({
  id: id(n),
  username: "siswa-" + n,
  full_name: "Siswa " + n,
  role_code: "student",
  class_id: id(30),
});
const row = (patch = {}) => ({
  id: id(40),
  class_id: id(30),
  subject_id: id(60),
  academic_year_id: id(70),
  semester: 1,
  kind: "PH",
  ph_number: 2,
  teacher_id: id(1),
  assessment_date: "2026-10-23",
  kkm_snapshot: 75,
  kkm_fallback: true,
  subject_name: "IPS",
  can_edit: true,
  scores: [
    { student_id: id(10), name: "Siswa 10", value: 0, notes: "Nilai nol" },
    {
      student_id: id(11),
      name: "Siswa 11",
      value: null,
      notes: "Belum dinilai",
    },
  ],
  ...patch,
});
function setup() {
  return (globalThis.gradesMocks = {
    caller: { principal: { id: id(1) }, sessionId: id(2) },
    calls: [],
    survey: false,
    code: "saved",
    snapshot: {
      module: "grades",
      today: "2026-10-23",
      revision: 1,
      isAdmin: true,
      canWrite: true,
      semester: 1,
      classes: [
        {
          id: id(30),
          name: "7A",
          year: 2026,
          academic_year_id: id(70),
          archived_at: null,
        },
      ],
      people: [person(), person(11)],
      rows: [row()],
      extra: { kkm: 0, subjects: [{ id: id(60), name: "IPS" }] },
    },
    reply: (b, status = 200) =>
      NextResponse.json(b, {
        status,
        headers: { "Cache-Control": "private, no-store" },
      }),
  });
}
const cmd = {
  type: "batch",
  id: null,
  classId: id(30),
  subjectId: id(60),
  date: "2026-10-23",
  kind: "PH",
  items: [
    { studentId: id(10), value: 0, notes: "Nol" },
    { studentId: id(11), value: null, notes: "" },
  ],
};
const request = (command = cmd, query = "", origin = "https://example.test") =>
  new NextRequest("https://example.test/api/learning/grades" + query, {
    method: "POST",
    headers: { Origin: origin, "Content-Type": "application/json" },
    body: JSON.stringify({ requestId: id(3), revision: 1, command }),
  });
test("snapshot preserves zero, null and zero KKM without coercion", () => {
  const d = gradesSnapshot.parse(setup().snapshot);
  assert.equal(d.extra.kkm, 0);
  assert.equal(d.rows[0].scores[0].value, 0);
  assert.equal(d.rows[0].scores[1].value, null);
});
test("snapshot rejects period mismatch, duplicate score IDs and invalid PH sequence", () => {
  const m = setup();
  for (const patch of [
    { semester: 2 },
    { assessment_date: "2027-01-01" },
    { ph_number: null },
    { kind: "ATS" },
  ])
    assert.equal(
      gradesSnapshot.safeParse({ ...m.snapshot, rows: [row(patch)] }).success,
      false,
    );
  assert.equal(
    gradesSnapshot.safeParse({
      ...m.snapshot,
      rows: [row({ scores: [row().scores[0], row().scores[0]] })],
    }).success,
    false,
  );
});
test("draft keeps all original scores even outside the current catalog", () => {
  const m = setup();
  m.snapshot.people = [person()];
  const d = gradesSnapshot.parse(m.snapshot),
    r = d.rows[0],
    people = gradeRoster(d, r),
    draft = gradeDraft(people, r);
  assert.equal(people.length, 2);
  assert.equal(draft[id(10)].value, "0");
  assert.equal(draft[id(11)].value, "");
  assert.equal(draft[id(11)].notes, "Belum dinilai");
});
test("roster deduplicates multi-role students and excludes applicants", () => {
  const m = setup();
  m.snapshot.people = [
    person(),
    { ...person(), role_code: "alumni" },
    { ...person(12), role_code: "applicant" },
  ];
  assert.equal(gradeRoster(gradesSnapshot.parse(m.snapshot)).length, 1);
});
test("filters normalize blank controls and accept semester but reject unrelated fields", () => {
  assert.deepEqual(gradeFilters.parse({ semester: "2", classId: "" }), {
    semester: 2,
  });
  for (const f of [{ semester: 3 }, { year: "2026" }, { classId: "forged" }])
    assert.equal(gradeFilters.safeParse(f).success, false);
});
test("command validation keeps null/zero, unique IDs, reason and KKM bounds", () => {
  assert.equal(commands.grades.parse(cmd).items[0].value, 0);
  assert.equal(
    commands.grades.safeParse({ ...cmd, id: id(40) }).success,
    false,
  );
  assert.equal(
    commands.grades.safeParse({ ...cmd, id: id(40), reason: "Koreksi" })
      .success,
    true,
  );
  for (const value of [-1, 101])
    assert.equal(
      commands.grades.safeParse({
        type: "kkm",
        classId: id(30),
        subjectId: id(60),
        date: "2026-10-23",
        value,
      }).success,
      false,
    );
});
test("GET scoped student report adds full class entry catalog with matching revision", async () => {
  const m = setup();
  const q =
    "?classId=" +
    id(30) +
    "&subjectId=" +
    id(60) +
    "&studentId=" +
    id(10) +
    "&semester=1";
  const r = await GET(
      new NextRequest("https://example.test/api/learning/grades" + q),
      params,
    ),
    b = await r.json();
  assert.equal(r.status, 200);
  assert.equal(b.data.extra.entryPeople.length, 2);
  const reads = m.calls.filter((c) => c[0] === "app_learning_read");
  assert.equal(reads.length, 2);
  assert.equal(reads[1][1].p_filters.studentId, undefined);
  assert.equal(reads[1][1].p_actor, id(1));
});
test("saved writes retain result/message and add code plus validated readback", async () => {
  setup();
  const r = await POST(request(), params),
    b = await r.json();
  assert.equal(r.status, 200);
  assert.equal(b.result.code, "saved");
  assert.equal(b.code, "saved");
  assert.equal(b.data.rows[0].scores[0].value, 0);
  assert.ok(b.message);
});
test("malformed ack, unknown code and failed readback are uncertain service errors", async () => {
  for (const patch of [
    { malformedResult: true },
    { code: "unknown" },
    { readError: { message: "secret" } },
    { snapshot: { module: "grades" } },
  ]) {
    Object.assign(setup(), patch);
    const r = await POST(request(), params);
    assert.equal(r.status, 503);
    assert.equal(JSON.stringify(await r.json()).includes("secret"), false);
  }
});
test("invalid readback filters never execute the mutation", async () => {
  const m = setup();
  assert.equal((await POST(request(cmd, "?semester=3"), params)).status, 400);
  assert.equal(m.calls.filter((c) => c[0] === "app_learning_write").length, 0);
});
test("scope/revision mismatch while reading roster fails closed", async () => {
  const m = setup();
  m.readSnapshots = [m.snapshot, { ...m.snapshot, revision: 2 }];
  const r = await GET(
    new NextRequest(
      "https://example.test/api/learning/grades?classId=" +
        id(30) +
        "&studentId=" +
        id(10),
    ),
    params,
  );
  assert.equal(r.status, 503);
});
test("known stale/denied/not_found errors remain actionable", async () => {
  for (const code of ["stale", "denied", "not_found", "duplicate"]) {
    setup().code = code;
    const r = await POST(request(), params);
    assert.equal(r.status, code === "denied" ? 403 : 409);
    assert.equal((await r.json()).code, code);
  }
});
test("auth, origin and survey gates block writes", async () => {
  for (const scenario of ["anonymous", "origin", "survey"]) {
    const m = setup();
    if (scenario === "anonymous") m.caller = null;
    if (scenario === "survey") m.survey = true;
    const r = await POST(
      request(
        cmd,
        "",
        scenario === "origin" ? "https://foreign.test" : "https://example.test",
      ),
      params,
    );
    assert.ok([401, 403].includes(r.status));
    assert.equal(
      m.calls.filter((c) => c[0] === "app_learning_write").length,
      0,
    );
  }
});
test("invalid upstream enters retry boundary and anonymous page retains login redirect", async () => {
  setup().snapshot.revision = -1;
  assert.equal(
    (
      await GET(
        new NextRequest("https://example.test/api/learning/grades"),
        params,
      )
    ).status,
    503,
  );
  await assert.rejects(page(params), /Grades unavailable/);
  setup().caller = null;
  await assert.rejects(page(params), (e) => e.url === "/login?expired=1");
});
test("report rejection retains result/message with additive acknowledgement code", async () => {
  const m = setup();
  m.code = "incomplete";
  const r = await POST(
    request({
      type: "publish",
      classId: id(30),
      semester: 1,
      studentIds: [id(10)],
    }),
    { params: Promise.resolve({ module: "reports" }) },
  );
  assert.equal(r.status, 409);
  assert.deepEqual(Object.keys(await r.json()).sort(), [
    "code",
    "message",
    "result",
  ]);
  assert.equal(m.calls.filter((c) => c[0] === "app_learning_read").length, 0);
});

test("entry decimal validation matches visible native controls across hidden pages", () => {
  assert.equal(gradeInputScore.safeParse(25.55).success, true);
  assert.equal(gradeInputScore.safeParse(25.555).success, false);
  assert.equal(gradeInputScore.safeParse(0).success, true);
  assert.equal(gradeInputScore.safeParse(100).success, true);
});
