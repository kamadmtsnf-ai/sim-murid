import { test } from "node:test";
import assert from "node:assert/strict";
import {
  evaluateGates,
  uatScenarios,
} from "../scripts/operations/release-gates.mjs";
const hash = "a".repeat(64),
  ref = "abcdefghijklmnopqrst";
const evidence = () => ({
  restore: {
    environment: "staging",
    engine: "supabase",
    projectRef: ref,
    evidenceSha256: hash,
    databaseMatched: true,
    storageMatched: true,
    authLoginVerified: true,
    rlsVerified: true,
    archivesAndLedgerMatched: true,
    restoreMs: 100,
    rpoExposureSeconds: 1,
  },
  uat: {
    environment: "staging",
    projectRef: ref,
    evidenceSha256: hash,
    passedScenarios: uatScenarios,
  },
  load: {
    environment: "staging",
    projectRef: ref,
    evidenceSha256: hash,
    realAuthentication: true,
    mixedReadsWritesExports: true,
    databaseReconciled: true,
    batches: [60, 132].map((concurrency) => ({
      concurrency,
      unexpectedErrors: 0,
      p95Ms: 100,
      conflictsValidated: true,
    })),
  },
  ownerAcceptance: {
    accepted: true,
    evidenceSha256: hash,
    rpoTargetSeconds: 2,
    rtoTargetSeconds: 2,
  },
});
test("P10 isolated/health/missing evidence cannot satisfy managed staging release gates", () => {
  assert.equal(evaluateGates().ready, false);
  for (const mutate of [
    (e) => (e.restore.engine = "pglite"),
    (e) => (e.restore.projectRef = "qpzoukkhdxpmbtkcqemj"),
    (e) => (e.restore.storageMatched = false),
    (e) => (e.uat.passedScenarios = ["admin"]),
    (e) => (e.load.realAuthentication = false),
    (e) => (e.load.batches[1].unexpectedErrors = 1),
    (e) => (e.ownerAcceptance.accepted = false),
    (e) => (e.ownerAcceptance.rtoTargetSeconds = 0),
  ]) {
    const e = evidence();
    mutate(e);
    assert.equal(evaluateGates(e).ready, false);
  }
});
test("P10 structurally complete operator evidence is accepted without claiming independent human verification", () => {
  const r = evaluateGates(evidence());
  assert.equal(r.ready, true);
  assert.deepEqual(r.blocked, []);
  assert.ok(r.scope.includes("not production capacity"));
});
