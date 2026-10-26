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
  "@/lib/auth/read-server": `export const readServerPrincipal=async()=>globalThis.committeeMocks.caller;`,
  "@/lib/auth/http": `export const privateJson=(body,status=200)=>globalThis.committeeMocks.reply(body,status);export const requestAuth=()=>({});export const verifiedPrincipal=async()=>globalThis.committeeMocks.caller;export const sameOrigin=r=>r.headers.get('origin')===r.nextUrl.origin;`,
  "@/lib/auth/admin": `export const createAuthAdmin=()=>({rpc:async(fn,args)=>{const m=globalThis.committeeMocks;m.calls.push([fn,args]);if(fn==='app_survey_required')return {data:m.survey,error:null};if(fn==='app_operations_write')return {data:m.malformedResult?{}:{code:m.code},error:m.writeError};return {data:m.snapshot,error:m.readError};}});`,
  "@/lib/settings/server": `export const readBounded=async r=>new Uint8Array(await r.arrayBuffer());`,
};
registerHooks({
  resolve(s, c, next) {
    if (s in mocks) return { url: "committee-mock:" + s, shortCircuit: true };
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
    if (url.startsWith("committee-mock:"))
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
const { committeeSnapshot, committeeFilters, paymentContext, monthLocked } =
  await import("../src/lib/operations/committee.ts");
const { exportRows, operationsExport } = await import(
  "../src/lib/operations/export.ts"
);
const id = (n) => `00000000-0000-4000-8000-${String(n).padStart(12, "0")}`;
const params = { params: Promise.resolve({ module: "fees" }) };
const months = (year = 2026) =>
  Array.from({ length: 12 }, (_, i) => ({
    student_id: id(10),
    name: "Siswa",
    month: year + "-" + String(i + 1).padStart(2, "0") + "-01",
    status: "unpaid",
    amount: 0,
    waiverSources: 0,
    tariff: null,
    outstanding: null,
  }));
function setup() {
  return (globalThis.committeeMocks = {
    caller: { principal: { id: id(1) }, sessionId: id(2) },
    calls: [],
    survey: false,
    code: "saved",
    snapshot: {
      module: "fees",
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
      summary: {
        cashReceived: 0,
        waivedMonths: 0,
        unpaidMonths: 12,
        knownOutstanding: 0,
        unknownTariffs: 12,
      },
      extra: { months: months(), trend: [] },
    },
    reply: (b, status = 200) =>
      NextResponse.json(b, {
        status,
        headers: { "Cache-Control": "private, no-store" },
      }),
  });
}
const command = {
  type: "payment",
  id: null,
  studentId: id(10),
  date: "2026-10-22",
  allocations: [
    { month: "2025-12-01", amount: 50000 },
    { month: "2026-01-01", amount: 60000 },
  ],
  notes: "Lintas tahun",
};
function req(query = "", cmd = command, origin = "https://example.test") {
  return new NextRequest("https://example.test/api/operations/fees" + query, {
    method: "POST",
    headers: { Origin: origin, "Content-Type": "application/json" },
    body: JSON.stringify({ requestId: id(3), revision: 1, command: cmd }),
  });
}
const writes = (m) => m.calls.filter((c) => c[0] === "app_operations_write");
const row = (patch = {}) => ({
  id: id(40),
  student_id: id(10),
  name: "Siswa",
  date: "2026-10-02",
  notes: "Catatan",
  amount: 110000,
  allocations: command.allocations,
  can_edit: true,
  ...patch,
});
test("blank filters normalize and unsupported/effective invalid ranges fail before mutation", async () => {
  assert.deepEqual(
    committeeFilters.parse({
      year: "2026",
      start: "",
      end: "",
      studentId: "",
      classId: "",
    }),
    { year: 2026 },
  );
  for (const query of [
    "?year=1999",
    "?year=2026&end=2025-01-01",
    "?start=2026-01-01&end=2028-01-01",
    "?status=Hadir",
    "?classId=invalid",
    "?view=payment&year=2026",
  ]) {
    const m = setup();
    assert.equal((await POST(req(query), params)).status, 400);
    assert.equal(writes(m).length, 0);
  }
});
test("currency, empty/duplicate allocations and edit reasons validate before write", async () => {
  for (const patch of [
    { allocations: [] },
    { allocations: [command.allocations[0], command.allocations[0]] },
    { allocations: [{ month: "2026-01-01", amount: 0 }] },
    { allocations: [{ month: "2026-01-01", amount: 1.5 }] },
    { allocations: [{ month: "2026-01-02", amount: 1000 }] },
    { id: id(40) },
    { id: id(40), reason: "ab" },
  ]) {
    const m = setup();
    assert.equal(
      (await POST(req("", { ...command, ...patch }), params)).status,
      400,
    );
    assert.equal(writes(m).length, 0);
  }
});
test("payment, cross-year correction, zero tariff and void retain identity and additive confirmed contract", async () => {
  for (const cmd of [
    command,
    { ...command, id: id(40), reason: "Koreksi diperiksa" },
    { type: "tariff", classId: id(20), month: "2026-10-01", amount: 0 },
    { type: "void", id: id(40), reason: "Pembayaran ganda" },
  ]) {
    const m = setup(),
      r = await POST(
        req("?year=2026&classId=" + id(20) + "&start=&end=", cmd),
        params,
      );
    assert.equal(r.status, 200);
    const b = await r.json();
    assert.equal(b.result.code, "saved");
    assert.equal(b.code, "saved");
    assert.equal(b.data.module, "fees");
    assert.equal(writes(m)[0][1].p_actor, id(1));
    assert.equal(writes(m)[0][1].p_session, id(2));
    assert.deepEqual(writes(m)[0][1].p_command, cmd);
    assert.equal(m.calls.at(-1)[1].p_filters.classId, id(20));
  }
});
test("payment context accepts only one student/year, keeps scope and rejects mixed history filters", async () => {
  const m = setup(),
    r = await GET(
      new NextRequest(
        "https://example.test/api/operations/fees?view=payment&year=2026&studentId=" +
          id(10),
      ),
      params,
    );
  assert.equal(r.status, 200);
  assert.deepEqual(m.calls.at(-1)[1].p_filters, {
    year: 2026,
    studentId: id(10),
    page: 1,
  });
  for (const query of [
    "view=payment&year=2026",
    "view=payment&year=2026&studentId=" + id(10) + "&classId=" + id(20),
    "view=payment&year=2026&studentId=" + id(10) + "&format=pdf",
  ]) {
    setup();
    assert.equal(
      (
        await GET(
          new NextRequest("https://example.test/api/operations/fees?" + query),
          params,
        )
      ).status,
      400,
    );
  }
});
test("context refuses missing/cross-student/year months; paid/waived lock except original allocation", () => {
  const s = setup().snapshot;
  assert.equal(paymentContext(s, id(10), 2026).extra.months.length, 12);
  for (const ms of [
    s.extra.months.slice(1),
    [...s.extra.months.slice(1), { ...s.extra.months[0], student_id: id(11) }],
    months(2025),
  ])
    assert.throws(() =>
      paymentContext({ ...s, extra: { ...s.extra, months: ms } }, id(10), 2026),
    );
  s.extra.months[0] = {
    ...s.extra.months[0],
    status: "paid",
    amount: 60000,
    outstanding: 0,
  };
  s.extra.months[1] = {
    ...s.extra.months[1],
    status: "waived",
    waiverSources: 1,
    outstanding: 0,
  };
  assert.equal(monthLocked(s, "2026-01-01", id(10), null), true);
  assert.equal(monthLocked(s, "2026-02-01", id(10), null), true);
  assert.equal(monthLocked(s, "2026-03-01", id(10), null), false);
  assert.equal(monthLocked(s, "2026-01-01", id(10), row()), false);
  assert.equal(monthLocked(s, "2026-01-01", id(11), row()), true);
});
test("snapshot rejects unsafe totals, amount/allocation mismatch and missing tariff confused with zero", () => {
  const s = setup().snapshot;
  for (const patch of [
    { revision: -1 },
    { summary: { cashReceived: Number.MAX_SAFE_INTEGER + 1 } },
    { rows: [row({ amount: 1 })], total: 1 },
    {
      extra: { ...s.extra, months: [{ ...s.extra.months[0], outstanding: 0 }] },
    },
  ])
    assert.equal(
      committeeSnapshot.safeParse({ ...s, ...patch }).success,
      false,
    );
  const zero = { ...s.extra.months[0], tariff: 0, outstanding: 0 };
  assert.equal(
    committeeSnapshot.safeParse({ ...s, extra: { ...s.extra, months: [zero] } })
      .success,
    true,
  );
});
test("conflicts have explicit machine codes and no false snapshot; failed acknowledgement/read is uncertain", async () => {
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
  }
  for (const change of [
    { malformedResult: true },
    { code: "unknown" },
    { readError: { message: "private upstream" } },
    { snapshot: { module: "fees" } },
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
test("session, survey and Origin guards prevent any write", async () => {
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
test("actual exports preserve cross-year allocations, unknown tariffs and zero-cash waiver statuses", async () => {
  for (const format of ["xlsx", "pdf"]) {
    const m = setup();
    m.snapshot.rows = [row({notes:"W".repeat(2000)})];
    m.snapshot.total = 1;
    m.snapshot.extra.months[0] = {
      ...m.snapshot.extra.months[0],
      status: "waived",
      waiverSources: 2,
      outstanding: 0,
    };
    const r = await GET(
      new NextRequest(
        "https://example.test/api/operations/fees?year=2026&studentId=" +
          id(10) +
          "&format=" +
          format,
      ),
      params,
    );
    assert.equal(r.status, 200);
    const bytes = new Uint8Array(await r.arrayBuffer());
    assert.ok(bytes.length > 100);
    if(format === "pdf"){const {PDFDocument}=await import("pdf-lib");assert.ok((await PDFDocument.load(bytes)).getPageCount()>1);}
    assert.equal(m.calls.at(-1)[1].p_filters.export, true);
    if (format === "xlsx") {
      const { default: ExcelJS } = await import("exceljs");
      const book = new ExcelJS.Workbook();
      await book.xlsx.load(Buffer.from(bytes));
      assert.ok(
        book
          .getWorksheet("Riwayat")
          .getRow(3)
          .values.some(
            (v) =>
              typeof v === "string" &&
              v.includes("2025-12") &&
              v.includes("2026-01"),
          ),
      );
      assert.equal(
        book.getWorksheet("Status bulan").getRow(2).getCell(4).value,
        0,
      );
      assert.equal(
        book.getWorksheet("Status bulan").getRow(2).getCell(5).value,
        "Tarif belum ditetapkan",
      );
    }
  }
  const s = setup().snapshot;
  s.rows = [row()];
  s.total = 1;
  assert.ok(exportRows(s).headers.includes("Bulan iuran / nominal"));
  await assert.rejects(
    operationsExport(
      {
        ...s,
        extra: { ...s.extra, months: Array(10001).fill(s.extra.months[0]) },
      },
      "pdf",
    ),
    RangeError,
  );
});
test("malformed upstream data is service failure and page exposes retry boundary", async () => {
  const m = setup();
  m.snapshot.rows = [row({ amount: 1 })];
  assert.equal(
    (
      await GET(
        new NextRequest("https://example.test/api/operations/fees"),
        params,
      )
    ).status,
    503,
  );
  await assert.rejects(page(params), /Operations unavailable/);
});
