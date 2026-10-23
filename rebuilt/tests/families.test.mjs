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
  "next/navigation": `export const redirect=url=>{const e=Error('redirect');e.url=url;throw e};`,
  "@/lib/auth/read-server": `export const readServerPrincipal=async()=>globalThis.familiesMocks.caller;`,
  "@/lib/auth/http": `export const privateJson=(b,s=200)=>globalThis.familiesMocks.reply(b,s);export const requestAuth=()=>({});export const verifiedPrincipal=async()=>globalThis.familiesMocks.caller;export const sameOrigin=r=>r.headers.get('origin')===r.nextUrl.origin;`,
  "@/lib/auth/authorization": `export class AccessDenied extends Error{};`,
  "@/lib/settings/server": `export const readBounded=async(r,max)=>{const b=new Uint8Array(await r.arrayBuffer());if(b.byteLength>max)throw new RangeError('Large');return b;};`,
  "@/lib/auth/admin": `export const createAuthAdmin=()=>({rpc:async(fn,args)=>{const m=globalThis.familiesMocks;m.calls.push([fn,args]);if(fn==='app_survey_required')return {data:m.required??false,error:null};if(fn==='app_family_write')return {data:m.ack,error:m.writeError};return {data:m.snapshot,error:m.readError};}});`,
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
const { GET, POST } = await import("../src/app/api/families/route.ts");
const { default: page } = await import("../src/app/account/families/page.tsx");
const { familySelection, confirmFamily } = await import(
  "../src/lib/education/families.ts"
);
const { familySnapshot } = await import("../src/lib/education/validation.ts");
const id = (n) => `00000000-0000-4000-8000-${String(n).padStart(12, "0")}`;
const snapshot = () => ({
  revision: 1,
  students: [{ id: id(1), name: "Student", username: "001" }],
  parents: [{ id: id(2), name: "Parent" }],
  references: [],
  guardians: [
    { id: id(3), student_id: id(1), parent_id: id(2), relationship: "father" },
  ],
  families: [
    {
      id: id(4),
      name: "Family",
      members: [{ student_id: id(1), legacy_order: 10 }],
    },
  ],
});
function setup() {
  return (globalThis.familiesMocks = {
    calls: [],
    caller: { principal: { id: id(5), is_admin: true }, sessionId: id(6) },
    snapshot: snapshot(),
    ack: { code: "saved", id: id(4) },
    reply: (b, s = 200) => NextResponse.json(b, { status: s }),
  });
}
const guardian = {
  type: "guardian",
  studentId: id(1),
  parentId: id(2),
  relationship: "father",
  remove: false,
};
const family = {
  type: "family",
  id: id(4),
  name: "Family",
  studentIds: [id(1)],
};
const request = (command = guardian, query = "") =>
  new NextRequest("https://example.test/api/families" + query, {
    method: "POST",
    headers: {
      origin: "https://example.test",
      "content-type": "application/json",
    },
    body: JSON.stringify({ requestId: id(7), revision: 0, command }),
  });
test("Family API confirms relationships/groups and preserves caller/revision/request envelope", async () => {
  for (const command of [guardian, family, { ...family, id: null }]) {
    const m = setup();
    if (command.type === "guardian") m.ack.id = command.studentId;
    const r = await POST(request(command));
    assert.equal(r.status, 200);
    assert.equal((await r.json()).code, "saved");
    const call = m.calls.find(([name]) => name === "app_family_write")[1];
    assert.equal(call.p_actor, id(5));
    assert.equal(call.p_session, id(6));
    assert.equal(call.p_request, id(7));
    assert.equal(call.p_revision, 0);
    assert.deepEqual(call.p_command, command);
  }
});
test("Family API rejects unknown acknowledgement and mismatched readback rather than false success", async () => {
  for (const ack of [
    { code: "unknown" },
    null,
    {},
    { code: "saved", id: null },
  ]) {
    const m = setup();
    m.ack = ack;
    assert.equal((await POST(request({ ...family, id: null }))).status, 503);
  }
  let m = setup();
  m.snapshot.guardians = [];
  assert.equal((await POST(request())).status, 503);
  m = setup();
  m.snapshot.revision = 2;
  assert.equal((await POST(request())).status, 503);
  m = setup();
  m.snapshot.families[0].name = "Other";
  assert.equal((await POST(request(family))).status, 503);
  for (const [code, status] of [
    ["denied", 403],
    ["stale", 409],
    ["invalid", 409],
  ]) {
    m = setup();
    m.ack = { code };
    assert.equal((await POST(request())).status, status);
  }
});
test("Family API validates before mutation and enforces auth/origin/survey gates", async () => {
  let m = setup();
  m.caller = null;
  assert.equal((await POST(request())).status, 401);
  assert.equal(m.calls.length, 0);
  m = setup();
  m.required = true;
  assert.equal((await POST(request())).status, 403);
  assert.equal(
    m.calls.some(([fn]) => fn === "app_family_write"),
    false,
  );
  setup();
  assert.equal(
    (
      await POST(
        new NextRequest("https://example.test/api/families", {
          method: "POST",
          headers: { origin: "https://foreign.test" },
        }),
      )
    ).status,
    403,
  );
  m = setup();
  assert.equal((await POST(request(guardian, "?year=invalid"))).status, 400);
  assert.equal(
    m.calls.some(([fn]) => fn === "app_family_write"),
    false,
  );
  m = setup();
  assert.equal(
    (await POST(request({ ...family, studentIds: [id(1), id(1)] }))).status,
    400,
  );
  assert.equal(
    m.calls.some(([fn]) => fn === "app_family_write"),
    false,
  );
});
test("Malformed backend snapshot is unavailable, permission denied remains distinct from outage", async () => {
  let m = setup();
  m.snapshot = {};
  assert.equal(
    (await GET(new NextRequest("https://example.test/api/families"))).status,
    503,
  );
  m = setup();
  m.snapshot = null;
  assert.equal(
    (await GET(new NextRequest("https://example.test/api/families"))).status,
    403,
  );
  m = setup();
  m.readError = { message: "secret" };
  await assert.rejects(page(), /Families unavailable/);
  m = setup();
  m.snapshot = null;
  assert.equal((await page()).type, "main");
  m = setup();
  m.caller = null;
  await assert.rejects(page(), (e) => e.url === "/login?expired=1");
});
test("Family snapshot rejects duplicate current memberships and selection preserves retained legacy order", () => {
  const data = snapshot();
  data.students.push({ id: id(8), name: "New" });
  data.families[0].members.push({ student_id: id(9), legacy_order: 11 });
  assert.deepEqual(
    familySelection(familySnapshot.parse(data), id(4), [id(8), id(9), id(1)]),
    [id(1), id(9), id(8)],
  );
  assert.doesNotThrow(() =>
    confirmFamily(familySnapshot.parse(data), {
      ...family,
      studentIds: [id(9), id(1)],
    }),
  );
  data.families.push({
    id: id(10),
    name: "Duplicate",
    members: [{ student_id: id(1), legacy_order: 12 }],
  });
  assert.equal(familySnapshot.safeParse(data).success, false);
});
