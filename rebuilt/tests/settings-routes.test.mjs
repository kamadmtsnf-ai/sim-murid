/** Actual Penilaian dan KKM route, schemas and server reader with synthetic Auth/SDK boundaries. */
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
  "next/image": "export default function Image(){};",
  "next/navigation": `export const redirect=url=>{const e=Error('redirect');e.url=url;throw e};`,
  "@/lib/auth/http": `export const privateJson=(body,status=200)=>globalThis.settingsMocks.reply(body,status);export const requestAuth=()=>({});export const verifiedPrincipal=async()=>globalThis.settingsMocks.caller;export const sameOrigin=r=>r.headers.get('origin')===r.nextUrl.origin;`,
  "@/lib/auth/authorization": `export class AccessDenied extends Error{};export const requireCapability=async()=>{if(globalThis.settingsMocks.denied)throw new AccessDenied()};`,
  "@/lib/auth/read-server": `export const readServerPrincipal=async()=>globalThis.settingsMocks.caller;export const readServerAuthClient=async()=>({});`,
  "@/lib/supabase/environment": `export const getSupabasePublicEnvironment=()=>({url:'https://assets.example.invalid'});`,
  "@/lib/auth/admin": `export const createAuthAdmin=()=>({rpc:async(fn,args)=>{const m=globalThis.settingsMocks;m.calls.push([fn,args]);if(fn==='app_settings_write'){m.command=args.p_command;if(m.logo&&m.ack?.code==='saved')m.snapshot.school.asset_data[args.p_command.slot]=args.p_command.path;return {data:m.ack,error:m.writeError};}if(fn==='app_settings_asset_gc')return {data:m.gcPaths??[],error:m.gcError};return {data:m.readSnapshots?.shift()??m.snapshot,error:m.readError};},storage:{from:()=>({upload:async(path)=>{globalThis.settingsMocks.path=path;return {error:globalThis.settingsMocks.uploadError};},remove:async(paths)=>{globalThis.settingsMocks.removed.push(paths);return {error:null};}})}});`,
};
registerHooks({
  resolve(s, c, next) {
    if (s in mocks) return { url: "promos-mock:" + s, shortCircuit: true };
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
    if (url.startsWith("promos-mock:"))
      return {
        format: "module",
        source: mocks[url.slice(12)],
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
const { GET, POST } = await import("../src/app/api/settings/route.ts");
const { POST: logo } = await import("../src/app/api/settings/logo/route.ts");
const { default: page } = await import("../src/app/account/settings/page.tsx");
const { emptySchool } = await import("../src/lib/settings/validation.ts");
const { default: sharp } = await import("sharp");
const id = (n) => `00000000-0000-4000-8000-${String(n).padStart(12, "0")}`;
const profile = () => ({ ...structuredClone(emptySchool), name: "MTs Audit" });
const state = (revision = 1) => ({
  revision,
  school: { ...profile(), id: id(3), asset_data: {}, updated_at: "2026-10-23" },
  subjects: [],
  memorization: [],
  holidays: [],
});
function setup() {
  return (globalThis.settingsMocks = {
    caller: { principal: { id: id(1), is_admin: true }, sessionId: id(2) },
    snapshot: state(),
    ack: { code: "saved", revision: 1, added: 0, skipped: 0 },
    removed: [],
    calls: [],
    reply: (b, status = 200) => NextResponse.json(b, { status }),
  });
}
const req = (command = { type: "profile", profile: profile() }, extra = {}) =>
  new NextRequest("https://example.test/api/settings", {
    method: "POST",
    headers: {
      origin: "https://example.test",
      "content-type": "application/json",
    },
    body: JSON.stringify({ requestId: id(4), revision: 0, command, ...extra }),
  });
test("Settings API enforces anonymous/admin/capability/origin gates before mutation", async () => {
  for (const [change, status] of [
    [(m) => (m.caller = null), 401],
    [(m) => (m.caller.principal.is_admin = false), 403],
    [(m) => (m.denied = true), 403],
  ]) {
    const m = setup();
    change(m);
    assert.equal((await POST(req())).status, status);
    assert.equal(m.calls.length, 0);
  }
  setup();
  assert.equal(
    (
      await POST(
        new NextRequest("https://example.test/api/settings", {
          method: "POST",
          headers: { origin: "https://foreign.test" },
        }),
      )
    ).status,
    403,
  );
});
test("Settings API validates payload and real readback, preserves actor/revision and rejects false success", async () => {
  let m = setup();
  const r = await POST(req());
  assert.equal(r.status, 200);
  assert.equal((await r.json()).code, "saved");
  const write = m.calls.find(([fn]) => fn === "app_settings_write")[1];
  assert.equal(write.p_actor, id(1));
  assert.equal(write.p_session, id(2));
  assert.equal(write.p_revision, 0);
  assert.equal(write.p_request, id(4));
  for (const ack of [
    { code: "saved" },
    { code: "saved", revision: 0 },
    { code: "unknown" },
    null,
  ]) {
    m = setup();
    m.ack = ack;
    assert.equal((await POST(req())).status, 503);
  }
  m = setup();
  m.snapshot.school.name = "Other";
  assert.equal((await POST(req())).status, 503);
  for (const [code, status] of [
    ["stale", 409],
    ["denied", 403],
    ["duplicate", 409],
  ]) {
    m = setup();
    m.ack = { code };
    assert.equal((await POST(req())).status, status);
  }
  m = setup();
  assert.equal(
    (await POST(req({ type: "profile", profile: profile() }, { actor: id(5) })))
      .status,
    400,
  );
  assert.equal(m.calls.length, 0);
  m = setup();
  assert.equal(
    (
      await POST(
        new NextRequest("https://example.test/api/settings", {
          method: "POST",
          headers: { origin: "https://example.test" },
          body: "x".repeat(16385),
        }),
      )
    ).status,
    413,
  );
  assert.equal(m.calls.length, 0);
  m = setup();
  m.readError = { message: "secret database detail" };
  const failed = await GET(
    new NextRequest("https://example.test/api/settings"),
  );
  assert.equal(failed.status, 503);
  assert.doesNotMatch(await failed.text(), /secret database/);
});
async function logoRequest(revision = "0", duplicate = false) {
  const f = new FormData();
  const png = await sharp({
    create: { width: 16, height: 16, channels: 4, background: "#123456" },
  })
    .png()
    .toBuffer();
  f.set("file", new File([png], "logo.png", { type: "image/png" }));
  f.set("slot", "school");
  f.set("revision", revision);
  if (duplicate) f.append("slot", "cooperative");
  return new NextRequest("https://example.test/api/settings/logo", {
    method: "POST",
    headers: { origin: "https://example.test" },
    body: f,
  });
}
test("Logo API uploads normalized image and confirms exact metadata before success", async () => {
  const m = setup();
  m.logo = true;
  m.readSnapshots = [state(0)];
  let r = await logo(await logoRequest());
  assert.equal(r.status, 200);
  const body = await r.json();
  assert.equal(body.code, "saved");
  assert.equal(body.settings.school.asset_data.school, m.path);
  assert.match(m.path, /\.png$/);
  assert.equal(m.removed.length, 0);
});
test("Logo API rejects empty revision and duplicate fields, preserves ambiguous uploads and removes rejected uploads", async () => {
  for (const [revision, duplicate] of [
    ["", false],
    ["0", true],
  ]) {
    const m = setup();
    assert.equal(
      (await logo(await logoRequest(revision, duplicate))).status,
      400,
    );
    assert.equal(m.calls.length, 0);
  }
  let m = setup();
  m.readSnapshots = [state(0)];
  m.ack = { code: "stale" };
  assert.equal((await logo(await logoRequest())).status, 409);
  assert.deepEqual(m.removed, [[m.path]]);
  m = setup();
  m.readSnapshots = [state(0)];
  m.writeError = { message: "uncertain" };
  assert.equal((await logo(await logoRequest())).status, 503);
  assert.equal(m.removed.length, 0);
  m = setup();
  m.readSnapshots = [state(0)];
  m.snapshot.school.asset_data.school = "other.png";
  assert.equal((await logo(await logoRequest())).status, 503);
});
test("Settings page redirects anonymous, denies non-admin and exposes recoverable error boundary for outages", async () => {
  let m = setup();
  m.caller = null;
  await assert.rejects(page(), (e) => e.url === "/login?expired=1");
  m = setup();
  m.caller.principal.is_admin = false;
  assert.equal((await page()).type, "main");
  m = setup();
  m.readError = { message: "private failure" };
  await assert.rejects(page(), /Settings unavailable/);
  setup();
  assert.equal((await page()).type, "main");
});
