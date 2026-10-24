import test from "node:test";
import assert from "node:assert/strict";
import { registerHooks } from "node:module";
import { readFileSync, existsSync, statSync } from "node:fs";
import { resolve, dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import ts from "typescript";
import { NextRequest, NextResponse } from "next/server.js";
globalThis.securityUiReply = (b, s) =>
  NextResponse.json(b, {
    status: s,
    headers: { "Cache-Control": "private, no-store" },
  });
const mocks = {
  "server-only": "export {};",
  panel: "export const SecurityPanel=()=>null;",
  "next/navigation": `export const redirect=url=>{const e=Error('redirect');e.url=url;throw e;};`,
  "@/lib/auth/read-server": `export const readServerPrincipal=async()=>{const m=globalThis.securityUiMocks;if(m.redirect){const e=Error('redirect');e.url=m.redirect;throw e;}return m.caller;};`,
  "@/lib/auth/security": `export const securityState=async()=>{const m=globalThis.securityUiMocks;if(m.securityError)throw Error('private security error');return m.state;};export const confirmCurrentPassword=async()=>{const m=globalThis.securityUiMocks;if(m.confirmError)throw Error('private provider');return m.confirm;};`,
  "@/lib/auth/http": `export const privateJson=(b,s=200)=>globalThis.securityUiReply(b,s);export const requestAuth=(r,jar)=>{jar.cookies.set('refreshed','synthetic');return {auth:{signOut:async()=>{globalThis.securityUiMocks.signouts++;}}};};export const verifiedPrincipal=async()=>globalThis.securityUiMocks.caller;export const sameOrigin=r=>r.headers.get('origin')===new URL(r.url).origin;`,
  "@/lib/auth/admin": `export const createAuthAdmin=()=>({rpc:(...args)=>globalThis.securityUiMocks.rpc(...args),auth:{admin:{updateUserById:async(id,value)=>{const m=globalThis.securityUiMocks;m.updates++;m.update=[id,value];return {error:m.providerError?{message:'private provider'}:null};}}}});`,
  "@/lib/auth/answer-hash": `export const hashAnswer=async()=> 'synthetic-hash';`,
};
registerHooks({
  resolve(s, c, next) {
    if (s === "./security-panel")
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

const { GET, POST } = await import("../src/app/api/auth/security/route.ts");
const { default: page } = await import("../src/app/account/security/page.tsx");
const state = () => ({
  gate: "ready",
  destination: "/account",
  question_code: "q1",
  role: "admin",
  can_set_question: true,
});
function setup() {
  const m = (globalThis.securityUiMocks = {
    caller: {
      principal: { id: "owner-id", username: "admin" },
      sessionId: "session-id",
    },
    state: state(),
    confirm: true,
    calls: [],
    updates: 0,
    signouts: 0,
  });
  m.rpc = async (fn, args) => {
    m.calls.push([fn, args]);
    if (m.rpcError === fn)
      return { error: { message: "private SQL" }, data: null };
    if (fn === "app_security_question_save" && m.afterSaveError)
      m.securityError = true;
    return { error: null, data: m[fn] ?? true };
  };
  return m;
}
const password = {
  action: "password",
  currentPassword: "Old!Secret92",
  newPassword: "New!Secret73",
  confirmPassword: "New!Secret73",
};
const question = {
  action: "question",
  currentPassword: "Old!Secret92",
  question: "q3",
  answer: "  Answer  ",
};
const request = (body = question, options = {}) =>
  new NextRequest("https://app.test/api/auth/security", {
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
test("security API enforces origin, authenticated identity and private cookies on all reads", async () => {
  let m = setup();
  assert.equal(
    (
      await POST(
        request(question, { headers: { origin: "https://foreign.test" } }),
      )
    ).status,
    403,
  );
  assert.equal(m.calls.length, 0);
  m = setup();
  m.caller = null;
  for (const handler of [GET, POST]) {
    const r = await handler(request());
    assert.equal(r.status, 401);
    assert.match(r.headers.get("set-cookie"), /refreshed/);
    assert.match(r.headers.get("cache-control"), /no-store/);
  }
  m = setup();
  m.securityError = true;
  const r = await GET(request(null, { method: "GET" }));
  assert.equal(r.status, 503);
  assert.match(r.headers.get("set-cookie"), /refreshed/);
  assert.ok(!JSON.stringify(await r.json()).includes("private"));
});
test("bounded request rejects malformed, oversized UTF8 and forged identity before writes", async () => {
  for (const [body, status] of [
    ["{", 400],
    [{ ...question, userId: "other" }, 400],
    [{ ...question, pad: "界".repeat(3000) }, 413],
  ]) {
    const m = setup();
    assert.equal((await POST(request(body))).status, status);
    assert.equal(m.calls.length, 0);
  }
  setup();
  assert.equal(
    (await POST(request(question, { headers: { "content-length": "9000" } })))
      .status,
    413,
  );
});
test("question writes bind own session and require rate, password and gate approval", async () => {
  let m = setup();
  const r = await POST(request());
  assert.equal(r.status, 200);
  assert.equal((await r.json()).state.question_code, "q1");
  assert.deepEqual(m.calls.at(-1), [
    "app_security_question_save",
    {
      p_user: "owner-id",
      p_session: "session-id",
      p_question: "q3",
      p_hash: "synthetic-hash",
    },
  ]);
  m = setup();
  m.state.can_set_question = false;
  assert.equal((await POST(request())).status, 403);
  assert.equal(m.calls.length, 0);
  m = setup();
  m.app_security_rate = false;
  assert.equal((await POST(request())).status, 429);
  assert.equal(m.calls.length, 1);
  m = setup();
  m.confirm = false;
  assert.equal((await POST(request())).status, 400);
  assert.equal(m.calls.length, 1);
});
test("question acknowledged save survives failed followup read; rejected acknowledgements fail closed", async () => {
  const m = setup();
  m.afterSaveError = true;
  const r = await POST(request());
  assert.equal(r.status, 200);
  const result = await r.json();
  assert.equal(result.state, null);
  assert.equal(result.saved, true);
  for (const value of [false, {}, "true"]) {
    const m = setup();
    m.app_security_question_save = value;
    assert.equal((await POST(request())).status, 409);
  }
});
test("failed password begin never proceeds to provider; provider errors are sanitized", async () => {
  let m = setup();
  m.app_password_begin = false;
  assert.equal((await POST(request(password))).status, 409);
  m = setup();
  m.confirmError = true;
  const r = await POST(request(password));
  assert.equal(r.status, 503);
  const b = await r.json();
  assert.equal(b.signed_out, false);
  assert.ok(!JSON.stringify(b).includes("private"));
});
test("page preserves auth redirects and surfaces outages for retry boundary", async () => {
  let m = setup();
  assert.ok(await page());
  m.caller = null;
  await assert.rejects(page(), (e) => e.url === "/login?expired=1");
  m = setup();
  m.state = null;
  await assert.rejects(page(), (e) => e.url === "/login?expired=1");
  m = setup();
  m.securityError = true;
  await assert.rejects(page(), /security error/);
  m = setup();
  m.redirect = "/account/services/surveys";
  await assert.rejects(page(), (e) => e.url === m.redirect);
});

test("password completion revokes sessions and honors begin/provider/finish failure boundaries", async () => {
  let m = setup();
  let r = await POST(request(password));
  assert.equal(r.status, 200);
  assert.equal((await r.json()).signed_out, true);
  assert.equal(m.signouts, 1);
  assert.deepEqual(m.update, ["owner-id", { password: password.newPassword }]);
  assert.deepEqual(
    m.calls.map((c) => c[0]),
    ["app_security_rate", "app_password_begin", "app_password_finish"],
  );
  for (const kind of ["providerError", "finish"]) {
    m = setup();
    if (kind === "finish") m.app_password_finish = false;
    else m.providerError = true;
    r = await POST(request(password));
    assert.equal(r.status, 503);
    const b = await r.json();
    assert.equal(b.signed_out, true);
    assert.equal(m.signouts, 0);
    assert.ok(!JSON.stringify(b).includes("private"));
  }
  m = setup();
  m.app_password_begin = {};
  r = await POST(request(password));
  assert.equal(r.status, 409);
  assert.equal(m.updates, 0);
});
