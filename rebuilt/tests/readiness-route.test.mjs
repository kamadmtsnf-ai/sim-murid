import { test } from "node:test";
import assert from "node:assert/strict";
import { NextRequest, NextResponse } from "next/server.js";
import { registerAuditHooks } from "./audit-loader.mjs";
registerAuditHooks({
  "@/lib/education/server": `export const educationContext=async()=>({caller:globalThis.p10.caller,reply:globalThis.p10.reply});export const failure=()=>({status:503,message:'Unavailable'});`,
  "@/lib/auth/admin": `export const createAuthAdmin=()=>({rpc:(name,args)=>({abortSignal:async s=>{globalThis.p10.calls.push({name,args,s});return globalThis.p10.result;}})});`,
  "@/lib/supabase/environment": `export const getSupabasePublicEnvironment=()=>({url:'https://abcdefghijklmnopqrst.supabase.co',publishableKey:'PRIVATE_KEY'});`,
});
const { GET } = await import("../src/app/api/release/readiness/route.ts");
const req = () =>
  new NextRequest("https://staging.example.test/api/release/readiness");
const reset = () =>
  (globalThis.p10 = {
    caller: { principal: { id: "server-id" }, sessionId: "server-session" },
    reply: (b, status = 200) =>
      NextResponse.json(b, {
        status,
        headers: { "cache-control": "private, no-store" },
      }),
    calls: [],
    result: { data: true, error: null },
  });
test("P10 target metadata requires verified Admin and never returns keys", async () => {
  const old = process.env.VERCEL_ENV;
  process.env.VERCEL_ENV = "preview";
  try {
    const s = reset(),
      r = await GET(req());
    assert.equal(r.status, 200);
    assert.deepEqual(await r.json(), {
      scope: "configuration-only",
      deployEnvironment: "preview",
      projectRef: "abcdefghijklmnopqrst",
    });
    assert.deepEqual(s.calls[0].args, {
      p_actor: "server-id",
      p_session: "server-session",
    });
    assert.ok(s.calls[0].s instanceof AbortSignal);
  } finally {
    if (old === undefined) delete process.env.VERCEL_ENV;
    else process.env.VERCEL_ENV = old;
  }
});
test("P10 no session, non-admin and unavailable authorization fail closed", async () => {
  let s = reset();
  s.caller = null;
  assert.equal((await GET(req())).status, 401);
  assert.equal(s.calls.length, 0);
  for (const value of [false, null, "true"]) {
    s = reset();
    s.result.data = value;
    assert.equal((await GET(req())).status, 403);
  }
  s = reset();
  s.result = { data: null, error: { message: "PRIVATE_DB" } };
  const r = await GET(req());
  assert.equal(r.status, 503);
  assert.ok(!(await r.text()).includes("PRIVATE"));
});
