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
  "@/lib/auth/read-server": `export const readServerPrincipal=async()=>globalThis.schedulesMocks.caller;`,
  "@/lib/auth/http": `export const privateJson=(body,status=200)=>globalThis.schedulesMocks.reply(body,status);export const requestAuth=()=>({});export const verifiedPrincipal=async()=>globalThis.schedulesMocks.caller;export const sameOrigin=r=>r.headers.get('origin')===r.nextUrl.origin;`,
  "@/lib/auth/admin": `export const createAuthAdmin=()=>({rpc:async(fn,args)=>{const m=globalThis.schedulesMocks;m.calls.push([fn,args]);if(fn==='app_survey_required')return {data:m.survey,error:null};if(fn==='app_schedules_write')return {data:m.malformedResult?{}:{code:m.code},error:m.writeError};return {data:fn==='app_classes_read'?m.classSnapshot:m.snapshot,error:m.readError};}});`,
  "@/lib/settings/server": `export const readBounded=async r=>new Uint8Array(await r.arrayBuffer());`,
};
registerHooks({
  resolve(s, c, next) {
    if (s in mocks) return { url: "schedules-mock:" + s, shortCircuit: true };
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
    if (url.startsWith("schedules-mock:"))
      return {
        format: "module",
        source: mocks[url.slice(15)],
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
const { GET, POST } = await import("../src/app/api/schedules/route.ts");

const { scheduleSnapshot } = await import("../src/lib/education/validation.ts");
const { default: page } = await import("../src/app/account/schedules/page.tsx");
const id = (n) => `00000000-0000-4000-8000-${String(n).padStart(12, "0")}`;
function setup() {
  return (globalThis.schedulesMocks = {
    caller: { principal: { id: id(1) }, sessionId: id(2) },
    calls: [],
    classSnapshot: {
      revision: 0,
      can_manage: true,
      years: [{ id: id(10), start_year: 2026, is_active: true }],
      classes: [],
      teachers: [],
      students: [],
    },
    snapshot: {
      revision: 0,
      today: 4,
      lessons: [],
      duties: [],
      duty_roster: [],
      subjects: [],
      teachers: [],
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
  command = { type: "duties", classId: id(20), items: [] },
  query = "",
  origin = "https://example.test",
) {
  return new NextRequest("https://example.test/api/schedules" + query, {
    method: "POST",
    headers: { origin, "Content-Type": "application/json" },
    body: JSON.stringify({ requestId: id(3), revision: 0, command }),
  });
}
const writes = (m) => m.calls.filter((c) => c[0] === "app_schedules_write");

test("invalid year/class/day query never reaches write RPC", async () => {
  for (const query of [
    "?year=invalid",
    "?class=invalid",
    "?day=8",
    "?day=-1",
    "?day=no",
  ]) {
    const m = setup();
    assert.equal((await POST(req(undefined, query))).status, 400);
    assert.equal(writes(m).length, 0);
  }
});
test("anonymous, required survey and foreign Origin never write", async () => {
  let m = setup();
  m.caller = null;
  assert.equal((await POST(req())).status, 401);
  assert.equal(writes(m).length, 0);
  m = setup();
  m.survey = true;
  assert.equal((await POST(req())).status, 403);
  assert.equal(writes(m).length, 0);
  m = setup();
  assert.equal(
    (await POST(req(undefined, "", "https://foreign.test"))).status,
    403,
  );
  assert.equal(m.calls.length, 0);
});
test("lesson, full-week duties and selective deletion preserve server identity and command", async () => {
  for (const command of [
    {
      type: "lesson",
      id: null,
      classId: id(20),
      teacherId: id(30),
      subjectId: id(40),
      weekday: 1,
      start: "07:00",
      durationMinutes: 40,
      jtm: 2,
      breakMinutes: 15,
    },
    {
      type: "duties",
      classId: id(20),
      items: [
        { weekday: 1, studentId: id(50) },
        { weekday: 7, studentId: id(51) },
      ],
    },
    { type: "schedule_delete", lessonIds: [id(60)], dutyIds: [id(61)] },
  ]) {
    const m = setup();
    const r = await POST(
      req(command, `?year=${id(10)}&class=${id(20)}&day=1&personal=1`),
    );
    assert.equal(r.status, 200);
    assert.deepEqual(writes(m)[0][1], {
      p_actor: id(1),
      p_session: id(2),
      p_request: id(3),
      p_revision: 0,
      p_command: command,
    });
    const read = m.calls.find((c) => c[0] === "app_schedules_read");
    assert.deepEqual(read[1], {
      p_actor: id(1),
      p_session: id(2),
      p_year: id(10),
      p_class: id(20),
      p_weekday: 1,
      p_personal: true,
    });
  }
});
test("malformed upstream data produces safe 503 rather than client 400", async () => {
  for (const snapshot of [
    { revision: -1 },
    { ...setup().snapshot, today: 8 },
  ]) {
    const m = setup();
    m.snapshot = snapshot;
    const r = await GET(new NextRequest("https://example.test/api/schedules"));
    assert.equal(r.status, 503);
    assert.equal(JSON.stringify(await r.json()).includes("revision"), false);
  }
});
test("saved write with failed refresh is uncertain, never confirmed success", async () => {
  const m = setup();
  m.readError = { message: "private details" };
  const r = await POST(req());
  assert.equal(r.status, 503);
  assert.equal(writes(m).length, 1);
  assert.equal(
    JSON.stringify(await r.json()).includes("private details"),
    false,
  );
});
test("conflicts remain scoped and invalid commands never write", async () => {
  for (const code of [
    "stale",
    "denied",
    "overlap",
    "invalid_membership",
    "not_found",
    "request_conflict",
  ]) {
    const m = setup();
    m.code = code;
    const r = await POST(req());
    assert.equal(r.status, code === "denied" ? 403 : 409);
    assert.equal((await r.json()).code, code);
  }
  for (const cmd of [
    {
      type: "duties",
      classId: id(20),
      items: [
        { weekday: 1, studentId: id(50) },
        { weekday: 1, studentId: id(50) },
      ],
    },
    { type: "schedule_delete", lessonIds: [], dutyIds: [] },
    { type: "duties", classId: id(20), items: [], actor: id(99) },
  ]) {
    const m = setup();
    assert.equal((await POST(req(cmd))).status, 400);
    assert.equal(writes(m).length, 0);
  }
});
test("snapshot rejects unsafe revisions, invalid days and inconsistent computed time", () => {
  const snapshot = setup().snapshot;
  for (const revision of [-1, 0.5, Number.MAX_SAFE_INTEGER + 1])
    assert.equal(
      scheduleSnapshot.safeParse({ ...snapshot, revision }).success,
      false,
    );
  const lesson = {
    id: id(60),
    class_id: id(20),
    class_name: "7 A",
    year_id: id(10),
    subject_id: id(40),
    subject: "IPA",
    teacher_id: id(30),
    teacher_name: "Guru",
    weekday: 1,
    start_minute: 420,
    duration_minutes: 40,
    jtm: 2,
    break_minutes: 15,
    end_minute: 515,
    can_manage: true,
  };
  assert.equal(
    scheduleSnapshot.safeParse({ ...snapshot, lessons: [lesson] }).success,
    true,
  );
  for (const patch of [
    { weekday: 0 },
    { end_minute: 516 },
    { start_minute: 420.5 },
    { end_minute: 1440 },
  ])
    assert.equal(
      scheduleSnapshot.safeParse({
        ...snapshot,
        lessons: [{ ...lesson, ...patch }],
      }).success,
      false,
    );
  assert.equal(
    scheduleSnapshot.safeParse({ ...snapshot, lessons: [lesson, lesson] })
      .success,
    false,
  );
});

test("malformed write acknowledgement fails as uncertain upstream response", async () => {
  const m = setup();
  m.malformedResult = true;
  assert.equal((await POST(req())).status, 503);
  assert.equal(writes(m).length, 1);
});

test("page redirects anonymous and exposes upstream outage to retry boundary", async () => {
  const m = setup();
  m.caller = null;
  await assert.rejects(
    () => page({ searchParams: Promise.resolve({}) }),
    (e) => e.url === "/login?expired=1",
  );
  m.caller = { principal: { id: id(1) }, sessionId: id(2) };
  const result = await page({ searchParams: Promise.resolve({ day: "1" }) });
  assert.equal(result.props.children[1].props.filters.year, id(10));
  assert.equal(result.props.children[1].props.filters.weekday, 1);
  m.readError = { message: "private" };
  await assert.rejects(
    () => page({ searchParams: Promise.resolve({}) }),
    /Schedules unavailable/,
  );
});

test("page preserves the Piket tab across filters without changing RPC command scope", async () => {
  const m = setup();
  const result = await page({
    searchParams: Promise.resolve({ view: "piket", day: "7", personal: "1" }),
  });
  const panel = result.props.children[1];
  assert.equal(panel.props.initialTab, "piket");
  assert.equal(panel.props.filters.weekday, 7);
  assert.equal(panel.props.filters.personal, true);
  assert.equal(
    m.calls.some((c) => c[0] === "app_schedules_write"),
    false,
  );
});
test("unknown or repeated tab query safely defaults to KBM", async () => {
  for (const view of ["invalid", ["piket", "kbm"]]) {
    setup();
    const result = await page({ searchParams: Promise.resolve({ view }) });
    assert.equal(result.props.children[1].props.initialTab, "kbm");
  }
});
