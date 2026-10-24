import test from "node:test";
import assert from "node:assert/strict";
import { registerHooks } from "node:module";
import { readFileSync, existsSync, statSync } from "node:fs";
import { resolve, dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import ts from "typescript";
import { NextRequest, NextResponse } from "next/server.js";
globalThis.accessUiReply = (b, s) =>
  NextResponse.json(b, {
    status: s,
    headers: { "Cache-Control": "private, no-store" },
  });
const mocks = {
  "server-only": "export {};",
  panel: "export const AccessPanel=()=>null;",
  "next/navigation": `export const redirect=url=>{const e=Error('redirect');e.url=url;throw e;};`,
  "@/lib/auth/read-server": `export const readServerAuthClient=async()=>{const m=globalThis.accessUiMocks;if(m.redirect){const e=Error('redirect');e.url=m.redirect;throw e;}return m.client;};`,
  "@/lib/auth/security": `export const securityState=async()=>{const m=globalThis.accessUiMocks;if(m.securityError)throw Error('private security error');return m.state;};`,
  "@/lib/auth/http": `export const privateJson=(b,s=200)=>globalThis.accessUiReply(b,s);export const requestAuth=(r,jar)=>{jar.cookies.set('refreshed','synthetic');return globalThis.accessUiMocks.client;};export const verifiedPrincipal=async()=>globalThis.accessUiMocks.caller;`,
};
registerHooks({
  resolve(s, c, next) {
    if (s === "./access-panel")
      return { url: "access-mock:panel", shortCircuit: true };
    if (s in mocks) return { url: "access-mock:" + s, shortCircuit: true };
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
    if (url.startsWith("access-mock:"))
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

const { GET } = await import("../src/app/api/auth/access/route.ts");
const { default: page } = await import("../src/app/account/access/page.tsx");
const { loadOwnAccess } = await import("../src/lib/auth/access-page.ts");
const { accessPageSchema } = await import(
  "../src/lib/auth/access-validation.ts"
);
const {
  permissionRows,
  filterPermissions,
  classLabel,
  accessViewKey,
  uniqueAssignments,
  permissionLabel,
} = await import("../src/lib/auth/access-view.ts");
const id = (n) => `00000000-0000-4000-8000-${String(n).padStart(12, "0")}`;
const sample = () => ({
  user_id: id(1),
  role: "teacher",
  assignments: [{ code: "homeroom_teacher", class_id: id(11) }],
  grants: [
    { capability: "profiles.read", scope: "own", class_id: null },
    { capability: "classes.read", scope: "class", class_id: id(11) },
    { capability: "classes.read", scope: "class", class_id: id(12) },
    { capability: "references.read", scope: "all", class_id: null },
  ],
});
function setup() {
  const m = (globalThis.accessUiMocks = {
    caller: { principal: { id: id(1) }, sessionId: id(2) },
    state: { gate: "ready" },
    context: sample(),
    calls: [],
    queries: [],
    classes: [
      { id: id(11), name: "A", level: 7, academic_years: { start_year: 2026 } },
      { id: id(12), name: "B", level: 7, academic_years: { start_year: 2026 } },
    ],
  });
  m.client = {
    rpc: async (fn, ...args) => {
      m.calls.push([fn, ...args]);
      return {
        data: m.context,
        error: m.rpcError ? { message: "private SQL" } : null,
      };
    },
    from: (table) => ({
      select: (columns) => ({
        abortSignal: () => ({
          in: async (field, ids) => {
            m.queries.push({ table, columns, field, ids });
            if (m.metadataThrow) throw Error("private metadata");
            return {
              data: m.classes,
              error: m.metadataError ? { message: "private metadata" } : null,
            };
          },
        }),
      }),
    }),
  };
  return m;
}
const request = (query = "") =>
  new NextRequest("https://app.test/api/auth/access" + query);
test("access endpoint preserves refreshed cookies and private cache on success,401,403,503", async () => {
  for (const mode of [
    "success",
    "no-principal",
    "no-state",
    "gate",
    "outage",
  ]) {
    const m = setup();
    if (mode === "no-principal") m.caller = null;
    if (mode === "no-state") m.state = null;
    if (mode === "gate") m.state = { gate: "password" };
    if (mode === "outage") m.rpcError = true;
    const r = await GET(request());
    assert.equal(
      r.status,
      mode === "success"
        ? 200
        : mode === "gate"
          ? 403
          : mode === "outage"
            ? 503
            : 401,
    );
    assert.match(r.headers.get("set-cookie"), /refreshed/);
    assert.match(r.headers.get("cache-control"), /no-store/);
    if (mode === "outage")
      assert.ok(!JSON.stringify(await r.json()).includes("private"));
  }
});
test("access identity remains bound to authenticated caller and forged query never selects another user", async () => {
  let m = setup();
  const r = await GET(request("?user_id=" + id(99) + "&username=other"));
  assert.equal(r.status, 200);
  assert.deepEqual(m.calls, [["app_access_context"]]);
  assert.equal((await r.json()).user_id, id(1));
  m = setup();
  m.context.user_id = id(99);
  assert.equal((await GET(request())).status, 503);
  assert.equal(m.queries.length, 0);
  m = setup();
  m.context = null;
  assert.equal((await GET(request())).status, 401);
});
test("class metadata is caller scoped, bounded to referenced IDs and uses paired academic years", async () => {
  const m = setup();
  m.classes.push({
    id: id(99),
    name: "Foreign",
    level: 9,
    academic_years: { start_year: 2026 },
  });
  const data = await loadOwnAccess(m.client, id(1));
  assert.deepEqual(m.queries[0].ids.toSorted(), [id(11), id(12)]);
  assert.equal(m.queries[0].table, "classes");
  assert.equal(data.class_labels.length, 2);
  assert.equal(data.class_labels[0].label, "Kelas 7 · A · 2026/2027");
  assert.ok(!JSON.stringify(data).includes("Foreign"));
  m.context.assignments = [];
  m.context.grants = m.context.grants.filter((g) => g.scope !== "class");
  m.queries = [];
  await loadOwnAccess(m.client, id(1));
  assert.equal(m.queries.length, 0);
});
test("metadata unavailable, restricted by RLS, or malformed never broadens or discards class scope", async () => {
  for (const mode of ["error", "throw", "empty", "malformed"]) {
    const m = setup();
    if (mode === "error") m.metadataError = true;
    if (mode === "throw") m.metadataThrow = true;
    if (mode === "empty") m.classes = [];
    if (mode === "malformed") m.classes = [{ id: "bad" }];
    const r = await GET(request());
    assert.equal(r.status, 200);
    const data = await r.json();
    assert.deepEqual(data.grants, m.context.grants);
    assert.equal(data.class_labels.length, 0);
    assert.equal(data.details_available, mode === "empty");
    assert.ok(classLabel(data, id(11)).includes(id(11)));
  }
});
test("page retains exact login and onboarding redirects, errors reach retry boundary", async () => {
  let m = setup();
  const p = await page();
  assert.equal(p.props.initialData.user_id, id(1));
  m.caller = null;
  await assert.rejects(page(), (e) => e.url === "/login?expired=1");
  for (const gate of [null, { gate: "profile_pending" }]) {
    m = setup();
    m.state = gate;
    await assert.rejects(
      page(),
      (e) => e.url === (gate ? "/account/security" : "/login?expired=1"),
    );
  }
  m = setup();
  m.rpcError = true;
  await assert.rejects(page(), /unavailable/);
  m = setup();
  m.redirect = "/account/services/surveys";
  await assert.rejects(page(), (e) => e.url === m.redirect);
});
test("display groups exact tuples without losing class distinctions or mutating source", () => {
  const data = accessPageSchema.parse(sample());
  data.grants.push({ ...data.grants[1] });
  data.assignments.push({ ...data.assignments[0] });
  const before = structuredClone(data);
  const rows = permissionRows(data);
  assert.equal(rows.length, 3);
  assert.equal(
    rows.find((r) => r.capability === "classes.read").scopes.length,
    2,
  );
  assert.equal(uniqueAssignments(data).length, 1);
  assert.deepEqual(data, before);
  assert.equal(permissionLabel("classes.manage"), "Kelola Kelas dan siswa");
  assert.equal(permissionLabel("discipline.read"), "Lihat Poin siswa");
  assert.equal(
    permissionLabel("future.resource.export"),
    "export future.resource",
  );
  assert.equal(permissionLabel("unknown"), "unknown");
});
test("filters intersect and pagination source is complete; scope all never replaces own/class", () => {
  const data = accessPageSchema.parse({
    ...sample(),
    class_labels: [
      { id: id(11), label: "Kelas A 2026/2027" },
      { id: id(12), label: "Kelas B 2026/2027" },
    ],
  });
  assert.equal(
    filterPermissions(data, {
      query: "KELAS B",
      resource: "classes",
      scope: "class",
    })[0].scopes.length,
    2,
  );
  assert.equal(
    filterPermissions(data, {
      query: "profil",
      resource: "classes",
      scope: "own",
    }).length,
    0,
  );
  assert.equal(
    filterPermissions(data, { query: "", resource: "", scope: "own" })[0]
      .capability,
    "profiles.read",
  );
  assert.equal(
    filterPermissions(data, { query: "seluruh", resource: "", scope: "all" })[0]
      .capability,
    "references.read",
  );
  for (let i = 0; i < 35; i++)
    data.grants.push({
      capability: `future${i}.read`,
      scope: "all",
      class_id: null,
    });
  assert.equal(
    filterPermissions(data, { query: "", resource: "", scope: "" }).length,
    38,
  );
});
test("view schema rejects missing/contradictory class scope; stable page key ignores array order", () => {
  const data = accessPageSchema.parse(sample());
  for (const grant of [
    { capability: "classes.read", scope: "class", class_id: null },
    { capability: "profiles.read", scope: "own", class_id: id(11) },
  ])
    assert.equal(
      accessPageSchema.safeParse({ ...data, grants: [grant] }).success,
      false,
    );
  assert.equal(
    accessViewKey(data),
    accessViewKey({
      ...data,
      grants: data.grants.toReversed(),
      assignments: data.assignments.toReversed(),
    }),
  );
  assert.notEqual(
    accessViewKey(data),
    accessViewKey({ ...data, role: "admin" }),
  );
});
