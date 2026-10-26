import "./support/next-dynamic.mjs";
/** Actual Poin Siswa route, schemas and server reader with synthetic Auth/SDK boundaries. */
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
  "@/lib/auth/read-server": `export const readServerPrincipal=async()=>globalThis.pointsMocks.caller;`,
  "@/lib/auth/http": `export const privateJson=(body,status=200)=>globalThis.pointsMocks.reply(body,status);export const requestAuth=()=>({});export const verifiedPrincipal=async()=>globalThis.pointsMocks.caller;export const sameOrigin=r=>r.headers.get('origin')===r.nextUrl.origin;`,
  "@/lib/auth/admin": `export const createAuthAdmin=()=>({rpc:async(fn,args)=>{const m=globalThis.pointsMocks;m.calls.push([fn,args]);if(fn==='app_survey_required')return {data:m.survey,error:null};if(fn==='app_services_write')return {data:m.malformedResult?{}:{code:m.code},error:m.writeError};return {data:m.readSnapshots?.shift()??m.snapshot,error:m.readError};}});`,
  "@/lib/settings/server": `export const readBounded=async r=>new Uint8Array(await r.arrayBuffer());`,
};
registerHooks({
  resolve(s, c, next) {
    if (s in mocks) return { url: "points-mock:" + s, shortCircuit: true };
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
    if (url.startsWith("points-mock:"))
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
const { GET, POST } = await import("../src/app/api/services/[module]/route.ts");
const { default: page } = await import(
  "../src/app/account/services/[module]/page.tsx"
);
const {
  disciplineSnapshot,
  parseDiscipline,
  disciplineFilters,
  canCancelEvent,
} = await import("../src/lib/services/discipline.ts");
const { commands } = await import("../src/lib/services/validation.ts");
const { exportServices, serviceExportRows } = await import(
  "../src/lib/services/export.ts"
);
const id = (n) => `00000000-0000-4000-8000-${String(n).padStart(12, "0")}`;
const params = { params: Promise.resolve({ module: "discipline" }) };
const cat = {
  code: "A01",
  category: "Kehadiran",
  description: "Terlambat",
  points: -2,
  consequence: "Tindak lanjut",
  active: true,
};
const event = (patch = {}) => ({
  id: id(40),
  student_id: id(10),
  event_date: "2026-10-23",
  code: "A01",
  notes: "Catatan",
  created_by: id(1),
  base_points: -2,
  catalog_snapshot: cat,
  multiplier: 1,
  r02: false,
  r03: false,
  before: 50,
  after: 48,
  delta: -2,
  ...patch,
});
const student = (patch = {}) => ({
  student_id: id(10),
  class_id: id(30),
  name: "Siswa",
  class_name: "7A",
  archived: false,
  snapshot: {
    student_id: id(10),
    month: "2026-10-01",
    balance: 48,
    level: 1,
    violations: 1,
    good: 0,
    policy: "SPK-1.0",
    events: [event()],
  },
  ...patch,
});
function setup() {
  return (globalThis.pointsMocks = {
    id,
    caller: { principal: { id: id(1) }, sessionId: id(2) },
    calls: [],
    survey: false,
    code: "saved",
    snapshot: {
      module: "discipline",
      revision: 1,
      today: "2026-10-23",
      month: "2026-10-01",
      isAdmin: true,
      isManager: false,
      rows: [student()],
      extra: {
        canRecord: true,
        catalog: [cat],
        settings: {
          email_enabled: false,
          whatsapp_enabled: false,
          point_threshold: 2,
          affective_subject_id: null,
        },
        affective: [],
        ranking: [],
      },
      years: null,
      classes: [{ id: id(30), name: "7A" }],
      subjects: null,
    },
    reply: (b, status = 200) =>
      NextResponse.json(b, {
        status,
        headers: { "Cache-Control": "private, no-store" },
      }),
  });
}
const cmd = {
  type: "event",
  studentId: id(10),
  date: "2026-10-23",
  code: "A01",
  notes: "Catatan",
};
const request = (command = cmd, query = "", origin = "https://example.test") =>
  new NextRequest("https://example.test/api/services/discipline" + query, {
    method: "POST",
    headers: { Origin: origin, "Content-Type": "application/json" },
    body: JSON.stringify({ requestId: id(3), revision: 1, command }),
  });
test("discipline accepts SPK replay and preserves signed/clamped event values", () => {
  const m = setup();
  assert.equal(
    disciplineSnapshot.parse(m.snapshot).rows[0].snapshot.balance,
    48,
  );
  for (const patch of [
    { before: 0 },
    { delta: 99 },
    { student_id: id(90) },
    { event_date: "2026-09-22" },
  ])
    assert.equal(
      disciplineSnapshot.safeParse({
        ...m.snapshot,
        rows: [
          student({
            snapshot: {
              ...m.snapshot.rows[0].snapshot,
              events: [event(patch)],
            },
          }),
        ],
      }).success,
      false,
    );
});
test("identical multi-role rows collapse; conflicting snapshots fail closed", () => {
  const m = setup();
  m.snapshot.rows.push(student());
  assert.equal(parseDiscipline(m.snapshot).rows.length, 1);
  m.snapshot.rows[1].name = "Conflict";
  assert.throws(() => parseDiscipline(m.snapshot));
});
test("nullable empty catalog and blank filters handled, invalid months rejected", () => {
  const m = setup();
  m.snapshot.extra.catalog = null;
  assert.deepEqual(parseDiscipline(m.snapshot).extra.catalog, []);
  assert.deepEqual(
    disciplineFilters.parse({ month: "2026-10-01", classId: "" }),
    { month: "2026-10-01" },
  );
  for (const f of [
    { month: "2026-10-23" },
    { month: "invalid" },
    { role: "teacher" },
  ])
    assert.equal(disciplineFilters.safeParse(f).success, false);
});
test("cancel only admin or active recording owner, never archived or reader", () => {
  const m = setup(),
    d = disciplineSnapshot.parse(m.snapshot),
    r = d.rows[0],
    e = r.snapshot.events[0];
  assert.equal(canCancelEvent(d, r, e, id(90)), true);
  d.isAdmin = false;
  assert.equal(canCancelEvent(d, r, e, id(90)), false);
  assert.equal(canCancelEvent(d, r, e, id(1)), true);
  assert.equal(canCancelEvent(d, { ...r, archived: true }, e, id(1)), false);
  d.extra.canRecord = false;
  assert.equal(canCancelEvent(d, r, e, id(1)), false);
});
test("catalog permits negative points, enforces range and cancellation reason", () => {
  assert.equal(
    commands.discipline.safeParse({ type: "catalog", ...cat }).success,
    true,
  );
  assert.equal(
    commands.discipline.safeParse({ type: "catalog", ...cat, points: -101 })
      .success,
    false,
  );
  assert.equal(
    commands.discipline.safeParse({ type: "cancel", id: id(40), reason: "x" })
      .success,
    false,
  );
});
test("GET canonicalizes repeated upstream rows and forwards scoped filters", async () => {
  const m = setup();
  m.snapshot.rows.push(student());
  const r = await GET(
    new NextRequest(
      "https://example.test/api/services/discipline?month=2026-10-01&classId=" +
        id(30),
    ),
    params,
  );
  assert.equal(r.status, 200);
  const data = (await r.json()).data;
  assert.equal(data.rows.length, 1);
  assert.equal(data.extra.recordingStudents.length, 1);
  assert.equal(m.calls.filter((c) => c[0] === "app_services_read").length, 2);
  assert.deepEqual(
    m.calls.filter((c) => c[0] === "app_services_read")[1][1].p_filters,
    { month: "2026-10-01" },
  );
  assert.equal(
    m.calls.find((c) => c[0] === "app_services_read")[1].p_filters.classId,
    id(30),
  );
});
test("POST confirms valid snapshot while retaining result/message contract", async () => {
  setup();
  const r = await POST(request(cmd, "?month=2026-10-01"), params),
    b = await r.json();
  assert.equal(r.status, 200);
  assert.equal(b.code, "saved");
  assert.equal(b.result.code, "saved");
  assert.equal(b.data.month, "2026-10-01");
  assert.ok(b.message);
});
test("invalid read filters are rejected before mutation", async () => {
  const m = setup();
  assert.equal(
    (await POST(request(cmd, "?month=2026-10-23"), params)).status,
    400,
  );
  assert.equal(m.calls.filter((c) => c[0] === "app_services_write").length, 0);
});
test("unknown acknowledgement and readback outage cannot claim success", async () => {
  for (const patch of [
    { code: "unknown" },
    { malformedResult: true },
    { readError: { message: "secret" } },
    { snapshot: { module: "discipline" } },
  ]) {
    Object.assign(setup(), patch);
    const r = await POST(request(), params);
    assert.equal(r.status, 503);
    assert.equal(JSON.stringify(await r.json()).includes("secret"), false);
  }
});
test("known conflicts preserve actionable code without snapshot", async () => {
  for (const code of [
    "archived",
    "stale",
    "not_configured",
    "not_found",
    "denied",
  ]) {
    setup().code = code;
    const r = await POST(request(), params);
    assert.equal(r.status, code === "denied" ? 403 : 409);
    const b = await r.json();
    assert.equal(b.code, code);
    assert.equal(b.data, undefined);
  }
});
test("anonymous, origin and survey restrictions block writes", async () => {
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
      m.calls.filter((c) => c[0] === "app_services_write").length,
      0,
    );
  }
});
test("malformed upstream read becomes service error and page uses retry boundary", async () => {
  setup().snapshot.revision = -1;
  assert.equal(
    (
      await GET(
        new NextRequest("https://example.test/api/services/discipline"),
        params,
      )
    ).status,
    503,
  );
  await assert.rejects(page(params), /unavailable/i);
});
test("Excel text cells guard formulas and Excel/PDF preserve numeric balance and export limits", async () => {
  const m = setup();
  m.snapshot.rows[0].name = "=INJECT";
  const data = disciplineSnapshot.parse(m.snapshot);
  assert.equal(serviceExportRows(data).rows[0][3], 48);
  await assert.rejects(exportServices(data,"csv"));
  for (const f of ["xlsx", "pdf"])
    assert.ok(
      (await (await exportServices(data, f)).arrayBuffer()).byteLength > 100,
    );
  assert.throws(
    () => serviceExportRows({ ...data, rows: Array(10001).fill(data.rows[0]) }),
    RangeError,
  );
});
test("certificate only exports scoped ranking winners and handles empty selection", async () => {
  const m = setup();
  m.snapshot.extra.ranking = [
    {
      x: {
        student_id: id(10),
        name: "Nama".repeat(200),
        class_name: "7A",
        snapshot: { balance: 48 },
      },
      class_rank: 1,
      global_rank: 1,
    },
  ];
  assert.equal(
    (await exportServices(disciplineSnapshot.parse(m.snapshot), "certificate"))
      .status,
    200,
  );
  m.snapshot.extra.ranking = [];
  await assert.rejects(
    exportServices(disciplineSnapshot.parse(m.snapshot), "certificate"),
    /Tidak ada penerima/,
  );
});

test("empty certificate selection is 404 instead of a service outage", async () => {
  setup();
  const r = await GET(
    new NextRequest(
      "https://example.test/api/services/discipline?format=certificate",
    ),
    params,
  );
  assert.equal(r.status, 404);
  assert.match((await r.json()).message, /Belum ada penerima/);
});

test("recording catalog revision mismatch fails closed on read and confirmed write", async () => {
  for (const write of [false, true]) {
    const m = setup();
    m.readSnapshots = [m.snapshot, { ...m.snapshot, revision: 2 }];
    const q = "?classId=" + id(30) + "&month=2026-10-01";
    const r = write
      ? await POST(request(cmd, q), params)
      : await GET(
          new NextRequest("https://example.test/api/services/discipline" + q),
          params,
        );
    assert.equal(r.status, 503);
    assert.equal((await r.json()).code, undefined);
  }
});
