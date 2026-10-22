import { z } from "zod";
/** Public academic-year values are consecutive year pairs. start_year remains the stable storage key. */
export const academicYearInput = z
  .string()
  .trim()
  .regex(/^\d{4}\s*[/-]\s*\d{4}$/, "Gunakan tahun ajaran seperti 2026/2027.")
  .refine((value) => {
    const [start, end] = value.split(/[/-]/).map(Number);
    return (
      Number.isInteger(start) &&
      start! >= 1900 &&
      start! <= 2199 &&
      end === start! + 1
    );
  }, "Tahun ajaran harus berurutan, misalnya 2026/2027.")
  .transform((value) => value.split(/[/-]/).map(Number).join("/"));
export function academicYearStart(value: unknown): number | null {
  if (
    typeof value === "number" &&
    Number.isInteger(value) &&
    value >= 1900 &&
    value <= 2200
  )
    return value;
  if (typeof value === "string") {
    if (/^\d{4}$/.test(value)) return academicYearStart(Number(value));
    const parsed = academicYearInput.safeParse(value);
    if (parsed.success) return Number(parsed.data.slice(0, 4));
  }
  return null;
}
export function formatAcademicYear(value: unknown) {
  const start = academicYearStart(value);
  return start === null ? "—" : `${start}/${start + 1}`;
}
export function semesterLabel(value: unknown) {
  return Number(value) === 1 ? "Ganjil" : Number(value) === 2 ? "Genap" : "—";
}
export function semesterPeriod(value: unknown, semester: unknown) {
  const start = academicYearStart(value),
    number = Number(semester);
  if (start === null || ![1, 2].includes(number)) return null;
  return number === 1
    ? {
        start: `${start}-07-01`,
        end: `${start}-12-31`,
        label: `Ganjil · Juli–Desember ${start}`,
      }
    : {
        start: `${start + 1}-01-01`,
        end: `${start + 1}-06-30`,
        label: `Genap · Januari–Juni ${start + 1}`,
      };
}
export function academicPeriodForDate(value: string) {
  if (!z.iso.date().safeParse(value).success) return null;
  const year = Number(value.slice(0, 4)),
    month = Number(value.slice(5, 7));
  const start = month >= 7 ? year : year - 1;
  if (academicYearStart(start) === null) return null;
  return {
    academicYear: formatAcademicYear(start),
    startYear: start,
    semester: month >= 7 ? 1 : 2,
  };
}
export function defaultSemesterDate(
  year: unknown,
  semester: unknown,
  today: string,
) {
  const period = semesterPeriod(
    year ?? academicPeriodForDate(today)?.startYear,
    semester,
  );
  return period
    ? today >= period.start && today <= period.end
      ? today
      : period.start
    : "";
}
