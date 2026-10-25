import { test } from "node:test";
import assert from "node:assert/strict";
import { createServer } from "node:http";
import {
  validatePlan,
  runStagingLoad,
} from "../scripts/operations/staging-load.mjs";
const plan = () => ({
  origin: "http://127.0.0.1:1234",
  environment: "staging",
  projectRef: "abcdefghijklmnopqrst",
  users: Array.from({ length: 132 }, (_, i) => ({
    cookie: "test-session=" + String(i).padStart(10, "0"),
  })),
  scenarios: [{ method: "GET", path: "/api/classes", expectedStatuses: [200] }],
});
test("P10 load driver blocks production, unapproved external hosts, duplicate sessions and unsafe routes/writes", () => {
  for (const mutate of [
    (p) => (p.origin = "https://sim-muridv2.vercel.app"),
    (p) => (p.projectRef = "qpzoukkhdxpmbtkcqemj"),
    (p) => (p.origin = "https://preview.example.test"),
    (p) => (p.users[1] = p.users[0]),
    (p) => (p.scenarios[0].path = "https://evil.example.test/api/classes"),
    (p) => (p.scenarios[0].path = "/api/auth/login"),
    (p) => (p.scenarios[0].method = "POST"),
  ]) {
    const p = plan();
    mutate(p);
    assert.throws(() => validatePlan(p));
  }
  assert.ok(validatePlan(plan()));
});
test("P10 authenticated staging transport exercises 60/132 distinct sessions and refuses mismatched metadata before load", async () => {
  let bad = false,
    calls = 0;
  const seen = new Set();
  const server = createServer((req, res) => {
    res.setHeader("content-type", "application/json");
    if (req.url === "/api/release/readiness") {
      res.end(
        JSON.stringify({
          scope: "configuration-only",
          deployEnvironment: bad ? "production" : "preview",
          projectRef: "abcdefghijklmnopqrst",
        }),
      );
      return;
    }
    calls++;
    seen.add(req.headers.cookie);
    res.end(JSON.stringify({ ok: true }));
  });
  await new Promise((r) => server.listen(0, "127.0.0.1", r));
  try {
    const p = plan();
    p.origin = "http://127.0.0.1:" + server.address().port;
    const r = await runStagingLoad(p);
    assert.deepEqual(
      r.batches.map((v) => [v.requests, v.errors]),
      [
        [60, 0],
        [132, 0],
      ],
    );
    assert.equal(calls, 192);
    assert.equal(seen.size, 132);
    assert.ok(!JSON.stringify(r).includes("test-session"));
    bad = true;
    calls = 0;
    await assert.rejects(() => runStagingLoad(p), /metadata/);
    assert.equal(calls, 0);
  } finally {
    await new Promise((r) => server.close(r));
  }
});

test("P10 malformed private plan never prints credential fragments from JSON parser errors", async () => {
  const { mkdtemp, writeFile, readFile, rm } = await import("node:fs/promises");
  const { tmpdir } = await import("node:os");
  const { join } = await import("node:path");
  const { spawnSync } = await import("node:child_process");
  const dir = await mkdtemp(join(tmpdir(), "p10-private-"));
  try {
    const file = join(dir, "plan.json");
    await writeFile(file, '{"cookie":"PRIVATE_COOKIE_SENTINEL",BROKEN');
    for (const script of ["staging-load", "release-gates"]) {
      const output = join(dir, script + "-report.json");
      await writeFile(
        output,
        JSON.stringify({ ready: true, status: "old-success" }),
      );
      const r = spawnSync(
        process.execPath,
        [
          "--experimental-strip-types",
          "scripts/operations/" + script + ".mjs",
          file,
          output,
        ],
        { encoding: "utf8" },
      );
      assert.equal(r.status, 1);
      const failed = JSON.parse(await readFile(output, "utf8"));
      assert.notEqual(failed.ready, true);
      assert.notEqual(failed.status, "old-success");
      assert.ok(!(r.stdout + r.stderr).includes("PRIVATE_COOKIE_SENTINEL"));
    }
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});
