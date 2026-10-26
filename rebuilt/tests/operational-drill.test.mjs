import { test } from "node:test";
import assert from "node:assert/strict";
import { restoreDrill } from "../scripts/operations/restore-drill.mjs";
import { benchmark } from "../scripts/operations/benchmark.mjs";
test("P10 isolated backup restores all tables, schema/security, balances, archive, session and rejects corrupt data", async () => {
  const r = await restoreDrill();
  assert.equal(r.tableCount, 84);
  assert.equal(r.migrations, 49);
  assert.ok(Object.values(r.checks).every((v) => v === true));
  assert.equal(r.rpo.postBackupSyntheticWritesLost, 1);
  assert.equal(r.rpo.productionTarget, null);
  assert.ok(r.backup.bytes > 100);
  assert.ok(r.restoreAndReconcileMs > 0);
});
test("P10 registered-session business benchmark has seven base roles plus head, native contention and valid PDF output", async () => {
  const r = await benchmark();
  assert.equal(Object.keys(r.roleReads).length, 8);
  for (const v of Object.values(r.roleReads)) assert.equal(v.errors, 0);
  assert.deepEqual(
    r.revisionContention.map((v) => [
      v.inFlightRequests,
      v.saved,
      v.expectedStale,
      v.errors,
    ]),
    [
      [60, 1, 59, 0],
      [132, 1, 131, 0],
    ],
  );
  assert.equal(r.pdfExport.errors, 0);
  assert.equal(r.budgets.productionCapacity, null);
});
