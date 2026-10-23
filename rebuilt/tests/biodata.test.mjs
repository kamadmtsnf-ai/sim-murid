import test from "node:test";
import assert from "node:assert/strict";
import { registerHooks } from "node:module";
import { readFileSync, existsSync, statSync } from "node:fs";
import { resolve, dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import ts from "typescript";
import { NextRequest, NextResponse } from "next/server.js";
import { PDFDocument } from "pdf-lib";
globalThis.biodataReply = (b, s) =>
  NextResponse.json(b, {
    status: s,
    headers: { "Cache-Control": "private, no-store" },
  });
const mocks = {
  "server-only": "export {};",
  panel: "export const BiodataPanel=()=>null;",
  "next/server":
    "export const after=cb=>globalThis.biodataMocks.after.push(cb);",
  "next/navigation": `export const redirect=url=>{const e=Error('redirect');e.url=url;throw e;};export const notFound=()=>{throw Error('not_found')};`,
  "@/lib/auth/read-server": `export const readServerPrincipal=async()=>globalThis.biodataMocks.caller;`,
  "@/lib/auth/http": `export const privateJson=(b,s=200)=>globalThis.biodataReply(b,s);export const requestAuth=()=>({});export const verifiedPrincipal=async()=>globalThis.biodataMocks.caller;export const sameOrigin=r=>r.headers.get('origin')===new URL(r.url).origin;`,
  "@/lib/settings/server": `export const readBounded=async r=>{const a=new Uint8Array(await r.arrayBuffer());if(a.length>65536)throw new RangeError();return a;};`,
  "@/lib/auth/admin": `export const createAuthAdmin=()=>globalThis.biodataMocks.admin;`,
};
registerHooks({
  resolve(s, c, next) {
    if (s === "./biodata-panel" || s === "../biodata-panel")
      return { url: "biodata-mock:panel", shortCircuit: true };
    if (s in mocks) return { url: "biodata-mock:" + s, shortCircuit: true };
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
    if (url.startsWith("biodata-mock:"))
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

const { GET: profileGet, POST: profilePost } = await import(
  "../src/app/api/student-profile/[id]/route.ts"
);
const { GET: docsGet, POST: docsPost } = await import(
  "../src/app/api/student-documents/[id]/route.ts"
);
const { default: ownPage } = await import(
  "../src/app/account/biodata/page.tsx"
);
const { default: targetPage } = await import(
  "../src/app/account/biodata/[id]/page.tsx"
);
const { emptyBiodata, requiredFields } = await import(
  "../src/lib/student/validation.ts"
);
const { fieldSection, fieldVisible } = await import(
  "../src/lib/student/presentation.ts"
);
const id = (n) => `00000000-0000-4000-8000-${String(n).padStart(12, "0")}`;
const student = () => ({
  id: id(3),
  name: "Siswa uji",
  username: "0012",
  data: emptyBiodata(),
  revision: 2,
  can_write: true,
  progress: {
    percent: 0,
    complete: false,
    missing: [],
    missingDocuments: ["KK", "AKTA", "IJAZAH_MI"],
  },
});
const row = () => ({
  id: id(4),
  kind: "KK",
  filename: "kk.pdf",
  mime: "application/pdf",
  size: 10,
  state: "pending",
  created_at: "2026-10-23T00:00:00Z",
  owner_id: id(3),
  path: id(3) + "/" + id(4) + ".pdf",
});
function setup() {
  const m = (globalThis.biodataMocks = {
    caller: { principal: { id: id(1) }, sessionId: id(2) },
    student: student(),
    meta: row(),
    rows: [],
    calls: [],
    storageCalls: [],
    after: [],
    rpcError: null,
    storageError: null,
    code: "saved",
    file: new Blob(["bad"], { type: "application/pdf" }),
  });
  m.admin = {
    rpc: async (fn, args) => {
      m.calls.push([fn, args]);
      if (m.rpcError === fn)
        return { error: { message: "SQL private detail" }, data: null };
      if (fn === "app_survey_required") return { data: false, error: null };
      if (fn === "app_student_read") return { data: m.student, error: null };
      if (fn === "app_document_list") return { data: m.rows, error: null };
      if (fn === "app_document_get") return { data: m.meta, error: null };
      if (fn === "app_document_prepare")
        return {
          data: {
            code: "prepared",
            id: args.p_id,
            path: id(3) + "/" + args.p_id + ".pdf",
          },
          error: null,
        };
      if (fn === "app_document_delete")
        return {
          data: { code: args.p_done ? "deleted" : "deleting" },
          error: null,
        };
      return { data: { code: m.code }, error: null };
    },
    storage: {
      from: () => ({
        createSignedUploadUrl: async (path, opts) => {
          m.storageCalls.push(["upload", path, opts]);
          return {
            data: { path, token: "synthetic-token" },
            error: m.storageError,
          };
        },
        createSignedUrl: async (path, seconds, opts) => {
          m.storageCalls.push(["signed", path, seconds, opts]);
          return {
            data: { signedUrl: "https://example.org/signed" },
            error: m.storageError,
          };
        },
        download: async () => {
          m.storageCalls.push(["read"]);
          return { data: m.file, error: m.storageError };
        },
        remove: async () => {
          m.storageCalls.push(["remove"]);
          return { data: [], error: m.storageError };
        },
      }),
    },
  };
  return m;
}
const context = (owner = id(3)) => ({ params: Promise.resolve({ id: owner }) });
const req = (body, method = "POST", origin = "https://app.test") =>
  new NextRequest("https://app.test/api/student-documents/" + id(3), {
    method,
    headers: { origin, "Content-Type": "application/json" },
    ...(method === "POST"
      ? { body: typeof body === "string" ? body : JSON.stringify(body) }
      : {}),
  });
const prepare = {
  action: "prepare",
  kind: "KK",
  filename: "kk.pdf",
  size: 10,
  mime: "application/pdf",
};
test("biodata routes reject absent session and cross-origin mutations before storage", async () => {
  const m = setup();
  m.caller = null;
  for (const fn of [profileGet, profilePost, docsGet, docsPost])
    assert.equal((await fn(req({}), context())).status, 401);
  m.caller = { principal: { id: id(1) }, sessionId: id(2) };
  for (const fn of [profilePost, docsPost])
    assert.equal(
      (await fn(req({}, "POST", "https://foreign.test"), context())).status,
      403,
    );
  assert.equal(m.storageCalls.length, 0);
});
test("biodata profile passes verified caller, normalizes addresses and preserves zero/leading zeros", async () => {
  const m = setup();
  const r = await profilePost(
    req({
      requestId: id(8),
      revision: 2,
      data: {
        ...emptyBiodata(),
        NIK: "001234",
        JumlahSaudara: "0",
        WaliPilihan: "Ayah",
        AyahNama: "Ayah",
      },
    }),
    context(),
  );
  assert.equal(r.status, 200);
  const args = m.calls.find((c) => c[0] === "app_student_save")[1];
  assert.equal(args.p_actor, id(1));
  assert.equal(args.p_session, id(2));
  assert.equal(args.p_target, id(3));
  assert.equal(args.p_data.WaliNama, "Ayah");
  assert.equal(args.p_data.JumlahSaudara, "0");
  assert.equal(args.p_data.NIK, "001234");
});
test("biodata invalid/stale/denied/storage errors never report success or expose SQL", async () => {
  for (const code of ["stale", "denied", "request_conflict"]) {
    const m = setup();
    m.code = code;
    assert.equal(
      (
        await profilePost(
          req({ requestId: id(8), revision: 2, data: emptyBiodata() }),
          context(),
        )
      ).status,
      code === "denied" ? 403 : 409,
    );
  }
  const m = setup();
  m.rpcError = "app_student_save";
  const r = await profilePost(
    req({ requestId: id(8), revision: 2, data: emptyBiodata() }),
    context(),
  );
  assert.equal(r.status, 503);
  assert.ok(!JSON.stringify(await r.json()).includes("SQL"));
  assert.equal((await docsPost(req("{"), context())).status, 400);
  assert.equal((await docsPost(req(prepare), context("bad"))).status, 400);
});
test("private document read and upload maintain authorization and no-upsert contract", async () => {
  let m = setup();
  let r = await docsGet(req(null, "GET"), context());
  assert.equal(r.status, 200);
  assert.match(r.headers.get("cache-control"), /no-store/);
  m.student.can_write = false;
  r = await docsPost(req(prepare), context());
  assert.equal(r.status, 403);
  assert.equal(m.storageCalls.length, 0);
  m = setup();
  r = await docsPost(req(prepare), context());
  assert.equal(r.status, 200);
  assert.equal(m.storageCalls[0][2].upsert, false);
  assert.equal(typeof (await r.json()).upload.token, "string");
});
test("foreign document owner is denied before download/delete/finalize storage access", async () => {
  for (const action of ["download", "delete", "finalize"]) {
    const m = setup();
    m.meta.owner_id = id(9);
    const r = await docsPost(
      req({
        action,
        id: id(4),
        ...(action === "download" ? { download: true } : {}),
      }),
      context(),
    );
    assert.equal(r.status, 403);
    assert.equal(m.storageCalls.length, 0);
  }
});
test("signed private download uses short expiry and explicit filename, preview stays inline", async () => {
  for (const download of [true, false]) {
    const m = setup();
    m.meta.state = "ready";
    const r = await docsPost(
      req({ action: "download", id: id(4), download }),
      context(),
    );
    assert.equal(r.status, 200);
    assert.equal(m.storageCalls[0][2], 60);
    assert.deepEqual(
      m.storageCalls[0][3],
      download ? { download: "kk.pdf" } : {},
    );
  }
});
test("finalize rejects obsolete metadata and size mismatch before reading bytes", async () => {
  let m = setup();
  m.meta.state = "deleted";
  assert.equal(
    (await docsPost(req({ action: "finalize", id: id(4) }), context())).status,
    409,
  );
  assert.equal(m.storageCalls.length, 0);
  m = setup();
  let read = false;
  m.file = {
    size: 11,
    type: "application/pdf",
    arrayBuffer: async () => {
      read = true;
      throw Error("should not read");
    },
  };
  assert.equal(
    (await docsPost(req({ action: "finalize", id: id(4) }), context())).status,
    400,
  );
  assert.equal(read, false);
  assert.equal(
    m.calls.find((c) => c[0] === "app_document_finish")[1].p_valid,
    false,
  );
});
test("real PDF is inspected before successful finalize and snapshot refresh", async () => {
  const m = setup(),
    pdf = await PDFDocument.create();
  pdf.addPage();
  const bytes = await pdf.save();
  m.meta.size = bytes.length;
  m.file = new Blob([bytes], { type: "application/pdf" });
  const r = await docsPost(req({ action: "finalize", id: id(4) }), context());
  assert.equal(r.status, 200);
  const args = m.calls.find((c) => c[0] === "app_document_finish")[1];
  assert.equal(args.p_valid, true);
  assert.match(args.p_sha256, /^[a-f0-9]{64}$/);
  assert.ok((await r.json()).student);
});
test("delete partial storage failure preserves durable retry and never confirms deletion", async () => {
  const m = setup();
  m.storageError = { message: "storage unavailable" };
  const r = await docsPost(req({ action: "delete", id: id(4) }), context());
  assert.equal(r.status, 503);
  assert.equal(m.calls.filter((c) => c[0] === "app_document_delete").length, 1);
  assert.equal(
    m.calls.find((c) => c[0] === "app_document_delete")[1].p_done,
    false,
  );
});
test("page missing session redirects, invalid UUID is notFound, access denied differs from outage", async () => {
  let m = setup();
  m.caller = null;
  await assert.rejects(ownPage(), (e) => e.url === "/login?expired=1");
  m = setup();
  await assert.rejects(targetPage(context("bad")), /not_found/);
  m.student = null;
  assert.ok(await ownPage());
  m.rpcError = "app_student_read";
  await assert.rejects(ownPage(), /Unavailable/);
});
test("all required fields remain visible under conditional combinations and assigned exactly once", () => {
  for (const alive of ["Masih Hidup", "Sudah Meninggal"])
    for (const abroad of [true, false])
      for (const same of [true, false])
        for (const guardian of ["Ayah", "Lainnya"]) {
          const d = {
            ...emptyBiodata(),
            AyahStatus: alive,
            IbuStatus: alive,
            AyahAlamatTinggalLuarNegeri: abroad,
            IbuAlamatTinggalLuarNegeri: abroad,
            IbuAlamatSamadenganAyah: same,
            WaliPilihan: guardian,
            WaliAlamatStatus: "Lainnya",
            WaliAlamatTinggalLuarNegeri: abroad,
          };
          for (const f of requiredFields(d)) {
            assert.equal(fieldVisible(f, d), true, f);
            assert.ok(
              ["student", "father", "mother", "guardian", "address"].includes(
                fieldSection(f),
              ),
            );
          }
        }
});
