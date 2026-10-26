import "./support/next-dynamic.mjs";
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
  "@/lib/auth/read-server": `export const readServerPrincipal=async()=>globalThis.booksMocks.caller;`,
  "@/lib/auth/http": `export const privateJson=(body,status=200)=>globalThis.booksMocks.reply(body,status);export const requestAuth=()=>({});export const verifiedPrincipal=async()=>globalThis.booksMocks.caller;export const sameOrigin=r=>r.headers.get('origin')===r.nextUrl.origin;`,
  "@/lib/auth/admin": `export const createAuthAdmin=()=>({rpc:async(fn,args)=>{const m=globalThis.booksMocks;m.calls.push([fn,args]);if(fn==='app_survey_required')return {data:m.survey,error:null};if(fn==='app_learning_write')return {data:m.ack??{code:m.code,id:m.resultId},error:m.writeError};if(fn==='app_asset_cleanup')return {data:[],error:null};if(fn==='app_asset_admin'||fn==='app_asset_get')return {data:m.assetMeta,error:null};if(fn==='app_asset_write')return {data:{code:m.assetCode,id:args.p_data.id},error:m.assetError};return {data:m.readSnapshots?.shift()??m.snapshot,error:m.readError};},storage:{from:()=>({remove:async paths=>{globalThis.booksMocks.removed.push(paths);return {error:null};},createSignedUploadUrl:async()=>({data:{token:'signed-token'},error:null}),download:async()=>({data:globalThis.booksMocks.blob,error:null})})}});`,
  "@/lib/settings/server": `export const readBounded=async(r,max)=>{const bytes=new Uint8Array(await r.arrayBuffer());if(bytes.byteLength>max)throw new RangeError("Too large");return bytes;};`,
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
const { GET, POST } = await import("../src/app/api/learning/[module]/route.ts");
const { default: page } = await import(
  "../src/app/account/learning/[module]/page.tsx"
);

const { POST: assetPOST } = await import(
  "../src/app/api/learning/assets/route.ts"
);
const { GET: assetGET } = await import(
  "../src/app/api/learning/assets/[id]/route.ts"
);
const { booksSnapshot, bookFilters, bookLocator } = await import(
  "../src/lib/learning/books.ts"
);
const { commands } = await import("../src/lib/learning/validation.ts");
const { PDFDocument } = await import("pdf-lib");
const id = (n) => `00000000-0000-4000-8000-${String(n).padStart(12, "0")}`;
const params = { params: Promise.resolve({ module: "books" }) };
const command = {
  type: "book",
  id: null,
  title: "Buku",
  author: "Guru",
  publisher: "Madrasah",
  year: 2026,
  version: "1",
  category: "Pelajaran",
  subjectId: null,
  level: 7,
  url: "https://example.org/book.pdf",
  premium: false,
};
const snapshot = () => ({
  module: "books",
  revision: 1,
  today: "2026-10-23",
  isAdmin: true,
  canWrite: true,
  semester: 1,
  classes: [],
  people: [],
  rows: [
    {
      id: id(10),
      title: "Buku",
      author: "Guru",
      publisher: "Madrasah",
      publication_year: 2026,
      version: "1",
      category: "Pelajaran",
      subject_id: null,
      level: 7,
      external_url: "https://example.org/old.pdf",
      premium: false,
      active: true,
      assets: [],
    },
  ],
  extra: { subjects: [], total: 1, page: 1 },
});
function setup() {
  return (globalThis.booksMocks = {
    caller: { principal: { id: id(1), is_admin: true }, sessionId: id(2) },
    calls: [],
    removed: [],
    code: "saved",
    resultId: id(10),
    assetCode: "saved",
    survey: false,
    snapshot: snapshot(),
    reply: (b, status = 200) =>
      NextResponse.json(b, {
        status,
        headers: { "Cache-Control": "private, no-store" },
      }),
  });
}
const request = (c = command) =>
  new NextRequest("https://example.test/api/learning/books", {
    method: "POST",
    headers: {
      origin: "https://example.test",
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ requestId: id(99), revision: 1, command: c }),
  });
const get = (q = "") =>
  new NextRequest("https://example.test/api/learning/books" + q);
const assetRequest = (body) =>
  new NextRequest("https://example.test/api/learning/assets", {
    method: "POST",
    headers: {
      origin: "https://example.test",
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });
test("book DTO preserves optional metadata, year bounds, zero-length URL and rejects forged fields", () => {
  setup();
  assert.equal(
    commands.books.parse({ ...command, year: null, url: "" }).year,
    null,
  );
  for (const year of [1799, 2201, 2026.5])
    assert.equal(commands.books.safeParse({ ...command, year }).success, false);
  assert.equal(
    commands.books.safeParse({ ...command, title: " " }).success,
    false,
  );
  assert.equal(
    commands.books.safeParse({ ...command, actor: id(3) }).success,
    false,
  );
  assert.equal(
    commands.books.safeParse({ ...command, url: "javascript:alert(1)" })
      .success,
    false,
  );
  assert.equal(
    commands.books.parse({ ...command, title: "x".repeat(300) }).title.length,
    300,
  );
});
test("external locators retain HTTPS and normalize legacy Drive links safely", () => {
  assert.equal(
    bookLocator("https://drive.google.com/open?id=abc-123").preview,
    "https://drive.google.com/file/d/abc-123/preview",
  );
  assert.equal(
    bookLocator("https://drive.google.com/file/d/abc/view").preview,
    "https://drive.google.com/file/d/abc/preview",
  );
  for (const url of [
    "http://example.org",
    "javascript:alert(1)",
    "https://user:pass@example.org",
    "bad",
  ])
    assert.equal(bookLocator(url), null);
  assert.equal(
    bookLocator("https://example.org/book.pdf").href,
    "https://example.org/book.pdf",
  );
});
test("catalog reader validates module, pagination, rows and scoped filter contract", async () => {
  const m = setup();
  assert.equal(
    (await GET(get("?query=Buku&level=7&page=1"), params)).status,
    200,
  );
  assert.equal(m.calls.at(-1)[1].p_filters.level, 7);
  assert.equal((await GET(get("?page=0"), params)).status, 400);
  assert.equal((await GET(get("?semester=1"), params)).status, 200);
  assert.equal(m.calls.at(-1)[1].p_filters.semester, 1);
  m.snapshot.module = "reports";
  assert.equal((await GET(get(), params)).status, 503);
  assert.equal(
    booksSnapshot.safeParse({
      ...snapshot(),
      extra: { subjects: [], page: 1, total: "oops" },
    }).success,
    false,
  );
  assert.equal(bookFilters.safeParse({ semester: 1 }).success, false);
});
test("anonymous, survey, origin and revoked access fail before mutation", async () => {
  const m = setup();
  m.caller = null;
  assert.equal((await POST(request(), params)).status, 401);
  assert.equal(
    m.calls.some(([fn]) => fn === "app_learning_write"),
    false,
  );
  setup();
  const r = request();
  r.headers.set("origin", "https://evil.test");
  assert.equal((await POST(r, params)).status, 403);
  const n = setup();
  n.survey = true;
  assert.equal((await GET(get(), params)).status, 403);
  n.survey = false;
  n.code = "denied";
  assert.equal((await POST(request(), params)).status, 403);
});
test("saved book returns validated UUID acknowledgement without altering request identity", async () => {
  const m = setup();
  const r = await POST(request(), params),
    b = await r.json();
  assert.equal(r.status, 200);
  assert.equal(b.code, "saved");
  assert.equal(b.result.id, id(10));
  const args = m.calls.find(([fn]) => fn === "app_learning_write")[1];
  assert.equal(args.p_actor, id(1));
  assert.equal(args.p_session, id(2));
  assert.equal(args.p_request, id(99));
  assert.equal(args.p_revision, 1);
  assert.deepEqual(args.p_command, command);
});
test("malformed, unknown and wrong-target saved acknowledgements fail closed with 503", async () => {
  for (const ack of [
    { code: "saved" },
    { code: "saved", id: "bad" },
    { code: "unknown" },
    { code: "saved", id: id(11) },
  ]) {
    const m = setup();
    m.ack = ack;
    assert.equal(
      (await POST(request({ ...command, id: id(10) }), params)).status,
      503,
    );
  }
});
test("stale/conflict/invalid acknowledgements do not claim success", async () => {
  for (const code of ["stale", "request_conflict", "invalid", "not_found"]) {
    const m = setup();
    m.code = code;
    const r = await POST(request(), params);
    assert.equal(r.status, 409);
    assert.equal((await r.json()).code, code);
  }
});
test("backend outage is retryable through account error boundary; unauthenticated page redirects", async () => {
  const m = setup();
  m.readError = { message: "Offline" };
  await assert.rejects(page(params), /Books unavailable/);
  m.caller = null;
  await assert.rejects(page(params), (e) => e.url === "/login?expired=1");
});
test("asset writes remain admin-only and book uploads PDF-only", async () => {
  const m = setup();
  m.caller.principal.is_admin = false;
  assert.equal(
    (
      await assetPOST(
        assetRequest({
          action: "prepare",
          kind: "book",
          targetId: id(10),
          filename: "book.pdf",
          mime: "application/pdf",
          size: 100,
        }),
      )
    ).status,
    403,
  );
  setup();
  assert.equal(
    (
      await assetPOST(
        assetRequest({
          action: "prepare",
          kind: "book",
          targetId: id(10),
          filename: "book.jpg",
          mime: "image/jpeg",
          size: 100,
        }),
      )
    ).status,
    400,
  );
});
test("valid uploaded PDF is inspected and finalization preserves asset identity", async () => {
  const m = setup(),
    pdf = await PDFDocument.create();
  pdf.addPage();
  const bytes = await pdf.save();
  m.assetMeta = {
    id: id(80),
    path: `book/${id(10)}/${id(80)}`,
    mime: "application/pdf",
    filename: "book.pdf",
    size: bytes.length,
    state: "pending",
  };
  m.blob = new Blob([bytes]);
  const r = await assetPOST(assetRequest({ action: "finalize", id: id(80) }));
  assert.equal(r.status, 200);
  assert.equal((await r.json()).id, id(80));
  assert.ok(
    m.calls.some(
      ([fn, a]) =>
        fn === "app_asset_write" &&
        a.p_action === "ready" &&
        /^[a-f0-9]{64}$/.test(a.p_data.sha256),
    ),
  );
});
test("corrupt uploaded PDF fails validation without marking ready", async () => {
  const m = setup();
  m.assetMeta = {
    id: id(80),
    path: `book/${id(10)}/${id(80)}`,
    mime: "application/pdf",
    filename: "bad.pdf",
    size: 5,
    state: "pending",
  };
  m.blob = new Blob(["wrong"]);
  assert.equal(
    (await assetPOST(assetRequest({ action: "finalize", id: id(80) }))).status,
    400,
  );
  assert.equal(
    m.calls.some(
      ([fn, a]) => fn === "app_asset_write" && a.p_action === "ready",
    ),
    false,
  );
});
test("private book object access is checked before download and never cached publicly", async () => {
  const m = setup(),
    params = { params: Promise.resolve({ id: id(80) }) };
  m.assetMeta = null;
  assert.equal(
    (
      await assetGET(
        new NextRequest("https://example.test/api/learning/assets/" + id(80)),
        params,
      )
    ).status,
    403,
  );
  assert.equal(m.calls.at(-1)[1].p_actor, id(1));
  m.assetMeta = {
    path: "book/private/file",
    mime: "application/pdf",
    filename: "book.pdf",
  };
  m.blob = new Blob(["PDF"]);
  const r = await assetGET(
    new NextRequest("https://example.test/api/learning/assets/" + id(80)),
    params,
  );
  assert.equal(r.status, 200);
  assert.equal(r.headers.get("Cache-Control"), "private, no-store");
  assert.equal(r.headers.get("X-Content-Type-Options"), "nosniff");
});
