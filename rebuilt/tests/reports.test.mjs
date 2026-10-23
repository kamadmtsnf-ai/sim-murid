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
  "next/link": "export default function Link(){};",
  "next/navigation": `export const notFound=()=>{throw Error('not found')};export const redirect=url=>{const e=Error('redirect');e.url=url;throw e};`,
  "@/lib/auth/read-server": `export const readServerPrincipal=async()=>globalThis.reportsMocks.caller;`,
  "@/lib/auth/http": `export const privateJson=(body,status=200)=>globalThis.reportsMocks.reply(body,status);export const requestAuth=()=>({});export const verifiedPrincipal=async()=>globalThis.reportsMocks.caller;export const sameOrigin=r=>r.headers.get('origin')===r.nextUrl.origin;`,
  "@/lib/auth/admin": `export const createAuthAdmin=()=>({rpc:async(fn,args)=>{const m=globalThis.reportsMocks;m.calls.push([fn,args]);if(fn==='app_survey_required')return {data:m.survey,error:null};if(fn==='app_learning_write')return {data:m.malformedResult?{}:{code:m.code},error:m.writeError};return {data:m.readSnapshots?.shift()??m.snapshot,error:m.readError};}});`,
  "@/lib/settings/server": `export const readBounded=async r=>new Uint8Array(await r.arrayBuffer());`,
};
registerHooks({
  resolve(s, c, next) {
    if (s in mocks) return { url: "report-mock:" + s, shortCircuit: true };
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
    if (url.startsWith("report-mock:"))
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
const { GET, POST } = await import("../src/app/api/learning/[module]/route.ts");
const { default: page } = await import(
  "../src/app/account/learning/[module]/page.tsx"
);

const { reportReady, reportSnapshot, reportValue } = await import(
  "../src/lib/learning/reports.ts"
);
const id = (n) => `00000000-0000-4000-8000-${String(n).padStart(12, "0")}`;
const subject = {
  subject_id: id(60),
  name: "IPS",
  ph: 80,
  ats: 70,
  asas: 90,
  practice: 0,
  final: 82,
  kkm: 75,
  grade: "C",
  complete: true,
};
const draft = {
  student: { id: id(10), name: "Siswa", username: "siswa-1" },
  class: { id: id(30), name: "7A" },
  year: 2026,
  semester: 1,
  draft: true,
  policy: "RAPOR-1.0",
  subjects: [subject],
  school: { name: "Sekolah", identity: {} },
};
const row = { student_id: id(10), name: "Siswa", draft, published: null };
const params = { params: Promise.resolve({ module: "reports" }) };
function setup() {
  return (globalThis.reportsMocks = {
    caller: { principal: { id: id(1) }, sessionId: id(2) },
    calls: [],
    survey: false,
    code: "saved",
    snapshot: {
      module: "reports",
      today: "2026-10-23",
      revision: 2,
      isAdmin: true,
      canWrite: true,
      semester: 1,
      classes: [{ id: id(30), name: "7A", year: 2026 }],
      people: [],
      rows: [structuredClone(row)],
      extra: { canPublish: true },
    },
    reply: (b, status = 200) =>
      NextResponse.json(b, {
        status,
        headers: { "Cache-Control": "private, no-store" },
      }),
  });
}
const url =
  "https://example.test/api/learning/reports?classId=" + id(30) + "&semester=1";
const command = {
  type: "publish",
  classId: id(30),
  semester: 1,
  studentIds: [id(10)],
};
const request = (query = url) => new NextRequest(query);
const post = (patch = {}) =>
  new NextRequest(url, {
    method: "POST",
    headers: {
      origin: "https://example.test",
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ requestId: id(90), revision: 1, command, ...patch }),
  });
test("reader normalizes duplicate roles and binds trusted scope", async () => {
  const m = setup();
  m.snapshot.rows.push(structuredClone(row));
  const r = await GET(request(), params);
  assert.equal(r.status, 200);
  const b = await r.json();
  assert.equal(b.data.rows.length, 1);
  assert.equal(b.data.extra.scope.classId, id(30));
});
test("conflicting duplicate reports fail closed", async () => {
  const m = setup();
  m.snapshot.rows.push({ ...row, name: "Conflicting" });
  assert.equal((await GET(request(), params)).status, 503);
});
test("null draft never becomes a published report", () => {
  setup();
  const r = { ...row, draft: null };
  assert.equal(reportReady(r), false);
  assert.equal(reportSnapshot(r), null);
});
test("incomplete grades cannot be offered for publishing", () => {
  assert.equal(reportReady(row), true);
  assert.equal(
    reportReady({
      ...row,
      draft: { ...draft, subjects: [{ ...subject, complete: false }] },
    }),
    false,
  );
});
test("published snapshot stays authoritative after draft changes", () => {
  const r = {
    ...row,
    draft: { ...draft, subjects: [] },
    published: {
      id: id(99),
      published_at: "2026-10-23",
      snapshot: { ...draft, draft: false },
    },
  };
  assert.equal(reportReady(r), false);
  assert.equal(reportSnapshot(r).subjects[0].final, 82);
});
test("zero practice and missing values remain distinct", () => {
  assert.equal(reportValue(subject, "Praktik"), 0);
  assert.equal(reportValue({ ...subject, practice: null }, "Praktik"), null);
  assert.equal(reportValue(subject, "combined"), 82);
});
test("wrong student identity and period are rejected", async () => {
  const m = setup();
  m.snapshot.rows[0].draft.student.id = id(11);
  assert.equal((await GET(request(), params)).status, 503);
  setup().snapshot.semester = 2;
  assert.equal((await GET(request(), params)).status, 503);
});
test("confirmed publish returns authoritative readback", async () => {
  const m = setup();
  m.snapshot.rows[0].published = {
    id: id(99),
    snapshot: { ...structuredClone(draft), draft: false },
    published_at: "2026-10-23",
  };
  const r = await POST(post(), params);
  assert.equal(r.status, 200);
  const b = await r.json();
  assert.equal(b.code, "saved");
  assert.equal(b.data.revision, 2);
});
test("failed readback never claims confirmed success", async () => {
  setup().readError = { message: "offline" };
  assert.equal((await POST(post(), params)).status, 503);
});
test("unknown acknowledgement is uncertain", async () => {
  setup().code = "unexpected";
  assert.equal((await POST(post(), params)).status, 503);
});
test("stale scope rejected before RPC write", async () => {
  const m = setup();
  assert.equal(
    (await POST(post({ command: { ...command, semester: 2 } }), params)).status,
    409,
  );
  assert.ok(!m.calls.some(([fn]) => fn === "app_learning_write"));
});
test("auth and origin gates still protect publishing", async () => {
  setup().caller = null;
  assert.equal((await GET(request(), params)).status, 401);
  setup();
  const r = new NextRequest(url, {
    method: "POST",
    headers: { origin: "https://other.test" },
  });
  assert.equal((await POST(r, params)).status, 403);
});
test("PDF selection rejects foreign and duplicate IDs", async () => {
  setup();
  assert.equal(
    (await GET(request(url + "&format=pdf&selected=" + id(11)), params)).status,
    403,
  );
  assert.equal(
    (
      await GET(
        request(url + "&format=pdf&selected=" + id(10) + "," + id(10)),
        params,
      )
    ).status,
    400,
  );
});
test("empty PDF returns not found and actual PDF has valid signature", async () => {
  setup().snapshot.rows = [];
  assert.equal((await GET(request(url + "&format=pdf"), params)).status, 404);
  setup();
  const r = await GET(request(url + "&format=pdf&kind=Praktik"), params);
  assert.equal(r.status, 200);
  assert.equal(r.headers.get("cache-control"), "no-store");
  assert.ok(
    Buffer.from(await r.arrayBuffer())
      .subarray(0, 4)
      .equals(Buffer.from("%PDF")),
  );
});
test("report outage uses retry boundary", async () => {
  setup().readError = { message: "offline" };
  await assert.rejects(page(params), /unavailable/i);
});
test("favicon uses scalable school brand mark", () => {
  const s = readFileSync("src/app/icon.svg", "utf8");
  assert.match(s, /viewBox="0 0 64 64"/);
  assert.match(s, /#0f766e/);
  assert.ok(!s.includes("http://", s.indexOf("viewBox")));
});

test("PDF wraps long identifiers and title font widths", async () => {
  const { wrapPdfLine } = await import("../src/lib/learning/print.ts");
  for (const size of [10, 15]) {
    const lines = wrapPdfLine(
      "Madrasah " + "x".repeat(500),
      (text) => text.length * size,
    );
    assert.ok(lines.every((line) => line.length * size <= 510));
    assert.equal(
      lines.join("").replaceAll(" ", ""),
      "Madrasah" + "x".repeat(500),
    );
  }
});

test("saved acknowledgement with unpublished readback stays uncertain", async () => {
  setup();
  assert.equal((await POST(post(), params)).status, 503);
});
test("legacy publish URL without query remains accepted", async () => {
  const m = setup();
  m.snapshot.rows[0].published = {
    id: id(99),
    snapshot: { ...structuredClone(draft), draft: false },
    published_at: "2026-10-23",
  };
  const r = new NextRequest(url.split("?")[0], {
    method: "POST",
    headers: {
      origin: "https://example.test",
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ requestId: id(90), revision: 1, command }),
  });
  assert.equal((await POST(r, params)).status, 200);
});
