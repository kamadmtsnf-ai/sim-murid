import { z } from "zod";
import { operationsSnapshot } from "./validation";
const id = z.uuid(),
  day = z.number().int().min(1).max(6),
  date = z.iso.date().refine((v) => v >= "2000-01-01" && v <= "2100-12-31");
export const dutyFilters = z.preprocess(
  (input) =>
    typeof input === "object" && input !== null
      ? Object.fromEntries(
          Object.entries(input).filter(([, v]) => v !== "" && v !== undefined),
        )
      : input,
  z
    .object({
      year: z.coerce.number().int().min(2000).max(2100).optional(),
      start: date.optional(),
      end: date.optional(),
      page: z.coerce.number().int().min(1).max(100000).optional(),
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
    }, "Rentang tanggal maksimal 366 hari dan tanggal akhir harus sesudah tanggal awal."),
);
export const dutySnapshot = operationsSnapshot
  .extend({
    module: z.literal("duty"),
    revision: z.number().int().nonnegative().safe(),
    total: z.number().int().nonnegative(),
    page: z.number().int().positive(),
    pageSize: z.number().int().positive(),
    rows: z.array(
      z.object({
        id,
        teacher_id: id,
        name: z.string(),
        date,
        kind: z.enum(["primary", "substitute"]),
        status: z.enum(["pending", "confirmed", "cancelled"]),
        replaces_id: id.nullable(),
        notes: z.string(),
        can_edit: z.boolean(),
      }),
    ),
    extra: z.object({
      roster: z.array(
        z.object({ teacher_id: id, name: z.string(), weekday: day }),
      ),
      confirmed: z.boolean(),
    }),
  })
  .superRefine((data, ctx) => {
    if (
      data.total < data.rows.length ||
      new Set(data.people.map((p) => p.id)).size !== data.people.length ||
      new Set(data.rows.map((r) => r.id)).size !== data.rows.length ||
      new Set(data.extra.roster.map((r) => r.teacher_id + ":" + r.weekday))
        .size !== data.extra.roster.length ||
      data.rows.some((r) =>
        r.kind === "primary"
          ? r.replaces_id !== null
          : r.replaces_id === null || r.replaces_id === r.teacher_id,
      )
    )
      ctx.addIssue({ code: "custom", message: "Data piket tidak konsisten." });
  });
export type DutySnapshot = z.infer<typeof dutySnapshot>;
export function dutyActions(row: DutySnapshot["rows"][number], today: string) {
  if (!row.can_edit || row.date !== today || row.status === "cancelled")
    return [];
  return row.status === "confirmed"
    ? (["unconfirm", "cancel"] as const)
    : row.kind === "substitute"
      ? (["confirm", "cancel"] as const)
      : (["cancel"] as const);
}
export const dutyDays = [
  "",
  "Senin",
  "Selasa",
  "Rabu",
  "Kamis",
  "Jumat",
  "Sabtu",
];

export const dutyMessages: Record<string, string> = {
  invalid:
    "Periksa guru yang dipilih, jadwal hari ini, dan status tugas Guru Piket.",
  duplicate: "Guru sudah memiliki penugasan aktif pada hari ini.",
  not_found: "Catatan tidak ditemukan atau bukan untuk hari ini.",
  denied: "Akses tidak diizinkan. Periksa sesi dan hak pengelolaan Guru Piket.",
};
