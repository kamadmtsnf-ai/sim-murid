import { z } from "zod";
import { snapshot } from "./validation.ts";
const stamp = z.iso.datetime({ offset: true });
const statuses = z.enum([
  "queued",
  "processing",
  "sent",
  "failed",
  "ambiguous",
  "cancelled",
]);
export const jobRow = z
  .object({
    id: z.uuid(),
    event_type: z.string(),
    channel: z.enum(["email", "whatsapp", "internal"]),
    status: statuses,
    attempts: z.number().int().nonnegative(),
    created_at: stamp,
    available_at: stamp,
    locked_until: stamp.nullable(),
    last_error_code: z.string().nullable(),
  })
  .passthrough();
export const jobsSnapshot = snapshot
  .extend({
    module: z.literal("jobs"),
    revision: z.number().int().nonnegative().safe(),
    isAdmin: z.literal(true),
    rows: z.array(jobRow).max(200),
    extra: z
      .object({
        jobs: z
          .array(
            z
              .object({
                id: z.uuid(),
                job_type: z.string(),
                job_key: z.string(),
                status: z.enum([
                  "queued",
                  "running",
                  "succeeded",
                  "failed",
                  "skipped",
                ]),
                attempts: z.number().int().nonnegative(),
                business_date: z.string(),
                created_at: stamp,
                started_at: stamp.nullable(),
                finished_at: stamp.nullable(),
              })
              .passthrough(),
          )
          .max(100),
        providers: z.object({
          gmail: z.boolean(),
          whatsapp: z.boolean(),
          scheduledDispatch: z.boolean(),
        }),
      })
      .passthrough(),
  })
  .refine(
    (s) =>
      new Set(s.rows.map((r) => r.id)).size === s.rows.length &&
      new Set(s.extra.jobs.map((r) => r.id)).size === s.extra.jobs.length,
    "Duplicate jobs",
  );
export type JobsSnapshot = z.infer<typeof jobsSnapshot>;
export const jobsAcknowledgement = z.object({
  code: z.enum([
    "saved",
    "denied",
    "stale",
    "invalid",
    "not_found",
    "locked",
    "duplicate",
    "request_conflict",
  ]),
  id: z.uuid().optional(),
  dryRun: z.boolean().optional(),
  reminderCandidates: z.number().int().nonnegative().optional(),
  date: z.string().optional(),
  hourWib: z.number().int().min(0).max(23).optional(),
});
export const deliveryResult = z.object({
  code: z.enum(["empty", "sent", "failed", "ambiguous", "unconfirmed"]),
  message: z.string().min(1).max(1000),
});
export const jobStatusLabel: Record<string, string> = {
  queued: "Menunggu",
  processing: "Diproses",
  sent: "Diterima penyedia",
  failed: "Gagal",
  ambiguous: "Perlu pemeriksaan",
  cancelled: "Dibatalkan",
  running: "Berjalan",
  succeeded: "Selesai",
  skipped: "Dilewati",
};
