/** Actual Classes route, schemas and server reader with synthetic Auth/SDK boundaries. */
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
  "next/link": "export default function Link(){};",
  "next/navigation": `export const notFound=()=>{throw Error('not found')};export const redirect=url=>{const e=Error('redirect');e.url=url;throw e};`,
  "@/lib/auth/read-server": `export const readServerPrincipal=async()=>globalThis.dutyMocks.caller;`,
  "@/lib/auth/http": `export const privateJson=(body,status=200)=>globalThis.dutyMocks.reply(body,status);export const requestAuth=()=>({});export const verifiedPrincipal=async()=>globalThis.dutyMocks.caller;export const sameOrigin=r=>r.headers.get('origin')===r.nextUrl.origin;`,
  "@/lib/auth/admin": `export const createAuthAdmin=()=>({rpc:async(fn,args)=>{const m=globalThis.dutyMocks;m.calls.push([fn,args]);if(fn==='app_survey_required')return {data:m.survey,error:null};if(fn==='app_operations_write')return {data:m.malformedResult?{}:{code:m.code},error:m.writeError};return {data:m.snapshot,error:m.readError};}});`,
  "@/lib/settings/server": `export const readBounded=async r=>new Uint8Array(await r.arrayBuffer());`,
};
registerHooks({
  resolve(s, c, next) {
    if (s in mocks) return { url: "duty-mock:" + s, shortCircuit: true };
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
    if (url.startsWith("duty-mock:"))
      return {
        format: "module",
        source: mocks[url.slice(10)],
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
const { GET, POST } = await import(
  "../src/app/api/operations/[module]/route.ts"
);
const { default: page } = await import(
  "../src/app/account/operations/[module]/page.tsx"
);
const { dutySnapshot, dutyFilters, dutyActions } = await import(
  "../src/lib/operations/duty.ts"
);
const id = (n) => `00000000-0000-4000-8000-${String(n).padStart(12, "0")}`;
const params = (module = "duty") => ({ params: Promise.resolve({ module }) });
function setup() {
  return (globalThis.dutyMocks = {
    caller: { principal: { id: id(1) }, sessionId: id(2) },
    calls: [],
    survey: false,
    code: "saved",
    snapshot: {
      module: "duty",
      today: "2026-10-22",
      revision: 0,
      canManage: true,
      isAdmin: true,
      people: [],
      classes: [],
      rows: [],
      total: 0,
      page: 1,
      pageSize: 50,
      summary: {},
      extra: { roster: [], confirmed: false },
    },
    reply: (b, status = 200) =>
      NextResponse.json(b, {
        status,
        headers: { "Cache-Control": "private, no-store" },
      }),
  });
}
function req(
  command = { type: "primary", teacherId: id(30) },
  query = "",
  origin = "https://example.test",
  module = "duty",
) {
  return new NextRequest(
    "https://example.test/api/operations/" + module + query,
    {
      method: "POST",
      headers: { origin, "Content-Type": "application/json" },
      body: JSON.stringify({ requestId: id(3), revision: 0, command }),
    },
  );
}
const writes = (m) => m.calls.filter((c) => c[0] === "app_operations_write");
test("invalid/implicit out-of-range duty filters are rejected before write", async () => {
  for (const query of [
    "?start=1900-01-01",
    "?year=1999",
    "?start=2026-12-01&end=2026-01-01",
    "?year=2026&end=2028-01-01",
    "?page=0",
    "?studentId=" + id(30),
  ]) {
    const m = setup();
    assert.equal((await POST(req(undefined, query), params())).status, 400);
    assert.equal(writes(m).length, 0);
  }
});
test("blank native date inputs normalize and valid filters reach confirmed read", async () => {
  const m = setup();
  const r = await POST(req(undefined, "?year=2026&start=&end="), params());
  assert.equal(r.status, 200);
  assert.equal((await r.json()).data.module, "duty");
  assert.equal(
    m.calls.find((c) => c[0] === "app_operations_read")[1].p_filters.year,
    2026,
  );
});
test("anonymous, survey-gated and foreign Origin cannot write", async () => {
  let m = setup();
  m.caller = null;
  assert.equal((await POST(req(), params())).status, 401);
  assert.equal(writes(m).length, 0);
  m = setup();
  m.survey = true;
  assert.equal((await POST(req(), params())).status, 403);
  assert.equal(writes(m).length, 0);
  m = setup();
  assert.equal(
    (await POST(req(undefined, "", "https://foreign.test"), params())).status,
    403,
  );
  assert.equal(m.calls.length, 0);
});
test("all duty commands preserve identity/revision and existing contract", async () => {
  for (const command of [
    { type: "primary", teacherId: id(30) },
    { type: "appoint", teacherId: id(31), replacesId: id(30) },
    { type: "roster", teacherId: id(30), weekdays: [1, 6], assignTask: true },
    { type: "confirm", id: id(40), reason: "Diperiksa hadir" },
    { type: "unconfirm", id: id(40), reason: "Batal konfirmasi" },
    { type: "cancel", id: id(40), reason: "Batal penunjukan" },
  ]) {
    const m = setup();
    assert.equal((await POST(req(command), params())).status, 200);
    assert.deepEqual(writes(m)[0][1], {
      p_actor: id(1),
      p_session: id(2),
      p_request: id(3),
      p_revision: 0,
      p_module: "duty",
      p_command: command,
    });
  }
});
test("known conflicts preserve status and no false success snapshot", async () => {
  for (const code of [
    "denied",
    "stale",
    "not_found",
    "request_conflict",
    "invalid",
    "duplicate",
  ]) {
    const m = setup();
    m.code = code;
    const r = await POST(req(), params());
    assert.equal(r.status, code === "denied" ? 403 : 409);
    const body = await r.json();
    assert.equal(body.result.code, code);
    assert.equal(body.code, code);
    assert.equal(
      m.calls.some((c) => c[0] === "app_operations_read"),
      false,
    );
  }
});
test("write acknowledgement and post-write read failure are uncertain 503", async () => {
  for (const change of [
    { malformedResult: true },
    { code: "unknown_ack" },
    { readError: { message: "private details" } },
    { snapshot: { module: "duty", revision: -1 } },
  ]) {
    const m = setup();
    Object.assign(m, change);
    const r = await POST(req(), params());
    assert.equal(r.status, 503);
    assert.equal(writes(m).length, 1);
    assert.equal(
      JSON.stringify(await r.json()).includes("private details"),
      false,
    );
  }
});
test("malformed duty upstream read is service error instead of input error", async () => {
  const m = setup();
  m.snapshot.revision = -1;
  assert.equal(
    (
      await GET(
        new NextRequest("https://example.test/api/operations/duty"),
        params(),
      )
    ).status,
    503,
  );
});
test("savings refuses success when its confirmed snapshot is malformed", async () => {
  setup();
  const r = await POST(
    req(
      { type: "account", ownerId: id(50), category: "S" },
      "",
      "https://example.test",
      "savings",
    ),
    params("savings"),
  );
  assert.equal(r.status, 503);
  assert.equal((await r.json()).code, undefined);
});
test("status/date scoped actions never offer cancelled/historical corrections", () => {
  const base = {
    id: id(40),
    teacher_id: id(30),
    name: "Guru",
    date: "2026-10-22",
    kind: "substitute",
    status: "pending",
    replaces_id: id(31),
    notes: "Guru utama",
    can_edit: true,
  };
  assert.deepEqual(dutyActions(base, base.date), ["confirm", "cancel"]);
  assert.deepEqual(dutyActions({ ...base, status: "confirmed" }, base.date), [
    "unconfirm",
    "cancel",
  ]);
  for (const patch of [
    { status: "cancelled" },
    { date: "2026-10-21" },
    { can_edit: false },
  ])
    assert.deepEqual(dutyActions({ ...base, ...patch }, base.date), []);
});
test("snapshot rejects unsafe revisions, duplicate rosters and invalid states", () => {
  const snapshot = setup().snapshot;
  for (const revision of [-1, 0.5, Number.MAX_SAFE_INTEGER + 1])
    assert.equal(
      dutySnapshot.safeParse({ ...snapshot, revision }).success,
      false,
    );
  const roster = { teacher_id: id(30), name: "Guru", weekday: 1 };
  assert.equal(
    dutySnapshot.safeParse({
      ...snapshot,
      extra: { roster: [roster, roster], confirmed: false },
    }).success,
    false,
  );
  assert.equal(
    dutySnapshot.safeParse({
      ...snapshot,
      extra: { roster: [{ ...roster, weekday: 7 }], confirmed: false },
    }).success,
    false,
  );
  assert.equal(
    dutyFilters.safeParse({ start: "2026-01-01", end: "2028-01-01" }).success,
    false,
  );
});
test("page validates filters, preserves history view, redirects and distinguishes outage", async () => {
  const m = setup();
  let result = await page({
    ...params(),
    searchParams: Promise.resolve({
      view: "history",
      year: "2026",
      start: "",
      end: "",
    }),
  });
  assert.equal(result.props.children[1].props.initialTab, "history");
  assert.equal(result.props.children[1].props.filters.year, 2026);
  result = await page({
    ...params(),
    searchParams: Promise.resolve({ year: "1999" }),
  });
  assert.equal(
    result.props.children[0].props.children,
    "Filter Guru Piket tidak valid",
  );
  m.readError = { message: "private" };
  await assert.rejects(() => page(params()), /Duty unavailable/);
  m.caller = null;
  await assert.rejects(
    () => page(params()),
    (e) => e.url === "/login?expired=1",
  );
});
test("duty exports preserve real XLSX/PDF output and read-only boundaries", async () => {
  for (const format of ["xlsx", "pdf"]) {
    setup();
    const { operationsExport } = await import(
      "../src/lib/operations/export.ts"
    );
    await operationsExport(setup().snapshot, format);
    const r = await GET(
      new NextRequest(
        "https://example.test/api/operations/duty?format=" + format,
      ),
      params(),
    );
    assert.equal(r.status, 200);
    assert.ok((await r.arrayBuffer()).byteLength > 100);
    assert.equal(r.headers.get("Cache-Control"), "no-store");
  }
});

test("GET normalizes empty native filter fields before reading", async () => {
  const m = setup();
  const r = await GET(
    new NextRequest(
      "https://example.test/api/operations/duty?year=2026&start=&end=",
    ),
    params(),
  );
  assert.equal(r.status, 200);
  assert.deepEqual(
    m.calls.find((c) => c[0] === "app_operations_read")[1].p_filters,
    { year: 2026 },
  );
});
