import { PGlite } from "@electric-sql/pglite";
import { createHash } from "node:crypto";
import assert from "node:assert/strict";
import { performance } from "node:perf_hooks";
import { writeFile } from "node:fs/promises";
import {
  createScenario,
  fingerprints,
  schemaFingerprint,
} from "./scenario.mjs";
export async function restoreChecked(blob, sha256) {
  const actual = createHash("sha256")
    .update(Buffer.from(await blob.arrayBuffer()))
    .digest("hex");
  if (actual !== sha256) throw Error("Backup checksum mismatch");
  return new PGlite({ loadDataDir: blob });
}
export async function restoreDrill() {
  const scenario = await createScenario(),
    { db, users } = scenario;
  let restored;
  try {
    const schemaBefore = await schemaFingerprint(db);
    const before = await fingerprints(db),
      backupStarted = performance.now(),
      blob = await db.dumpDataDir("gzip"),
      backupMs = performance.now() - backupStarted,
      hash = createHash("sha256")
        .update(Buffer.from(await blob.arrayBuffer()))
        .digest("hex");
    await assert.rejects(
      () => restoreChecked(new Blob(["CORRUPT"]), hash),
      /checksum mismatch/,
    );
    // Explicitly demonstrate loss of one post-snapshot synthetic write; never merge it silently.
    await db.query(
      "insert into public.holidays(holiday_date,description) values('2026-11-02','P10_AFTER_BACKUP')",
    );
    const start = performance.now();
    restored = await restoreChecked(blob, hash);
    await restored.waitReady;
    const after = await fingerprints(restored),
      restoreAndReconcileMs = performance.now() - start;
    assert.deepEqual(after, before);
    const schemaAfter = await schemaFingerprint(restored);
    assert.deepEqual(schemaAfter, schemaBefore);
    const val = async (q, p = []) =>
      Object.values((await restored.query(q, p)).rows[0])[0];
    assert.equal(
      await val(
        "select exists(select 1 from public.holidays where description='P10_AFTER_BACKUP')",
      ),
      false,
    );
    const student = users.student;
    assert.ok(
      await val("select public.app_auth_principal($1,$2)", [
        student.id,
        student.session,
      ]),
    );
    assert.equal(
      Number(
        await val(
          "select sum(delta) from sim_murid_private.savings_transactions where account_id=$1",
          [scenario.account],
        ),
      ),
      200000,
    );
    assert.equal(
      Number(
        await val(
          "select (snapshot->'subjects'->0->>'final')::numeric from sim_murid_private.report_snapshots where student_id=$1",
          [student.id],
        ),
      ),
      82,
    );
    assert.equal(
      await val("select public.app_audit_read($1,$2)", [
        student.id,
        student.session,
      ]),
      null,
    );
    for (const role of ["anon", "authenticated"]) {
      await restored.exec("set role " + role);
      try {
        await assert.rejects(
          restored.exec("select * from sim_murid_private.report_snapshots"),
          (e) => e.code === "42501",
        );
      } finally {
        await restored.exec("reset role");
      }
    }
    await assert.rejects(
      restored.exec("delete from sim_murid_private.report_snapshots"),
      (e) => e.code === "55000",
    );
    return {
      scope:
        "isolated PGlite physical snapshot; NOT Supabase managed backup/Auth provider/Storage recovery",
      migrations: scenario.migrations.length,
      tableCount: Object.keys(before).length,
      entities: before,
      schema: schemaBefore,
      backup: { sha256: hash, bytes: blob.size, ms: backupMs },
      restoreAndReconcileMs,
      checks: {
        allTableCountsAndDigests: true,
        rlsPoliciesTriggersRoutineBodiesAndGrants: true,
        registeredSessionRestored: true,
        ledgerBalance: true,
        report82: true,
        unauthorizedAuditDenied: true,
        rlsAndGrants: true,
        immutableArchive: true,
        corruptChecksumRejected: true,
        postBackupWriteAbsent: true,
      },
      rpo: { postBackupSyntheticWritesLost: 1, productionTarget: null },
      rto: {
        measuredIsolatedMs: restoreAndReconcileMs,
        productionTarget: null,
      },
      limitations: [
        "No production data or remote database touched",
        "No managed Auth/Storage objects or SMTP/WA/AI restoration",
        "PGlite single connection; not managed Postgres capacity",
        "Cloud staging/UAT still required",
      ],
    };
  } finally {
    await restored?.close();
    await db.close();
  }
}
if (import.meta.url === new URL(process.argv[1], "file:").href) {
  const result = await restoreDrill();
  if (process.argv[2])
    await writeFile(process.argv[2], JSON.stringify(result, null, 2) + "\n");
  console.log(
    JSON.stringify({
      tables: result.tableCount,
      checks: result.checks,
      restoreAndReconcileMs: result.restoreAndReconcileMs,
    }),
  );
}
