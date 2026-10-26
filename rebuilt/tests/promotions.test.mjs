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
  "@/lib/auth/read-server": `export const readServerPrincipal=async()=>globalThis.promotionsMocks.caller;`,
  "@/lib/auth/http": `export const privateJson=(body,status=200)=>globalThis.promotionsMocks.reply(body,status);export const requestAuth=()=>({});export const verifiedPrincipal=async()=>globalThis.promotionsMocks.caller;export const sameOrigin=r=>r.headers.get('origin')===r.nextUrl.origin;`,
  "@/lib/auth/admin": `export const createAuthAdmin=()=>({rpc:async(fn,args)=>{const m=globalThis.promotionsMocks;m.calls.push([fn,args]);if(fn==='app_survey_required')return {data:m.survey,error:null};if(fn==='app_learning_write')return {data:{code:m.code},error:m.writeError};if(fn==='app_asset_cleanup')return {data:[],error:null};if(fn==='app_asset_admin'||fn==='app_asset_get')return {data:m.assetMeta,error:null};if(fn==='app_asset_write')return {data:{code:m.assetCode,id:args.p_data.id},error:m.assetError};return {data:m.readSnapshots?.shift()??m.snapshot,error:m.readError};},storage:{from:()=>({remove:async paths=>{globalThis.promotionsMocks.removed.push(paths);return {error:null};},createSignedUploadUrl:async()=>({data:{token:'signed-token'},error:null}),download:async()=>({data:globalThis.promotionsMocks.blob,error:null})})}});`,
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
const { promotionsSnapshot, mappingError, promotionConfirmed, emptyMetadata } =
  await import("../src/lib/learning/promotions.ts");
const { diplomaFields } = await import("../src/lib/learning/validation.ts");
const { PDFDocument } = await import("pdf-lib");
const id = (n) => `00000000-0000-4000-8000-${String(n).padStart(12, "0")}`;
const params = { params: Promise.resolve({ module: "promotions" }) };
const metadata = Object.fromEntries(diplomaFields.map((k) => [k, ""]));
const row = (n = 10, role = "student", classId = id(30)) => ({
  student_id: id(n),
  name: "Pengguna " + n,
  role,
  class_id: classId,
  diploma:
    role === "alumni"
      ? {
          metadata: { ...metadata, nomor_ijazah: "LAMA" },
          view_override: "deny",
          download_override: "deny",
        }
      : null,
  canView: true,
  canDownload: true,
  assets: [],
});
const snapshot = () => ({
  module: "promotions",
  revision: 1,
  today: "2026-10-23",
  isAdmin: true,
  canWrite: true,
  semester: 1,
  classes: [
    {
      id: id(30),
      name: "7A",
      academic_year_id: id(70),
      level: 7,
      year: 2026,
      archived_at: null,
    },
    {
      id: id(31),
      name: "8A",
      academic_year_id: id(71),
      level: 8,
      year: 2027,
      archived_at: null,
    },
  ],
  people: [],
  rows: [row(), row(11, "alumni", null)],
  extra: {
    years: [
      { id: id(70), start_year: 2026 },
      { id: id(71), start_year: 2027 },
    ],
    access: { allow_view: false, allow_download: false },
  },
});
function setup() {
  return (globalThis.promotionsMocks = {
    caller: { principal: { id: id(1), is_admin: true }, sessionId: id(2) },
    calls: [],
    removed: [],
    code: "saved",
    assetCode: "saved",
    survey: false,
    snapshot: snapshot(),
    assetMeta: {
      id: id(80),
      path: "diploma/" + id(11) + "/" + id(80),
      mime: "application/pdf",
      filename: "ijazah.pdf",
      size: 1,
      state: "ready",
    },
    reply: (b, status = 200) =>
      NextResponse.json(b, {
        status,
        headers: { "Cache-Control": "private, no-store" },
      }),
  });
}
const mapping = {
  type: "promote",
  sourceYearId: id(70),
  targetYearId: id(71),
  items: [{ studentId: id(10), expectedClassId: id(30), classId: id(31) }],
  reason: "Keputusan rapat",
};
const request = (command, revision = 1) =>
  new NextRequest("https://example.test/api/learning/promotions", {
    method: "POST",
    headers: {
      origin: "https://example.test",
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ requestId: id(99), revision, command }),
  });
const assetRequest = (body) =>
  new NextRequest("https://example.test/api/learning/assets", {
    method: "POST",
    headers: {
      origin: "https://example.test",
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });
test("mapping validates correct levels, next year and full source scope", () => {
  const d = promotionsSnapshot.parse(snapshot());
  assert.equal(mappingError(d, mapping), null);
  assert.ok(mappingError(d, { ...mapping, targetYearId: id(70) }));
  assert.ok(
    mappingError(d, {
      ...mapping,
      items: [{ ...mapping.items[0], classId: null }],
    }),
  );
  assert.ok(mappingError(d, { ...mapping, sourceYearId: id(71) }));
  assert.ok(
    mappingError(d, {
      ...mapping,
      items: [{ ...mapping.items[0], classId: id(30) }],
    }),
  );
});
test("manual placement and alumni restore preserve explicit null/class targets", () => {
  const d = promotionsSnapshot.parse(snapshot());
  assert.equal(
    mappingError(d, {
      ...mapping,
      type: "place",
      items: [{ studentId: id(11), expectedClassId: null, classId: id(31) }],
    }),
    null,
  );
  assert.equal(
    mappingError(d, {
      ...mapping,
      type: "place",
      items: [{ ...mapping.items[0], classId: null }],
    }),
    null,
  );
});
test("metadata opens correct alumni and preserves every field including zero", () => {
  const a = row(11, "alumni", null),
    b = row(12, "alumni", null);
  a.diploma.metadata.nomor_ijazah = "A";
  b.diploma.metadata.nomor_ijazah = "B";
  b.diploma.metadata.nilai_rata_rata = 0;
  assert.equal(emptyMetadata(a).nomor_ijazah, "A");
  assert.equal(emptyMetadata(b).nomor_ijazah, "B");
  assert.equal(emptyMetadata(b).nilai_rata_rata, "0");
  assert.equal(Object.keys(emptyMetadata(a)).length, 13);
});
test("same student may have active enrollments in distinct years without duplicate UI identity", () => {
  const d = snapshot();
  d.rows.push(row(10, "student", id(31)));
  assert.ok(promotionsSnapshot.safeParse(d).success);
  assert.equal(mappingError(promotionsSnapshot.parse(d), mapping), null);
  d.rows.push(row());
  assert.equal(promotionsSnapshot.safeParse(d).success, false);
});
test("invalid snapshot class/access/revision fails closed", async () => {
  for (const change of [
    (d) => (d.revision = -1),
    (d) => (d.rows[0].class_id = id(100)),
    (d) => delete d.extra.access,
  ]) {
    const m = setup();
    change(m.snapshot);
    assert.equal(
      (
        await GET(
          new NextRequest("https://example.test/api/learning/promotions"),
          params,
        )
      ).status,
      503,
    );
  }
});
test("fresh preflight rejects wrong-year while stale/replay UUID semantics stay with RPC", async () => {
  let m = setup();
  assert.equal(
    (await POST(request({ ...mapping, sourceYearId: id(71) }), params)).status,
    409,
  );
  assert.ok(!m.calls.some(([fn]) => fn === "app_learning_write"));
  m = setup();
  m.code = "stale";
  assert.equal((await POST(request(mapping, 0), params)).status, 409);
  assert.ok(m.calls.some(([fn]) => fn === "app_learning_write"));
  m = setup();
  m.snapshot.revision = 2;
  m.snapshot.rows[0].class_id = id(31);
  assert.equal((await POST(request(mapping), params)).status, 200);
});
test("successful promotion requires revision and authoritative target role/class readback", async () => {
  const m = setup(),
    next = snapshot();
  next.revision = 2;
  next.rows[0].class_id = id(31);
  m.readSnapshots = [snapshot(), next];
  const r = await POST(request(mapping), params);
  assert.equal(r.status, 200);
  const b = await r.json();
  assert.equal(b.result.code, "saved");
  assert.equal(b.code, "saved");
  assert.equal(b.data.rows[0].class_id, id(31));
});
test("unknown acknowledgement or stale/unapplied readback cannot claim success", async () => {
  setup().code = "unknown";
  assert.equal((await POST(request(mapping), params)).status, 503);
  setup();
  assert.equal((await POST(request(mapping), params)).status, 503);
  const m = setup(),
    next = snapshot();
  next.revision = 2;
  m.readSnapshots = [snapshot(), next];
  assert.equal((await POST(request(mapping), params)).status, 503);
});
test("metadata and independent global/override policies have exact readback checks", () => {
  const d = promotionsSnapshot.parse(snapshot());
  assert.equal(
    promotionConfirmed(d, {
      type: "access",
      scope: "global",
      view: false,
      download: false,
    }),
    true,
  );
  assert.equal(
    promotionConfirmed(d, {
      type: "access",
      scope: "global",
      view: true,
      download: false,
    }),
    false,
  );
  assert.equal(
    promotionConfirmed(d, {
      type: "access",
      scope: "individual",
      studentIds: [id(11)],
      view: "deny",
      download: "deny",
    }),
    true,
  );
  assert.equal(
    promotionConfirmed(d, {
      type: "diploma",
      studentId: id(11),
      metadata: { ...metadata, nomor_ijazah: "LAMA" },
    }),
    true,
  );
  assert.equal(
    promotionConfirmed(d, { type: "diploma", studentId: id(11), metadata }),
    false,
  );
});
test("anonymous, role, origin and survey gates still protect actions", async () => {
  setup().caller = null;
  assert.equal((await POST(request(mapping), params)).status, 401);
  setup().snapshot.isAdmin = false;
  assert.equal((await POST(request(mapping), params)).status, 403);
  setup().survey = true;
  assert.equal((await POST(request(mapping), params)).status, 403);
  setup();
  const r = new NextRequest("https://example.test/api/learning/promotions", {
    method: "POST",
    headers: { origin: "https://foreign.test" },
  });
  assert.equal((await POST(r, params)).status, 403);
});
test("outage uses retry boundary and anonymous page redirects to login", async () => {
  setup().readError = { message: "offline" };
  await assert.rejects(page(params), /unavailable/i);
  setup().caller = null;
  await assert.rejects(page(params), (e) => e.url === "/login?expired=1");
});
test("asset delete returns explicit matching ack, denied ack never deletes storage", async () => {
  let m = setup();
  let r = await assetPOST(assetRequest({ action: "delete", id: id(80) }));
  assert.equal(r.status, 200);
  assert.equal((await r.json()).action, "delete");
  assert.equal(m.removed.length, 1);
  m = setup();
  m.assetCode = "denied";
  r = await assetPOST(assetRequest({ action: "delete", id: id(80) }));
  assert.equal(r.status, 503);
  assert.equal(m.removed.length, 0);
});
test("asset prepare paths remain scoped and signed; nonadmin/invalid upload denied", async () => {
  setup();
  const r = await assetPOST(
    assetRequest({
      action: "prepare",
      kind: "diploma",
      targetId: id(11),
      slot: "IJAZAH",
      filename: "ijazah.pdf",
      mime: "application/pdf",
      size: 20,
    }),
  );
  assert.equal(r.status, 200);
  const b = await r.json();
  assert.equal(b.upload.path, "diploma/" + id(11) + "/" + b.id);
  setup().caller.principal.is_admin = false;
  assert.equal(
    (await assetPOST(assetRequest({ action: "delete", id: id(80) }))).status,
    403,
  );
});
test("asset finalize inspects actual PDF and rejects corrupt bytes", async () => {
  const pdf = await PDFDocument.create();
  pdf.addPage();
  const bytes = await pdf.save();
  let m = setup();
  m.blob = new Blob([bytes]);
  m.assetMeta.size = bytes.length;
  m.assetMeta.state = "pending";
  let r = await assetPOST(assetRequest({ action: "finalize", id: id(80) }));
  assert.equal(r.status, 200);
  assert.equal((await r.json()).code, "saved");
  m = setup();
  m.blob = new Blob(["invalid"]);
  m.assetMeta.size = 7;
  r = await assetPOST(assetRequest({ action: "finalize", id: id(80) }));
  assert.equal(r.status, 400);
  assert.ok(
    m.calls.some(
      ([fn, a]) => fn === "app_asset_write" && a.p_action === "failed",
    ),
  );
});
test("asset fetch checks view/download independently and returns no-store/nosniff", async () => {
  let m = setup();
  m.blob = new Blob(["%PDF-1.4"]);
  let r = await assetGET(
    new NextRequest(
      "https://example.test/api/learning/assets/" + id(80) + "?download=true",
    ),
    { params: Promise.resolve({ id: id(80) }) },
  );
  assert.equal(r.status, 200);
  assert.match(r.headers.get("content-disposition"), /attachment/);
  assert.equal(r.headers.get("x-content-type-options"), "nosniff");
  assert.match(r.headers.get("cache-control"), /no-store/);
  assert.ok(
    m.calls.some(([fn, a]) => fn === "app_asset_get" && a.p_download === true),
  );
  m = setup();
  m.assetMeta = null;
  r = await assetGET(
    new NextRequest("https://example.test/api/learning/assets/" + id(80)),
    { params: Promise.resolve({ id: id(80) }) },
  );
  assert.equal(r.status, 403);
});

test("healthy reader returns promotions DTO", async () => {
  setup();
  const { learningData } = await import("../src/lib/learning/server.ts");
  const d = await learningData(id(1), id(2), "promotions");
  assert.equal(d.module, "promotions");
});

test("all legacy promotion command variants parse without duplicate discriminator runtime errors", async () => {
  const { commands } = await import("../src/lib/learning/validation.ts");
  for (const c of [
    mapping,
    { ...mapping, type: "place" },
    { type: "diploma", studentId: id(11), metadata },
    { type: "access", scope: "global", view: true, download: false },
    {
      type: "access",
      scope: "individual",
      studentIds: [id(11)],
      view: "inherit",
      download: "deny",
    },
  ])
    assert.ok(commands.promotions.safeParse(c).success);
  assert.equal(
    commands.promotions.safeParse({
      type: "access",
      scope: "individual",
      studentIds: [id(11), id(11)],
      view: "inherit",
      download: "deny",
    }).success,
    false,
  );
});

test("valid 500-student batch fits the promotions-specific bounded body budget", async () => {
  const m = setup();
  const before = snapshot();
  before.rows = Array.from({ length: 500 }, (_, i) => row(1000 + i));
  const after = structuredClone(before);
  after.revision = 2;
  after.rows.forEach((r) => {
    r.class_id = id(31);
  });
  m.readSnapshots = [before, after];
  const command = {
    ...mapping,
    items: before.rows.map((r) => ({
      studentId: r.student_id,
      expectedClassId: r.class_id,
      classId: id(31),
    })),
  };
  const req = request(command);
  const bytes = new TextEncoder().encode(await req.clone().text()).length;
  assert.ok(bytes > 65536 && bytes < 131072);
  const r = await POST(req, params);
  assert.equal(r.status, 200);
  assert.equal((await r.json()).data.rows.length, 500);
  const excessive = new NextRequest(
    "https://example.test/api/learning/promotions",
    {
      method: "POST",
      headers: {
        origin: "https://example.test",
        "Content-Type": "application/json",
      },
      body: " ".repeat(131073),
    },
  );
  setup();
  assert.equal((await POST(excessive, params)).status, 413);
  const gradeOversize = new NextRequest(
    "https://example.test/api/learning/grades",
    {
      method: "POST",
      headers: {
        origin: "https://example.test",
        "Content-Type": "application/json",
      },
      body: " ".repeat(65537),
    },
  );
  setup();
  assert.equal(
    (
      await POST(gradeOversize, {
        params: Promise.resolve({ module: "grades" }),
      })
    ).status,
    413,
  );
  setup();
  assert.equal(
    (
      await POST(
        request({
          ...command,
          items: [
            ...command.items,
            { studentId: id(9999), expectedClassId: id(30), classId: id(31) },
          ],
        }),
        params,
      )
    ).status,
    400,
  );
});
