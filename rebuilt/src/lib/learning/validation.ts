import { z } from "zod";
export const learningModules = z.enum([
  "grades",
  "reports",
  "promotions",
  "books",
]);
export type LearningModule = z.infer<typeof learningModules>;
export const titles: Record<LearningModule, string> = {
  grades: "Penilaian dan KKM",
  reports: "Rapor",
  promotions: "Kenaikan kelas dan ijazah",
  books: "Buku digital",
};
const id = z.uuid(),
  nullable = id.nullable().default(null),
  date = z.iso.date(),
  txt = z.string().trim().max(2000),
  reason = z.string().trim().min(3).max(2000);
export const diplomaFields = [
  "kelas_lulus",
  "tahun_lulus",
  "nomor_ijazah",
  "tanggal_ijazah",
  "kepala_sekolah",
  "nip_kepala_sekolah",
  "nilai_rata_rata",
  "predikat",
  "nomor_transkrip",
  "tanggal_transkrip",
  "nomor_skl",
  "tanggal_skl",
  "keterangan_skl",
] as const;
const metadata = z
  .object(
    Object.fromEntries(
      diplomaFields.map((k) => [k, z.string().trim().max(1000)]),
    ) as Record<(typeof diplomaFields)[number], z.ZodString>,
  )
  .strict();
export const commands = {
  grades: z.discriminatedUnion("type", [
    z
      .object({
        type: z.literal("kkm"),
        classId: id,
        subjectId: id,
        date,
        value: z.number().min(0).max(100),
      })
      .strict(),
    z
      .object({
        type: z.literal("batch"),
        id: nullable,
        classId: id,
        subjectId: id,
        date,
        kind: z.enum(["PH", "ATS", "ASAS", "Praktik"]),
        items: z
          .array(
            z
              .object({
                studentId: id,
                value: z.number().min(0).max(100).nullable(),
                notes: txt.default(""),
              })
              .strict(),
          )
          .min(1)
          .max(500)
          .refine((v) => new Set(v.map((x) => x.studentId)).size === v.length),
        reason: reason.optional(),
      })
      .strict()
      .refine((v) => !v.id || !!v.reason, {
        message: "Alasan koreksi wajib diisi.",
        path: ["reason"],
      }),
    z.object({ type: z.literal("void"), id, reason }).strict(),
  ]),
  reports: z
    .object({
      type: z.literal("publish"),
      classId: id,
      semester: z.number().int().min(1).max(2),
      studentIds: z
        .array(id)
        .min(1)
        .max(500)
        .refine((v) => new Set(v).size === v.length),
    })
    .strict(),
  promotions: z.union([
    z
      .object({
        type: z.enum(["promote", "place"]),
        sourceYearId: id,
        targetYearId: id,
        items: z
          .array(
            z
              .object({
                studentId: id,
                classId: nullable,
                expectedClassId: nullable,
              })
              .strict(),
          )
          .min(1)
          .max(500)
          .refine((v) => new Set(v.map((x) => x.studentId)).size === v.length),
        reason,
      })
      .strict(),
    z.object({ type: z.literal("diploma"), studentId: id, metadata }).strict(),
    z
      .object({
        type: z.literal("access"),
        scope: z.literal("global"),
        view: z.boolean(),
        download: z.boolean(),
      })
      .strict(),
    z
      .object({
        type: z.literal("access"),
        scope: z.literal("individual"),
        studentIds: z
          .array(id)
          .min(1)
          .max(500)
          .refine((v) => new Set(v).size === v.length),
        view: z.enum(["allow", "deny", "inherit"]),
        download: z.enum(["allow", "deny", "inherit"]),
      })
      .strict(),
  ]),
  books: z.discriminatedUnion("type", [
    z
      .object({
        type: z.literal("book"),
        id: nullable,
        title: z.string().trim().min(1).max(300),
        author: txt,
        publisher: txt,
        year: z.number().int().min(1800).max(2200).nullable(),
        version: txt,
        category: txt,
        subjectId: nullable,
        level: z.number().int().min(7).max(9).nullable(),
        url: z.union([
          z.literal(""),
          z.url().refine((v) => new URL(v).protocol === "https:"),
        ]),
        premium: z.boolean(),
      })
      .strict(),
    z.object({ type: z.literal("void"), id, reason }).strict(),
  ]),
};
export const learningFilters = z
  .object({
    classId: id.optional(),
    subjectId: id.optional(),
    studentId: id.optional(),
    semester: z.coerce.number().int().min(1).max(2).optional(),
    query: z.string().max(100).optional(),
    level: z.coerce.number().int().min(7).max(9).optional(),
    category: z.string().max(200).optional(),
    page: z.coerce.number().int().min(1).max(10000).optional(),
  })
  .strict();
const record = z.record(z.string(), z.unknown());
export const learningSnapshot = z.object({
  module: learningModules,
  revision: z.number(),
  today: z.string(),
  isAdmin: z.boolean(),
  canWrite: z.boolean(),
  classes: z.array(record),
  people: z.array(record),
  semester: z.number(),
  rows: z.array(record),
  extra: record,
});
export type LearningSnapshot = z.infer<typeof learningSnapshot>;
export const assetPrepare = z
  .object({
    action: z.literal("prepare"),
    kind: z.enum(["book", "diploma"]),
    targetId: id,
    slot: z.enum(["IJAZAH", "TRANSKRIP", "SKL"]).optional(),
    filename: z.string().min(1).max(200),
    mime: z.enum(["application/pdf", "image/png", "image/jpeg"]),
    size: z
      .number()
      .int()
      .min(1)
      .max(50 * 1024 * 1024),
  })
  .strict()
  .refine((x) => x.kind !== "book" || x.mime === "application/pdf");
export const assetAction = z
  .object({ action: z.enum(["finalize", "delete"]), id })
  .strict();
export const messages: Record<string, string> = {
  saved: "Perubahan berhasil disimpan.",
  denied: "Akses tidak diizinkan.",
  invalid: "Periksa isian, periode, dan referensi data.",
  duplicate: "Data atau batch sudah diproses.",
  stale: "Data berubah. Muat ulang sebelum menyimpan.",
  request_conflict: "ID permintaan telah digunakan.",
  incomplete: "Komponen nilai wajib belum lengkap.",
  published:
    "Rapor sudah terbit. Arsip dipertahankan; penerbitan ulang menunggu kebijakan koreksi.",
};
