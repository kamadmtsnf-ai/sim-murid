import test from "node:test";
import assert from "node:assert/strict";
import { registerHooks } from "node:module";
import { readFileSync, existsSync, statSync } from "node:fs";
import { resolve, dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import ts from "typescript";
import { NextRequest, NextResponse } from "next/server.js";
import ExcelJS from "exceljs";
globalThis.reconciliationReply = (b, s) => NextResponse.json(b, { status: s });
const mocks = {
  "@/lib/audit/server": "export const auditHistoryAvailable=async()=>false;",
  "server-only": "export {};",
  panel: "export const ServicesPanel=()=>null;",
  "next/navigation": `export const redirect=url=>{const e=Error('redirect');e.url=url;throw e;};export const notFound=()=>{throw Error('not_found')};`,
  "@/lib/auth/read-server": `export const readServerPrincipal=async()=>globalThis.reconciliationMocks.caller;`,
  "@/lib/auth/http": `export const privateJson=(b,s=200)=>globalThis.reconciliationReply(b,s);export const requestAuth=()=>({});export const verifiedPrincipal=async()=>globalThis.reconciliationMocks.caller;export const sameOrigin=()=>true;`,
  "@/lib/auth/authorization": `export class AccessDenied extends Error{};`,
  "@/lib/settings/server": `export const readBounded=async r=>new Uint8Array(await r.arrayBuffer());`,
  "@/lib/auth/admin": `export const createAuthAdmin=()=>({rpc:async(fn,args)=>{const m=globalThis.reconciliationMocks;m.calls.push([fn,args]);if(fn==='app_survey_required')return {data:m.survey,error:null};if(m.readError)throw Error('private SQL');return {data:args.p_module==='discipline'?m.discipline:args.p_module==='surveys'?m.catalog:m.snapshot,error:null};}});`,
  "@/lib/operations/server": `export const operationsData=async(actor,session,module,filters)=>{const m=globalThis.reconciliationMocks;m.operations.push([actor,session,module,filters]);if(m.operationError)throw m.operationError;return m.operation(module);};`,
  "@/lib/learning/server": `export const learningData=async()=>globalThis.reconciliationMocks.reports;`,
};
registerHooks({
  resolve(s, c, next) {
    if (s === "./panel")
      return { url: "reconciliation-mock:panel", shortCircuit: true };
    if (s in mocks)
      return { url: "reconciliation-mock:" + s, shortCircuit: true };
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
    if (url.startsWith("reconciliation-mock:"))
      return {
        format: "module",
        source: mocks[url.slice(20)],
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

const { GET: read } = await import("../src/app/api/services/[module]/route.ts");
const { GET: pack } = await import("../src/app/api/services/exports/route.ts");
const { serviceExportRows, exportServices } = await import(
  "../src/lib/services/export.ts"
);
const { reconciliationSnapshot, packageQuery } = await import(
  "../src/lib/services/reconciliation.ts"
);
const { default: page } = await import(
  "../src/app/account/services/[module]/page.tsx"
);
const { AccessDenied } = await import("@/lib/auth/authorization");
const id = (n) => `00000000-0000-4000-8000-${String(n).padStart(12, "0")}`;
const state = () => ({
  module: "reconciliation",
  revision: 7,
  today: "2026-10-23",
  month: "2026-10-01",
  isAdmin: true,
  isManager: false,
  rows: [],
  extra: {
    tables: 50,
    savingsBalance: 256000,
    reportSnapshots: 4,
    pointSnapshots: 0,
    submittedSurveys: 3,
    sourceAvailable: false,
  },
  years: [{ id: id(8), start_year: 2026 }],
  classes: [{ id: id(3), name: "Kelas 7A", academic_year_id: id(8) }],
  subjects: [],
});
function setup() {
  const m = (globalThis.reconciliationMocks = {
    caller: { principal: { id: id(1), is_admin: true }, sessionId: id(2) },
    calls: [],
    operations: [],
    survey: false,
    snapshot: state(),
    discipline: {
      ...state(),
      module: "discipline",
      extra: {
        canRecord: true,
        catalog: [],
        settings: {
          email_enabled: false,
          whatsapp_enabled: false,
          point_threshold: 2,
          affective_subject_id: null,
        },
        ranking: [],
        affective: [],
      },
      rows: [
        {
          student_id: id(10),
          name: "Student",
          class_id: id(3),
          class_name: "7A",
          archived: false,
          snapshot: {
            student_id: id(10),
            month: "2026-10-01",
            balance: 100,
            level: 0,
            violations: 0,
            good: 0,
            policy: "SPK-1.0",
            events: [],
          },
        },
      ],
    },
    reports: {
      revision: 300,
      rows: [
        {
          name: "Student",
          draft: {
            year: 2026,
            semester: 1,
            draft: true,
            subjects: [
              {
                name: "IPS",
                ph: 80,
                ats: 70,
                asas: 90,
                practice: 0,
                final: 82,
                kkm: 70,
                grade: "B",
              },
            ],
          },
        },
      ],
    },
  });
  m.operation = (module) => ({
    module,
    revision: 7,
    rows: [
      {
        date: "2026-10-23",
        name: "=SUM(1)",
        status: "Hadir",
        amount: 1000,
        delta: 1000,
      },
    ],
    total: 1,
    summary: { count: 1, amount: 1000 },
    extra: {},
  });
  return m;
}
const req = (query) =>
  new NextRequest(
    "https://sim.test/api/services/exports" + (query ? "?" + query : ""),
  );
const params = { params: Promise.resolve({ module: "reconciliation" }) };
async function workbook(response) {
  assert.equal(response.status, 200);
  assert.match(response.headers.get("Content-Type"), /spreadsheetml/);
  const book = new ExcelJS.Workbook();
  await book.xlsx.load(Buffer.from(await response.arrayBuffer()));
  return book;
}
test("actual summary export contains typed metrics even when rows are empty; legitimate zero counts survive", async () => {
  const m = setup(),
    s = reconciliationSnapshot.parse(m.snapshot),
    table = serviceExportRows(s);
  assert.equal(table.rows.length, 7);
  assert.deepEqual(table.rows[1], ["Saldo tabungan", 256000]);
  assert.deepEqual(table.rows[3], ["Arsip poin siswa", 0]);
  const book = await workbook(await exportServices(s, "xlsx"));
  assert.equal(book.worksheets[0].getCell("B3").value, 256000);
  const r = await read(req("format=xlsx"), params);
  await workbook(r);
  assert.equal((await read(req(), params)).status, 200);
});
test("shared query validation rejects invalid date/month/range, missing dependencies and repeated filters before domain reads", async () => {
  const m = setup();
  for (const q of [
    "start=2026-12-02&end=2026-01-01",
    "month=2026-10-23",
    "domains=attendance,attendance",
    "domains=reports",
    "domains=survey-results",
    "start=2026-02-30",
    "classId=bad",
    "domains=unknown",
    "start=2026-10-01&start=2026-10-02",
    "unexpected=1",
  ]) {
    assert.equal((await pack(req(q))).status, 400, q);
  }
  assert.equal(m.operations.length, 0);
  assert.equal(m.calls.filter((c) => c[0] === "app_services_read").length, 0);
  assert.equal(packageQuery.safeParse({ month: "2026-10-01" }).success, true);
});
test("package preserves all five domains, filters, numeric values and safe literal spreadsheet text", async () => {
  const m = setup();
  const book = await workbook(
    await pack(
      req("start=2026-10-01&end=2026-10-23&month=2026-10-01&classId=" + id(3)),
    ),
  );
  for (const n of [
    "attendance",
    "mentoring",
    "fees",
    "savings",
    "discipline",
    "Keterangan",
  ])
    assert.ok(book.getWorksheet(n), n);
  assert.equal(book.getWorksheet("attendance").getCell("B2").value, "=SUM(1)");
  assert.equal(
    book.getWorksheet("attendance-summary").getCell("B3").value,
    1000,
  );
  for (const [actor, session, , f] of m.operations) {
    assert.equal(actor, id(1));
    assert.equal(session, id(2));
    assert.equal(f.classId, id(3));
    assert.equal(f.start, "2026-10-01");
    assert.equal(f.end, "2026-10-23");
    assert.equal(f.export, true);
  }
  assert.equal(
    m.calls.some((c) => c[0] === "app_services_write"),
    false,
  );
});
test("partial, oversized and mixed-revision packages never return a workbook", async () => {
  let m = setup(),
    base = m.operation;
  m.operation = (d) => ({ ...base(d), total: 2 });
  assert.equal((await pack(req("domains=attendance"))).status, 413);
  m = setup();
  base = m.operation;
  m.operation = (d) => ({ ...base(d), revision: d === "mentoring" ? 8 : 7 });
  assert.equal((await pack(req("domains=attendance,mentoring"))).status, 503);
  m = setup();
  m.discipline.revision = 8;
  assert.equal((await pack(req("domains=attendance,discipline"))).status, 503);
  m = setup();
  base = m.operation;
  m.operation = (d) => ({
    ...base(d),
    total: 10001,
    rows: Array.from({ length: 10001 }, () => ({ name: "Synthetic" })),
  });
  assert.equal((await pack(req("domains=attendance"))).status, 413);
});
test("optional reports and survey exports retain academic labels and independent learning revision", async () => {
  const m = setup();
  let book = await workbook(
    await pack(
      req("domains=attendance,reports&classId=" + id(3) + "&semester=1"),
    ),
  );
  const sheet = book.getWorksheet("reports");
  assert.equal(sheet.getCell("B2").value, "2026/2027");
  assert.equal(sheet.getCell("C2").value, "Ganjil");
  assert.equal(sheet.getCell("I2").value, 0);
  assert.equal(sheet.getCell("J2").value, 82);
  m.snapshot = {
    ...state(),
    module: "insights",
    isManager: true,
    extra: {
      aggregates: [{ role: "student", aspect: "A", code: "A1", n: 5, mean: 4 }],
    },
    rows: [],
  };
  m.catalog = {
    ...state(),
    module: "surveys",
    rows: [
      {
        id: id(9),
        title: "Survei",
        academic_year_id: id(8),
        semester: 1,
        starts_on: "2026-07-01",
        ends_on: "2026-12-31",
        status: "closed",
        kind: "main",
        instrument_version: "v1",
        response: null,
        plan: [],
      },
    ],
    extra: { required: [], peers: [] },
  };
  book = await workbook(
    await pack(req("domains=attendance,survey-results&periodId=" + id(9))),
  );
  assert.equal(book.getWorksheet("survey-results").getCell("E2").value, 4);
  m.snapshot.isManager = false;
  assert.equal(
    (await pack(req("domains=survey-results&periodId=" + id(9)))).status,
    403,
  );
});
test("auth/survey/domain-denial and page outages stay protected without inventing reconciliation results", async () => {
  let m = setup();
  m.caller = null;
  assert.equal((await pack(req())).status, 401);
  await assert.rejects(page(params), (e) => e.url === "/login?expired=1");
  m = setup();
  m.survey = true;
  assert.equal((await pack(req())).status, 403);
  m = setup();
  m.operationError = new AccessDenied();
  assert.equal((await pack(req())).status, 403);
  m = setup();
  m.caller.principal.is_admin = false;
  await workbook(await pack(req("domains=attendance")));
  m = setup();
  m.snapshot = null;
  assert.equal((await read(req(), params)).status, 403);
  assert.ok(await page(params));
  m = setup();
  m.snapshot = {};
  assert.equal((await read(req(), params)).status, 503);
  await assert.rejects(page(params), /Reconciliation unavailable/);
  m = setup();
  m.snapshot.extra.tables = -1;
  assert.equal((await read(req(), params)).status, 503);
  m = setup();
  m.snapshot.classes = [m.snapshot.classes[0], m.snapshot.classes[0]];
  assert.equal((await read(req(), params)).status, 503);
});
