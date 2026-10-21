import { readFile, writeFile } from "node:fs/promises";
import { createHash } from "node:crypto";
export function reconcile(source, target) {
  const issues = [],
    entities = new Set([
      ...Object.keys(source.entities ?? {}),
      ...Object.keys(target.entities ?? {}),
    ]);
  if (!source.entities || !target.entities)
    throw new Error("Manifest entities required");
  const findings = [];
  for (const entity of entities) {
    const s = source.entities[entity],
      t = target.entities[entity];
    if (!s || !t) {
      issues.push(entity + ": missing source/target");
      continue;
    }
    if (
      !Number.isSafeInteger(s.count) ||
      s.count < 0 ||
      !Number.isSafeInteger(t.count) ||
      t.count < 0
    )
      throw new Error("Invalid count");
    if (s.count !== t.count) issues.push(entity + ": count mismatch");
    if (s.orphans !== 0 || t.orphans !== 0)
      issues.push(entity + ": orphan or missing validation");
    if (s.digest !== t.digest || !s.digest)
      issues.push(entity + ": canonical digest mismatch");
    findings.push({ entity, sourceCount: s.count, targetCount: t.count });
  }
  for (const key of [
    "savingsBalances",
    "feeCash",
    "feeAllocations",
    "gradesByPeriod",
    "pointReplay",
    "surveyProgress",
    "documentChecksums",
    "documentAccess",
  ]) {
    if (!Object.hasOwn(source, key) || !Object.hasOwn(target, key)) {
      issues.push(key + ": missing evidence");
      continue;
    }
    if (
      JSON.stringify(canonical(source[key])) !==
      JSON.stringify(canonical(target[key]))
    )
      issues.push(key + ": mismatch");
  }
  const usernames = new Map();
  for (const u of source.usernames ?? []) {
    if (typeof u !== "string") throw new Error("Usernames must remain strings");
    const key = u.replace(/^'/, "").trim().toLocaleLowerCase("en-US");
    if (usernames.has(key)) issues.push("username collision requires review");
    usernames.set(key, u);
  }
  if (!source.usernames) issues.push("username collision review missing");
  return {
    status: issues.length ? "blocked" : "matched",
    issues,
    findings,
    sourceHash: createHash("sha256")
      .update(JSON.stringify(canonical(source)))
      .digest("hex"),
    limitations: [
      "Read-only comparison of supplied normalized manifests. Matching does not prove successful import, backup or restore.",
    ],
  };
}
function canonical(v) {
  if (Array.isArray(v)) return v.map(canonical);
  if (v && typeof v === "object")
    return Object.fromEntries(
      Object.keys(v)
        .sort()
        .map((k) => [k, canonical(v[k])]),
    );
  return v;
}
if (
  process.argv[1] &&
  import.meta.url === new URL("file://" + process.argv[1]).href
) {
  const [sourcePath, targetPath, outputPath] = process.argv.slice(2);
  if (!sourcePath || !targetPath || !outputPath)
    throw new Error(
      "Usage: node reconcile.mjs source.json target.json report.json",
    );
  const report = reconcile(
    JSON.parse(await readFile(sourcePath, "utf8")),
    JSON.parse(await readFile(targetPath, "utf8")),
  );
  await writeFile(outputPath, JSON.stringify(report, null, 2) + "\n");
  console.log(report.status, report.issues.length, "issues");
  if (report.status !== "matched") process.exitCode = 2;
}
