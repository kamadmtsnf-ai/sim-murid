import { z } from "zod";
import { learningSnapshot, commands, diplomaFields } from "./validation.ts";
const id = z.uuid();
export const diplomaSlot = z.enum(["IJAZAH", "TRANSKRIP", "SKL"]);
export const promotionRow = z
  .object({
    student_id: id,
    name: z.string(),
    role: z.enum(["student", "applicant", "alumni"]),
    class_id: id.nullable(),
    diploma: z
      .object({
        metadata: z.record(z.string(), z.unknown()),
        view_override: z.enum(["allow", "deny", "inherit"]),
        download_override: z.enum(["allow", "deny", "inherit"]),
      })
      .passthrough()
      .nullable(),
    canView: z.boolean(),
    canDownload: z.boolean(),
    assets: z.array(
      z.object({
        id,
        filename: z.string(),
        mime: z.enum(["application/pdf", "image/png", "image/jpeg"]),
        slot: diplomaSlot,
      }),
    ),
  })
  .passthrough();
export const promotionsSnapshot = learningSnapshot
  .extend({
    module: z.literal("promotions"),
    revision: z.number().int().nonnegative().safe(),
    classes: z.array(
      z
        .object({
          id,
          name: z.string(),
          year: z.number().int(),
          academic_year_id: id,
          level: z.number().int().min(7).max(9),
          archived_at: z.string().nullable().optional(),
        })
        .passthrough(),
    ),
    rows: z.array(promotionRow),
    extra: z
      .object({
        years: z.array(z.object({ id, start_year: z.number().int() })),
        access: z
          .object({ allow_view: z.boolean(), allow_download: z.boolean() })
          .passthrough(),
      })
      .passthrough(),
  })
  .superRefine((d, c) => {
    const seen = new Set<string>();
    for (const row of d.rows) {
      if (seen.has(row.student_id + ":" + row.class_id))
        c.addIssue({ code: "custom", message: "Duplicate active student" });
      seen.add(row.student_id + ":" + row.class_id);
      if (row.class_id && !d.classes.some((x) => x.id === row.class_id))
        c.addIssue({ code: "custom", message: "Class unavailable" });
    }
  });
export type PromotionsSnapshot = z.infer<typeof promotionsSnapshot>;
export type PromotionRow = z.infer<typeof promotionRow>;
export type PromotionCommand = z.infer<typeof commands.promotions>;
export function emptyMetadata(row: PromotionRow) {
  return Object.fromEntries(
    diplomaFields.map((key) => [key, String(row.diploma?.metadata[key] ?? "")]),
  ) as Record<(typeof diplomaFields)[number], string>;
}
/** Client and server share preflight; SQL remains authoritative and atomic. */
export function mappingError(
  data: PromotionsSnapshot,
  command: PromotionCommand,
): string | null {
  if (command.type !== "promote" && command.type !== "place") return null;
  const source = data.extra.years.find((y) => y.id === command.sourceYearId),
    target = data.extra.years.find((y) => y.id === command.targetYearId);
  if (!source || !target)
    return "Pilih tahun ajaran asal dan tujuan yang tersedia.";
  if (command.type === "promote" && target.start_year !== source.start_year + 1)
    return "Kenaikan harus menuju tahun ajaran berikutnya.";
  for (const item of command.items) {
    const row = data.rows.find(
        (r) =>
          r.student_id === item.studentId &&
          r.class_id === item.expectedClassId,
      ),
      old = data.classes.find((c) => c.id === row?.class_id),
      next = data.classes.find((c) => c.id === item.classId);
    if (
      !row ||
      row.class_id !== item.expectedClassId ||
      (old && old.academic_year_id !== source.id)
    )
      return "Data kelas asal tidak sesuai. Muat ulang dan periksa tahun ajaran asal.";
    if (
      item.classId &&
      (!next || next.archived_at || next.academic_year_id !== target.id)
    )
      return "Kelas tujuan harus aktif dan berada pada tahun ajaran tujuan.";
    if (
      command.type === "promote" &&
      (row.role === "alumni" ||
        (row.role === "applicant" && (!next || next.level !== 7)) ||
        (row.role === "student" &&
          (!old ||
            (old.level === 9
              ? !!next
              : !next || next.level !== old.level + 1))))
    )
      return "Periksa jenjang tujuan: calon ke 7, 7 ke 8, 8 ke 9, dan 9 ke Alumni.";
  }
  return null;
}

/** Acknowledgement alone is insufficient; compare the authoritative state. */
export function promotionConfirmed(
  data: PromotionsSnapshot,
  command: PromotionCommand,
): boolean {
  if (command.type === "promote" || command.type === "place")
    return command.items.every((item) =>
      data.rows.some(
        (row) =>
          row.student_id === item.studentId &&
          row.class_id === item.classId &&
          row.role === (item.classId ? "student" : "alumni"),
      ),
    );
  if (command.type === "diploma")
    return data.rows.some(
      (row) =>
        row.student_id === command.studentId &&
        diplomaFields.every(
          (key) => row.diploma?.metadata[key] === command.metadata[key],
        ),
    );
  if (command.type !== "access") return false;
  if (command.scope === "global")
    return (
      data.extra.access.allow_view === command.view &&
      data.extra.access.allow_download === command.download
    );
  return command.studentIds.every((id) =>
    data.rows.some(
      (row) =>
        row.student_id === id &&
        row.diploma?.view_override === command.view &&
        row.diploma?.download_override === command.download,
    ),
  );
}
