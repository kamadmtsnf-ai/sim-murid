/** Actual Classes route, schemas and server reader with synthetic Auth/SDK boundaries. */
import test from "node:test";
import assert from "node:assert/strict";
import { registerHooks } from "node:module";
import { readFileSync, existsSync } from "node:fs";
import { resolve, dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import ts from "typescript";
import { NextRequest, NextResponse } from "next/server.js";
const mocks = {
  "server-only": "export {};",
  "next/navigation": `export const redirect=url=>{const e=Error('redirect');e.url=url;throw e};`,
  "@/lib/auth/read-server": `export const readServerPrincipal=async()=>globalThis.classesMocks.caller;`,
  "@/lib/auth/http": `export const privateJson=(body,status=200)=>globalThis.classesMocks.reply(body,status);export const requestAuth=()=>({});export const verifiedPrincipal=async()=>globalThis.classesMocks.caller;export const sameOrigin=r=>r.headers.get('origin')===r.nextUrl.origin;`,
  "@/lib/auth/admin": `export const createAuthAdmin=()=>({rpc:async(fn,args)=>{const m=globalThis.classesMocks;m.calls.push([fn,args]);if(fn==='app_survey_required')return {data:m.survey,error:null};if(fn==='app_classes_write')return {data:{code:m.code},error:m.writeError};return {data:m.snapshot,error:m.readError};}});`,
  "@/lib/settings/server": `export const readBounded=async r=>new Uint8Array(await r.arrayBuffer());`,
};
registerHooks({
  resolve(s, c, next) {
    if (s in mocks) return { url: "classes-mock:" + s, shortCircuit: true };
    let p;
    if (s.startsWith("@/")) p = resolve("src", s.slice(2));
    else if (s.startsWith(".") && c.parentURL?.includes("/src/"))
      p = join(dirname(fileURLToPath(c.parentURL)), s);
    if (p)
      for (const ext of ["", ".ts", ".tsx"])
        if (existsSync(p + ext))
          return { url: new URL("file://" + p + ext).href, shortCircuit: true };
    return next(s, c);
  },
  load(url, c, next) {
    if (url.startsWith("classes-mock:"))
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
const { GET, POST } = await import("../src/app/api/classes/route.ts");
const { classesData } = await import("../src/lib/education/server.ts");
const { classSnapshot } = await import("../src/lib/education/validation.ts");
const { default: page } = await import("../src/app/account/classes/page.tsx");
const id = (n) => `00000000-0000-4000-8000-${String(n).padStart(12, "0")}`;
function setup() {
  return (globalThis.classesMocks = {
    caller: { principal: { id: id(1) }, sessionId: id(2) },
    calls: [],
    snapshot: {
      revision: 0,
      can_manage: true,
      years: [{ id: id(10), start_year: 2026, is_active: true }],
      classes: [],
      teachers: [],
      students: [],
    },
    survey: false,
    code: "saved",
    reply: (b, s) =>
      NextResponse.json(b, {
        status: s,
        headers: { "Cache-Control": "private, no-store" },
      }),
  });
}
function req(
  command = { type: "year", startYear: 2027 },
  query = "",
  origin = "https://example.test",
) {
  return new NextRequest("https://example.test/api/classes" + query, {
    method: "POST",
    headers: { origin, "Content-Type": "application/json" },
    body: JSON.stringify({ requestId: id(3), revision: 0, command }),
  });
}
const writes = (m) => m.calls.filter((c) => c[0] === "app_classes_write");
test("anonymous and survey-required mutations never write", async () => {
  let m = setup();
  m.caller = null;
  assert.equal((await POST(req())).status, 401);
  assert.equal(writes(m).length, 0);
  m = setup();
  m.survey = true;
  assert.equal((await POST(req())).status, 403);
  assert.equal(writes(m).length, 0);
});
test("foreign Origin is rejected before context or RPC", async () => {
  const m = setup();
  assert.equal(
    (await POST(req(undefined, "", "https://foreign.test"))).status,
    403,
  );
  assert.equal(m.calls.length, 0);
});
test("invalid year query is rejected before any write", async () => {
  const m = setup();
  assert.equal((await POST(req(undefined, "?year=invalid"))).status, 400);
  assert.equal(writes(m).length, 0);
});
test("all commands preserve IDs, revision and server actor/session", async () => {
  for (const cmd of [
    { type: "year", startYear: 2027 },
    { type: "year_activate", id: id(10) },
    {
      type: "class",
      id: null,
      yearId: id(10),
      level: 7,
      name: "7 A",
      teacherId: null,
    },
    {
      type: "class",
      id: id(20),
      yearId: id(10),
      level: 8,
      name: "8 A",
      teacherId: id(30),
    },
    { type: "class_archive", id: id(20) },
    {
      type: "enrollment",
      classId: id(20),
      studentIds: [id(40)],
      startsOn: "2026-10-22",
      remove: true,
    },
  ]) {
    const m = setup();
    assert.equal((await POST(req(cmd))).status, 200);
    assert.deepEqual(writes(m)[0][1], {
      p_actor: id(1),
      p_session: id(2),
      p_request: id(3),
      p_revision: 0,
      p_command: cmd,
    });
  }
});
test("invalid commands and duplicate student IDs cannot reach write RPC", async () => {
  for (const cmd of [
    { type: "year", startYear: 2200 },
    {
      type: "enrollment",
      classId: id(20),
      studentIds: [id(40), id(40)],
      startsOn: "2026-10-22",
      remove: false,
    },
    { type: "year", startYear: 2027, actor: id(99) },
  ]) {
    const m = setup();
    assert.equal((await POST(req(cmd))).status, 400);
    assert.equal(writes(m).length, 0);
  }
});
test("known conflicts preserve error status and code", async () => {
  for (const code of [
    "stale",
    "duplicate",
    "class_in_use",
    "denied",
    "request_conflict",
  ]) {
    const m = setup();
    m.code = code;
    const r = await POST(req());
    assert.equal(r.status, code === "denied" ? 403 : 409);
    assert.equal((await r.json()).code, code);
  }
});
test("malformed upstream snapshot is service failure, never client validation error", async () => {
  const m = setup();
  m.snapshot = { revision: -1 };
  const r = await GET(new NextRequest("https://example.test/api/classes"));
  assert.equal(r.status, 503);
  assert.equal(JSON.stringify(await r.json()).includes("revision"), false);
});
test("saved write followed by failed refresh is not reported as confirmed success", async () => {
  const m = setup();
  m.readError = { message: "private database details" };
  const r = await POST(req());
  assert.equal(r.status, 503);
  assert.equal(writes(m).length, 1);
  assert.equal(
    JSON.stringify(await r.json()).includes("private database"),
    false,
  );
});
test("snapshot rejects invalid numeric metadata and inconsistent references", () => {
  const m = setup();
  for (const revision of [-1, 0.5, Number.MAX_SAFE_INTEGER + 1])
    assert.equal(
      classSnapshot.safeParse({ ...m.snapshot, revision }).success,
      false,
    );
  assert.equal(
    classSnapshot.safeParse({
      ...m.snapshot,
      years: [...m.snapshot.years, ...m.snapshot.years],
    }).success,
    false,
  );
  assert.equal(
    classSnapshot.safeParse({
      ...m.snapshot,
      years: [{ id: id(10), start_year: 2026.5, is_active: true }],
    }).success,
    false,
  );
});
test("page redirects anonymous, distinguishes denied data and upstream outage", async () => {
  const m = setup();
  m.caller = null;
  await assert.rejects(
    () => page(),
    (e) => e.url === "/login?expired=1",
  );
  m.caller = { principal: { id: id(1) }, sessionId: id(2) };
  m.snapshot = null;
  assert.ok(await page());
  m.readError = { message: "private" };
  await assert.rejects(() => page(), /Classes unavailable/);
  await assert.rejects(() => classesData(id(1), id(2)), /Unavailable/);
});

test('paired academic-year request normalizes at the actual route and invalid pairs never write',async()=>{
 for(const academicYear of ['2026/2027','2026-2027']){const m=setup();assert.equal((await POST(req({type:'year',academicYear}))).status,200);assert.deepEqual(writes(m)[0][1].p_command,{type:'year',startYear:2026});}
 for(const academicYear of ['2026','2026/2028','2027/2026']){const m=setup();assert.equal((await POST(req({type:'year',academicYear}))).status,400);assert.equal(writes(m).length,0);}
});
