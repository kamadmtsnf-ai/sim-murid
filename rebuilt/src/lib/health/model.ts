import { z } from "zod";
import { jobsSnapshot } from "../services/jobs.ts";
import { reconciliationSnapshot } from "../services/reconciliation.ts";

const count = z.number().int().nonnegative().safe();
const timestamp = z.iso.datetime({ offset: true });
export const healthSnapshot = z.object({
  checkedAt: timestamp,
  jobs: z.object({
    checkedAt: timestamp,
    available: z.boolean(),
    outbox: z.object({ sampled: count, queued: count, processing: count, sent: count, failed: count, ambiguous: count, cancelled: count }).nullable(),
    runs: z.object({ sampled: count, queued: count, running: count, succeeded: count, failed: count, skipped: count }).nullable(),
    providers: z.object({ gmail: z.boolean(), whatsapp: z.boolean(), scheduledDispatch: z.boolean() }).nullable(),
    oldestQueuedAt: timestamp.nullable(),
    latestProviderAcceptedAt: timestamp.nullable(),
    latestJobFinishedAt: timestamp.nullable(),
  }).strict(),
  reconciliation: z.object({
    checkedAt: timestamp,
    available: z.boolean(),
    sourceAvailable: z.boolean().nullable(),
    tables: count.nullable(),
    reportSnapshots: count.nullable(),
    pointSnapshots: count.nullable(),
    submittedSurveys: count.nullable(),
  }).strict(),
}).strict();
export type HealthSnapshot = z.infer<typeof healthSnapshot>;

/** Validate each full server snapshot, then emit only explicit aggregate fields. */
export function healthFromSources(jobsInput: unknown, reconciliationInput: unknown, checkedAt: string): HealthSnapshot {
  const jobs = jobsSnapshot.safeParse(jobsInput);
  const reconciliation = reconciliationSnapshot.safeParse(reconciliationInput);
  const ordered = (values: string[]) => values.sort((a,b)=>Date.parse(a)-Date.parse(b));
  const outbox = jobs.success ? {
    sampled: jobs.data.rows.length,
    queued: jobs.data.rows.filter(r=>r.status==="queued").length,
    processing: jobs.data.rows.filter(r=>r.status==="processing").length,
    sent: jobs.data.rows.filter(r=>r.status==="sent").length,
    failed: jobs.data.rows.filter(r=>r.status==="failed").length,
    ambiguous: jobs.data.rows.filter(r=>r.status==="ambiguous").length,
    cancelled: jobs.data.rows.filter(r=>r.status==="cancelled").length,
  } : null;
  const runs = jobs.success ? {
    sampled: jobs.data.extra.jobs.length,
    queued: jobs.data.extra.jobs.filter(r=>r.status==="queued").length,
    running: jobs.data.extra.jobs.filter(r=>r.status==="running").length,
    succeeded: jobs.data.extra.jobs.filter(r=>r.status==="succeeded").length,
    failed: jobs.data.extra.jobs.filter(r=>r.status==="failed").length,
    skipped: jobs.data.extra.jobs.filter(r=>r.status==="skipped").length,
  } : null;
  return healthSnapshot.parse({
    checkedAt,
    jobs: {
      checkedAt, available: jobs.success, outbox, runs,
      providers: jobs.success ? { gmail: jobs.data.extra.providers.gmail, whatsapp: jobs.data.extra.providers.whatsapp, scheduledDispatch: jobs.data.extra.providers.scheduledDispatch } : null,
      oldestQueuedAt: jobs.success ? ordered(jobs.data.rows.filter(r=>r.status==="queued").map(r=>r.created_at))[0]??null : null,
      // Outbox has no accepted_at: do not substitute created_at as delivery time.
      latestProviderAcceptedAt: null,
      latestJobFinishedAt: jobs.success ? ordered(jobs.data.extra.jobs.map(r=>r.finished_at).filter((v):v is string=>v!==null)).at(-1)??null : null,
    },
    reconciliation: {
      checkedAt, available: reconciliation.success,
      sourceAvailable: reconciliation.success ? reconciliation.data.extra.sourceAvailable : null,
      tables: reconciliation.success ? reconciliation.data.extra.tables : null,
      reportSnapshots: reconciliation.success ? reconciliation.data.extra.reportSnapshots : null,
      pointSnapshots: reconciliation.success ? reconciliation.data.extra.pointSnapshots : null,
      submittedSurveys: reconciliation.success ? reconciliation.data.extra.submittedSurveys : null,
    },
  });
}
