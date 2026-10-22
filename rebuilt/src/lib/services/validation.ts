import {academicPeriodForDate} from '../academic/period.ts';
import { z } from "zod";
export const modules = z.enum([
  "discipline",
  "notifications",
  "surveys",
  "insights",
  "jobs",
  "reconciliation",
]);
export type ServiceModule = z.infer<typeof modules>;
export const titles: Record<ServiceModule, string> = {
  discipline: "Poin kedisiplinan",
  notifications: "Notifikasi",
  surveys: "Survei evaluasi",
  insights: "Hasil survei dan rencana aksi",
  jobs: "Antrean dan pekerjaan",
  reconciliation: "Rekonsiliasi migrasi",
};
const id = z.uuid(),
  date = z.iso.date(),
  month = date.refine((v) => v.endsWith("-01")),
  text = z.string().trim().max(2000),
  reason = text.min(3),
  row = z.record(z.string(), z.unknown()),
  answers = z.record(
    z.string().max(80),
    z.union([z.string().max(10000), z.number().int().min(1).max(5)]),
  );
const item = z
  .object({
    code: z.string().regex(/^[A-Z0-9-]{1,40}$/),
    kind: z.enum(["likert", "essay"]),
    question: z.string().trim().min(3).max(1000),
    required: z.boolean(),
    section: z.literal("micro"),
    aspect: z.literal("micro"),
  })
  .strict();
export const commands = {
  discipline: z.discriminatedUnion("type", [
    z
      .object({
        type: z.literal("event"),
        studentId: id,
        date,
        code: z.string().regex(/^[A-I][0-9]{2}$/),
        notes: text,
      })
      .strict(),
    z.object({ type: z.literal("cancel"), id, reason }).strict(),
    z
      .object({
        type: z.literal("catalog"),
        code: z.string().regex(/^[A-I][0-9]{2}$/),
        category: text.min(1),
        description: text.min(1),
        points: z.number().int().min(-100).max(100),
        consequence: text,
        active: z.boolean(),
      })
      .strict(),
    z.object({ type: z.enum(["reset", "affective"]), month }).strict(),
    z.object({ type: z.literal("rebuild"), studentId: id, month }).strict(),
    z
      .object({
        type: z.literal("settings"),
        email: z.boolean(),
        whatsapp: z.boolean().default(false),
        threshold: z.number().int().min(0).max(5),
        subjectId: id.nullable(),
      })
      .strict(),
  ]),
  notifications: z
    .object({ type: z.literal("read"), id: id.nullable() })
    .strict(),
  surveys: z.discriminatedUnion("type", [
    z
      .object({
        type: z.literal("period"),
        periodId: id.nullable(),
        title: text.min(3),
        yearId: id,
        semester: z.number().int().min(1).max(2),
        start: date,
        end: date,
        targets: z
          .array(z.enum(["student", "teacher", "parent"]))
          .min(1)
          .max(3),
        kind: z.enum(["main", "micro"]),
        questions: z.array(item).min(1).max(50).nullable(),
        examOverride: text,
      })
      .strict()
      .refine((v) => v.end >= v.start)
      .refine(v=>{const a=academicPeriodForDate(v.start),b=academicPeriodForDate(v.end);return a?.semester===v.semester&&b?.semester===v.semester&&a.startYear===b.startYear;},'Tanggal survei harus berada dalam satu semester yang dipilih.')
      .refine((v) => v.kind !== "micro" || v.questions !== null),
    z.object({ type: z.enum(["start", "close"]), periodId: id }).strict(),
    z
      .object({
        type: z.enum(["save", "submit"]),
        periodId: id,
        version: z.number().int().min(0),
        answers,
      })
      .strict(),
    z
      .object({
        type: z.enum(["peer_save", "peer_submit"]),
        periodId: id,
        version: z.number().int().min(0),
        answers: z.record(
          id,
          z.record(
            z.string().regex(/^PTS-[1-7]$/),
            z.union([
              z.number().int().min(1).max(5),
              z.literal("TT"),
              z.string().max(10000),
            ]),
          ),
        ),
      })
      .strict(),
  ]),
  insights: z.discriminatedUnion("type", [
    z
      .object({
        type: z.literal("plan_status"),
        periodId: id,
        index: z.number().int().min(0).max(6),
        status: z.enum(["belum", "proses", "selesai"]),
      })
      .strict(),

    z
      .object({ type: z.literal("note"), periodId: id, userId: id, note: text })
      .strict(),
    z
      .object({
        type: z.literal("plan"),
        periodId: id,
        items: z
          .array(
            z
              .object({
                description: text.min(3),
                owner: text.min(1),
                target: date,
                aspect: z.enum([
                  "Pengajaran",
                  "Fasilitas",
                  "Kurikulum",
                  "Karakter",
                  "Disiplin",
                  "Budaya",
                ]),
                status: z.enum(["belum", "proses", "selesai"]),
              })
              .strict(),
          )
          .min(3)
          .max(7),
      })
      .strict(),
  ]),
  jobs: z.discriminatedUnion("type", [
    z.object({ type: z.literal("tick"), dryRun: z.boolean() }).strict(),
    z.object({ type: z.literal("retry"), id }).strict(),
  ]),
};
export const filters = z
  .object({
    month: month.optional(),
    classId: id.optional(),
    studentId: id.optional(),
    periodId: id.optional(),
    role: z.enum(["student", "teacher", "parent"]).optional(),
    quality: z.enum(["tinggi", "sedang", "rendah"]).optional(),
  })
  .strict();
export const snapshot = z.object({
  module: modules,
  revision: z.number(),
  today: z.string(),
  isAdmin: z.boolean(),
  isManager: z.boolean(),
  month: z.string(),
  rows: z.array(row),
  extra: row,
  years: z.array(row).nullable(),
  classes: z.array(row),
  subjects: z.array(row).nullable(),
});
export const notificationSnapshot = snapshot.extend({
  module: z.literal("notifications"),
  rows: z.array(z.object({
    id: z.uuid(), title: z.string().nullable(), message: z.string().nullable(),
    created_at: z.string().nullable(), read_at: z.string().nullable(),
  }).passthrough()),
  extra: z.object({unread: z.number().int().nonnegative()}).passthrough(),
}).refine(value => new Set(value.rows.map(row => row.id)).size === value.rows.length, "Duplicate notification IDs");
export type ServiceSnapshot = z.infer<typeof snapshot>;
export const messages: Record<string, string> = {
  saved: "Perubahan disimpan.",
  denied: "Akses tidak diizinkan.",
  stale: "Data telah berubah. Muat ulang untuk melanjutkan.",
  locked: "Periode atau jawaban terkunci.",
  archived: "Bulan sudah diarsipkan. Riwayat dipertahankan.",
  invalid: "Periksa data dan periode.",
  not_found: "Data tidak ditemukan.",
  incomplete: "Jawaban atau data wajib belum lengkap.",
  peer_incomplete: "Selesaikan penilaian seluruh rekan terlebih dahulu.",
  exam_warning:
    "Survei dekat jadwal ujian. Isi alasan override bila tetap dibuka.",
  not_configured: "Layanan atau mapel belum dikonfigurasi.",
  duplicate: "Data sudah diproses.",
  request_conflict: "ID permintaan sudah digunakan.",
};

export function requiredMissing(
  instrument: Record<string, unknown>[],
  answers: Record<string, unknown>,
) {
  return instrument
    .filter(
      (q) =>
        q.required !== false &&
        (answers[String(q.code)] === undefined ||
          answers[String(q.code)] === null ||
          String(answers[String(q.code)]).trim() === ""),
    )
    .map((q) => String(q.code));
}
