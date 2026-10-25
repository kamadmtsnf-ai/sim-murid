import { NextResponse } from "next/server.js";
globalThis.p10NextResponse = NextResponse;
import { test } from "node:test";
import assert from "node:assert/strict";
import { registerAuditHooks } from "./audit-loader.mjs";
registerAuditHooks({
  "server-only": "export {};",
  "next/server": "export const NextResponse=globalThis.p10NextResponse;",
  "@/lib/auth/admin": "export const createAuthAdmin=()=>({});",
});
const { requestReference, errorDigest, withReference } = await import(
    "../src/lib/observability/reference.ts"
  ),
  { logRequestFailure, logResponseFailure } = await import(
    "../src/lib/observability/log.ts"
  ),
  { privateJson } = await import("../src/lib/auth/http.ts"),
  { onRequestError } = await import("../src/instrumentation.ts");
const id = "00000000-0000-4000-8000-000000000001";
test("P10 reference accepts UUIDv4/digest only and never raw private text", () => {
  assert.equal(requestReference(id), id);
  for (const v of [
    "PRIVATE_PASSWORD",
    "foo@example.org",
    "http://example.org/?token=PRIVATE",
    "a".repeat(1000),
    null,
    42,
  ]) {
    assert.equal(requestReference(v), null);
    assert.equal(errorDigest(v), null);
  }
  assert.equal(errorDigest("1234567890"), "1234567890");
  assert.equal(
    withReference("Isian tetap", id),
    "Isian tetap Kode laporan: " + id + ".",
  );
});
test("P10 API errors correlate header to one allowlisted log without changing response JSON", async () => {
  const logs = [],
    old = console.error;
  console.error = (v) => logs.push(JSON.parse(v));
  try {
    const r = privateJson(
      { message: "PRIVATE_BODY", token: "PRIVATE_TOKEN" },
      503,
    );
    const reference = r.headers.get("x-request-id");
    assert.ok(requestReference(reference));
    assert.deepEqual(logs, [
      { event: "sim.http_error", reference, status: 503 },
    ]);
    assert.equal(r.headers.get("cache-control"), "private, no-store");
    assert.equal(r.headers.get("vary"), "Cookie");
    assert.deepEqual(await r.json(), {
      message: "PRIVATE_BODY",
      token: "PRIVATE_TOKEN",
    });
    privateJson({}, 200);
    privateJson({}, 403);
    assert.equal(logs.length, 1);
  } finally {
    console.error = old;
  }
});
test("P10 Next error hook excludes request URL/cookies/body and error stack/message", () => {
  const old = console.error,
    logs = [];
  console.error = (v) => logs.push(JSON.parse(v));
  try {
    onRequestError(
      {
        message: "PRIVATE_MESSAGE",
        stack: "PRIVATE_STACK",
        digest: "1234567890",
      },
      {
        path: "/users/PRIVATE?token=PRIVATE",
        method: "GET",
        headers: { cookie: "PRIVATE_COOKIE" },
      },
      {
        routeType: "render",
        routerKind: "App Router",
        routePath: "PRIVATE",
        revalidateReason: undefined,
      },
    );
    assert.deepEqual(logs, [
      {
        event: "sim.request_error",
        digest: "1234567890",
        routeType: "render",
        method: "GET",
      },
    ]);
    assert.ok(!JSON.stringify(logs).includes("PRIVATE"));
  } finally {
    console.error = old;
  }
});
test("P10 malformed errors, hostile getters and broken logging never change application flow", () => {
  const old = console.error;
  console.error = () => {
    throw Error("logger unavailable");
  };
  try {
    assert.doesNotThrow(() => logResponseFailure(id, 503));
    assert.doesNotThrow(() =>
      logRequestFailure(
        {
          get digest() {
            throw Error("getter");
          },
        },
        "PRIVATE",
        "PRIVATE",
      ),
    );
    assert.doesNotThrow(() => logRequestFailure(null, null, null));
  } finally {
    console.error = old;
  }
});
