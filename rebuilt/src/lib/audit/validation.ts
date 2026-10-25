import { z } from "zod";
import {
  auditDomains,
  domainLabels,
  nestedKeys,
  idKeys,
  numberKeys,
  dateKeys,
  enumKeys,
  enumValues,
} from "./policy";
export { domainLabels, finalizationMatrix } from "./policy";
export const domains = z.enum(auditDomains);
const cursor = z
  .object({ at: z.iso.datetime({ offset: true }), id: z.uuid() })
  .strict();
export const auditQuery = z
  .object({
    domain: domains.optional(),
    before: z.iso.datetime({ offset: true }).optional(),
    beforeId: z.uuid().optional(),
  })
  .strict()
  .refine(
    (v) => Boolean(v.before) === Boolean(v.beforeId),
    "Kursor tidak lengkap.",
  );
function projected(value: unknown, depth = 0): boolean {
  if (depth > 6 || !value || typeof value !== "object") return false;
  if (Array.isArray(value))
    return value.length <= 500 && value.every((v) => projected(v, depth + 1));
  return Object.entries(value).every(([k, v]) => {
    if (nestedKeys.includes(k)) return projected(v, depth + 1);
    if (idKeys.includes(k)) return v === null || z.uuid().safeParse(v).success;
    if (["studentIds", "lessonIds", "dutyIds"].includes(k))
      return (
        Array.isArray(v) &&
        v.length <= 500 &&
        v.every((x) => z.uuid().safeParse(x).success)
      );
    if (numberKeys.includes(k))
      return (
        v === null ||
        typeof v === "boolean" ||
        (typeof v === "number" && Number.isFinite(v))
      );
    if (dateKeys.includes(k)) return z.iso.date().safeParse(v).success;
    if (enumKeys.includes(k))
      return typeof v === "string" && enumValues.includes(v);
    return k === "reasonProvided" && typeof v === "boolean";
  });
}
export const auditEntry = z
  .object({
    id: z.uuid(),
    at: z.iso.datetime({ offset: true }),
    actorId: z.uuid().nullable(),
    actorLabel: z.string().max(200).nullable().default(null),
    actorKind: z.enum(["user", "system", "migration"]),
    action: z.string().min(1).max(120),
    entityType: z.string().max(100).nullable(),
    entityId: z.uuid().nullable(),
    requestId: z.uuid(),
    metadata: z
      .record(z.string(), z.json())
      .refine(projected, "Field riwayat tidak diizinkan."),
  })
  .strict()
  .refine((v) => (v.actorKind === "user") === (v.actorId !== null));
export const auditSnapshot = z
  .object({
    version: z.literal(1),
    domain: domains.nullable(),
    rows: z.array(auditEntry).max(25),
    next: cursor.nullable(),
  })
  .strict()
  .superRefine((v, c) => {
    if (new Set(v.rows.map((r) => r.id)).size !== v.rows.length)
      c.addIssue({ code: "custom", message: "Duplikasi riwayat." });
    const tail = v.rows.at(-1);
    if (
      v.next &&
      (v.rows.length !== 25 ||
        !tail ||
        v.next.id !== tail.id ||
        v.next.at !== tail.at)
    )
      c.addIssue({ code: "custom", message: "Kursor berbeda." });
    if (v.domain && v.rows.some((r) => r.action.split(".")[0] !== v.domain))
      c.addIssue({ code: "custom", message: "Cakupan berbeda." });
  });
export type AuditSnapshot = z.infer<typeof auditSnapshot>;
export type AuditEntry = z.infer<typeof auditEntry>;
const labels: Record<string, string> = {
  value: "Nilai",
  status: "Status",
  id: "ID",
  classId: "Kelas",
  class_id: "Kelas",
  subjectId: "Mata pelajaran",
  subject_id: "Mata pelajaran",
  studentId: "Siswa",
  student_id: "Siswa",
  date: "Tanggal",
  assessment_date: "Tanggal penilaian",
  semester: "Semester",
  kind: "Jenis",
  type: "Tindakan",
  kkm_snapshot: "KKM saat penilaian",
  ph_number: "Nomor PH",
  amount: "Nominal",
  balance_before: "Saldo awal",
  balance_after: "Saldo akhir",
  sourceYearId: "ID tahun asal",
  targetYearId: "ID tahun tujuan",
  expectedClassId: "Kelas asal",
  academic_year_id: "ID tahun ajaran",
  assessment_id: "ID penilaian",
  voided: "Dibatalkan",
  previous_role: "Peran sebelumnya",
  new_role: "Peran berikutnya",
};
export function auditValues(value: unknown) {
  if (!value || typeof value !== "object" || Array.isArray(value)) return [];
  return Object.entries(value).flatMap(([k, v]) =>
    labels[k] &&
    (v === null || ["string", "number", "boolean"].includes(typeof v))
      ? [{ field: labels[k]!, value: v === null ? "—" : String(v) }]
      : [],
  );
}
export function auditAction(action: string) {
  const [domain = "", verb = ""] = action.split(".");
  const verbs: Record<string, string> = {
    batch: "Simpan data",
    kkm: "Perbarui KKM",
    void: "Pembatalan",
    publish: "Terbitkan",
    promote: "Proses kenaikan",
    place: "Penempatan manual",
    submit: "Kirim",
    save: "Simpan",
    start: "Mulai",
    peer_submit: "Kirim penilaian peer",
    transaction: "Transaksi",
    access: "Perbarui akses",
    diploma: "Perbarui data ijazah",
    payment: "Simpan pembayaran",
    report: "Simpan bimbingan",
    edit: "Koreksi",
    confirm: "Konfirmasi",
    unconfirm: "Batalkan konfirmasi",
    cancel: "Pembatalan",
    assign: "Perbarui penugasan",
    roster: "Perbarui jadwal piket",
    primary: "Tetapkan piket",
    appoint: "Tetapkan pengganti",
  };
  return `${domainLabels[domain as keyof typeof domainLabels] ?? "Aktivitas"} · ${verbs[verb] ?? "Perubahan tercatat"}`;
}
