import "./support/next-dynamic.mjs";
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
  "@/lib/auth/read-server": `export const readServerPrincipal=async()=>globalThis.attendanceMocks.caller;`,
  "@/lib/auth/http": `export const privateJson=(body,status=200)=>globalThis.attendanceMocks.reply(body,status);export const requestAuth=()=>({});export const verifiedPrincipal=async()=>globalThis.attendanceMocks.caller;export const sameOrigin=r=>r.headers.get('origin')===r.nextUrl.origin;`,
  "@/lib/auth/admin": `export const createAuthAdmin=()=>({rpc:async(fn,args)=>{const m=globalThis.attendanceMocks;m.calls.push([fn,args]);if(fn==='app_survey_required')return {data:m.survey,error:null};if(fn==='app_operations_write')return {data:m.malformedResult?{}:{code:m.code},error:m.writeError};return {data:m.snapshot,error:m.readError};}});`,
  "@/lib/settings/server": `export const readBounded=async r=>new Uint8Array(await r.arrayBuffer());`,
};
registerHooks({
  resolve(s, c, next) {
    if (s in mocks) return { url: "attendance-mock:" + s, shortCircuit: true };
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
    if (url.startsWith("attendance-mock:"))
      return {
        format: "module",
        source: mocks[url.slice(16)],
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
const {
  attendanceFilters,
  attendanceMonth,
  calendarSnapshot,
  calendarStatus,
} = await import("../src/lib/operations/attendance.ts");
const id = (n) => `00000000-0000-4000-8000-${String(n).padStart(12, "0")}`;
const params = { params: Promise.resolve({ module: "attendance" }) };
function setup() {
  return (globalThis.attendanceMocks = {
    caller: { principal: { id: id(1) }, sessionId: id(2) },
    calls: [],
    survey: false,
    code: "saved",
    snapshot: {
      module: "attendance",
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
      summary: { recorded: 0 },
      extra: { holidays: [], trend: [] },
    },
    reply: (b, status = 200) =>
      NextResponse.json(b, {
        status,
        headers: { "Cache-Control": "private, no-store" },
      }),
  });
}
const command = {
  type: "batch",
  items: [
    {
      studentId: id(10),
      classId: id(20),
      date: "2026-10-22",
      status: "Hadir",
      notes: "Dipertahankan",
    },
  ],
};
function req(query = "", cmd = command, origin = "https://example.test") {
  return new NextRequest(
    "https://example.test/api/operations/attendance" + query,
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
  class_id: id(20),
  name: "Siswa",
  class_name: "7A",
  date: "2026-10-02",
  status: "Izin",
  notes: "Catatan",
  can_edit: true,
  ...patch,
});
test("blank filters normalize; effective range and input schemas fail before any write", async () => {
  assert.deepEqual(
    attendanceFilters.parse({
      year: "2026",
      start: "",
      end: "",
      classId: "",
      status: "",
    }),
    { year: 2026 },
  );
  for (const query of [
    "?year=1999",
    "?year=2026&end=2025-01-01",
    "?start=2026-01-01&end=2028-01-01",
    "?page=0",
    "?classId=invalid",
    "?calendar=2026-10",
  ]) {
    const m = setup();
    assert.equal((await POST(req(query), params)).status, 400);
    assert.equal(writes(m).length, 0);
  }
});
test("confirmed attendance writes retain contract and authoritative identity, with filtered snapshot", async () => {
  for (const cmd of [
    command,
    {
      type: "edit",
      id: id(40),
      status: "Sakit",
      notes: "Reviewed",
      reason: "Pemeriksaan ulang",
    },
    { type: "void", id: id(40), reason: "Data duplikat" },
  ]) {
    const m = setup();
    const result = await POST(
      req("?year=2026&status=Hadir&start=&end=", cmd),
      params,
    );
    assert.equal(result.status, 200);
    const body = await result.json();
    assert.equal(body.result.code, "saved");
    assert.equal(body.code, "saved");
    assert.equal(body.data.module, "attendance");
    assert.equal(writes(m)[0][1].p_actor, id(1));
    assert.equal(writes(m)[0][1].p_session, id(2));
    assert.deepEqual(writes(m)[0][1].p_command, cmd);
    assert.equal(m.calls.at(-1)[1].p_filters.status, "Hadir");
  }
});
test("conflicts block resubmission with explicit machine code and no false snapshot", async () => {
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
test("unknown acknowledgement and failed/malformed confirmed read return uncertain service error", async () => {
  for (const change of [
    { malformedResult: true },
    { code: "new_unknown_code" },
    { readError: { message: "private upstream details" } },
    { snapshot: { module: "attendance" } },
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
test("calendar fetch strips history filters, requests complete scoped month including leap February", async () => {
  const m = setup();
  const r = await GET(
    new NextRequest(
      "https://example.test/api/operations/attendance?calendar=2028-02&studentId=" +
        id(10),
    ),
    params,
  );
  assert.equal(r.status, 200);
  assert.match(r.headers.get("Server-Timing"), /^sim_app;dur=\d+\.\d$/);
  assert.deepEqual(m.calls.at(-1)[1].p_filters, {
    start: "2028-02-01",
    end: "2028-02-29",
    studentId: id(10),
    export: true,
    page: 1,
  });
  for (const q of [
    "calendar=2026-13&studentId=" + id(10),
    "calendar=2026-10",
    "calendar=2026-10&studentId=" + id(10) + "&status=Hadir",
    "calendar=2026-10&studentId=" + id(10) + "&format=pdf",
  ]) {
    const state = setup();
    assert.equal(
      (
        await GET(
          new NextRequest(
            "https://example.test/api/operations/attendance?" + q,
          ),
          params,
        )
      ).status,
      400,
    );
    assert.equal(state.calls.length, 1);
  }
});
test("calendar refuses incomplete, cross-student, duplicate or out-of-month data", () => {
  const s = setup().snapshot;
  s.rows = [row()];
  s.total = 1;
  assert.equal(calendarSnapshot(s, id(10), "2026-10").rows.length, 1);
  for (const patch of [
    { total: 51 },
    { page: 2 },
    { rows: [row({ student_id: id(11) })] },
    { rows: [row({ date: "2026-09-30" })] },
    { rows: [row(), row()], total: 2 },
  ])
    assert.throws(() =>
      calendarSnapshot({ ...s, ...patch }, id(10), "2026-10"),
    );
  assert.deepEqual(attendanceMonth("2026-02"), {
    start: "2026-02-01",
    end: "2026-02-28",
  });
  s.extra.holidays = ["2026-10-05"];
  assert.equal(calendarStatus(s, "2026-10-02"), "Izin");
  assert.equal(calendarStatus(s, "2026-10-04"), "Libur");
  assert.equal(calendarStatus(s, "2026-10-05"), "Libur");
  assert.equal(calendarStatus(s, "2026-10-06"), "Belum dicatat");
  assert.equal(calendarStatus(s, "2026-10-23"), "Belum berlangsung");
});
test("session, survey and Origin guard prevent any attendance write", async () => {
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
test("actual exports use complete scoped history; invalid upstream read surfaces as service failure", async () => {
  for (const format of ["xlsx", "pdf"]) {
    const m = setup();
    m.snapshot.rows = [row()];
    m.snapshot.total = 1;
    const r = await GET(
      new NextRequest(
        "https://example.test/api/operations/attendance?year=2026&studentId=" +
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
  m.snapshot.rows = [row({ status: "unknown" })];
  assert.equal(
    (
      await GET(
        new NextRequest("https://example.test/api/operations/attendance"),
        params,
      )
    ).status,
    503,
  );
  await assert.rejects(page(params), /Operations unavailable/);
});
