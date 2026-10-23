import { z } from "zod";
import { learningFilters, learningSnapshot } from "./validation.ts";
const id = z.uuid();
const score = z.number().min(0).max(100);
export const reportKinds = [
  "combined",
  "PH",
  "ATS",
  "ASAS",
  "Praktik",
] as const;
export type ReportKind = (typeof reportKinds)[number];
export const reportFilters = z
  .object({
    classId: learningFilters.shape.classId,
    studentId: learningFilters.shape.studentId,
    semester: learningFilters.shape.semester,
  })
  .strict();
const snapshot = z
  .object({
    student: z.object({ id, name: z.string(), username: z.string() }),
    class: z.object({ id, name: z.string() }),
    year: z.number().int(),
    semester: z.number().int().min(1).max(2),
    draft: z.boolean(),
    policy: z.literal("RAPOR-1.0"),
    subjects: z.array(
      z
        .object({
          subject_id: id,
          name: z.string(),
          ph: score.nullable(),
          ats: score.nullable(),
          asas: score.nullable(),
          practice: score.nullable(),
          final: score,
          kkm: score,
          grade: z.enum(["A", "B", "C", "D"]),
          complete: z.boolean(),
        })
        .passthrough(),
    ),
  })
  .passthrough();
export const reportRow = z
  .object({
    student_id: id,
    name: z.string(),
    draft: snapshot.nullable(),
    published: z.object({ id, snapshot, published_at: z.string() }).nullable(),
  })
  .superRefine((r, c) => {
    for (const s of [r.draft, r.published?.snapshot])
      if (s && s.student.id !== r.student_id)
        c.addIssue({ code: "custom", message: "Student mismatch" });
    if (r.published?.snapshot.draft || (r.draft && !r.draft.draft))
      c.addIssue({ code: "custom", message: "Report status mismatch" });
  });
export const reportsSnapshot = learningSnapshot
  .extend({
    module: z.literal("reports"),
    revision: z.number().int().nonnegative().safe(),
    semester: z.number().int().min(1).max(2),
    classes: z.array(
      z.object({ id, name: z.string(), year: z.number().int() }).passthrough(),
    ),
    rows: z.array(reportRow),
    extra: z
      .object({ canPublish: z.boolean(), scope: reportFilters.optional() })
      .passthrough(),
  })
  .transform((data, ctx) => {
    const rows = new Map<string, z.infer<typeof reportRow>>();
    for (const r of data.rows) {
      const old = rows.get(r.student_id);
      if (old && JSON.stringify(old) !== JSON.stringify(r))
        ctx.addIssue({ code: "custom", message: "Conflicting reports" });
      rows.set(r.student_id, r);
      for (const s of [r.draft, r.published?.snapshot])
        if (
          s &&
          (s.semester !== data.semester ||
            (data.extra.scope?.classId &&
              s.class.id !== data.extra.scope.classId))
        )
          ctx.addIssue({ code: "custom", message: "Report scope mismatch" });
    }
    return { ...data, rows: [...rows.values()] };
  });
export type ReportsSnapshot = z.infer<typeof reportsSnapshot>;
export type ReportRow = z.infer<typeof reportRow>;
export function reportSnapshot(r: ReportRow) {
  return r.published?.snapshot ?? r.draft;
}
export function reportReady(r: ReportRow) {
  return (
    !r.published &&
    !!r.draft?.subjects.length &&
    r.draft.subjects.every((s) => s.complete)
  );
}
export function reportValue(s: Record<string, unknown>, kind: string): unknown {
  const key = (
    {
      combined: "final",
      PH: "ph",
      ATS: "ats",
      ASAS: "asas",
      Praktik: "practice",
    } as Record<string, string>
  )[kind];
  return key ? s[key] : undefined;
}
