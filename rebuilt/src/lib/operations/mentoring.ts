import { z } from "zod";
import { filtersSchema, operationsSnapshot } from "./validation";
export const mentoringFilters = z.preprocess(
  (input) =>
    typeof input === "object" && input !== null
      ? Object.fromEntries(
          Object.entries(input).filter(([, v]) => v !== "" && v !== undefined),
        )
      : input,
  z
    .object({
      year: filtersSchema.shape.year,
      start: filtersSchema.shape.start,
      end: filtersSchema.shape.end,
      studentId: filtersSchema.shape.studentId,
      page: filtersSchema.shape.page,
      export: filtersSchema.shape.export,
    })
    .strict()
    .refine((f) => {
      const year =
        f.year ??
        Number(
          new Intl.DateTimeFormat("en-US", {
            year: "numeric",
            timeZone: "Asia/Jakarta",
          }).format(new Date()),
        );
      const start = f.start ?? `${year}-01-01`,
        end = f.end ?? `${year}-12-31`;
      return (
        start <= end && (Date.parse(end) - Date.parse(start)) / 86400000 <= 366
      );
    }, "Pilih rentang tanggal maksimal 366 hari."),
);
const id = z.uuid();
export const mentoringSnapshot = operationsSnapshot
  .extend({
    module: z.literal("mentoring"),
    revision: z.number().int().nonnegative().safe(),
    total: z.number().int().nonnegative(),
    page: z.number().int().positive(),
    pageSize: z.number().int().positive(),
    rows: z.array(
      z.object({
        id,
        student_id: id,
        teacher_id: id,
        name: z.string(),
        teacher_name: z.string(),
        date: z.iso.date(),
        kind: z.enum(["memorization", "development"]),
        subject: z.string(),
        catalog_id: id.nullable(),
        predicate: z.string(),
        notes: z.string(),
        can_edit: z.boolean(),
      }),
    ),
    extra: z.object({
      assignments: z.array(
        z.object({
          id,
          teacher_id: id,
          student_id: id,
          name: z.string(),
          teacher_name: z.string(),
        }),
      ),
      catalog: z.array(z.object({ id, name: z.string() })),
      canAssign: z.boolean(),
    }),
  })
  .superRefine((v, ctx) => {
    if (
      v.total < v.rows.length ||
      new Set(v.rows.map((r) => r.id)).size !== v.rows.length ||
      new Set(v.extra.assignments.map((a) => a.student_id)).size !==
        v.extra.assignments.length ||
      new Set(v.people.map((p) => p.id)).size !== v.people.length ||
      new Set(v.extra.catalog.map((c) => c.id)).size !==
        v.extra.catalog.length ||
      (v.extra.canAssign && !v.isAdmin)
    )
      ctx.addIssue({
        code: "custom",
        message: "Data bimbingan tidak konsisten.",
      });
  });
export type MentoringSnapshot = z.infer<typeof mentoringSnapshot>;
export const mentoringMessages: Record<string, string> = {
  invalid:
    "Periksa guru, tugas Guru Wali, siswa, tanggal, dan kelengkapan laporan.",
  duplicate:
    "Siswa sudah memiliki Guru Wali. Lepaskan penugasan lama sebelum memindahkan siswa.",
  denied:
    "Akses ditolak. Periksa sesi dan penugasan bimbingan yang masih aktif.",
};
