import { z } from "zod";
import { filtersSchema, operationsSnapshot } from "./validation";
export const attendanceStatuses = ["Hadir", "Sakit", "Izin", "Alpha"] as const;
export const attendanceFilters = z.preprocess(
  (input) =>
    typeof input === "object" && input !== null
      ? Object.fromEntries(
          Object.entries(input).filter(([, v]) => v !== "" && v !== undefined),
        )
      : input,
  filtersSchema.refine((f) => {
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
export function attendanceMonth(month: string) {
  const parsed = z
    .string()
    .regex(/^(20\d{2}|2100)-(0[1-9]|1[0-2])$/)
    .parse(month);
  const last = new Date(
    Date.UTC(Number(parsed.slice(0, 4)), Number(parsed.slice(5)), 0),
  ).getUTCDate();
  return {
    start: parsed + "-01",
    end: parsed + "-" + String(last).padStart(2, "0"),
  };
}
const date = z.iso.date();
export const attendanceSnapshot = operationsSnapshot
  .extend({
    module: z.literal("attendance"),
    revision: z.number().int().nonnegative().safe(),
    page: z.number().int().positive(),
    pageSize: z.number().int().positive(),
    total: z.number().int().nonnegative(),
    summary: z.record(z.string(), z.number().nonnegative()),
    rows: z.array(
      z.object({
        id: z.uuid(),
        student_id: z.uuid(),
        class_id: z.uuid(),
        name: z.string(),
        class_name: z.string(),
        date,
        status: z.enum(attendanceStatuses),
        notes: z.string(),
        can_edit: z.boolean(),
      }),
    ),
    extra: z.object({
      holidays: z.array(date),
      trend: z.array(
        z.object({
          month: z.string().regex(/^\d{4}-\d{2}$/),
          value: z.number().nonnegative(),
        }),
      ),
    }),
  })
  .superRefine((v, ctx) => {
    if (
      v.total < v.rows.length ||
      new Set(v.rows.map((r) => r.student_id + ":" + r.date)).size !==
        v.rows.length
    )
      ctx.addIssue({
        code: "custom",
        message: "Data absensi tidak konsisten.",
      });
  });
export type AttendanceSnapshot = z.infer<typeof attendanceSnapshot>;
/** A calendar must receive every row for one student, never a filtered history page. */
export function calendarSnapshot(
  input: unknown,
  studentId: string,
  month: string,
) {
  const data = attendanceSnapshot.parse(input),
    range = attendanceMonth(month);
  if (
    data.page !== 1 ||
    data.rows.length !== data.total ||
    data.rows.some(
      (r) =>
        r.student_id !== studentId ||
        r.date < range.start ||
        r.date > range.end,
    )
  )
    throw Error("Kalender belum lengkap.");
  return data;
}
export function calendarStatus(data: AttendanceSnapshot, date: string) {
  const row = data.rows.find((r) => r.date === date);
  return (
    row?.status ??
    (new Date(date + "T12:00:00Z").getUTCDay() === 0 ||
    data.extra.holidays.includes(date)
      ? "Libur"
      : date > data.today
        ? "Belum berlangsung"
        : "Belum dicatat")
  );
}
export const attendanceMessages: Record<string, string> = {
  invalid:
    "Periksa siswa, kelas saat tanggal absensi, dan hari sekolah. Tanggal mendatang tidak dapat diinput.",
  duplicate:
    "Absensi siswa pada tanggal tersebut sudah ada. Gunakan koreksi pada riwayat.",
  denied:
    "Akses ditolak. Periksa sesi dan konfirmasi piket untuk tanggal absensi.",
};
