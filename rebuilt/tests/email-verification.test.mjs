import test from "node:test";
import assert from "node:assert/strict";
import { registerHooks } from "node:module";
import { readFileSync, existsSync, statSync } from "node:fs";
import { resolve, dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import ts from "typescript";
import { NextRequest, NextResponse } from "next/server.js";
globalThis.emailUiReply = (b, s) =>
  NextResponse.json(b, {
    status: s,
    headers: { "Cache-Control": "private, no-store" },
  });
const mocks = {
  "server-only": "export {};",
  panel: "export const EmailPanel=()=>null;",
  "next/navigation": `export const redirect=url=>{const e=Error('redirect');e.url=url;throw e;};`,
  "@/lib/auth/read-server": `export const readServerPrincipal=async()=>{const m=globalThis.emailUiMocks;if(m.redirect){const e=Error('redirect');e.url=m.redirect;throw e;}return m.caller;};`,
  "@/lib/auth/security": `export const securityState=async()=>{const m=globalThis.emailUiMocks;if(m.securityError)throw Error('Security unavailable');return {gate:m.state?.verified?'ready':'email_pending',destination:'/account',question_code:'q1',role:'teacher',can_set_question:true};};`,
  "@/lib/auth/http": `export const privateJson=(b,s=200)=>globalThis.emailUiReply(b,s);export const requestAuth=(r,jar)=>{jar.cookies.set('refreshed','synthetic');return {};};export const verifiedPrincipal=async()=>globalThis.emailUiMocks.caller;export const sameOrigin=r=>r.headers.get('origin')===new URL(r.url).origin;`,
  "@/lib/auth/admin": `export const createAuthAdmin=()=>({rpc:(...args)=>globalThis.emailUiMocks.rpc(...args)});`,
  "./gmail": `export const emailEnvironment=()=>({secret:'synthetic-secret-for-tests-only-123456789'});export const sendOtp=async(...args)=>{const m=globalThis.emailUiMocks;m.emails.push(args);if(m.smtpError)throw Error('private SMTP error');return 'synthetic-message';};`,
  "@/lib/email/gmail": `export const emailEnvironment=()=>({secret:'synthetic-secret-for-tests-only-123456789'});`,
};
registerHooks({
  resolve(s, c, next) {
    if (s === "./email-panel")
      return { url: "emailui-mock:panel", shortCircuit: true };
    if (s in mocks) return { url: "emailui-mock:" + s, shortCircuit: true };
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
    if (url.startsWith("emailui-mock:"))
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

const { GET, POST } = await import("../src/app/api/account/email/route.ts");
const { default: page } = await import("../src/app/account/email/page.tsx");
const { reserveAndSend } = await import("../src/lib/email/service.ts");
const { emailStateSchema, emailTiming } = await import(
  "../src/lib/email/validation.ts"
);
const id = (n) => `00000000-0000-4000-8000-${String(n).padStart(12, "0")}`;
const sample = () => ({
  email: "teacher@example.org",
  verified: false,
  sent_today: 1,
  challenge: {
    id: id(3),
    expires_at: "2026-10-23T12:10:00Z",
    retry_at: "2026-10-23T12:01:00Z",
    status: "pending",
    delivery_state: "accepted",
    attempts_remaining: 5,
  },
});
function setup() {
  const m = (globalThis.emailUiMocks = {
    caller: { principal: { id: id(1), username: "teacher" }, sessionId: id(2) },
    state: sample(),
    calls: [],
    emails: [],
    reserveCode: "reserved",
    consume: true,
    delivery: true,
  });
  m.rpc = async (fn, args) => {
    m.calls.push([fn, args]);
    if (m.rpcError === fn)
      return { data: null, error: { message: "private SQL" } };
    if (m.rpcThrow === fn) throw Error("private SQL thrown");
    if (fn === "app_email_state") return { data: m.state, error: null };
    if (fn === "app_email_context")
      return {
        data: m.context ?? {
          user_id: id(1),
          username: "teacher",
          email: "teacher@example.org",
          purpose: "verify",
        },
        error: null,
      };
    if (fn === "app_email_consume") {
      if (m.consume === true && m.state) m.state.verified = true;
      return { data: m.consume, error: null };
    }
    if (fn === "app_email_reserve")
      return {
        data:
          m.reserveCode === "reserved"
            ? {
                code: "reserved",
                id: args.p_id,
                email: "teacher@example.org",
                name: "Guru uji",
                expires_at: "2026-10-23T12:10:00Z",
              }
            : { code: m.reserveCode, retry_after: 45 },
        error: null,
      };
    if (fn === "app_email_delivery")
      return {
        data: m.delivery,
        error: m.deliveryError
          ? { message: "private recording failure" }
          : null,
      };
    return { data: null, error: null };
  };
  return m;
}
const req = (body = { action: "send" }, opts = {}) =>
  new NextRequest("https://app.test/api/account/email", {
    method: opts.method ?? "POST",
    headers: {
      origin: opts.origin ?? "https://app.test",
      "Content-Type": "application/json",
      ...opts.headers,
    },
    ...((opts.method ?? "POST") === "POST"
      ? { body: typeof body === "string" ? body : JSON.stringify(body) }
      : {}),
  });
const verify = { action: "verify", challengeId: id(3), code: "001234" };
test("email verification authenticates, denies CSRF, preserves cookies and private cache", async () => {
  let m = setup();
  m.caller = null;
  assert.equal((await GET(req(null, { method: "GET" }))).status, 401);
  assert.equal((await POST(req())).status, 401);
  assert.equal(m.calls.length, 0);
  m = setup();
  assert.equal(
    (await POST(req({ action: "send" }, { origin: "https://foreign.test" })))
      .status,
    403,
  );
  assert.equal(m.emails.length, 0);
  const r = await GET(req(null, { method: "GET" }));
  assert.equal(r.status, 200);
  assert.match(r.headers.get("cache-control"), /no-store/);
  assert.match(r.headers.get("set-cookie"), /refreshed/);
  const b = await r.json();
  assert.ok(b.serverTime);
  assert.equal(b.state.email, m.state.email);
});
test("email commands/body bound reject forged identity, malformed JSON, oversized UTF-8 and content-length", async () => {
  for (const body of [
    { action: "send", userId: id(9) },
    { ...verify, code: "12x456" },
    "{",
  ]) {
    const m = setup();
    assert.equal((await POST(req(body))).status, 400);
    assert.equal(m.emails.length, 0);
    assert.ok(!m.calls.some((c) => c[0] === "app_email_consume"));
  }
  setup();
  assert.equal(
    (
      await POST(
        req({ action: "send" }, { headers: { "content-length": "3000" } }),
      )
    ).status,
    413,
  );
  const body = JSON.stringify({ action: "send", pad: "界".repeat(800) });
  assert.ok(body.length < 2048 && Buffer.byteLength(body) > 2048);
  assert.equal((await POST(req(body))).status, 413);
});
test("send binds caller and purpose, reserves digest, never leaks plaintext OTP into response", async () => {
  const m = setup(),
    r = await POST(req());
  assert.equal(r.status, 200);
  const reserve = m.calls.find((c) => c[0] === "app_email_reserve")[1];
  assert.equal(reserve.p_user, id(1));
  assert.equal(reserve.p_session, id(2));
  assert.equal(reserve.p_purpose, "verify");
  assert.equal(reserve.p_expected_email, "teacher@example.org");
  assert.match(reserve.p_hash, /^hmac\$v1\$/);
  const body = await r.json();
  assert.ok(!Object.values(body).includes(m.emails[0][2]));
  assert.ok(!("code" in body) && !("otp_hash" in body));
  assert.equal(m.emails.length, 1);
  assert.equal(
    m.calls.find((c) => c[0] === "app_email_delivery")[1].p_accepted,
    true,
  );
});
test("already verified send is a no-op and role/gate denial does not send", async () => {
  let m = setup();
  m.state.verified = true;
  assert.equal((await POST(req())).status, 200);
  assert.equal(m.emails.length, 0);
  assert.ok(!m.calls.some((c) => c[0] === "app_email_reserve"));
  m = setup();
  m.state = null;
  assert.equal((await GET(req(null, { method: "GET" }))).status, 403);
  assert.equal((await POST(req())).status, 403);
  assert.equal(m.emails.length, 0);
});
test("rate limits and invalid email never invoke SMTP, Retry-After payload preserved", async () => {
  for (const code of [
    "cooldown",
    "daily_limit",
    "global_limit",
    "invalid_email",
    "address_changed",
    "busy",
  ]) {
    const m = setup();
    m.reserveCode = code;
    const r = await POST(req());
    assert.equal(
      r.status,
      ["cooldown", "daily_limit", "global_limit"].includes(code) ? 429 : 400,
    );
    assert.equal((await r.json()).retry_after, 45);
    assert.equal(m.emails.length, 0);
  }
});
test("foreign/recovery context cannot consume verification OTP", async () => {
  for (const patch of [{ user_id: id(9) }, { purpose: "recovery" }]) {
    const m = setup();
    m.context = {
      user_id: id(1),
      username: "teacher",
      email: "teacher@example.org",
      purpose: "verify",
      ...patch,
    };
    assert.equal((await POST(req(verify))).status, 400);
    assert.ok(!m.calls.some((c) => c[0] === "app_email_consume"));
  }
});
test("verify preserves leading zero and requires actual boolean consume acknowledgement", async () => {
  let m = setup();
  let r = await POST(req(verify));
  assert.equal(r.status, 200);
  assert.equal((await r.json()).state.gate, "ready");
  assert.match(
    m.calls.find((c) => c[0] === "app_email_consume")[1].p_hash,
    /^hmac\$v1\$/,
  );
  for (const value of [false, {}, "true"]) {
    m = setup();
    m.consume = value;
    r = await POST(req(verify));
    assert.equal(r.status, 400);
  }
});
test("SMTP rejection records failure but accepted SMTP plus lost DB acknowledgement is never marked failed", async () => {
  let m = setup();
  m.smtpError = true;
  assert.equal(
    (await reserveAndSend(id(1), id(2), "teacher@example.org", "verify")).code,
    "delivery_failed",
  );
  assert.equal(
    m.calls.find((c) => c[0] === "app_email_delivery")[1].p_accepted,
    false,
  );
  for (const mode of ["error", "throw"]) {
    m = setup();
    if (mode === "error") m.deliveryError = true;
    else m.rpcThrow = "app_email_delivery";
    const result = await reserveAndSend(
      id(1),
      id(2),
      "teacher@example.org",
      "verify",
    );
    assert.equal(result.code, "delivery_failed");
    const writes = m.calls.filter((c) => c[0] === "app_email_delivery");
    assert.equal(writes.length, 1);
    assert.equal(writes[0][1].p_accepted, true);
  }
});
test("shared recovery delivery path still uses recovery purpose and opaque HMAC", async () => {
  const m = setup();
  const result = await reserveAndSend(
    id(1),
    null,
    "teacher@example.org",
    "recovery",
  );
  assert.equal(result.ok, true);
  assert.equal(m.emails[0][3], "recovery");
  assert.equal(
    m.calls.find((c) => c[0] === "app_email_reserve")[1].p_purpose,
    "recovery",
  );
});
test("outages and malformed state never expose provider/SQL information", async () => {
  for (const fn of [
    "app_email_state",
    "app_email_context",
    "app_email_consume",
  ]) {
    const m = setup();
    m.rpcError = fn;
    const r = await POST(req(verify));
    assert.equal(r.status, 503);
    assert.ok(!JSON.stringify(await r.json()).includes("private"));
  }
  const m = setup();
  m.state = { ...sample(), sent_today: -1 };
  assert.equal((await GET(req(null, { method: "GET" }))).status, 503);
});
test("page preserves redirects and exposes outages to error boundary", async () => {
  let m = setup();
  assert.ok(await page());
  m.caller = null;
  await assert.rejects(page(), (e) => e.url === "/login?expired=1");
  m = setup();
  m.state = null;
  await assert.rejects(page(), (e) => e.url === "/account/security");
  m = setup();
  m.redirect = "/account/services/surveys";
  await assert.rejects(page(), (e) => e.url === m.redirect);
  m = setup();
  m.rpcError = "app_email_state";
  await assert.rejects(page(), /unavailable/);
});
test("typed state rejects invalid time/status/counters and timing enforces expiry/attempt/delivery", () => {
  const s = sample();
  assert.equal(emailStateSchema.safeParse(s).success, true);
  for (const patch of [
    { expires_at: "bad" },
    { retry_at: "bad" },
    { status: "unknown" },
    { delivery_state: "unknown" },
    { attempts_remaining: -1 },
    { attempts_remaining: 6 },
  ])
    assert.equal(
      emailStateSchema.safeParse({
        ...s,
        challenge: { ...s.challenge, ...patch },
      }).success,
      false,
    );
  let t = emailTiming(s, Date.parse("2026-10-23T12:00:10Z"));
  assert.equal(t.remaining, 50);
  assert.equal(t.canVerify, true);
  assert.equal(
    emailTiming(s, Date.parse(s.challenge.expires_at)).canVerify,
    false,
  );
  for (const patch of [
    { status: "locked" },
    { delivery_state: "queued" },
    { attempts_remaining: 0 },
  ])
    assert.equal(
      emailTiming(
        { ...s, challenge: { ...s.challenge, ...patch } },
        Date.parse("2026-10-23T12:00:10Z"),
      ).canVerify,
      false,
    );
  assert.equal(
    emailTiming(
      s,
      Date.parse("2026-10-23T12:02:00Z"),
      Date.parse("2026-10-23T12:02:40Z"),
    ).remaining,
    40,
  );
});
