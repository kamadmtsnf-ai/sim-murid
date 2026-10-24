import test from "node:test";
import assert from "node:assert/strict";
import { registerHooks } from "node:module";
import { readFileSync, existsSync, statSync } from "node:fs";
import { resolve, dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import ts from "typescript";
import { NextRequest, NextResponse } from "next/server.js";
globalThis.sessionsUiReply = (b, s) =>
  NextResponse.json(b, {
    status: s,
    headers: { "Cache-Control": "private, no-store" },
  });
const mocks = {
  "server-only": "export {};",
  panel: "export const SessionPanel=()=>null;",
  "next/navigation": `export const redirect=url=>{const e=Error('redirect');e.url=url;throw e;};`,
  "@/lib/auth/read-server": `export const readServerPrincipal=async()=>{const m=globalThis.sessionsUiMocks;if(m.redirect){const e=Error('redirect');e.url=m.redirect;throw e;}return m.caller;};`,
  "@/lib/auth/security": `export const securityState=async()=>{const m=globalThis.sessionsUiMocks;if(m.securityError)throw Error('private security error');return m.state;};;`,
  "@/lib/auth/http": `export const privateJson=(b,s=200)=>globalThis.sessionsUiReply(b,s);export const requestAuth=(r,jar)=>{jar.cookies.set('refreshed','synthetic');return {auth:{signOut:async()=>{const m=globalThis.sessionsUiMocks;m.signouts++;if(m.signoutError)throw Error('private provider');}}};};export const verifiedPrincipal=async()=>globalThis.sessionsUiMocks.caller;export const sameOrigin=r=>r.headers.get('origin')===new URL(r.url).origin;`,
  "@/lib/auth/admin": `export const createAuthAdmin=()=>({rpc:(...args)=>globalThis.sessionsUiMocks.rpc(...args)});`,
};
registerHooks({
  resolve(s, c, next) {
    if (s === "./session-panel")
      return { url: "sessions-mock:panel", shortCircuit: true };
    if (s in mocks) return { url: "sessions-mock:" + s, shortCircuit: true };
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
    if (url.startsWith("sessions-mock:"))
      return {
        format: "module",
        source: mocks[url.slice(14)],
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

const { GET, POST } = await import("../src/app/api/auth/sessions/route.ts");
const { default: page } = await import("../src/app/account/sessions/page.tsx");
const { sessionListSchema, sessionRevokeSchema, effectiveSessionStatus } =
  await import("../src/lib/auth/sessions.ts");
const id = (n) => `00000000-0000-4000-8000-${String(n).padStart(12, "0")}`;
const sample = () => ({
  username: "0006",
  sessions: [
    {
      id: id(3),
      device: "Chrome · Windows",
      issued_at: "2026-10-24T00:00:00Z",
      last_seen_at: "2026-10-24T00:10:00Z",
      expires_at: "2026-10-24T01:00:00Z",
      remember: false,
      current: true,
      status: "active",
    },
  ],
});
function setup() {
  const m = (globalThis.sessionsUiMocks = {
    caller: {
      principal: { id: id(1), username: "0006", is_admin: false },
      sessionId: id(2),
    },
    state: { gate: "ready" },
    list: sample(),
    revoke: { revoked: 1, signed_out: false },
    calls: [],
    signouts: 0,
  });
  m.rpc = async (fn, args) => {
    m.calls.push([fn, args]);
    if (m.rpcError === fn)
      return { error: { message: "private SQL" }, data: null };
    return { error: null, data: fn === "app_session_list" ? m.list : m.revoke };
  };
  return m;
}
const request = (body = { action: "list" }, options = {}) =>
  new NextRequest("https://app.test/api/auth/sessions", {
    method: options.method ?? "POST",
    headers: {
      origin: "https://app.test",
      "Content-Type": "application/json",
      ...options.headers,
    },
    ...((options.method ?? "POST") === "POST"
      ? { body: typeof body === "string" ? body : JSON.stringify(body) }
      : {}),
  });
const revoke = { action: "revoke", scope: "one", sessionId: id(3) };
test("sessions API rejects CSRF and missing/revoked session; cookies and private headers survive failures", async () => {
  let m = setup();
  assert.equal(
    (await POST(request(revoke, { headers: { origin: "https://other.test" } })))
      .status,
    403,
  );
  assert.equal(m.calls.length, 0);
  for (const gate of ["no-caller", "no-state", "outage"]) {
    m = setup();
    if (gate === "no-caller") m.caller = null;
    if (gate === "no-state") m.state = null;
    if (gate === "outage") m.securityError = true;
    const r = await GET(request(null, { method: "GET" }));
    assert.equal(r.status, gate === "outage" ? 503 : 401);
    assert.match(r.headers.get("set-cookie"), /refreshed/);
    assert.match(r.headers.get("cache-control"), /no-store/);
    assert.equal(m.calls.length, 0);
  }
});
test("sessions preserve onboarding gate and deny foreign usernames for non-admin before RPC", async () => {
  for (const gate of [
    "password",
    "profile_pending",
    "security_question",
    "email_pending",
    "survey_pending",
    "account_pending",
  ]) {
    const m = setup();
    m.state = { gate };
    const r = await POST(request(revoke));
    assert.equal(r.status, 403);
    assert.equal((await r.json()).destination, "/account/security");
    assert.equal(m.calls.length, 0);
  }
  for (const action of [
    { action: "list", username: "other" },
    { ...revoke, username: "other" },
  ]) {
    const m = setup();
    assert.equal((await POST(request(action))).status, 403);
    assert.equal(m.calls.length, 0);
  }
});
test("bounded sessions requests reject UTF8 excess, bad IDs and forged actor without mutation", async () => {
  for (const [body, status] of [
    ["{", 400],
    [{ ...revoke, actor: id(9) }, 400],
    [{ ...revoke, sessionId: "bad" }, 400],
    [{ action: "list", pad: "界".repeat(800) }, 413],
  ]) {
    const m = setup();
    assert.equal((await POST(request(body))).status, status);
    assert.equal(m.calls.length, 0);
  }
  setup();
  assert.equal(
    (await POST(request(revoke, { headers: { "content-length": "3000" } })))
      .status,
    413,
  );
});
test("list binds server identity and exact leading-zero/hyphen username; server time and DTO validated", async () => {
  let m = setup();
  let r = await GET(request(null, { method: "GET" }));
  assert.equal(r.status, 200);
  assert.equal((await r.json()).username, "0006");
  assert.deepEqual(m.calls[0], [
    "app_session_list",
    { p_actor: id(1), p_auth_session: id(2) },
  ]);
  m = setup();
  m.caller.principal.is_admin = true;
  m.list.username = "0006-user";
  r = await POST(request({ action: "list", username: "0006-user" }));
  assert.equal(r.status, 200);
  const b = await r.json();
  assert.ok(b.serverTime);
  assert.equal(b.username, "0006-user");
  assert.equal(m.calls[0][1].p_username, "0006-user");
  m = setup();
  m.list.sessions[0].expires_at = "invalid";
  assert.equal((await GET(request(null, { method: "GET" }))).status, 503);
});
test("revoke one/all keep exact scope and zero acknowledgement; self revocation survives provider cleanup outage", async () => {
  let m = setup();
  let r = await POST(request(revoke));
  assert.equal(r.status, 200);
  assert.equal((await r.json()).revoked, 1);
  assert.deepEqual(m.calls[0], [
    "app_session_revoke",
    { p_actor: id(1), p_auth_session: id(2), p_session: id(3) },
  ]);
  assert.equal(m.signouts, 0);
  m = setup();
  m.revoke = { revoked: 0, signed_out: false };
  r = await POST(request({ action: "revoke", scope: "all" }));
  assert.equal(r.status, 200);
  assert.equal((await r.json()).revoked, 0);
  assert.equal("p_session" in m.calls[0][1], false);
  m = setup();
  m.revoke = { revoked: 1, signed_out: true };
  m.signoutError = true;
  r = await POST(request(revoke));
  assert.equal(r.status, 200);
  assert.equal((await r.json()).signed_out, true);
  assert.equal(m.signouts, 1);
});
test("RPC denial, malformed acknowledgements and provider details fail closed", async () => {
  for (const value of [
    null,
    {},
    true,
    { revoked: -1, signed_out: false },
    { revoked: 1, signed_out: "false" },
  ]) {
    const m = setup();
    m.revoke = value;
    const r = await POST(request(revoke));
    assert.equal(r.status, value === null ? 403 : 503);
    assert.equal(m.signouts, 0);
  }
  const m = setup();
  m.rpcError = "app_session_revoke";
  const r = await POST(request(revoke));
  assert.equal(r.status, 503);
  assert.ok(!JSON.stringify(await r.json()).includes("private SQL"));
});
test("typed session dates prevent rendering errors, reject duplicate IDs and derive expiry without changing revoked status", () => {
  const data = sample();
  assert.equal(sessionListSchema.safeParse(data).success, true);
  for (const key of ["issued_at", "expires_at", "last_seen_at"]) {
    const bad = sample();
    bad.sessions[0][key] = "bad";
    assert.equal(sessionListSchema.safeParse(bad).success, false);
  }
  assert.equal(
    sessionListSchema.safeParse({
      ...data,
      sessions: [data.sessions[0], data.sessions[0]],
    }).success,
    false,
  );
  assert.equal(
    sessionRevokeSchema.safeParse({ revoked: 0, signed_out: false }).success,
    true,
  );
  const s = data.sessions[0];
  assert.equal(
    effectiveSessionStatus(s, Date.parse(s.expires_at) - 1),
    "active",
  );
  assert.equal(effectiveSessionStatus(s, Date.parse(s.expires_at)), "expired");
  assert.equal(
    effectiveSessionStatus(
      { ...s, status: "revoked" },
      Date.parse(s.expires_at),
    ),
    "revoked",
  );
});
test("page distinguishes invalid session, onboarding redirect and service outage; admin flag is server-derived", async () => {
  let m = setup();
  const p = await page();
  assert.equal(p.props.ownUsername, "0006");
  assert.equal(p.props.canManageOthers, false);
  m.caller.principal.is_admin = true;
  assert.equal((await page()).props.canManageOthers, true);
  for (const state of [null, { gate: "password" }]) {
    m = setup();
    m.state = state;
    await assert.rejects(
      page(),
      (e) => e.url === (state ? "/account/security" : "/login?expired=1"),
    );
  }
  m = setup();
  m.caller = null;
  await assert.rejects(page(), (e) => e.url === "/login?expired=1");
  m = setup();
  m.securityError = true;
  await assert.rejects(page(), /security error/);
  m = setup();
  m.redirect = "/account/services/surveys";
  await assert.rejects(page(), (e) => e.url === m.redirect);
});
