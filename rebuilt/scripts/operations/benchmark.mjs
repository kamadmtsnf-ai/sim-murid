import { createScenario } from "./scenario.mjs";
import { randomUUID } from "node:crypto";
import { performance } from "node:perf_hooks";
import assert from "node:assert/strict";
import { writeFile } from "node:fs/promises";
export function distribution(samples) {
  const sorted = samples.map((x) => x.ms).sort((a, b) => a - b);
  return {
    requests: samples.length,
    errors: samples.filter((x) => !x.ok).length,
    p50Ms: sorted[Math.ceil(sorted.length * 0.5) - 1],
    p95Ms: sorted[Math.ceil(sorted.length * 0.95) - 1],
    maxMs: sorted.at(-1),
  };
}
export async function benchmark() {
  const s = await createScenario(),
    { db, val, users } = s;
  try {
    const roles = {},
      measure = async (fn) => {
        const start = performance.now();
        try {
          await fn();
          return { ms: performance.now() - start, ok: true };
        } catch {
          return { ms: performance.now() - start, ok: false };
        }
      };
    await db.exec("set role service_role");
    for (const name of [
      "admin",
      "head",
      "teacher",
      "student",
      "parent",
      "alumni",
      "customer",
      "applicant",
    ]) {
      const u = users[name],
        samples = [];
      for (let i = 0; i < 12; i++)
        samples.push(
          await measure(async () => {
            const principal = await val(
              "select public.app_auth_principal($1,$2)",
              [u.id, u.session],
            );
            assert.ok(principal);
            const data = await val(
              "select public.app_learning_read($1,$2,'reports',$3::jsonb)",
              [
                u.id,
                u.session,
                JSON.stringify({ classId: s.cls, semester: 1 }),
              ],
            );
            if (["student", "parent", "teacher"].includes(name)) {
              assert.ok(
                !JSON.stringify(data?.rows ?? []).includes(users.foreign.id),
              );
            }
            const audit = await val("select public.app_audit_read($1,$2)", [
              u.id,
              u.session,
            ]);
            assert.equal(audit !== null, name === "admin");
          }),
        );
      roles[name] = distribution(samples);
      assert.equal(roles[name].errors, 0, "Role read failure: " + name);
    }
    const queue = [];
    for (const concurrency of [60, 132]) {
      const before = await s.revision(),
        ids = Array.from({ length: concurrency }, () => randomUUID()),
        command = {
          type: "batch",
          id: null,
          classId: s.cls,
          subjectId: s.subject,
          date: "2026-10-21",
          kind: "PH",
          items: [{ studentId: users.student.id, value: 55, notes: "" }],
        };
      const started = performance.now();
      const results = await Promise.all(
        ids.map(async (request) => {
          const start = performance.now();
          const result = await s.learning(command, request, before);
          return {
            request,
            result,
            ms: performance.now() - start,
            ok: ["saved", "stale"].includes(result.code),
          };
        }),
      );
      const saved = results.filter((r) => r.result.code === "saved"),
        stale = results.filter((r) => r.result.code === "stale");
      assert.equal(saved.length, 1);
      assert.equal(stale.length, concurrency - 1);
      assert.equal(await s.revision(), before + 1);
      const winner = saved[0];
      assert.deepEqual(
        await s.learning(command, winner.request, before),
        winner.result,
      );
      assert.equal(
        Number(
          await val(
            "select count(*) from sim_murid_private.activity_logs where request_id=$1",
            [winner.request],
          ),
        ),
        1,
      );
      queue.push({
        inFlightRequests: concurrency,
        elapsedMs: performance.now() - started,
        saved: 1,
        expectedStale: stale.length,
        ...distribution(results),
      });
    }
    await db.exec("reset role");
    const rows = (
      await db.query(
        "select student_id,jsonb_build_object('snapshot',snapshot) published from sim_murid_private.report_snapshots",
      )
    ).rows;
    const { reportsPdf } = await import("../../src/lib/learning/print.ts");
    const exports = [];
    for (let i = 0; i < 5; i++)
      exports.push(
        await measure(async () => {
          const bytes = await reportsPdf(rows, "combined");
          assert.ok(bytes.length > 100);
          assert.equal(Buffer.from(bytes).subarray(0, 4).toString(), "%PDF");
        }),
      );
    assert.equal(distribution(exports).errors, 0);
    return {
      scope:
        "isolated SQL with registered synthetic sessions + service_role; NOT Supabase Auth/browser/cloud UAT",
      engine:
        "PGlite single connection: concurrency below measures queued in-flight commands, not parallel Postgres workers",
      migrations: s.migrations.length,
      fixture: { actors: 10, students: 3, classes: 2, reportSnapshots: 1 },
      roleReads: roles,
      revisionContention: queue,
      pdfExport: distribution(exports),
      budgets: { productionP95Ms: null, productionCapacity: null },
      limitations: [
        "No health-endpoint capacity inference",
        "12 role read samples and 5 PDF samples are characterization only",
        "No real-user credentials or production data used",
        "External 60/132 mixed-session load remains a separate staging gate",
      ],
    };
  } finally {
    await db.close();
  }
}
if (import.meta.url === new URL(process.argv[1], "file:").href) {
  const result = await benchmark();
  if (process.argv[2])
    await writeFile(process.argv[2], JSON.stringify(result, null, 2) + "\n");
  console.log(JSON.stringify(result, null, 2));
}
