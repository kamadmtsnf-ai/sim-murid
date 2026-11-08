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
    channel: z.enum(["email", "whatsapp", "internal", "push"]),
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
          webPush: z.boolean().default(false),
        }),
      })
      .extend({push: z.object({points_pilot:z.object({enabled:z.boolean(),active_members:z.number().int().nonnegative()}).nullable().default(null),alarm:z.boolean().default(false),errors:z.record(z.string(),z.number().int().nonnegative()).default({}),counts:z.record(z.string(),z.number().int().nonnegative()),oldest_ready_at:z.string().nullable(),worker:z.object({last_started:z.string().nullable(),last_finished:z.string().nullable(),last_metrics:z.record(z.string(),z.number()),scheduler_enabled:z.boolean()}),database_dispatch:z.boolean()}).nullable().default(null)})
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
