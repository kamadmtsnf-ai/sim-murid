import { z } from "zod";
import { snapshot, filters } from "./validation.ts";
const id = z.uuid(),
  month = z.iso.date().refine((v) => v.endsWith("-01")),
  count = z.number().int().nonnegative().safe(),
  score = z.number().int().min(-50).max(100);
export const disciplineFilters = z.preprocess(
  (v) =>
    typeof v === "object" && v !== null
      ? Object.fromEntries(
          Object.entries(v).filter(([, x]) => x !== "" && x !== undefined),
        )
      : v,
  z
    .object({
      month: month.optional(),
      classId: filters.shape.classId,
      studentId: filters.shape.studentId,
    })
    .strict(),
);
const catalog = z.object({
  code: z.string().regex(/^[A-I][0-9]{2}$/),
  category: z.string(),
  description: z.string(),
  points: z.number().int().min(-100).max(100),
  consequence: z.string(),
  active: z.boolean(),
});
const event = z
  .object({
    id,
    student_id: id,
    event_date: z.iso.date(),
    code: z.string(),
    notes: z.string(),
    created_by: id,
    base_points: z.number().int().min(-100).max(100),
    catalog_snapshot: catalog,
    multiplier: z.number().int().min(1).max(3),
    r02: z.boolean(),
    r03: z.boolean(),
    before: score,
    after: score,
    delta: z.number().int().min(-150).max(150),
  })
  .passthrough();
const student = z.object({
  student_id: id,
  name: z.string(),
  class_id: id,
  class_name: z.string(),
  archived: z.boolean(),
  snapshot: z.object({
    student_id: id,
    month,
    balance: score,
    level: z.number().int().min(0).max(5),
    violations: count,
    good: count,
    policy: z.literal("SPK-1.0"),
    events: z.array(event),
  }),
});
export const disciplineSnapshot = snapshot
  .extend({
    module: z.literal("discipline"),
    revision: count,
    today: z.iso.date(),
    month,
    rows: z.array(student),
    extra: z
      .object({
        canRecord: z.boolean(),
        recordingStudents: z
          .array(
            student.pick({
              student_id: true,
              name: true,
              class_id: true,
              class_name: true,
            }),
          )
          .optional(),
        catalog: z
          .array(catalog)
          .nullable()
          .transform((v) => v ?? []),
        settings: z
          .object({
            email_enabled: z.boolean(),
            whatsapp_enabled: z.boolean(),
            point_threshold: z.number().int().min(0).max(5),
            affective_subject_id: id.nullable(),
          })
          .passthrough(),
        ranking: z.array(z.record(z.string(), z.unknown())),
        affective: z.array(z.record(z.string(), z.unknown())),
      })
      .passthrough(),
  })
  .superRefine((v, ctx) => {
    if (
      new Set(v.rows.map((r) => r.student_id + ":" + r.class_id)).size !==
        v.rows.length ||
      v.rows.some(
        (r) =>
          r.student_id !== r.snapshot.student_id ||
          r.snapshot.month !== v.month ||
          new Set(r.snapshot.events.map((e) => e.id)).size !==
            r.snapshot.events.length ||
          r.snapshot.events.some(
            (e) =>
              e.student_id !== r.student_id ||
              e.event_date.slice(0, 7) !== v.month.slice(0, 7) ||
              e.before + e.delta !== e.after,
          ),
      )
    )
      ctx.addIssue({ code: "custom", message: "Data poin tidak konsisten." });
  });
export type DisciplineSnapshot = z.infer<typeof disciplineSnapshot>;
/** Read SQL joins user_roles; collapse only identical duplicate records, never conflicting snapshots. */
export function parseDiscipline(input: unknown) {
  if (typeof input !== "object" || input === null)
    throw Error("Invalid discipline");
  const raw = input as Record<string, unknown>;
  if (!Array.isArray(raw.rows)) throw Error("Invalid rows");
  const seen = new Map<string, unknown>();
  for (const row of raw.rows) {
    const r = student.parse(row),
      key = r.student_id + ":" + r.class_id;
    if (seen.has(key) && JSON.stringify(seen.get(key)) !== JSON.stringify(r))
      throw Error("Conflicting discipline rows");
    seen.set(key, r);
  }
  return disciplineSnapshot.parse({ ...raw, rows: [...seen.values()] });
}
export const canCancelEvent = (
  data: DisciplineSnapshot,
  row: DisciplineSnapshot["rows"][number],
  event: DisciplineSnapshot["rows"][number]["snapshot"]["events"][number],
  userId: string,
) =>
  !row.archived &&
  data.extra.canRecord &&
  (data.isAdmin || event.created_by === userId);
