import { readFile, writeFile } from "node:fs/promises";
import { performance } from "node:perf_hooks";
import { distribution } from "./benchmark.mjs";
export const productionProject = "qpzoukkhdxpmbtkcqemj";
export function validatePlan(p, externalApproved = false) {
  const url = new URL(p.origin);
  if (
    url.username ||
    url.password ||
    url.search ||
    url.hash ||
    url.pathname !== "/" ||
    !["http:", "https:"].includes(url.protocol)
  )
    throw Error("Invalid target");
  const local = ["localhost", "127.0.0.1"].includes(url.hostname);
  if (
    url.hostname === "sim-muridv2.vercel.app" ||
    url.hostname === productionProject + ".supabase.co"
  )
    throw Error("Production target prohibited");
  if (!local && (!externalApproved || url.protocol !== "https:"))
    throw Error("External staging approval required");
  if (
    p.environment !== "staging" ||
    !/^[a-z0-9]{20}$/.test(p.projectRef) ||
    p.projectRef === productionProject
  )
    throw Error("Dedicated staging project required");
  if (
    !Array.isArray(p.users) ||
    p.users.length < 132 ||
    p.users.length > 200 ||
    !Array.isArray(p.scenarios) ||
    p.scenarios.length < 1 ||
    p.scenarios.length > 10
  )
    throw Error("132 to 200 staging users and bounded scenarios required");
  if (
    new Set(p.users.map((u) => u.cookie)).size !== p.users.length ||
    p.users.some(
      (u) =>
        typeof u.cookie !== "string" ||
        u.cookie.length < 10 ||
        u.cookie.length > 16000 ||
        /[\r\n]/.test(u.cookie),
    )
  )
    throw Error("Distinct valid staging session cookies required");
  const paths = new Set([
    "/api/classes",
    "/api/schedules",
    "/api/learning/grades",
    "/api/learning/reports",
    "/api/operations/savings",
    "/api/operations/attendance",
  ]);
  for (const s of p.scenarios) {
    const target = new URL(s.path, url);
    if (
      target.origin !== url.origin ||
      !paths.has(target.pathname) ||
      !["GET", "POST"].includes(s.method) ||
      !Array.isArray(s.expectedStatuses) ||
      s.expectedStatuses.length === 0 ||
      s.expectedStatuses.some((x) => ![200, 403, 409].includes(x))
    )
      throw Error("Unsafe scenario");
    if (
      s.method === "POST" &&
      (!p.allowWrites ||
        typeof s.body !== "object" ||
        !s.body ||
        JSON.stringify(s.body).length > 65536)
    )
      throw Error("Explicit bounded staging writes required");
  }
  return p;
}
export async function runStagingLoad(p, approved = false) {
  validatePlan(p, approved);
  const origin = new URL(p.origin);
  const preflight = await fetch(new URL("/api/release/readiness", origin), {
    headers: { cookie: p.users[0].cookie },
    redirect: "error",
    signal: AbortSignal.timeout(10000),
  });
  if (!preflight.ok) throw Error("Authenticated Admin preflight denied");
  const target = await preflight.json();
  if (
    target.scope !== "configuration-only" ||
    target.projectRef !== p.projectRef ||
    !["preview", "development"].includes(target.deployEnvironment)
  )
    throw Error("Staging metadata does not match approved target");
  const batches = [];
  for (const concurrency of [60, 132]) {
    const samples = await Promise.all(
      p.users.slice(0, concurrency).map(async (user, i) => {
        const s = p.scenarios[i % p.scenarios.length],
          start = performance.now();
        try {
          const r = await fetch(new URL(s.path, origin), {
            method: s.method,
            headers: {
              cookie: user.cookie,
              ...(s.method === "POST"
                ? { "content-type": "application/json", origin: origin.origin }
                : {}),
            },
            ...(s.method === "POST" ? { body: JSON.stringify(s.body) } : {}),
            redirect: "error",
            signal: AbortSignal.timeout(15000),
          });
          await r.arrayBuffer();
          return {
            ms: performance.now() - start,
            ok: s.expectedStatuses.includes(r.status),
            status: r.status,
          };
        } catch {
          return { ms: performance.now() - start, ok: false, status: 0 };
        }
      }),
    );
    batches.push({
      concurrency,
      ...distribution(samples),
      statusCounts: Object.fromEntries(
        [...new Set(samples.map((s) => s.status))].map((status) => [
          status,
          samples.filter((s) => s.status === status).length,
        ]),
      ),
    });
  }
  return {
    scope:
      "authenticated staging HTTP response measurements; business reconciliation and human UAT must be supplied separately",
    projectRef: p.projectRef,
    scenarioCount: p.scenarios.length,
    mixedWrites: p.scenarios.some((s) => s.method === "POST"),
    batches,
    limitations: [
      "One request per selected session per batch; not a sustained soak",
      "Expected denial/conflict is not a successful business mutation",
      "No tokens, bodies, raw URLs or response payloads in this report",
    ],
  };
}
if (import.meta.url === new URL(process.argv[1], "file:").href) {
  try {
    const p = JSON.parse(await readFile(process.argv[2], "utf8"));
    const result = await runStagingLoad(
      p,
      process.env.SIM_LOAD_EXTERNAL_APPROVED === "true",
    );
    if (process.argv[3])
      await writeFile(process.argv[3], JSON.stringify(result, null, 2) + "\n");
    console.log(JSON.stringify(result, null, 2));
    if (result.batches.some((b) => b.errors)) process.exitCode = 1;
  } catch {
    if (process.argv[3])
      try {
        await writeFile(
          process.argv[3],
          JSON.stringify({
            status: "failed",
            batches: [],
            scope: "staging verification incomplete",
          }) + "\n",
        );
      } catch {}
    console.error(
      "Staging verification failed; inspect the private plan, session access and target metadata.",
    );
    process.exitCode = 1;
  }
}
