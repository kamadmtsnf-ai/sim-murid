import test from "node:test";
import assert from "node:assert/strict";
import { registerHooks } from "node:module";
import { readFileSync, existsSync, statSync } from "node:fs";
import { resolve, dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import ts from "typescript";
import { NextRequest, NextResponse } from "next/server.js";
globalThis.jobsReply = (b, s) => NextResponse.json(b, { status: s });
const mocks = {
  "server-only": "export {};",
  panel: "export const ServicesPanel=()=>null;",
  "next/navigation": `export const redirect=url=>{const e=Error('redirect');e.url=url;throw e;};export const notFound=()=>{throw Error('not_found')};`,
  "@/lib/auth/read-server": `export const readServerPrincipal=async()=>globalThis.jobsMocks.caller;`,
  "@/lib/auth/http": `export const privateJson=(b,s=200)=>globalThis.jobsReply(b,s);export const requestAuth=()=>({});export const verifiedPrincipal=async()=>globalThis.jobsMocks.caller;export const sameOrigin=r=>r.headers.get('origin')===r.nextUrl.origin;`,
  "@/lib/auth/authorization": `export class AccessDenied extends Error{};`,
  "@/lib/settings/server": `export const readBounded=async(r,max)=>{const b=new Uint8Array(await r.arrayBuffer());if(b.byteLength>max)throw new RangeError('Large');return b;};`,
  "@/lib/auth/admin": `export const createAuthAdmin=()=>({rpc:async(fn,args)=>{const m=globalThis.jobsMocks;m.calls.push([fn,args]);return m.rpc(fn,args);}});`,
  nodemailer: `export default {createTransport:()=>({sendMail:async()=>{if(globalThis.jobsMocks.providerError)throw globalThis.jobsMocks.providerError;return {accepted:['synthetic@example.org'],messageId:'synthetic'};},close:()=>{}})};`,
  "@/lib/email/gmail": `export const emailEnvironment=()=>({email:'synthetic@example.org',password:'synthetic',name:'Fixture',secret:'fixture'});`,
};
registerHooks({
  resolve(s, c, next) {
    if (s === "./panel") return { url: "jobs-mock:panel", shortCircuit: true };
    if (s in mocks) return { url: "jobs-mock:" + s, shortCircuit: true };
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
    if (url.startsWith("jobs-mock:"))
      return {
        format: "module",
        source: mocks[url.slice(10)],
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
const { POST: dispatch } = await import(
  "../src/app/api/services/dispatch/route.ts"
);
const { dispatchDelivery } = await import("../src/lib/services/dispatch.ts");
const { default: page } = await import(
  "../src/app/account/services/[module]/page.tsx"
);
const id = (n) => `00000000-0000-4000-8000-${String(n).padStart(12, "0")}`;
const row = {
  id: id(3),
  event_type: "reminder",
  channel: "email",
  status: "queued",
  attempts: 1,
  created_at: "2026-10-23T10:00:00Z",
  available_at: "2026-10-23T10:00:00Z",
  locked_until: null,
  last_error_code: null,
};
const snapshot = () => ({
  module: "jobs",
  revision: 1,
  today: "2026-10-23",
  month: "2026-10-01",
  isAdmin: true,
  isManager: false,
  rows: [row],
  extra: { jobs: [] },
  years: [],
  classes: [],
  subjects: [],
});
function setup() {
  const m = (globalThis.jobsMocks = {
    caller: { principal: { id: id(1), is_admin: true }, sessionId: id(2) },
    calls: [],
    snapshot: snapshot(),
    ack: {
      code: "saved",
      dryRun: true,
      reminderCandidates: 0,
      date: "2026-10-23",
      hourWib: 21,
    },
    claim: { code: "empty" },
    complete: { code: "saved" },
  });
  m.rpc = async (fn) => ({
    error: null,
    data:
      fn === "app_survey_required"
        ? false
        : fn === "app_services_read"
          ? m.snapshot
          : fn === "app_services_write"
            ? m.ack
            : fn === "app_delivery_worker"
              ? m.claim
              : null,
  });
  return m;
}
const params = { params: Promise.resolve({ module: "jobs" }) };
const request = (
  command = { type: "tick", dryRun: true },
  origin = "https://sim.test",
) =>
  new NextRequest("https://sim.test/api/services/jobs", {
    method: "POST",
    headers: { origin, "Content-Type": "application/json" },
    body: JSON.stringify({ requestId: id(9), revision: 0, command }),
  });
test("jobs read validates snapshot/module/admin and exposes configuration booleans only", async () => {
  const m = setup();
  const r = await GET(request(), params);
  assert.equal(r.status, 200);
  const b = await r.json();
  assert.equal(typeof b.data.extra.providers.gmail, "boolean");
  assert.equal(JSON.stringify(b).includes("APP_PASSWORD"), false);
  m.snapshot.rows = [row, row];
  assert.equal((await GET(request(), params)).status, 503);
});
test("tick and retry require known ack, correct readback and revision", async () => {
  let m = setup();
  assert.equal((await POST(request(), params)).status, 200);
  for (const ack of [
    null,
    { code: "mystery" },
    { code: "saved" },
    {
      code: "saved",
      dryRun: false,
      reminderCandidates: 1,
      date: "2026-10-23",
      hourWib: 21,
    },
  ]) {
    m = setup();
    m.ack = ack;
    assert.equal((await POST(request(), params)).status, 503);
  }
  m = setup();
  m.snapshot.revision = 2;
  assert.equal((await POST(request(), params)).status, 503);
  m = setup();
  m.ack = { code: "saved", id: id(3) };
  assert.equal(
    (await POST(request({ type: "retry", id: id(3) }), params)).status,
    200,
  );
  m.snapshot.rows[0] = { ...row, status: "ambiguous" };
  assert.equal(
    (await POST(request({ type: "retry", id: id(3) }), params)).status,
    503,
  );
});
test("anonymous, foreign origin, malformed commands and required survey prevent writes", async () => {
  let m = setup();
  m.caller = null;
  assert.equal((await POST(request(), params)).status, 401);
  m = setup();
  assert.equal(
    (await POST(request(undefined, "https://foreign.test"), params)).status,
    403,
  );
  assert.equal(
    (await POST(request({ type: "retry", id: "bad" }), params)).status,
    400,
  );
  assert.equal(
    m.calls.some((c) => c[0] === "app_services_write"),
    false,
  );
  const base = m.rpc;
  m.rpc = async (fn) =>
    fn === "app_survey_required" ? { data: true, error: null } : base(fn);
  assert.equal((await POST(request(), params)).status, 403);
});
test("dispatch checks Admin and completed SQL gate before claiming delivery", async () => {
  let m = setup();
  m.caller.principal.is_admin = false;
  assert.equal((await dispatch(request())).status, 403);
  assert.equal(
    m.calls.some((c) => c[0] === "app_delivery_worker"),
    false,
  );
  m = setup();
  m.snapshot = null;
  assert.equal((await dispatch(request())).status, 403);
  m = setup();
  const r = await dispatch(request());
  assert.equal(r.status, 200);
  assert.equal((await r.json()).code, "empty");
});
test("delivery acknowledges provider acceptance only after saved completion; timeout stays ambiguous", async () => {
  for (const state of ["sent", "ambiguous", "unconfirmed", "unknown"]) {
    const m = setup();
    m.claim = {
      code: "claimed",
      delivery: {
        id: id(3),
        channel: "email",
        idempotency_key: "synthetic",
        payload: {
          email: "synthetic@example.org",
          title: "Fixture",
          message: "No real send",
        },
      },
    };
    if (state === "ambiguous") m.providerError = Error("timeout");
    const base = m.rpc;
    m.rpc = async (fn, args) =>
      fn === "app_delivery_worker" && args.p_action === "complete"
        ? {
            data:
              state === "unconfirmed"
                ? { code: "not_found" }
                : state === "unknown"
                  ? null
                  : { code: "saved" },
            error: null,
          }
        : base(fn, args);
    const result = await dispatchDelivery();
    assert.equal(result.code, state === "unknown" ? "unconfirmed" : state);
  }
  const m = setup();
  m.claim = { code: "mystery" };
  await assert.rejects(dispatchDelivery());
});
test("page keeps login redirect and service outages are retryable", async () => {
  let m = setup();
  m.caller = null;
  await assert.rejects(page(params), (e) => e.url === "/login?expired=1");
  m = setup();
  m.snapshot = {};
  await assert.rejects(page(params), /Jobs unavailable/);
  m = setup();
  m.snapshot = null;
  assert.ok(await page(params));
});

test("WhatsApp adapter preserves idempotency, validates HTTPS config and classifies uncertain network results", async () => {
  const oldFetch = globalThis.fetch,
    oldUrl = process.env.WHATSAPP_API_URL,
    oldKey = process.env.WHATSAPP_API_KEY;
  try {
    process.env.WHATSAPP_API_URL = "https://provider.fixture/send";
    process.env.WHATSAPP_API_KEY = "synthetic-key";
    for (const outcome of ["sent", "failed", "ambiguous", "invalid"]) {
      const m = setup();
      m.claim = {
        code: "claimed",
        delivery: {
          id: id(3),
          channel: "whatsapp",
          idempotency_key: "fixture-dedup",
          payload: {
            phone: "synthetic-phone",
            title: "Fixture",
            message: "Synthetic message",
          },
        },
      };
      const base = m.rpc;
      m.rpc = async (fn, args) =>
        fn === "app_delivery_worker" && args.p_action === "complete"
          ? { data: { code: "saved" }, error: null }
          : base(fn, args);
      let calls = 0;
      globalThis.fetch = async (url, options) => {
        calls++;
        assert.equal(options.headers["Idempotency-Key"], "fixture-dedup");
        assert.equal(JSON.parse(options.body).to, "synthetic-phone");
        if (outcome === "ambiguous") throw Error("timeout");
        return new Response("", { status: outcome === "failed" ? 400 : 200 });
      };
      process.env.WHATSAPP_API_URL =
        outcome === "invalid"
          ? "http://provider.fixture/send"
          : "https://provider.fixture/send";
      assert.equal(
        (await dispatchDelivery()).code,
        outcome === "invalid" ? "failed" : outcome,
      );
      assert.equal(calls, outcome === "invalid" ? 0 : 1);
    }
  } finally {
    globalThis.fetch = oldFetch;
    if (oldUrl === undefined) delete process.env.WHATSAPP_API_URL;
    else process.env.WHATSAPP_API_URL = oldUrl;
    if (oldKey === undefined) delete process.env.WHATSAPP_API_KEY;
    else process.env.WHATSAPP_API_KEY = oldKey;
  }
});
