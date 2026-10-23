import { z } from "zod";
import { snapshot } from "./validation.ts";
const count = z.number().int().nonnegative().safe();
export const reconciliationSnapshot = snapshot
  .extend({
    module: z.literal("reconciliation"),
    revision: count,
    isAdmin: z.literal(true),
    today: z.iso.date(),
    month: z.iso.date().refine((s) => s.endsWith("-01")),
    classes: z.array(
      z.object({ id: z.uuid(), name: z.string() }).passthrough(),
    ),
    extra: z
      .object({
        tables: count,
        savingsBalance: z.number().int().safe(),
        reportSnapshots: count,
        pointSnapshots: count,
        submittedSurveys: count,
        sourceAvailable: z.boolean(),
      })
      .passthrough(),
  })
  .refine(
    (s) => new Set(s.classes.map((c) => c.id)).size === s.classes.length,
    "Duplicate classes",
  );
export type ReconciliationSnapshot = z.infer<typeof reconciliationSnapshot>;
export const reconciliationMetrics = [
  ["tables", "Tabel aplikasi"],
  ["savingsBalance", "Saldo tabungan"],
  ["reportSnapshots", "Arsip rapor"],
  ["pointSnapshots", "Arsip poin siswa"],
  ["submittedSurveys", "Survei terkirim"],
] as const;
export const exportDomains = z.enum([
  "attendance",
  "mentoring",
  "fees",
  "savings",
  "discipline",
  "reports",
  "survey-results",
]);
export const packageDefaults = "attendance,mentoring,fees,savings,discipline";
const date = z.iso
  .date()
  .refine(
    (v) => v >= "2000-01-01" && v <= "2100-12-31",
    "Tanggal di luar rentang.",
  );
export const packageQuery = z
  .object({
    domains: z
      .string()
      .default(packageDefaults)
      .transform((v) => v.split(","))
      .pipe(z.array(exportDomains).min(1).max(7))
      .refine((v) => new Set(v).size === v.length, "Modul ekspor duplikat."),
    start: date.optional(),
    end: date.optional(),
    month: date
      .refine((v) => v.endsWith("-01"), "Bulan SPK harus dimulai tanggal 1.")
      .optional(),
    classId: z.uuid().optional(),
    studentId: z.uuid().optional(),
    semester: z.coerce.number().int().min(1).max(2).optional(),
    periodId: z.uuid().optional(),
  })
  .strict()
  .refine(
    (v) => !v.start || !v.end || v.start <= v.end,
    "Tanggal akhir harus sama atau setelah tanggal awal.",
  )
  .refine(
    (v) => !v.domains.includes("reports") || Boolean(v.classId),
    "Pilih kelas untuk ekspor rapor.",
  )
  .refine(
    (v) => !v.domains.includes("survey-results") || Boolean(v.periodId),
    "Pilih periode survei.",
  );
