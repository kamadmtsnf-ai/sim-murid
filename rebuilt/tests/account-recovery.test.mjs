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
  "next/navigation": `export const redirect=url=>{const e=Error('redirect');e.url=url;throw e;};`,
  "@/lib/auth/read-server": `export const readServerPrincipal=async()=>{const m=globalThis.recoveryAdmin;if(m.redirect){const e=Error('redirect');e.url=m.redirect;throw e;}return m.caller;};`,
  "@/lib/auth/http": `export const privateJson=(b,s=200)=>globalThis.recoveryAdmin.reply(b,s);export const requestAuth=()=>({});export const verifiedPrincipal=async()=>globalThis.recoveryAdmin.caller;export const sameOrigin=r=>r.headers.get('origin')===r.nextUrl.origin;`,
  "@/lib/auth/security": `export const securityState=async()=>({gate:globalThis.recoveryAdmin.gate});export const confirmCurrentPassword=async(id,p)=>{globalThis.recoveryAdmin.calls.push(['password',id,p]);return globalThis.recoveryAdmin.password;};`,
  "@/lib/auth/authorization": `export class AccessDenied extends Error{};export const requireCapability=async(c,name)=>{const m=globalThis.recoveryAdmin;m.calls.push(['capability',name]);if(m.denied)throw new AccessDenied();};`,
  "@/lib/auth/admin": `export const createAuthAdmin=()=>({rpc:async(fn,args)=>{const m=globalThis.recoveryAdmin;m.calls.push([fn,args]);return m.rpc(fn,args);},auth:{admin:{updateUserById:async(id,p)=>{const m=globalThis.recoveryAdmin;m.calls.push(['auth',id,p]);return m.auth;}}}});`,
  "@/app/account/recovery/recovery-panel": `export const RecoveryPanel=()=>null;`,
};
registerHooks({
  resolve(s, c, next) {
    if (s === "./recovery-panel")
      return {
        url: "recovery-admin-mock:@/app/account/recovery/recovery-panel",
        shortCircuit: true,
      };
    if (s in mocks)
      return { url: "recovery-admin-mock:" + s, shortCircuit: true };
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
    if (url.startsWith("recovery-admin-mock:"))
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

const { GET, POST } = await import("../src/app/api/account/recovery/route.ts");
const { default: page } = await import("../src/app/account/recovery/page.tsx");
const { recoveryResolutionSchema, recoveryListSchema } = await import(
  "../src/lib/auth/recovery-validation.ts"
);
const id = (n) => `00000000-0000-4000-8000-${String(n).padStart(12, "0")}`;
const item = {
  id: id(3),
  username: "00-user",
  full_name: "Pengguna",
  request_type: "password",
  status: "pending",
  requested_at: "2026-10-23T10:00:00Z",
  expires_at: "2026-10-24T10:00:00Z",
  security_answer_verified: false,
  self_request: false,
};
const payload = {
  requestId: id(3),
  action: "approve",
  identityConfirmed: true,
  evidenceReference: "BA-2026-0001",
  currentPassword: "Admin-secret",
};
function setup() {
  const m = (globalThis.recoveryAdmin = {
    calls: [],
    caller: { principal: { id: id(1), is_admin: true }, sessionId: id(2) },
    gate: "ready",
    password: true,
    auth: { data: { user: { id: id(4) } }, error: null },
    reply: (b, s = 200) =>
      NextResponse.json(b, {
        status: s,
        headers: { "Cache-Control": "private, no-store" },
      }),
  });
  m.rpc = async (fn) => ({
    error: null,
    data:
      fn === "app_recovery_list"
        ? [item]
        : fn === "app_survey_required"
          ? false
          : fn === "app_security_rate" || fn === "app_recovery_finish"
            ? true
            : fn === "app_recovery_begin"
              ? { user_id: id(4), request_type: "password", rejected: false }
              : null,
  });
  return m;
}
const request = (data = payload, origin = "https://sim.test") =>
  new NextRequest("https://sim.test/api/account/recovery", {
    method: "POST",
    headers: { Origin: origin, "Content-Type": "application/json" },
    body: JSON.stringify(data),
  });
test("password success requires target Auth acknowledgement and exact finalization; unique secret stays out of GET", async () => {
  const m = setup(),
    r = await POST(request()),
    b = await r.json();
  assert.equal(r.status, 200);
  assert.equal(b.outcome, "password");
  assert.equal(b.requestId, item.id);
  assert.ok(recoveryResolutionSchema.safeParse(b).success);
  assert.ok(b.temporaryPassword.length >= 32);
  assert.equal(m.calls.find((c) => c[0] === "auth")[1], id(4));
  assert.equal(
    m.calls.find((c) => c[0] === "app_recovery_finish")[1].p_operation,
    m.calls.find((c) => c[0] === "app_recovery_begin")[1].p_operation,
  );
  const get = await GET(request());
  assert.equal(
    JSON.stringify(await get.json()).includes("temporaryPassword"),
    false,
  );
  assert.equal(r.headers.get("Cache-Control"), "private, no-store");
});
test("rejection and session recovery do not change Auth password", async () => {
  for (const outcome of ["rejected", "session"]) {
    const m = setup(),
      base = m.rpc;
    m.rpc = async (fn) =>
      fn === "app_recovery_begin"
        ? {
            data: {
              user_id: id(4),
              request_type: "session",
              rejected: outcome === "rejected",
            },
            error: null,
          }
        : base(fn);
    const r = await POST(
      request({
        ...payload,
        action: outcome === "rejected" ? "reject" : "approve",
      }),
    );
    assert.equal(r.status, 200);
    assert.equal((await r.json()).outcome, outcome);
    assert.equal(
      m.calls.some((c) => c[0] === "auth" || c[0] === "app_recovery_finish"),
      false,
    );
  }
});
test("authentication, role, capability, onboarding, mandatory survey and current password gates prevent mutation", async () => {
  for (const [key, value, expected] of [
    ["caller", null, 401],
    ["gate", "password", 403],
    ["denied", true, 403],
    ["password", false, 400],
    ["survey", true, 403],
    ["role", false, 403],
  ]) {
    const m = setup();
    if (key === "role") m.caller.principal.is_admin = false;
    else if (key === "survey") {
      const base = m.rpc;
      m.rpc = async (fn) =>
        fn === "app_survey_required" ? { data: true, error: null } : base(fn);
    } else m[key] = value;
    assert.equal((await POST(request())).status, expected, key);
    assert.equal(
      m.calls.some((c) => c[0] === "app_recovery_begin" || c[0] === "auth"),
      false,
      key,
    );
  }
});
test("origin, invalid DTO, oversized streamed body and invalid JSON rejected before backend calls", async () => {
  const m = setup();
  assert.equal(
    (await POST(request(payload, "https://foreign.test"))).status,
    403,
  );
  assert.equal(
    (await POST(request({ ...payload, identityConfirmed: false }))).status,
    400,
  );
  assert.equal(
    (await POST(request({ ...payload, currentPassword: "a".repeat(5000) })))
      .status,
    413,
  );
  assert.equal(
    (
      await POST(
        new NextRequest("https://sim.test/api/account/recovery", {
          method: "POST",
          headers: { origin: "https://sim.test" },
          body: "{",
        }),
      )
    ).status,
    400,
  );
  assert.equal(m.calls.length, 0);
});
test("unknown or mismatched begin, Auth and finish acknowledgements never return a temporary password", async () => {
  for (const variant of [
    "null",
    "self",
    "rejected",
    "auth",
    "finish",
    "error",
    "rate",
  ]) {
    const m = setup(),
      base = m.rpc;
    if (variant === "auth")
      m.auth = { data: { user: { id: id(9) } }, error: null };
    m.rpc = async (fn) =>
      fn === "app_security_rate" && variant === "rate"
        ? { data: false, error: null }
        : fn === "app_recovery_finish" && variant === "finish"
          ? { data: "true", error: null }
          : fn === "app_recovery_begin" &&
              ["null", "self", "rejected", "error"].includes(variant)
            ? {
                data:
                  variant === "null"
                    ? null
                    : {
                        user_id: variant === "self" ? id(1) : id(4),
                        request_type: "password",
                        rejected: variant === "rejected",
                      },
                error: variant === "error" ? Error("private SQL") : null,
              }
            : base(fn);
    const r = await POST(request()),
      b = await r.json();
    assert.ok(r.status >= 400, variant);
    assert.equal("temporaryPassword" in b, false);
    assert.equal(JSON.stringify(b).includes("private SQL"), false);
  }
});
test("GET rejects malformed/duplicate queue; page redirects remain redirects and outage reaches error boundary", async () => {
  let m = setup();
  assert.equal((await GET(request())).status, 200);
  m.rpc = async () => ({ data: [item, item], error: null });
  assert.equal((await GET(request())).status, 503);
  assert.equal(recoveryListSchema.safeParse([item, item]).success, false);
  assert.equal(
    recoveryListSchema.safeParse([{ ...item, expires_at: item.requested_at }])
      .success,
    false,
  );
  m = setup();
  m.redirect = "/account/services/surveys";
  await assert.rejects(page(), (e) => e.url === m.redirect);
  m = setup();
  m.caller = null;
  await assert.rejects(page(), (e) => e.url === "/login?expired=1");
  m = setup();
  m.gate = "password";
  await assert.rejects(page(), (e) => e.url === "/account/security");
  m = setup();
  m.caller.principal.is_admin = false;
  await assert.rejects(page(), (e) => e.url === "/account");
  m = setup();
  m.rpc = async () => ({ data: null, error: Error("SQL") });
  await assert.rejects(page(), /Recovery queue unavailable/);
});
