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
  "@/lib/auth/read-server": `export const readServerPrincipal=async()=>globalThis.surveysMocks.caller;`,
  "@/lib/auth/http": `export const privateJson=(body,status=200)=>globalThis.surveysMocks.reply(body,status);export const requestAuth=()=>({});export const verifiedPrincipal=async()=>globalThis.surveysMocks.caller;export const sameOrigin=r=>r.headers.get('origin')===r.nextUrl.origin;`,
  "@/lib/auth/admin": `export const createAuthAdmin=()=>({from:()=>({select:()=>({eq:(column,value)=>({maybeSingle:async()=>{const m=globalThis.surveysMocks;m.roleActor=value;return {data:m.roleError?null:{role_code:m.role??"admin"},error:m.roleError};}})})}),rpc:async(fn,args)=>{const m=globalThis.surveysMocks;m.calls.push([fn,args]);if(fn==='app_survey_required')return {data:m.survey,error:null};if(fn==='app_services_write')return {data:m.ack,error:m.writeError};if(fn==='app_asset_cleanup')return {data:[],error:null};if(fn==='app_asset_admin'||fn==='app_asset_get')return {data:m.assetMeta,error:null};if(fn==='app_asset_write')return {data:{code:m.assetCode,id:args.p_data.id},error:m.assetError};return {data:m.readSnapshots?.shift()??m.snapshot,error:m.readError};},storage:{from:()=>({remove:async paths=>{globalThis.surveysMocks.removed.push(paths);return {error:null};},createSignedUploadUrl:async()=>({data:{token:'signed-token'},error:null}),download:async()=>({data:globalThis.surveysMocks.blob,error:null})})}});`,
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
const { GET, POST } = await import("../src/app/api/services/[module]/route.ts");
const { default: page } = await import(
  "../src/app/account/services/[module]/page.tsx"
);
const { validAnswers, validPeers, localSurveyDraft } = await import(
  "../src/lib/services/surveys.ts"
);
const id = (n) => `00000000-0000-4000-8000-${String(n).padStart(12, "0")}`;
const question = (code = "Q-1", kind = "likert") => ({
  code,
  kind,
  question: "Pertanyaan evaluasi",
  required: true,
  section: "A",
  aspect: "A1",
});
const respondent = () => ({
  period_id: id(10),
  user_id: id(1),
  role: "student",
  revision: 1,
  instrument: [question()],
  answers: { "Q-1": 4 },
  peer_answers: {},
  peers: [],
  submitted_at: null,
  peer_submitted_at: null,
});
const period = () => ({
  id: id(10),
  title: "Evaluasi madrasah",
  academic_year_id: id(70),
  semester: 1,
  starts_on: "2026-07-01",
  ends_on: "2026-12-31",
  status: "open",
  kind: "main",
  instrument_version: "SURVEI-1.0",
  response: respondent(),
  plan: null,
});
const snapshot = () => ({
  module: "surveys",
  revision: 1,
  today: "2026-10-23",
  isAdmin: false,
  isManager: false,
  month: "2026-10-01",
  years: [{ id: id(70), start_year: 2026 }],
  classes: [],
  subjects: [],
  rows: [period()],
  extra: { required: [id(10)], peers: [] },
});
function setup() {
  return (globalThis.surveysMocks = {
    caller: { principal: { id: id(1), is_admin: false }, sessionId: id(2) },
    calls: [],
    survey: false,
    snapshot: snapshot(),
    ack: { code: "saved", version: 1 },
    reply: (b, status = 200) =>
      NextResponse.json(b, {
        status,
        headers: { "Cache-Control": "private, no-store" },
      }),
  });
}
const params = { params: Promise.resolve({ module: "surveys" }) },
  save = { type: "save", periodId: id(10), version: 0, answers: { "Q-1": 4 } },
  create = {
    type: "period",
    periodId: null,
    title: "Evaluasi madrasah",
    yearId: id(70),
    semester: 1,
    start: "2026-07-01",
    end: "2026-12-31",
    targets: ["student"],
    kind: "main",
    questions: null,
    examOverride: "",
  };
const request = (command = save, domain = "surveys") =>
  new NextRequest("https://example.test/api/services/" + domain, {
    method: "POST",
    headers: {
      origin: "https://example.test",
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ requestId: id(99), revision: 1, command }),
  });
const get = () =>
  GET(new NextRequest("https://example.test/api/services/surveys"), params);
test("GET validates survey snapshot and respondent identity", async () => {
  const m = setup();
  assert.equal((await get()).status, 200);
  m.snapshot.rows[0].response.user_id = id(3);
  assert.equal((await get()).status, 503);
});
test("malformed upstream, duplicate questions and period mismatch fail closed", async () => {
  for (const change of [
    (s) => (s.rows[0].response.revision = "oops"),
    (s) => s.rows[0].response.instrument.push(question()),
    (s) => (s.rows[0].response.period_id = id(11)),
  ]) {
    const m = setup();
    change(m.snapshot);
    assert.equal((await get()).status, 503);
  }
});
test("confirmed write preserves UUID, actor, session and exact response revision", async () => {
  const m = setup(),
    r = await POST(request(), params),
    b = await r.json();
  assert.equal(r.status, 200);
  assert.equal(b.code, "saved");
  assert.equal(b.data.rows[0].response.revision, 1);
  const a = m.calls.find(([fn]) => fn === "app_services_write")[1];
  assert.equal(a.p_actor, id(1));
  assert.equal(a.p_session, id(2));
  assert.equal(a.p_request, id(99));
  assert.equal(a.p_revision, 1);
  assert.deepEqual(a.p_command, save);
});
test("malformed, unknown, wrong-version and unapplied acknowledgements cannot claim success", async () => {
  for (const ack of [
    null,
    { code: "mystery" },
    { code: "saved" },
    { code: "saved", version: 2 },
  ]) {
    const m = setup();
    m.ack = ack;
    assert.equal((await POST(request(), params)).status, 503);
  }
  const m = setup();
  m.snapshot.rows[0].response.answers = { "Q-1": 2 };
  assert.equal((await POST(request(), params)).status, 503);
});
test("post-commit read failure remains uncertain", async () => {
  const m = setup();
  m.readError = { message: "Offline" };
  assert.equal((await POST(request(), params)).status, 503);
  assert.ok(m.calls.some(([fn]) => fn === "app_services_write"));
});
test("main final requires authoritative final lock", async () => {
  const m = setup();
  assert.equal(
    (await POST(request({ ...save, type: "submit" }), params)).status,
    503,
  );
  m.snapshot.rows[0].response.submitted_at = "2026-10-23T00:00:00Z";
  assert.equal(
    (await POST(request({ ...save, type: "submit" }), params)).status,
    200,
  );
});
test("peer final verifies exact answers and independent lock", async () => {
  const m = setup(),
    r = m.snapshot.rows[0].response;
  r.role = "teacher";
  r.peers = [id(3)];
  r.peer_answers = { [id(3)]: { "PTS-1": "TT" } };
  const c = {
    type: "peer_submit",
    periodId: id(10),
    version: 0,
    answers: r.peer_answers,
  };
  assert.equal((await POST(request(c), params)).status, 503);
  r.peer_submitted_at = "2026-10-23T00:00:00Z";
  assert.equal((await POST(request(c), params)).status, 200);
});
test("start verifies owner and removes private admin note", async () => {
  const m = setup();
  m.ack = {
    code: "saved",
    response: { ...respondent(), admin_note: "private" },
  };
  const r = await POST(request({ type: "start", periodId: id(10) }), params);
  assert.equal(r.status, 200);
  assert.equal("admin_note" in (await r.json()).result.response, false);
  m.ack.response.user_id = id(3);
  assert.equal(
    (await POST(request({ type: "start", periodId: id(10) }), params)).status,
    503,
  );
});
test("create and close require matching identity and period attributes", async () => {
  const m = setup();
  m.ack = { code: "saved", id: id(10) };
  assert.equal((await POST(request(create), params)).status, 200);
  m.snapshot.rows[0].semester = 2;
  assert.equal((await POST(request(create), params)).status, 503);
  m.snapshot.rows[0].semester = 1;
  assert.equal(
    (await POST(request({ type: "close", periodId: id(10) }), params)).status,
    503,
  );
  m.snapshot.rows[0].status = "closed";
  assert.equal(
    (await POST(request({ type: "close", periodId: id(10) }), params)).status,
    200,
  );
});
test("known conflicts retain codes without readback", async () => {
  for (const code of [
    "stale",
    "locked",
    "incomplete",
    "peer_incomplete",
    "exam_warning",
    "request_conflict",
  ]) {
    const m = setup();
    m.ack = { code };
    const r = await POST(request(), params);
    assert.equal(r.status, 409);
    assert.equal((await r.json()).code, code);
    assert.equal(
      m.calls.some(([fn]) => fn === "app_services_read"),
      false,
    );
  }
});
test("auth and origin block writes; mandatory survey exemption remains", async () => {
  const m = setup();
  m.caller = null;
  assert.equal((await POST(request(), params)).status, 401);
  assert.equal(m.calls.length, 0);
  setup();
  const r = request();
  r.headers.set("origin", "https://evil.test");
  assert.equal((await POST(r, params)).status, 403);
  const n = setup();
  n.survey = true;
  assert.equal((await POST(request(), params)).status, 200);
  assert.equal(
    n.calls.some(([fn]) => fn === "app_survey_required"),
    false,
  );
});
test("cache validation preserves legacy draft and rejects forged values", () => {
  assert.equal(
    localSurveyDraft.safeParse({ version: 0, answers: { "Q-1": 0 } }).success,
    false,
  );
  assert.equal(
    localSurveyDraft.parse({ version: 0, answers: { "Q-1": 5 } }).peerDirty,
    false,
  );
  assert.equal(validAnswers([question()], { "Q-1": "5" }), false);
  assert.equal(validAnswers([question()], { unknown: 4 }), false);
  assert.equal(
    validPeers([id(3)], { [id(3)]: { "PTS-1": "TT", "PTS-7": "Saran" } }),
    true,
  );
  assert.equal(validPeers([id(3)], { [id(3)]: { "PTS-1": 0 } }), false);
  assert.equal(validPeers([id(3)], { [id(4)]: { "PTS-1": 4 } }), false);
});
test("valid 50-essay payload fits survey-specific budget", async () => {
  const m = setup(),
    instrument = Array.from({ length: 50 }, (_, i) =>
      question("M-" + (i + 1), "essay"),
    ),
    answers = Object.fromEntries(
      instrument.map((q) => [q.code, "\u0001".repeat(10000)]),
    );
  m.snapshot.rows[0].kind = "micro";
  m.snapshot.rows[0].response.instrument = instrument;
  m.snapshot.rows[0].response.answers = answers;
  const r = request({ ...save, answers });
  assert.ok((await r.clone().text()).length > 3000000);
  assert.equal((await POST(r, params)).status, 200);
});
test("oversized surveys rejected and other services retain 64KiB budget", async () => {
  const m = setup();
  assert.equal(
    (
      await POST(
        request({ ...save, answers: { "Q-1": "x".repeat(4194304) } }),
        params,
      )
    ).status,
    413,
  );
  assert.equal(
    m.calls.some(([fn]) => fn === "app_services_write"),
    false,
  );
  setup();
  assert.equal(
    (
      await POST(
        request(
          { ...save, answers: { "Q-1": "x".repeat(70000) } },
          "notifications",
        ),
        { params: Promise.resolve({ module: "notifications" }) },
      )
    ).status,
    413,
  );
});
test("page keeps login redirect and retry boundary", async () => {
  const m = setup();
  m.caller = null;
  await assert.rejects(page(params), (e) => e.url === "/login?expired=1");
  m.caller = { principal: { id: id(1), is_admin: false }, sessionId: id(2) };
  m.readError = { message: "Offline" };
  await assert.rejects(page(params), /Surveys unavailable/);
});
test("manager eligibility reads only own verified database role", async () => {
  const m = setup();
  m.snapshot.isManager = true;
  m.role = "teacher";
  const r = await get();
  assert.equal(r.status, 200);
  assert.equal((await r.json()).data.extra.respondentRole, "teacher");
  assert.equal(m.roleActor, id(1));
  m.roleError = { message: "Offline" };
  assert.equal((await get()).status, 503);
});
test("logout clears only survey cache and tolerates denied storage", async () => {
  const { clearSurveyDrafts } = await import(
    "../src/lib/services/survey-storage.ts"
  );
  const items = new Map([
      ["sim-survey:user:period", "draft"],
      ["preference", "keep"],
    ]),
    storage = {
      get length() {
        return items.size;
      },
      key: (n) => [...items.keys()][n],
      removeItem: (k) => items.delete(k),
    };
  assert.equal(clearSurveyDrafts(storage), true);
  assert.equal(items.has("sim-survey:user:period"), false);
  assert.equal(items.get("preference"), "keep");
  assert.equal(
    clearSurveyDrafts({
      get length() {
        throw Error("Denied");
      },
    }),
    false,
  );
});

test('Insights: catalog is available to personal users with academic metadata and scoped readback', async () => {
  const m=setup(), base=snapshot();
  m.readSnapshots=[{...base,module:'insights',rows:[],extra:{suppressed:true,minimum:3}},base];
  const response=await GET(new NextRequest('https://example.test/api/services/insights?periodId='+id(10)),{params:Promise.resolve({module:'insights'})});
  assert.equal(response.status,200);const data=(await response.json()).data;
  assert.equal(data.rows[0].academic_year_id,id(70));assert.equal(data.rows[0].semester,1);assert.equal(data.extra.appliedFilters.periodId,id(10));assert.equal(data.extra.suppressed,true);assert.equal(data.rows[0].response,undefined);
});
test('Insights: mismatched catalog revision is unavailable, unknown period is denied', async () => {
 for(const [catalog,periodId,status] of [[{...snapshot(),revision:2},id(10),503],[snapshot(),id(11),403]]){
  const m=setup();m.readSnapshots=[{...snapshot(),module:'insights',extra:{}},catalog];
  const response=await GET(new NextRequest('https://example.test/api/services/insights?periodId='+periodId),{params:Promise.resolve({module:'insights'})});assert.equal(response.status,status);
 }
});
test('Insights: note success requires actual matching readback; missing or changed acknowledgement is never successful', async () => {
 for(const [note,code,status] of [['Catatan baru','saved',200],['Lama','saved',503],['Catatan baru','unknown',503]]){
  const m=setup();m.ack={code};m.readSnapshots=[{...snapshot(),module:'insights',isManager:true,extra:{progress:[{user_id:id(1),note}]}},snapshot()];
  const response=await POST(request({type:'note',periodId:id(10),userId:id(1),note:'Catatan baru'},'insights'),{params:Promise.resolve({module:'insights'})});assert.equal(response.status,status);
  if(status===200){const body=await response.json();assert.equal(body.code,'saved');assert.equal(body.data.extra.progress[0].note,'Catatan baru');}
 }
});
