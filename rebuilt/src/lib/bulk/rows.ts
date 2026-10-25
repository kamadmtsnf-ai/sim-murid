import { z } from "zod";
import { endMinute } from "../education/validation";
import { headers, type BulkDomain } from "./validation";
const identity = z
  .string()
  .min(1)
  .max(100)
  .refine((v) => v === v.trim() && !/[\u0000-\u001f\u007f]/u.test(v));
const integer = (min: number, max: number) =>
  z
    .string()
    .regex(/^\d+$/)
    .transform(Number)
    .pipe(z.number().int().min(min).max(max));
const shapes = {
  enrollment: z.object({ username: identity }).strict(),
  grades: z
    .object({
      username: identity,
      value: z
        .string()
        .refine((v) => v === "" || /^\d+(\.\d{1,2})?$/.test(v))
        .transform((v) => (v === "" ? null : Number(v)))
        .pipe(z.number().min(0).max(100).nullable()),
      notes: z
        .string()
        .max(2000)
        .refine(
          (v) => !/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/u.test(v),
        ),
    })
    .strict(),
  schedules: z
    .object({
      teacher_username: identity,
      subject_code: z.string().regex(/^[A-Z][A-Z0-9_]{1,31}$/),
      weekday: integer(1, 7),
      start: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/),
      duration_minutes: integer(1, 240),
      jtm: integer(1, 12),
      break_minutes: integer(0, 240),
    })
    .strict()
    .refine(
      (v) =>
        endMinute(v.start, v.duration_minutes, v.jtm, v.break_minutes) < 1440,
    ),
};
/** Typed worksheet rows; no identity inference. */
export function parseBulkRows(records: string[][], domain: BulkDomain) {
  if (records.length < 2 || records.length > 101)
    throw Error("Isi 1–100 baris data.");
  if (JSON.stringify(records[0]) !== JSON.stringify(headers[domain]))
    throw Error("Header harus sama dengan template Excel.");
  const rows: Record<string, unknown>[] = [],
    issues: { row: number; code: string }[] = [];
  const seen = new Set<string>();
  records.slice(1).forEach((fields, index) => {
    const row = index + 2;
    if (fields.length !== headers[domain].length) {
      issues.push({ row, code: "Jumlah kolom tidak sesuai header" });
      return;
    }
    const raw = Object.fromEntries(
      headers[domain].map((h, i) => [h, fields[i]]),
    );
    const result = shapes[domain].safeParse(raw);
    if (!result.success) {
      issues.push({
        row,
        code: "Periksa username teks, referensi, waktu, nilai 0–100 (maksimal 2 desimal), dan panjang isian",
      });
      return;
    }
    const key =
      domain === "schedules" ? JSON.stringify(result.data) : raw.username!;
    if (seen.has(key)) {
      issues.push({ row, code: "Baris atau username duplikat" });
      return;
    }
    seen.add(key);
    rows.push(result.data);
  });
  return { rows, issues, count: records.length - 1 };
}
