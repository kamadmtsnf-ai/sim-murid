import { writeFile } from "node:fs/promises";
import { performance } from "node:perf_hooks";
const origin = new URL(process.argv[2] ?? "http://127.0.0.1:3274");
if (
  !["127.0.0.1", "localhost"].includes(origin.hostname) &&
  process.env.SIM_LOAD_EXTERNAL_APPROVED !== "true"
)
  throw new Error(
    "External target requires explicit SIM_LOAD_EXTERNAL_APPROVED=true",
  );
const samples = [];
for (const concurrency of [60, 132]) {
  const times = await Promise.all(
    Array.from({ length: concurrency }, async () => {
      const start = performance.now();
      try {
        const r = await fetch(new URL("/api/health", origin), {
          signal: AbortSignal.timeout(15000),
        });
        const body = await r.json();
        return {
          ms: performance.now() - start,
          ok: r.ok && body.status === "ok",
        };
      } catch {
        return { ms: performance.now() - start, ok: false };
      }
    }),
  );
  const sorted = times.map((x) => x.ms).sort((a, b) => a - b);
  samples.push({
    concurrency,
    requests: times.length,
    errors: times.filter((x) => !x.ok).length,
    p50: sorted[Math.ceil(sorted.length * 0.5) - 1],
    p95: sorted[Math.ceil(sorted.length * 0.95) - 1],
  });
}
const result = {
  origin: origin.origin,
  scenario:
    "anonymous liveness ONLY; not authenticated UAT or business workload",
  samples,
};
if (process.argv[3])
  await writeFile(process.argv[3], JSON.stringify(result, null, 2) + "\n");
console.log(JSON.stringify(result, null, 2));
if (samples.some((s) => s.errors)) process.exitCode = 1;
