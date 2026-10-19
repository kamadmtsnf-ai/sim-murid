import assert from "node:assert/strict";
import { test } from "node:test";
import { paginationSchema } from "../src/lib/validation/pagination.ts";
import { parseSupabasePublicEnvironment } from "../src/lib/validation/environment.ts";

test("query pagination validates untrusted query values and bounds", () => {
  assert.deepEqual(paginationSchema.parse({ page: "2", pageSize: "25", search: "  Ali  " }), {
    page: 2, pageSize: 25, search: "Ali",
  });
  for (const input of [{ page: "NaN" }, { page: "0" }, { pageSize: 101 }, { pageSize: -1 }, { search: "x".repeat(201) }]) {
    assert.equal(paginationSchema.safeParse(input).success, false);
  }
});

test("Supabase public config rejects absent/malformed/insecure remote settings and allows loopback", () => {
  for (const input of [{}, { url: "https://example.supabase.co", publishableKey: "" }, { url: "http://example.com", publishableKey: "public-test-key" }, { url: "javascript:alert(1)", publishableKey: "public-test-key" }]) {
    assert.equal(parseSupabasePublicEnvironment(input).success, false);
  }
  assert.equal(parseSupabasePublicEnvironment({ url: "https://example.supabase.co", publishableKey: "public-test-key" }).success, true);
  assert.equal(parseSupabasePublicEnvironment({ url: "http://127.0.0.1:54321", publishableKey: "local-test-key" }).success, true);
  assert.equal(parseSupabasePublicEnvironment({ url: "http://localhost.attacker.invalid", publishableKey: "public-test-key" }).success, false);
});
