/** Actual Classes route, schemas and server reader with synthetic Auth/SDK boundaries. */
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
  "@/lib/auth/read-server": `export const readServerPrincipal=async()=>globalThis.mentoringMocks.caller;`,
  "@/lib/auth/http": `export const privateJson=(body,status=200)=>globalThis.mentoringMocks.reply(body,status);export const requestAuth=()=>({});export const verifiedPrincipal=async()=>globalThis.mentoringMocks.caller;export const sameOrigin=r=>r.headers.get('origin')===r.nextUrl.origin;`,
  "@/lib/auth/admin": `export const createAuthAdmin=()=>({rpc:async(fn,args)=>{const m=globalThis.mentoringMocks;m.calls.push([fn,args]);if(fn==='app_survey_required')return {data:m.survey,error:null};if(fn==='app_operations_write')return {data:m.malformedResult?{}:{code:m.code},error:m.writeError};return {data:m.snapshot,error:m.readError};}});`,
  "@/lib/settings/server": `export const readBounded=async r=>new Uint8Array(await r.arrayBuffer());`,
};
registerHooks({
  resolve(s, c, next) {
    if (s in mocks) return { url: "mentoring-mock:" + s, shortCircuit: true };
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
    if (url.startsWith("mentoring-mock:"))
      return {
        format: "module",
        source: mocks[url.slice(15)],
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
const { GET, POST } = await import(
  "../src/app/api/operations/[module]/route.ts"
);
const { default: page } = await import(
  "../src/app/account/operations/[module]/page.tsx"
);
const { mentoringSnapshot, mentoringFilters } = await import(
  "../src/lib/operations/mentoring.ts"
);
const { commandSchemas } = await import("../src/lib/operations/validation.ts");
const id = (n) => `00000000-0000-4000-8000-${String(n).padStart(12, "0")}`;
const params = { params: Promise.resolve({ module: "mentoring" }) };
function setup() {
  return (globalThis.mentoringMocks = {
    caller: { principal: { id: id(1) }, sessionId: id(2) },
    calls: [],
    survey: false,
    code: "saved",
    snapshot: {
      module: "mentoring",
      today: "2026-10-22",
      revision: 1,
      canManage: true,
      isAdmin: true,
      people: [],
      classes: [],
      rows: [],
      total: 0,
      page: 1,
      pageSize: 50,
      summary: {},
      extra: { assignments: [], catalog: [], canAssign: true },
    },
    reply: (b, status = 200) =>
      NextResponse.json(b, {
        status,
        headers: { "Cache-Control": "private, no-store" },
      }),
  });
}
const command = {
  type: "report",
  id: null,
  studentId: id(10),
  date: "2026-10-22",
  kind: "memorization",
  catalogId: null,
  subject: "Al-Ikhlas",
  predicate: "Lancar",
  notes: "Empat ayat",
};
function req(query = "", cmd = command, origin = "https://example.test") {
  return new NextRequest(
    "https://example.test/api/operations/mentoring" + query,
    {
      method: "POST",
      headers: { Origin: origin, "Content-Type": "application/json" },
      body: JSON.stringify({ requestId: id(3), revision: 1, command: cmd }),
    },
  );
}
const writes = (m) => m.calls.filter((c) => c[0] === "app_operations_write");
const row = (patch = {}) => ({
  id: id(40),
  student_id: id(10),
  teacher_id: id(30),
  name: "Siswa",
  teacher_name: "Guru Wali",
  date: "2026-10-02",
  kind: "memorization",
  subject: "Al-Ikhlas",
  catalog_id: null,
  predicate: "Lancar",
  notes: "Catatan",
  can_edit: true,
  ...patch,
});
test("blank filters normalize and unsupported/effective invalid ranges fail before mutation", async () => {
  assert.deepEqual(
    mentoringFilters.parse({ year: "2026", start: "", end: "", studentId: "" }),
    { year: 2026 },
  );
  for (const query of [
    "?year=1999",
    "?year=2026&end=2025-01-01",
    "?start=2026-01-01&end=2028-01-01",
    "?status=Hadir",
    "?studentId=invalid",
    "?classId=" + id(20),
  ]) {
    const m = setup();
    assert.equal((await POST(req(query), params)).status, 400);
    assert.equal(writes(m).length, 0);
  }
});
test("report variants and corrections validate kind-specific fields and mandatory edit reason", async () => {
  for (const patch of [
    { predicate: "" },
    { subject: "" },
    { id: id(40) },
    { id: id(40), reason: "ab" },
    { kind: "development", notes: "" },
  ]) {
    const m = setup();
    assert.equal(
      (await POST(req("", { ...command, ...patch }), params)).status,
      400,
    );
    assert.equal(writes(m).length, 0);
  }
  assert.equal(
    commandSchemas.mentoring.safeParse({
      ...command,
      kind: "development",
      predicate: "",
      notes: "Perkembangan positif",
    }).success,
    true,
  );
});
test("all commands preserve actor/session/revision and return confirmed filtered snapshot", async () => {
  for (const cmd of [
    command,
    { ...command, id: id(40), reason: "Koreksi diperiksa" },
    {
      ...command,
      kind: "development",
      predicate: "",
      notes: "Perkembangan baik",
    },
    {
      type: "assign",
      teacherId: id(30),
      studentIds: [id(10)],
      assignTask: true,
    },
    { type: "assign", teacherId: id(30), studentIds: [], assignTask: false },
    { type: "void", id: id(40), reason: "Laporan duplikat" },
  ]) {
    const m = setup(),
      r = await POST(
        req("?year=2026&studentId=" + id(10) + "&start=&end=", cmd),
        params,
      );
    assert.equal(r.status, 200);
    const b = await r.json();
    assert.equal(b.result.code, "saved");
    assert.equal(b.code, "saved");
    assert.equal(b.data.module, "mentoring");
    assert.equal(writes(m)[0][1].p_actor, id(1));
    assert.equal(writes(m)[0][1].p_session, id(2));
    assert.deepEqual(writes(m)[0][1].p_command, cmd);
    assert.equal(m.calls.at(-1)[1].p_filters.studentId, id(10));
  }
});
test("conflicts have explicit code and never return false success snapshots", async () => {
  for (const code of [
    "stale",
    "not_found",
    "request_conflict",
    "denied",
    "invalid",
    "duplicate",
  ]) {
    const m = setup();
    m.code = code;
    const r = await POST(req(), params),
      b = await r.json();
    assert.equal(r.status, code === "denied" ? 403 : 409);
    assert.equal(b.code, code);
    assert.equal(b.data, undefined);
    assert.equal(
      m.calls.some((c) => c[0] === "app_operations_read"),
      false,
    );
  }
});
test("unknown/malformed acknowledgement and failed confirmed read are uncertain service errors", async () => {
  for (const change of [
    { malformedResult: true },
    { code: "unknown" },
    { readError: { message: "private upstream details" } },
    { snapshot: { module: "mentoring" } },
  ]) {
    const m = setup();
    Object.assign(m, change);
    const r = await POST(req(), params);
    assert.equal(r.status, 503);
    assert.equal(writes(m).length, 1);
    assert.equal(
      JSON.stringify(await r.json()).includes("private upstream"),
      false,
    );
  }
});
test("snapshot rejects duplicate assignments, unsafe metadata and malformed report types", () => {
  const s = setup().snapshot;
  const a = {
    id: id(50),
    teacher_id: id(30),
    student_id: id(10),
    name: "Siswa",
    teacher_name: "Guru",
  };
  for (const patch of [
    { revision: -1 },
    { revision: 0.5 },
    { page: 0 },
    { rows: [row({ kind: "unknown" })], total: 1 },
    { extra: { ...s.extra, assignments: [a, { ...a, id: id(51) }] } },
    { isAdmin: false },
  ])
    assert.equal(
      mentoringSnapshot.safeParse({ ...s, ...patch }).success,
      false,
    );
});
test("session, survey and cross-origin protections prevent writes", async () => {
  let m = setup();
  m.caller = null;
  assert.equal((await POST(req(), params)).status, 401);
  assert.equal(writes(m).length, 0);
  m = setup();
  m.survey = true;
  assert.equal((await POST(req(), params)).status, 403);
  assert.equal(writes(m).length, 0);
  m = setup();
  assert.equal(
    (await POST(req("", command, "https://foreign.test"), params)).status,
    403,
  );
  assert.equal(m.calls.length, 0);
});
test("actual XLSX/PDF export retains scope and upstream errors enter retry boundary", async () => {
  for (const format of ["xlsx", "pdf"]) {
    const m = setup();
    m.snapshot.rows = [row()];
    m.snapshot.total = 1;
    const r = await GET(
      new NextRequest(
        "https://example.test/api/operations/mentoring?year=2026&studentId=" +
          id(10) +
          "&format=" +
          format,
      ),
      params,
    );
    assert.equal(r.status, 200);
    assert.ok((await r.arrayBuffer()).byteLength > 100);
    assert.equal(m.calls.at(-1)[1].p_filters.export, true);
    assert.equal(r.headers.get("cache-control"), "no-store");
  }
  const m = setup();
  m.snapshot.rows = [row({ kind: "unknown" })];
  assert.equal(
    (
      await GET(
        new NextRequest("https://example.test/api/operations/mentoring"),
        params,
      )
    ).status,
    503,
  );
  await assert.rejects(page(params), /Operations unavailable/);
});
