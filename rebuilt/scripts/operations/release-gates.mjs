import { readFile, writeFile } from "node:fs/promises";
const production = "qpzoukkhdxpmbtkcqemj";
export const uatScenarios = [
  "admin",
  "school_head",
  "subject_teacher",
  "homeroom",
  "mentor",
  "duty",
  "counselor",
  "committee_treasurer",
  "savings_manager",
  "student",
  "parent_multi_child",
  "alumni",
  "customer",
  "applicant",
];
const hash = (v) => typeof v === "string" && /^[a-f0-9]{64}$/.test(v),
  number = (v) => typeof v === "number" && Number.isFinite(v) && v >= 0;
/** Operator evidence validation only; no automatic deployment or proof of human acceptance. */
export function evaluateGates(e = {}) {
  const blocked = [],
    r = e.restore ?? {},
    u = e.uat ?? {},
    l = e.load ?? {},
    o = e.ownerAcceptance ?? {};
  if (
    r.environment !== "staging" ||
    r.engine !== "supabase" ||
    typeof r.projectRef !== "string" ||
    !/^[a-z0-9]{20}$/.test(r.projectRef) ||
    r.projectRef === production ||
    !hash(r.evidenceSha256) ||
    r.databaseMatched !== true ||
    r.storageMatched !== true ||
    r.authLoginVerified !== true ||
    r.rlsVerified !== true ||
    r.archivesAndLedgerMatched !== true
  )
    blocked.push(
      "Managed staging restore + Auth/Storage/RLS/reconciliation evidence missing",
    );
  if (
    !number(r.restoreMs) ||
    !number(r.rpoExposureSeconds) ||
    !number(o.rpoTargetSeconds) ||
    !number(o.rtoTargetSeconds) ||
    r.rpoExposureSeconds > o.rpoTargetSeconds ||
    r.restoreMs > o.rtoTargetSeconds * 1000
  )
    blocked.push("Measured and accepted RPO/RTO missing or exceeded");
  if (
    u.environment !== "staging" ||
    u.projectRef !== r.projectRef ||
    !hash(u.evidenceSha256) ||
    !Array.isArray(u.passedScenarios) ||
    uatScenarios.some((v) => !u.passedScenarios.includes(v))
  )
    blocked.push("Real-user task UAT matrix incomplete");
  if (
    l.environment !== "staging" ||
    l.projectRef !== r.projectRef ||
    l.realAuthentication !== true ||
    l.mixedReadsWritesExports !== true ||
    l.databaseReconciled !== true ||
    !hash(l.evidenceSha256) ||
    !Array.isArray(l.batches) ||
    [60, 132].some(
      (n) =>
        !l.batches.some(
          (b) =>
            b.concurrency === n &&
            b.unexpectedErrors === 0 &&
            number(b.p95Ms) &&
            b.p95Ms > 0 &&
            b.conflictsValidated === true,
        ),
    )
  )
    blocked.push(
      "Authenticated 60/132 mixed staging load/reconciliation evidence incomplete",
    );
  if (o.accepted !== true || !hash(o.evidenceSha256))
    blocked.push("Owner acceptance not recorded");
  return {
    ready: blocked.length === 0,
    blocked,
    scope: "evidence validation, not production capacity or automatic cutover",
  };
}
if (import.meta.url === new URL(process.argv[1], "file:").href) {
  try {
    const e = process.argv[2]
      ? JSON.parse(await readFile(process.argv[2], "utf8"))
      : {};
    const r = evaluateGates(e);
    if (process.argv[3])
      await writeFile(process.argv[3], JSON.stringify(r, null, 2) + "\n");
    console.log(JSON.stringify(r, null, 2));
    if (!r.ready) process.exitCode = 1;
  } catch {
    if (process.argv[3])
      try {
        await writeFile(
          process.argv[3],
          JSON.stringify({
            ready: false,
            blocked: ["Invalid private evidence"],
            scope: "verification failed",
          }) + "\n",
        );
      } catch {}
    console.error(
      "Release evidence unreadable or invalid; operational gate remains blocked.",
    );
    process.exitCode = 1;
  }
}
