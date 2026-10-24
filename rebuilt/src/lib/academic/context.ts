import { z } from "zod";
import { formatAcademicYear, semesterLabel } from "./period.ts";
/** A navigation preference, never an authorization claim or a write payload. */
export const academicSelection = z
  .object({
    version: z.literal(1),
    year: z.number().int().min(1900).max(2199),
    semester: z.union([z.literal(1), z.literal(2)]),
    classId: z.uuid().nullable(),
  })
  .strict();
export type AcademicSelection = z.infer<typeof academicSelection>;
export type AcademicCatalog = {
  years: readonly number[];
  classes: readonly { id: string; year: number; name: string }[];
};
export function academicStorageKey(username: string) {
  return "sim-academic:v1:" + encodeURIComponent(username);
}
export function parseAcademicSelection(raw: string | null) {
  if (!raw || raw.length > 2048) return null;
  try {
    const p = academicSelection.safeParse(JSON.parse(raw));
    return p.success ? p.data : null;
  } catch {
    return null;
  }
}
export function academicSelectionLabel(value: AcademicSelection) {
  return `${formatAcademicYear(value.year)} · ${semesterLabel(value.semester)}`;
}
export function academicSelectionIssue(
  value: AcademicSelection,
  catalog: AcademicCatalog,
  requiresClass = false,
) {
  if (!catalog.years.includes(value.year))
    return "Tahun ajaran tersimpan tidak tersedia pada halaman ini. Pilih ulang melalui filter halaman.";
  if (requiresClass && !value.classId)
    return "Pilihan tersimpan belum memuat kelas. Pilih kelas melalui filter halaman.";
  if (
    value.classId &&
    !catalog.classes.some(
      (c) => c.id === value.classId && c.year === value.year,
    )
  )
    return "Kelas tersimpan tidak tersedia atau tidak sesuai tahun ajaran. Pilih ulang melalui filter halaman; cakupan tidak diperluas otomatis.";
  return null;
}
