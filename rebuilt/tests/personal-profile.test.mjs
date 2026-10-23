import test from "node:test";
import assert from "node:assert/strict";
import { registerHooks } from "node:module";
import { readFileSync, existsSync, statSync } from "node:fs";
import { resolve, dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import ts from "typescript";
import { NextRequest, NextResponse } from "next/server.js";
globalThis.profileReply = (b, s) =>
  NextResponse.json(b, {
    status: s,
    headers: { "Cache-Control": "private, no-store", Vary: "Cookie" },
  });
const mocks = {
  "server-only": "export {};",
  panel: "export const ProfileForm=()=>null;",
  "next/navigation": `export const redirect=url=>{const e=Error('redirect');e.url=url;throw e;};`,
  "@/lib/auth/read-server": `export const readServerPrincipal=async()=>{const m=globalThis.profileMocks;if(m.redirect){const e=Error('redirect');e.url=m.redirect;throw e;}return m.caller;};`,
  "@/lib/auth/security": `export const securityState=async()=>{const m=globalThis.profileMocks;if(m.gateError)throw Error('Gate unavailable');return m.gate;};`,
  "@/lib/auth/http": `export const privateJson=(b,s=200)=>globalThis.profileReply(b,s);export const requestAuth=(r,jar)=>{jar.cookies.set('refreshed','synthetic');return {};};export const verifiedPrincipal=async()=>{const m=globalThis.profileMocks;if(m.authError)throw Error('Auth private detail');return m.caller;};export const sameOrigin=r=>r.headers.get('origin')===new URL(r.url).origin;`,
  "@/lib/auth/admin": `export const createAuthAdmin=()=>({rpc:async(fn,args)=>{const m=globalThis.profileMocks;m.calls.push([fn,args]);if(m.rpcError===fn)return {data:null,error:{message:'private SQL'}};if(fn==='app_profile_update')return {data:m.update,error:null};return {data:m.profile,error:null};}});`,
};
registerHooks({
  resolve(s, c, next) {
    if (s === "./profile-form")
      return { url: "profile-mock:panel", shortCircuit: true };
    if (s in mocks) return { url: "profile-mock:" + s, shortCircuit: true };
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
    if (url.startsWith("profile-mock:"))
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

const { GET, POST } = await import("../src/app/api/account/profile/route.ts");
const { default: page } = await import("../src/app/account/profile/page.tsx");
const { profileSchema } = await import(
  "../src/lib/auth/recovery-validation.ts"
);
const { sameProfileContent, profileWriteSchema } = await import(
  "../src/lib/auth/profile.ts"
);
const sample = () => ({
  username: "00123-user",
  full_name: "Nama pengguna",
  phone: "081234",
  contact_email: "contact@example.org",
  bio: "Baris pertama\nBaris kedua",
  updated_at: "2026-10-23T10:11:12.123456+00:00",
});
function setup() {
  return (globalThis.profileMocks = {
    caller: {
      principal: {
        id: "00000000-0000-4000-8000-000000000001",
        username: "00123-user",
      },
      sessionId: "00000000-0000-4000-8000-000000000002",
    },
    profile: sample(),
    gate: { gate: "ready" },
    update: true,
    calls: [],
  });
}
function req(body = sample(), options = {}) {
  const method = options.method ?? "POST";
  return new NextRequest("https://app.test/api/account/profile", {
    method,
    headers: {
      origin: options.origin ?? "https://app.test",
      "Content-Type": "application/json",
      ...options.headers,
    },
    ...(method === "POST"
      ? { body: typeof body === "string" ? body : JSON.stringify(body) }
      : {}),
  });
}
test("profile auth/CSRF precede all profile writes, cookies and private cache preserved", async () => {
  let m = setup();
  m.caller = null;
  assert.equal((await GET(req(null, { method: "GET" }))).status, 401);
  assert.equal((await POST(req())).status, 401);
  assert.equal(m.calls.length, 0);
  m = setup();
  assert.equal(
    (await POST(req(sample(), { origin: "https://foreign.test" }))).status,
    403,
  );
  assert.equal(m.calls.length, 0);
  const r = await GET(req(null, { method: "GET" }));
  assert.equal(r.status, 200);
  assert.match(r.headers.get("cache-control"), /no-store/);
  assert.match(r.headers.get("set-cookie"), /refreshed=synthetic/);
});
test("profile update uses verified identity, exact microsecond version and normalized text", async () => {
  const m = setup(),
    r = await POST(
      req({
        ...sample(),
        full_name: " Nama pengguna ",
        contact_email: " Contact@Example.org ",
        phone: " 081234 ",
      }),
    );
  assert.equal(r.status, 200);
  const args = m.calls.find((c) => c[0] === "app_profile_update")[1];
  assert.equal(args.p_user, m.caller.principal.id);
  assert.equal(args.p_session, m.caller.sessionId);
  assert.equal(args.p_version, sample().updated_at);
  assert.equal(args.p_name, "Nama pengguna");
  assert.equal(args.p_phone, "081234");
  assert.equal(args.p_email, "contact@example.org");
  assert.equal(args.p_bio, sample().bio);
});
test("username/privilege injection and invalid/control fields never reach update RPC", async () => {
  for (const patch of [
    { username: "another-user" },
    { role: "admin" },
    { full_name: "" },
    { full_name: "Bad\u0000Name" },
    { phone: "Bad\u0000Phone" },
    { bio: "Bad\u0000Bio" },
    { contact_email: "bad@" },
    { contact_email: "id@auth.sim-murid.invalid" },
  ]) {
    const m = setup();
    const r = await POST(req({ ...sample(), ...patch }));
    assert.equal(r.status, "username" in patch ? 403 : 400);
    assert.equal(m.calls.length, 0);
  }
});
test("bounded request reader rejects chunked UTF-8 bytes beyond 16KiB, malformed JSON and oversize header", async () => {
  setup();
  assert.equal((await POST(req("{"))).status, 400);
  assert.equal(
    (await POST(req(sample(), { headers: { "content-length": "20000" } })))
      .status,
    413,
  );
  const body = JSON.stringify({ ...sample(), bio: "界".repeat(6000) });
  assert.ok(body.length < 16384 && Buffer.byteLength(body) > 16384);
  assert.equal((await POST(req(body))).status, 413);
});
test("stale/gated writes fail closed; read gate returns security destination", async () => {
  let m = setup();
  m.update = false;
  assert.equal((await POST(req())).status, 409);
  assert.equal(m.calls.filter((c) => c[0] === "app_profile_read").length, 0);
  m = setup();
  m.update = {};
  assert.equal((await POST(req())).status, 409);
  m = setup();
  m.profile = null;
  const r = await GET(req(null, { method: "GET" }));
  assert.equal(r.status, 403);
  assert.equal((await r.json()).destination, "/account/security");
});
test("post-commit read outage and malformed snapshots return unavailable without exposing internals", async () => {
  for (const fn of ["app_profile_update", "app_profile_read"]) {
    const m = setup();
    m.rpcError = fn;
    const r = await POST(req());
    assert.equal(r.status, 503);
    assert.ok(!JSON.stringify(await r.json()).includes("SQL"));
  }
  for (const patch of [{ username: "different-user" }, { updated_at: "bad" }]) {
    const m = setup();
    m.profile = { ...sample(), ...patch };
    assert.equal((await GET(req(null, { method: "GET" }))).status, 503);
  }
  const m = setup();
  m.authError = true;
  assert.equal((await GET(req(null, { method: "GET" }))).status, 503);
});
test("profile optional fields remain optional, multiline bio and international phone preserved", () => {
  const value = profileSchema.parse({
    ...sample(),
    phone: "+62 (812) 345-678",
    bio: " A\nB ",
    contact_email: "",
  });
  assert.equal(value.phone, "+62 (812) 345-678");
  assert.equal(value.bio, "A\nB");
  assert.equal(value.contact_email, "");
  const legacy = { ...sample(), full_name: "Nama\nLama" };
  assert.equal(profileSchema.safeParse(legacy).success, true);
  assert.equal(profileWriteSchema.safeParse(legacy).success, false);
  assert.ok(
    profileSchema.safeParse({ ...sample(), phone: "", bio: "" }).success,
  );
});
test("content comparison ignores version but checks username and all four fields", () => {
  assert.equal(
    sameProfileContent(sample(), {
      ...sample(),
      updated_at: "2026-10-23T12:00:00Z",
    }),
    true,
  );
  for (const key of ["username", "full_name", "phone", "contact_email", "bio"])
    assert.equal(
      sameProfileContent(sample(), { ...sample(), [key]: "changed" }),
      false,
    );
});
test("page allows ready/email_pending and preserves login/security/survey redirects", async () => {
  let m = setup();
  assert.ok(await page());
  m.gate.gate = "email_pending";
  assert.ok(await page());
  m.gate.gate = "password";
  await assert.rejects(page(), (e) => e.url === "/account/security");
  m = setup();
  m.caller = null;
  await assert.rejects(page(), (e) => e.url === "/login?expired=1");
  m = setup();
  m.redirect = "/account/services/surveys";
  await assert.rejects(page(), (e) => e.url === m.redirect);
});
test("page outages and malformed data reach local error boundary instead of masquerading as redirects", async () => {
  let m = setup();
  m.gateError = true;
  await assert.rejects(page(), /Gate unavailable/);
  m = setup();
  m.rpcError = "app_profile_read";
  await assert.rejects(page(), /Unavailable/);
  m = setup();
  m.profile = { ...sample(), updated_at: "bad" };
  await assert.rejects(page());
});
