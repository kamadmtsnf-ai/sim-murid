import { z } from "zod";
import { directoryQuery } from "./validation.ts";
export const directoryRoles = {
  teacher: "Guru",
  student: "Siswa",
  applicant: "Calon siswa",
  parent: "Orang tua",
  alumni: "Alumni",
};
export function directoryRoleLabel(role: string) {
  return (
    ({ admin: "Administrator", customer: "Nasabah" } as Record<string, string>)[
      role
    ] ??
    directoryRoles[role as keyof typeof directoryRoles] ??
    role
  );
}
export function directoryPageCount(data: { total: number; page_size: number }) {
  return Math.min(2000, Math.max(1, Math.ceil(data.total / data.page_size)));
}
export function directoryPageUrl(
  filter: z.infer<typeof directoryQuery>,
  page: number,
) {
  const input = directoryQuery.parse({ ...filter, page });
  return (
    "/account/directory?" +
    new URLSearchParams({
      role: input.role,
      query: input.query,
      status: input.status,
      page: String(input.page),
    }).toString()
  );
}
const dateFormatter = new Intl.DateTimeFormat("id-ID", {
  dateStyle: "medium",
  timeZone: "Asia/Jakarta",
});
export function directoryDate(value: string) {
  if (
    !(
      value.length === 10 ? z.iso.date() : z.iso.datetime({ offset: true })
    ).safeParse(value).success
  )
    return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : dateFormatter.format(date);
}
export function assignmentLabel(code: string) {
  const labels: Record<string, string> = {
    school_head: "Kepala madrasah",
    homeroom_teacher: "Wali kelas",
    duty_teacher: "Guru piket",
    student_mentor: "Pembimbing siswa",
    committee_treasurer: "Bendahara komite",
    savings_manager: "Pengelola tabungan",
  };
  return labels[code] ?? code.replaceAll("_", " ");
}
export const directoryDetailSchema = z.object({
  id: z.uuid(),
  username: z.string(),
  name: z.string(),
  role: z.string(),
  status: z.enum(["active", "inactive"]),
  contact: z
    .object({
      phone: z.string().nullable(),
      email: z.string().nullable(),
      bio: z.string(),
    })
    .nullable(),
  student: z.record(z.string(), z.unknown()).nullable(),
  children: z.array(
    z.object({
      id: z.uuid(),
      name: z.string(),
      username: z.string(),
      relationship: z.string(),
    }),
  ),
  siblings: z.array(
    z.object({ id: z.uuid(), name: z.string(), legacy_order: z.number() }),
  ),
  enrollments: z.array(
    z.object({
      id: z.uuid(),
      class_name: z.string(),
      year: z.number().int().min(1900).max(2200),
      starts_on: z.string(),
      ended_at: z.string().nullable(),
    }),
  ),
  assignments: z.array(
    z.object({
      code: z.string(),
      class_id: z.uuid().nullable(),
      valid_from: z.string(),
      valid_until: z.string().nullable(),
      revoked_at: z.string().nullable(),
    }),
  ),
  homerooms: z.array(z.object({ id: z.uuid(), name: z.string() })),
  lessons: z.array(
    z
      .object({
        id: z.uuid(),
        class_name: z.string(),
        subject: z.string(),
        weekday: z.number().int().min(1).max(7),
        start_minute: z.number().int().min(0).max(1439),
        end_minute: z.number().int().min(0).max(1439),
        jtm: z.number().int().positive(),
        break_minutes: z.number().int().nonnegative(),
      })
      .refine((lesson) => lesson.end_minute > lesson.start_minute),
  ),
});
export type DirectoryDetailData = z.infer<typeof directoryDetailSchema>;

const todayFormatter = new Intl.DateTimeFormat("sv-SE", {
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
  timeZone: "Asia/Jakarta",
});
export function directoryToday(now = new Date()) {
  return todayFormatter.format(now);
}
export function directoryAssignmentState(
  assignment: {
    valid_from: string;
    valid_until: string | null;
    revoked_at: string | null;
  },
  today: string,
) {
  if (assignment.revoked_at) return "Dicabut";
  if (
    !z.iso.date().safeParse(assignment.valid_from).success ||
    !z.iso.date().safeParse(today).success ||
    (assignment.valid_until !== null &&
      !z.iso.date().safeParse(assignment.valid_until).success)
  )
    return "Periode belum tersedia";
  if (assignment.valid_from > today) return "Belum berlaku";
  if (assignment.valid_until !== null && assignment.valid_until < today)
    return "Berakhir";
  return "Aktif";
}
