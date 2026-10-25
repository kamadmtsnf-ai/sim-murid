import { z } from "zod";
export const bulkDomains = z.enum(["enrollment", "schedules", "grades"]);
export type BulkDomain = z.infer<typeof bulkDomains>;
export const bulkOptions = z
  .object({
    classId: z.uuid(),
    subjectId: z.uuid().optional(),
    semester: z.union([z.literal(1), z.literal(2)]).optional(),
    date: z.iso.date().optional(),
    kind: z.enum(["PH", "ATS", "ASAS", "Praktik"]).optional(),
  })
  .strict();
export const bulkInput = z
  .object({
    action: z.enum(["preview", "commit"]),
    requestId: z.uuid(),
    domain: bulkDomains,
    options: bulkOptions,
    workbook: z.string().min(4).max(1398104),
    revision: z.number().int().nonnegative().safe().optional(),
  })
  .strict()
  .superRefine((v, c) => {
    if (v.action === "commit" && v.revision === undefined)
      c.addIssue({
        code: "custom",
        message: "Pratinjau harus diperiksa kembali.",
      });
    if (v.domain !== "schedules" && !v.options.date)
      c.addIssue({ code: "custom", message: "Tanggal wajib diisi." });
    if (
      v.domain === "grades" &&
      (!v.options.subjectId || !v.options.kind || !v.options.semester)
    )
      c.addIssue({
        code: "custom",
        message: "Mapel dan jenis penilaian wajib diisi.",
      });
    if (
      v.domain !== "grades" &&
      (v.options.subjectId || v.options.kind || v.options.semester)
    )
      c.addIssue({ code: "custom", message: "Konteks impor tidak sesuai." });
    if (
      v.domain === "grades" &&
      v.options.date &&
      v.options.semester &&
      (Number(v.options.date.slice(5, 7)) >= 7 ? 1 : 2) !== v.options.semester
    )
      c.addIssue({
        code: "custom",
        path: ["options", "date"],
        message:
          "Tanggal penilaian harus sesuai semester yang dipilih pada halaman.",
      });
    if (v.domain === "schedules" && v.options.date)
      c.addIssue({
        code: "custom",
        message: "Jadwal mingguan tidak memakai tanggal penilaian.",
      });
  });
export const rowOutcome = z
  .object({
    row: z.number().int().min(2).max(101),
    code: z.string().min(1).max(80),
  })
  .strict();
export const bulkResult = z
  .object({
    code: z.enum([
      "ready",
      "saved",
      "invalid",
      "denied",
      "stale",
      "duplicate",
      "request_conflict",
      "not_found",
      "existing_assessment",
    ]),
    revision: z.number().int().nonnegative().safe().optional(),
    requestId: z.uuid().optional(),
    rows: z.array(rowOutcome).max(100).optional(),
  })
  .strict()
  .superRefine((v, c) => {
    if (
      v.rows?.some((r, i) => r.row !== i + 2) ||
      new Set(v.rows?.map((r) => r.row)).size !== (v.rows?.length ?? 0) ||
      (["ready", "saved"].includes(v.code) &&
        (!v.requestId ||
          v.revision === undefined ||
          !v.rows?.length ||
          v.rows.some(
            (r) => r.code !== (v.code === "saved" ? "saved" : "valid"),
          )))
    )
      c.addIssue({
        code: "custom",
        message: "Hasil impor belum dapat dipastikan.",
      });
  });
export type BulkResult = z.infer<typeof bulkResult>;
export const headers: Record<BulkDomain, string[]> = {
  enrollment: ["username"],
  grades: ["username", "value", "notes"],
  schedules: [
    "teacher_username",
    "subject_code",
    "weekday",
    "start",
    "duration_minutes",
    "jtm",
    "break_minutes",
  ],
};
export const bulkTemplates:Record<BulkDomain,string[][]>={
 enrollment:[["001-02"]],grades:[["001-02","0",""]],schedules:[["guru-01","IPS","1","07:00","40","2","0"]]
};
export const outcomeLabels: Record<string, string> = {
  valid: "Valid; belum disimpan",
  saved: "Tersimpan",
  duplicate_row: "Username berulang dalam berkas",
  reference: "Referensi aktif tidak ditemukan",
  membership: "Siswa tidak terdaftar aktif pada kelas/tanggal penilaian",
  already_enrolled: "Siswa sudah ditempatkan pada tahun ajaran ini",
  overlap: "Jadwal bertabrakan untuk kelas atau guru",
  invalid: "Isian tidak valid",
  denied: "Akses tidak diizinkan",
  stale: "Data berubah; buat pratinjau baru",
  not_saved: "Tidak disimpan karena batch ditolak",
  duplicate: "Isi batch sudah pernah diimpor",
  request_conflict: "ID permintaan tidak cocok dengan isi batch",
  not_found: "Belum ada hasil tersimpan untuk permintaan ini",
  existing_assessment:
    "Penilaian jenis/periode ini sudah ada; gunakan alur koreksi di modul nilai",
};

export const bulkCatalog = z
  .object({
    classId: z.uuid(),
    domain: bulkDomains,
    people: z
      .array(
        z.object({ username: z.string().max(100), name: z.string().max(200) }),
      )
      .max(500),
    subjects: z
      .array(z.object({ code: z.string().max(32), name: z.string().max(150) }))
      .max(100),
  })
  .strict();

export type BulkCatalog = z.infer<typeof bulkCatalog>;
