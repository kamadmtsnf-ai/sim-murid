/** Login route tests at the SDK boundary: no live identity or provider requests. */
import test from "node:test";
import assert from "node:assert/strict";
import { registerHooks } from "node:module";
import { readFileSync, existsSync } from "node:fs";
import { resolve, dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import ts from "typescript";
import { NextRequest } from "next/server.js";
const sources = {
  "server-only": "export {};",
  "@supabase/supabase-js": `export const createClient=(...args)=>globalThis.recoveryMocks.authClient(...args);`,
  "@supabase/ssr": `export const createServerClient=(...args)=>globalThis.recoveryMocks.cookieClient(...args);`,
  "@/lib/auth/admin": `export const createAuthAdmin=()=>{if(globalThis.recoveryMocks.configError)throw Error('private configuration');return globalThis.recoveryMocks.admin};`,
  "@/lib/email/service": `export const emailContextSchema={safeParse:x=>globalThis.recoveryMocks.context(x)};export const reserveAndSend=(...a)=>globalThis.recoveryMocks.deliver(...a);`,
  "@/lib/email/gmail": `export const emailEnvironment=()=>({secret:'synthetic-secret-for-tests-only-123456789'});`,
  "@/lib/auth/answer-hash": `export const verifyAnswer=async()=>globalThis.recoveryMocks.answer;`,
  "@/lib/supabase/environment": `export const getSupabasePublicEnvironment=()=>({url:'https://fixture.supabase.co',publishableKey:'sb_publishable_fixture'});`,
};
registerHooks({
  resolve(specifier, context, next) {
    if (specifier in sources)
      return { url: "login-mock:" + specifier, shortCircuit: true };
    if (specifier === "next/server") return next("next/server.js", context);
    let path;
    if (specifier.startsWith("@/")) path = resolve("src", specifier.slice(2));
    else if (specifier.startsWith(".") && context.parentURL?.includes("/src/"))
      path = join(dirname(fileURLToPath(context.parentURL)), specifier);
    if (path)
      for (const suffix of ["", ".ts", ".tsx"])
        if (existsSync(path + suffix))
          return {
            url: new URL("file://" + path + suffix).href,
            shortCircuit: true,
          };
    return next(specifier, context);
  },
  load(url, context, next) {
    if (url.startsWith("login-mock:"))
      return {
        format: "module",
        source: sources[url.slice(11)],
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
    return next(url, context);
  },
});

const manual = (await import("../src/app/api/auth/recovery/route.ts")).POST;
const email = (await import("../src/app/api/auth/email-recovery/route.ts"))
  .POST;
const id = "11111111-1111-4111-8111-111111111111";
const payload = {
  username: "00-User",
  requestType: "password",
  method: "manual",
};
const send = { username: "00-User", action: "send" };
const reset = {
  username: "00-User",
  action: "reset",
  challengeId: id,
  code: "001234",
  newPassword: "Safe!Password83",
  confirmPassword: "Safe!Password83",
};
function setup(options = {}) {
  const calls = [];
  const m = {
    calls,
    answer: true,
    context: (x) => ({ success: !!x, data: x }),
    deliver: async (...a) => {
      calls.push(["delivery", ...a]);
      return { ok: true };
    },
    ...options,
  };
  m.admin = {
    rpc: async (name, args) => {
      calls.push([name, args]);
      if (options.rpc) return options.rpc(name, args);
      return {
        data:
          name === "app_email_context"
            ? {
                user_id: id,
                username: send.username,
                email: "synthetic@example.invalid",
                purpose: "recovery",
              }
            : name === "app_recovery_identity"
              ? { id, question_code: "q1", answer_hash: "test" }
              : true,
        error: null,
      };
    },
    auth: {
      admin: {
        updateUserById: async (...a) => {
          calls.push(["password", ...a]);
          return options.changed ?? { error: null };
        },
      },
    },
  };
  globalThis.recoveryMocks = m;
  return m;
}
function request(body, origin = "https://example.test", headers = {}) {
  return new NextRequest("https://example.test/api/auth/recovery", {
    method: "POST",
    headers: { origin, "content-type": "application/json", ...headers },
    body: typeof body === "string" ? body : JSON.stringify(body),
  });
}
test("recovery routes reject Origin, invalid JSON and privilege injection before provider calls", async () => {
  for (const route of [manual, email]) {
    const m = setup();
    assert.equal(
      (await route(request({}, "https://evil.invalid"))).status,
      403,
    );
    assert.equal((await route(request("{"))).status, 400);
    assert.equal((await route(request({ ...send, actor: id }))).status, 400);
    assert.equal(m.calls.length, 0);
  }
});
test("manual request preserves exact username, type and generic response", async () => {
  const m = setup();
  const r = await manual(request(payload));
  assert.equal(r.status, 202);
  assert.match((await r.json()).message, /Jika akun/);
  assert.equal(
    m.calls.find((x) => x[0] === "app_recovery_identity")[1].p_username,
    "00-User",
  );
  assert.equal(
    m.calls.find((x) => x[0] === "app_recovery_request")[1].p_type,
    "password",
  );
  assert.equal(
    m.calls.find((x) => x[0] === "app_recovery_request")[1].p_answer_verified,
    false,
  );
  assert.match(r.headers.get("cache-control"), /no-store/);
});
test("manual proof mismatch/unknown user remain generic and do not create request", async () => {
  for (const unknown of [false, true]) {
    const m = setup({
      answer: false,
      rpc: async (name) => ({
        data:
          name === "app_recovery_identity"
            ? unknown
              ? null
              : { id, question_code: "q1", answer_hash: "test" }
            : true,
        error: null,
      }),
    });
    const r = await manual(
      request({
        ...payload,
        method: "question",
        question: "q1",
        answer: "wrong",
      }),
    );
    assert.equal(r.status, 202);
    assert.ok(!m.calls.some((x) => x[0] === "app_recovery_request"));
  }
});
test("stream cap counts UTF8 bytes and handles unreadable streams on both APIs", async () => {
  for (const [route, limit] of [
    [manual, 4096],
    [email, 8192],
  ]) {
    setup();
    const unicode = JSON.stringify({ padding: "é".repeat(limit / 2) });
    assert.equal((await route(request(unicode))).status, 413);
    const bad = new NextRequest("https://example.test/api/auth/recovery", {
      method: "POST",
      headers: { origin: "https://example.test" },
      body: new ReadableStream({
        start(c) {
          c.error(Error("private stream failure"));
        },
      }),
      duplex: "half",
    });
    assert.equal((await route(bad)).status, 400);
  }
});
test("manual limiter and unavailable services fail closed", async () => {
  for (const [data, status] of [
    [false, 429],
    [null, 429],
  ]) {
    setup({ rpc: async () => ({ data, error: null }) });
    assert.equal((await manual(request(payload))).status, status);
  }
  setup({
    rpc: async () => {
      throw Error("private");
    },
  });
  assert.equal((await manual(request(payload))).status, 503);
});
test("email send keeps generic accepted contract on unknown account, budget and delivery failure", async () => {
  for (const outcome of ["unknown", "budget", "delivery"]) {
    let deliveryCalls = 0;
    const m = setup({
      rpc: async (name) => ({
        data:
          name === "app_email_recovery_identity"
            ? outcome === "unknown"
              ? null
              : { user_id: id, email: "synthetic@example.invalid" }
            : name === "app_recovery_probe"
              ? outcome !== "budget"
              : true,
        error: null,
      }),
      deliver: async () => {
        deliveryCalls++;
        throw Error("private");
      },
    });
    const r = await email(request(send));
    assert.equal(r.status, 202);
    assert.match((await r.json()).challengeId, /^[0-9a-f-]{36}$/);
    assert.equal(deliveryCalls, outcome === "delivery" ? 1 : 0);
    assert.ok(!m.calls.some((x) => x[0] === "password"));
  }
});
test("email reset checks strength, account binding, purpose and one-time consume before changing password", async () => {
  let m = setup();
  assert.equal(
    (await email(request({ ...reset, newPassword: "weak" }))).status,
    400,
  );
  assert.ok(!m.calls.some((x) => x[0] === "app_email_consume"));
  for (const invalid of [
    { username: "other", purpose: "recovery" },
    { username: send.username, purpose: "verify" },
  ]) {
    m = setup({
      rpc: async (name) => ({
        data:
          name === "app_email_context"
            ? { user_id: id, email: "synthetic@example.invalid", ...invalid }
            : true,
        error: null,
      }),
    });
    assert.equal((await email(request(reset))).status, 400);
    assert.ok(!m.calls.some((x) => x[0] === "password"));
  }
});
test("successful reset changes exact target then finalizes; code remains a string with leading zeros", async () => {
  const m = setup();
  const r = await email(request(reset));
  assert.equal(r.status, 200);
  assert.equal((await r.json()).destination, "/login?password=changed");
  const names = m.calls.map((x) => x[0]);
  assert.ok(names.indexOf("app_email_consume") < names.indexOf("password"));
  assert.ok(names.indexOf("password") < names.indexOf("app_password_finish"));
  assert.deepEqual(m.calls.find((x) => x[0] === "password").slice(1), [
    id,
    { password: reset.newPassword },
  ]);
});
test("ambiguous consume transport failure warns code may have been used and never changes password", async () => {
  const m = setup({
    rpc: async (name) => {
      if (name === "app_email_consume") throw Error("lost reply");
      return {
        data:
          name === "app_email_context"
            ? {
                user_id: id,
                username: send.username,
                email: "synthetic@example.invalid",
                purpose: "recovery",
              }
            : true,
        error: null,
      };
    },
  });
  const r = await email(request(reset));
  assert.equal(r.status, 503);
  assert.match((await r.json()).message, /belum dapat dipastikan|mungkin/);
  assert.ok(!m.calls.some((x) => x[0] === "password"));
});
test("Auth update and finalization failures never return false reset success", async () => {
  setup({ changed: { error: { message: "private" } } });
  let r = await email(request(reset));
  assert.equal(r.status, 503);
  assert.ok(!(await r.json()).destination);
  setup({
    rpc: async (name) => ({
      data:
        name === "app_email_context"
          ? {
              user_id: id,
              username: send.username,
              email: "synthetic@example.invalid",
              purpose: "recovery",
            }
          : name === "app_password_finish"
            ? false
            : true,
      error: null,
    }),
  });
  r = await email(request(reset));
  assert.equal(r.status, 503);
});
