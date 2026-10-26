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
  nodemailer: `export default {createTransport:()=>({sendMail:async()=>{globalThis.savingsMocks.smtp++;return {accepted:['verified@example.test'],messageId:'synthetic'}},close(){}})};`,
  "@/lib/email/gmail": `export const emailEnvironment=()=>({name:'Test',email:'test@example.test',appPassword:'synthetic'});`,
  "@/lib/email/gmail-config": `export const gmailTransportOptions=()=>({});export const gmailFailureReason=()=> 'connection';`,

  "server-only": "export {};",
  "next/link": "export default function Link(){};",
  "next/navigation": `export const notFound=()=>{throw Error('not found')};export const redirect=url=>{const e=Error('redirect');e.url=url;throw e};`,
  "@/lib/auth/read-server": `export const readServerPrincipal=async()=>globalThis.savingsMocks.caller;`,
  "@/lib/auth/http": `export const privateJson=(body,status=200)=>globalThis.savingsMocks.reply(body,status);export const requestAuth=()=>({});export const verifiedPrincipal=async()=>globalThis.savingsMocks.caller;export const sameOrigin=r=>r.headers.get('origin')===r.nextUrl.origin;`,
  "@/lib/auth/admin": `export const createAuthAdmin=()=>({rpc:async(fn,args)=>{const m=globalThis.savingsMocks;m.calls.push([fn,args]);if(fn==='app_survey_required')return {data:m.survey,error:null};if(fn==='app_fee_quote')return {data:m.quote,error:m.quoteError};if(fn==='app_slip_read')return {data:m.slip,error:m.slipError};if(fn==='app_slip_delivery'){m.actions.push(args.p_action);return {data:args.p_action==='queue'?{code:'queued',count:1}:args.p_action==='claim'?{code:'claimed',id:m.id(90),email:'verified@example.test'}:{code:'saved'},error:args.p_action==='complete'?m.completeError:null};}if(fn==='app_operations_write')return {data:m.malformedResult?{}:{code:m.code},error:m.writeError};return {data:m.snapshot,error:m.readError};}});`,
  "@/lib/settings/server": `export const readBounded=async r=>new Uint8Array(await r.arrayBuffer());`,
};
registerHooks({
  resolve(s, c, next) {
    if (s in mocks) return { url: "savings-mock:" + s, shortCircuit: true };
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
    if (url.startsWith("savings-mock:"))
      return {
        format: "module",
        source: mocks[url.slice(13)],
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
const { GET: quoteGET } = await import("../src/app/api/slips/quote/route.ts");
const { POST: sendSlip, GET: readSlip } = await import(
  "../src/app/api/slips/[id]/route.ts"
);
const { savingsSnapshot, savingsFilters, savingsAmount, parseFeeQuote } =
  await import("../src/lib/operations/savings.ts");
const { commandSchemas } = await import("../src/lib/operations/validation.ts");
const { exportRows, operationsExport } = await import(
  "../src/lib/operations/export.ts"
);
const id = (n) => `00000000-0000-4000-8000-${String(n).padStart(12, "0")}`;
const params = { params: Promise.resolve({ module: "savings" }) },
  slipParams = { params: Promise.resolve({ id: id(80) }) };
const row = (patch = {}) => ({
  id: id(40),
  account_id: id(30),
  student_id: id(10),
  name: "Siswa",
  date: "2026-10-22",
  kind: "withdrawal",
  amount: 123000,
  delta: -123000,
  balance_before: 200000,
  balance: 77000,
  notes: "Catatan",
  reverses_id: null,
  reversed: false,
  can_edit: true,
  slip_id: id(80),
  fee: 1000,
  cash_received: 122000,
  ...patch,
});
function setup() {
  return (globalThis.savingsMocks = {
    id,
    caller: { principal: { id: id(1) }, sessionId: id(2) },
    calls: [],
    actions: [],
    smtp: 0,
    survey: false,
    code: "saved",
    snapshot: {
      module: "savings",
      today: "2026-10-22",
      revision: 1,
      canManage: true,
      isAdmin: true,
      people: [],
      classes: [],
      rows: [row()],
      total: 1,
      page: 1,
      pageSize: 50,
      summary: {
        balance: 77000,
        periodNet: -123000,
        deposits: 0,
        withdrawals: 123000,
      },
      extra: {
        accounts: [
          {
            id: id(30),
            owner_id: id(10),
            name: "Siswa",
            category: "S",
            balance: 77000,
          },
        ],
        brackets: [],
        trend: [{ month: "2026-10", value: -123000 }],
      },
    },
    quote: {
      applied: true,
      bracket: null,
      raw: 1230,
      fee: 1000,
      cash: 122000,
      policy: "FEE-1.0",
      matched: false,
    },
    slip: {
      reversed: false,
      snapshot: {
        transaction: { id: id(40), account_id: id(30), amount: 123000 },
        fee: {
          applied: true,
          bracket: null,
          raw: 1230,
          fee: 1000,
          cash: 122000,
          policy: "FEE-1.0",
          matched: false,
        },
      },
      deliveries: [],
    },
    reply: (b, status = 200) =>
      NextResponse.json(b, {
        status,
        headers: { "Cache-Control": "private, no-store" },
      }),
  });
}
const command = {
  type: "transaction",
  id: null,
  accountId: id(30),
  kind: "deposit",
  date: "2026-10-22",
  amount: 1000,
  feeApplied: false,
  reason: "Setoran",
};
function req(cmd = command, origin = "https://example.test", query = "") {
  return new NextRequest(
    "https://example.test/api/operations/savings" + query,
    {
      method: "POST",
      headers: { Origin: origin, "Content-Type": "application/json" },
      body: JSON.stringify({ requestId: id(3), revision: 1, command: cmd }),
    },
  );
}
test("savings enforces ledger, gross fee/cash consistency and signed trend", () => {
  const m = setup();
  assert.equal(savingsSnapshot.parse(m.snapshot).extra.trend[0].value, -123000);
  for (const patch of [
    { balance: 1 },
    { delta: 123000 },
    { fee: 2000 },
    { kind: "reversal" },
    { reversed: true },
  ])
    assert.equal(
      savingsSnapshot.safeParse({ ...m.snapshot, rows: [row(patch)] }).success,
      false,
    );
});
test("amount and date filters reject invalid ranges and normalize empty controls", () => {
  for (const n of [0, -1000, 1001, Infinity, 1e12 + 1000])
    assert.equal(savingsAmount.safeParse(n).success, false);
  assert.deepEqual(
    savingsFilters.parse({ studentId: "", start: "", year: "2026" }),
    { year: 2026 },
  );
  for (const f of [
    { start: "2026-12-01", end: "2026-01-01" },
    { start: "2024-01-01", end: "2026-01-01" },
    { arbitrary: "yes" },
  ])
    assert.equal(savingsFilters.safeParse(f).success, false);
});
test("fee quote verifies amount/applied and keeps a true zero fee flag", () => {
  const m = setup();
  assert.equal(parseFeeQuote(m.quote, 123000, true).fee, 1000);
  assert.throws(() => parseFeeQuote(m.quote, 124000, true));
  assert.throws(() => parseFeeQuote(m.quote, 123000, false));
  assert.equal(
    parseFeeQuote({ ...m.quote, fee: 0, cash: 123000 }, 123000, true).applied,
    true,
  );
});
test("bracket corrections require reason and database-compatible precision", () => {
  const b = {
    type: "bracket",
    id: id(60),
    minimum: 0,
    maximum: null,
    percent: 1,
    active: true,
    reason: "Koreksi",
  };
  assert.equal(commandSchemas.savings.safeParse(b).success, true);
  assert.equal(
    commandSchemas.savings.safeParse({ ...b, reason: "" }).success,
    false,
  );
  assert.equal(
    commandSchemas.savings.safeParse({ ...b, percent: 1.12345 }).success,
    false,
  );
});
test("saved response includes verified snapshot and preserves legacy result/message", async () => {
  setup();
  const r = await POST(req(), params),
    b = await r.json();
  assert.equal(r.status, 200);
  assert.equal(b.result.code, "saved");
  assert.equal(b.code, "saved");
  assert.equal(b.data.extra.accounts[0].balance, 77000);
  assert.ok(b.message);
});
test("account creation returns unfiltered catalog for immediate transaction entry", async () => {
  setup();
  const r = await POST(
    req({ type: "account", ownerId: id(10), category: "S" }),
    params,
  );
  assert.equal(r.status, 200);
  assert.equal((await r.json()).data.extra.catalogAccounts.length, 1);
});
test("uncertain acknowledgement or malformed post-write read never reports saved", async () => {
  for (const patch of [
    { malformedResult: true },
    { code: "unknown" },
    { readError: { message: "secret" } },
    { snapshot: { module: "savings" } },
  ]) {
    Object.assign(setup(), patch);
    const r = await POST(req(), params);
    assert.equal(r.status, 503);
    assert.equal(JSON.stringify(await r.json()).includes("secret"), false);
  }
});
test("definitive insufficient/overlap feedback is retained", async () => {
  for (const code of ["insufficient", "overlap"]) {
    setup().code = code;
    const r = await POST(req(), params);
    assert.equal(r.status, 409);
    const b = await r.json();
    assert.equal(b.code, code);
    assert.ok(b.message.length > 15);
  }
});
test("auth, origin, survey and malformed input prevent writes", async () => {
  for (const scenario of ["anonymous", "origin", "survey", "invalid"]) {
    const m = setup();
    if (scenario === "anonymous") m.caller = null;
    if (scenario === "survey") m.survey = true;
    const r = await POST(
      req(
        scenario === "invalid" ? { ...command, amount: 1001 } : command,
        scenario === "origin" ? "https://foreign.test" : "https://example.test",
      ),
      params,
    );
    assert.ok([400, 401, 403].includes(r.status));
    assert.equal(
      m.calls.filter((c) => c[0] === "app_operations_write").length,
      0,
    );
  }
});
test("read validates upstream and export is complete PDF/XLSX with fee/cash", async () => {
  setup();
  const r = await GET(
    new NextRequest("https://example.test/api/operations/savings"),
    params,
  );
  assert.equal(r.status, 200);
  const data = (await r.json()).data;
  assert.ok(exportRows(data).headers.includes("Biaya penarikan"));
  for (const f of ["pdf", "xlsx"])
    assert.ok((await operationsExport(data, f)).length > 100);
  setup().snapshot.revision = -1;
  assert.equal(
    (
      await GET(
        new NextRequest("https://example.test/api/operations/savings"),
        params,
      )
    ).status,
    503,
  );
});
test("quote endpoint rejects invalid controls and malformed upstream", async () => {
  setup();
  assert.equal(
    (
      await quoteGET(
        new NextRequest(
          "https://example.test/api/slips/quote?amount=123000&apply=true",
        ),
      )
    ).status,
    200,
  );
  assert.equal(
    (
      await quoteGET(
        new NextRequest(
          "https://example.test/api/slips/quote?amount=123000&apply=yes",
        ),
      )
    ).status,
    400,
  );
  setup().quote.cash = 1;
  assert.equal(
    (
      await quoteGET(
        new NextRequest(
          "https://example.test/api/slips/quote?amount=123000&apply=true",
        ),
      )
    ).status,
    503,
  );
});
test("slip preparation failure never claims a delivery or calls SMTP", async () => {
  const m = setup();
  m.slipError = { message: "secret" };
  const r = await sendSlip(req(), slipParams);
  assert.equal(r.status, 503);
  assert.deepEqual(m.actions, ["queue"]);
  assert.equal(m.smtp, 0);
});
test("SMTP acceptance with failed completion is explicitly uncertain", async () => {
  const m = setup();
  m.completeError = { message: "secret" };
  const r = await sendSlip(req(), slipParams);
  assert.equal(r.status, 503);
  assert.equal((await r.json()).status, "ambiguous");
  assert.equal(m.smtp, 1);
  assert.deepEqual(m.actions, ["queue", "claim", "complete"]);
});
test("slip success is confirmed and unauthenticated read is denied", async () => {
  const m = setup();
  assert.equal((await sendSlip(req(), slipParams)).status, 200);
  assert.equal(m.smtp, 1);
  m.caller = null;
  assert.equal(
    (
      await readSlip(
        new NextRequest("https://example.test/api/slips/" + id(80)),
        slipParams,
      )
    ).status,
    401,
  );
});
test("HTML slip wraps long names, escapes markup and keeps private download headers", async () => {
  const m = setup();
  m.slip.snapshot.owner = { full_name: "<script>alert(1)</script>" };
  const r = await readSlip(
    new NextRequest(
      "https://example.test/api/slips/" + id(80) + "?format=html",
    ),
    slipParams,
  );
  assert.equal(r.status, 200);
  assert.equal(r.headers.get("Cache-Control"), "no-store");
  const html = await r.text();
  assert.ok(html.includes('name="viewport"'));
  assert.ok(html.includes("overflow-wrap:anywhere"));
  assert.equal(html.includes("<script>"), false);
});
