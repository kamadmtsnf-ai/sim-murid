/** Detail page/API tests use actual presentation and validation with synthetic SDK boundaries. */
import test from "node:test";
import assert from "node:assert/strict";
import { registerHooks } from "node:module";
import { readFileSync, existsSync } from "node:fs";
import { resolve, dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import ts from "typescript";
import { NextRequest, NextResponse } from "next/server.js";
import { renderToStaticMarkup } from "react-dom/server";
const sources = {
  "../manage-assignments": `import {createElement} from 'react';export const ManageAssignments=()=>createElement('button',null,'Kelola Tugas Tambahan');`,
  "server-only": "export {};",
  "next/navigation": `export const redirect=url=>{const e=Error('redirect');e.url=url;throw e};`,
  "next/link": `import {createElement} from 'react';export default function Link({prefetch,children,...props}){return createElement('a',props,children)}`,
  "@/lib/auth/read-server": `export const readServerPrincipal=async()=>{if(globalThis.detailMocks.authError)throw Error('Auth unavailable');return globalThis.detailMocks.caller};`,
  "@/lib/auth/admin": `export const createAuthAdmin=()=>({rpc:async(...a)=>{globalThis.detailMocks.calls.push(a);if(globalThis.detailMocks.failure)throw Error('private database context');return globalThis.detailMocks.result}});`,
  "@/lib/education/server": `export const educationContext=async()=>({caller:globalThis.detailMocks.caller,reply:(body,status=200)=>globalThis.detailMocks.reply(body,status)});export const failure=e=>({status:e.name==='ZodError'?400:503,message:'Safe service error'});`,
};
registerHooks({
  resolve(specifier, context, next) {
    if (context.parentURL?.startsWith("detail-mock:") && specifier === "react")
      return next(specifier, { ...context, parentURL: import.meta.url });
    if (specifier in sources)
      return { url: "detail-mock:" + specifier, shortCircuit: true };
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
    if (url.startsWith("detail-mock:"))
      return {
        format: "module",
        source: sources[url.slice(12)],
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
const { default: page } = await import(
  "../src/app/account/directory/[id]/page.tsx"
);
const { GET } = await import("../src/app/api/directory/[id]/route.ts");
const domain = await import("../src/lib/education/directory.ts");
const { DirectoryDetailView } = await import(
  "../src/app/account/directory/directory-detail.tsx"
);
const id = "11111111-1111-4111-8111-111111111111",
  actor = "22222222-2222-4222-8222-222222222222";
const person = () => ({
  id,
  username: "00-User",
  name: "Pengguna sintetis",
  role: "teacher",
  status: "active",
  contact: null,
  student: null,
  children: [],
  siblings: [],
  enrollments: [],
  assignments: [],
  homerooms: [],
  lessons: [],
});
function setup() {
  return (globalThis.detailMocks = {
    caller: { principal: { id: actor }, sessionId: "synthetic-session" },
    calls: [],
    result: { data: person(), error: null },
    failure: false,
    reply: (body, status) => NextResponse.json(body, { status }),
  });
}
const params = (target = id) => ({ params: Promise.resolve({ id: target }) });
const request = () =>
  new NextRequest(
    "https://example.test/api/directory/" + id + "?actor=untrusted",
  );
function render(node) {
  return renderToStaticMarkup(node);
}
test("anonymous detail redirects/401 before privileged reads", async () => {
  const m = setup();
  m.caller = null;
  await assert.rejects(
    () => page(params()),
    (e) => e.url === "/login?expired=1",
  );
  assert.equal((await GET(request(), params())).status, 401);
  assert.equal(m.calls.length, 0);
});
test("invalid UUID never reaches RPC; unavailable page remains focusable", async () => {
  const m = setup();
  const result = await page(params("invalid"));
  assert.match(render(result), /tabindex="-1"/);
  assert.equal((await GET(request(), params("invalid"))).status, 400);
  assert.equal(m.calls.length, 0);
});
test("page and API bind actor/session from server and target from validated URL", async () => {
  const m = setup();
  await page(params());
  await GET(request(), params());
  assert.deepEqual(m.calls, [
    [
      "app_directory_detail",
      { p_actor: actor, p_session: "synthetic-session", p_target: id },
    ],
    [
      "app_directory_detail",
      { p_actor: actor, p_session: "synthetic-session", p_target: id },
    ],
  ]);
});
test("malformed upstream data fails closed in page and API instead of returning false success", async () => {
  setup().result.data = { id };
  await assert.rejects(() => page(params()), /unavailable/i);
  const r = await GET(request(), params());
  assert.equal(r.status, 503);
  assert.ok(!(await r.json()).detail);
});
test("a mismatched upstream record never renders or returns another user", async () => {
  setup().result.data = { ...person(), id: actor };
  await assert.rejects(() => page(params()), /unavailable/i);
  assert.equal((await GET(request(), params())).status, 503);
});
test("null denial and missing record share unavailable result without leaking existence", async () => {
  setup().result.data = null;
  const html = render(await page(params()));
  assert.match(html, /Detail tidak tersedia untuk akun Anda/);
  assert.match(html, /tabindex="-1"/);
  assert.equal((await GET(request(), params())).status, 404);
});
test("validated successful API keeps extra existing fields and restricted null values", async () => {
  const m = setup();
  m.result.data = {
    ...person(),
    documents: null,
    mentoring_status: "existing field",
  };
  const r = await GET(request(), params());
  assert.equal(r.status, 200);
  assert.deepEqual((await r.json()).detail, m.result.data);
});
test("RPC/auth outages remain safe; invalid input differs from unavailable upstream", async () => {
  setup().failure = true;
  await assert.rejects(
    () => page(params()),
    (e) => !e.message.includes("private"),
  );
  const r = await GET(request(), params());
  assert.equal(r.status, 503);
  assert.ok(!JSON.stringify(await r.json()).includes("private"));
  setup().authError = true;
  await assert.rejects(() => page(params()), /unavailable/i);
});
test("dates reject normalized impossible dates and non-ISO values while retaining WIB formatting", () => {
  for (const date of [
    "2026-02-31",
    "2026-02-31T00:00:00Z",
    "1",
    " ",
    "invalid",
  ])
    assert.equal(domain.directoryDate(date), null, date);
  assert.equal(domain.directoryDate("2024-02-29"), "29 Feb 2024");
  assert.equal(domain.directoryDate("2026-10-21T18:00:00Z"), "22 Okt 2026");
});
test("all existing user roles have clear localized labels without expanding list filters", () => {
  assert.equal(domain.directoryRoleLabel("admin"), "Administrator");
  assert.equal(domain.directoryRoleLabel("customer"), "Nasabah");
  assert.equal(domain.directoryRoleLabel("teacher"), "Guru");
  assert.ok(!("admin" in domain.directoryRoles));
});
test("detail schema follows database status and academic-year constraints", () => {
  for (const patch of [
    { status: "deleted" },
    {
      enrollments: [
        {
          id,
          class_name: "VII A",
          year: 2026.5,
          starts_on: "2026-07-01",
          ended_at: null,
        },
      ],
    },
    {
      enrollments: [
        {
          id,
          class_name: "VII A",
          year: 2201,
          starts_on: "2026-07-01",
          ended_at: null,
        },
      ],
    },
  ])
    assert.equal(
      domain.directoryDetailSchema.safeParse({ ...person(), ...patch }).success,
      false,
    );
});
test("assignment state uses WIB date boundaries, inclusive end, revocation and unknown-date fallback", () => {
  assert.equal(typeof domain.directoryAssignmentState, "function");
  const a = {
    valid_from: "2026-10-22",
    valid_until: "2026-10-22",
    revoked_at: null,
  };
  assert.equal(domain.directoryAssignmentState(a, "2026-10-22"), "Aktif");
  assert.equal(
    domain.directoryAssignmentState(a, "2026-10-21"),
    "Belum berlaku",
  );
  assert.equal(domain.directoryAssignmentState(a, "2026-10-23"), "Berakhir");
  assert.equal(
    domain.directoryAssignmentState(
      { ...a, revoked_at: "2026-10-22T00:00:00Z" },
      "2026-10-22",
    ),
    "Dicabut",
  );
  assert.equal(
    domain.directoryAssignmentState(
      { ...a, valid_from: "invalid" },
      "2026-10-22",
    ),
    "Periode belum tersedia",
  );
  assert.equal(
    domain.directoryToday(new Date("2026-10-21T18:00:00Z")),
    "2026-10-22",
  );
});
test("restricted and empty views do not invent contacts or expose private student fields", () => {
  const html = render(
    DirectoryDetailView({ person: { ...person(), role: "student" } }),
  );
  assert.ok(!html.includes("Kontak dan profil"));
  assert.ok(!html.includes("/account/biodata/"));
  assert.match(html, /Belum ada riwayat kelas yang dapat ditampilkan/);
  const student = render(
    DirectoryDetailView({
      person: {
        ...person(),
        role: "student",
        student: { data: { NIK: "synthetic-sensitive" } },
      },
    }),
  );
  assert.ok(student.includes("/account/biodata/" + id));
  assert.ok(!student.includes("synthetic-sensitive"));
  assert.match(
    render(DirectoryDetailView({ person: { ...person(), role: "customer" } })),
    /Informasi tambahan tidak tersedia/,
  );
});
test("detail-specific loading uses correct context, named status and no real user data", async () => {
  const { default: Loading } = await import(
    "../src/app/account/directory/[id]/loading.tsx"
  );
  const html = render(Loading());
  assert.match(html, /Memuat detail pengguna/);
  assert.match(html, /aria-busy="true"/);
  assert.match(html, /tabindex="-1"/);
  assert.ok(!html.includes("Pengguna sintetis"));
});

test("canonical UUID casing remains compatible with Postgres identifiers", async () => {
  const m = setup(),
    target = "abcdefab-cdef-4abc-8def-abcdefabcdef";
  m.result.data = { ...person(), id: target };
  assert.equal(
    (await GET(request(), params(target.toUpperCase()))).status,
    200,
  );
  assert.match(
    render(await page(params(target.toUpperCase()))),
    /Pengguna sintetis/,
  );
});

test('assignment management control appears only for admin viewing a teacher',async()=>{
 let m=setup();assert.doesNotMatch(render(await page(params())),/Kelola Tugas Tambahan/);
 m=setup();m.caller.principal.is_admin=true;assert.match(render(await page(params())),/Kelola Tugas Tambahan/);
 m=setup();m.caller.principal.is_admin=true;m.result.data.role='student';assert.doesNotMatch(render(await page(params())),/Kelola Tugas Tambahan/);
});
