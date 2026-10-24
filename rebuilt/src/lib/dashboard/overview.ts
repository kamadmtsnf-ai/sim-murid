import { z } from "zod";
export const overviewSources = [
  "notifications",
  "schedule",
  "duty",
  "attendance",
  "mentoring",
  "fees",
  "savings",
  "jobs",
] as const;
export type OverviewSource = (typeof overviewSources)[number];
const count = z.number().int().nonnegative().safe();
const metric = z
  .object({
    id: z.enum(overviewSources),
    label: z.string().max(150),
    module: z.string().max(100),
    period: z.string().max(150),
    state: z.enum(["ready", "unavailable", "denied"]),
    value: count.nullable(),
    format: z.enum(["count", "currency", "text"]),
    display: z.string().max(100).optional(),
    detail: z.string().max(500),
  })
  .strict();
export const overviewSchema = z
  .object({
    subject: z.uuid(),
    today: z.iso.date(),
    loadedAt: z.iso.datetime(),
    role: z
      .enum([
        "admin",
        "teacher",
        "student",
        "parent",
        "alumni",
        "customer",
        "applicant",
      ])
      .nullable(),
    assignments: z.array(z.string().max(80)).max(20),
    contextReady: z.boolean(),
    metrics: z.array(metric).max(8),
    tasks: z
      .array(
        z
          .object({
            id: z.enum(overviewSources),
            priority: z.enum(["review", "today", "info"]),
            title: z.string().max(150),
            detail: z.string().max(500),
            module: z.string().max(100),
          })
          .strict(),
      )
      .max(8),
    agenda: z
      .array(
        z
          .object({
            subject: z.string().max(200),
            className: z.string().max(200),
            start: count.max(1439),
            end: count.max(1439),
          })
          .strict(),
      )
      .max(5),
    agendaCount: count,
    calendar: z.enum(["normal", "holiday", "unknown"]),
  })
  .strict()
  .superRefine((s, c) => {
    if (
      new Set(s.metrics.map((m) => m.id)).size !== s.metrics.length ||
      new Set(s.tasks.map((t) => t.id)).size !== s.tasks.length ||
      s.tasks.some(
        (t) => !s.metrics.some((m) => m.id === t.id && m.state === "ready"),
      ) ||
      s.metrics.some(
        (m) =>
          m.state !== "ready" && (m.value !== null || m.display !== undefined),
      ) ||
      s.agendaCount < s.agenda.length ||
      s.agenda.some((a) => a.end <= a.start) ||
      (!s.contextReady &&
        (s.role !== null ||
          s.metrics.length ||
          s.tasks.length ||
          s.agenda.length)) ||
      (s.calendar === "holiday" && s.agenda.length)
    )
      c.addIssue({ code: "custom", message: "Ringkasan tidak konsisten." });
  });
export type Overview = z.infer<typeof overviewSchema>;
export type OverviewMetric = Overview["metrics"][number];
export type OverviewTask = Overview["tasks"][number];
export const overviewRoleLabels: Record<string, string> = {
  admin: "Administrator",
  teacher: "Guru",
  student: "Siswa",
  parent: "Orang tua",
  alumni: "Alumni",
  customer: "Nasabah",
  applicant: "Calon siswa",
};
export const overviewAssignmentLabels: Record<string, string> = {
  school_head: "Kepala madrasah",
  homeroom_teacher: "Wali kelas",
  duty_teacher: "Guru piket",
  student_mentor: "Guru Wali",
  committee_treasurer: "Bendahara komite",
  savings_manager: "Pengelola tabungan",
};
export function overviewDay(now: Date) {
  const parts = new Intl.DateTimeFormat("en-CA", {
      timeZone: "Asia/Jakarta",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      hourCycle: "h23",
    }).formatToParts(now),
    p = Object.fromEntries(parts.map((x) => [x.type, x.value]));
  const today = `${p.year}-${p.month}-${p.day}`,
    weekday = new Date(today + "T00:00:00Z").getUTCDay() || 7;
  return {
    today,
    weekday,
    minute: Number(p.hour) * 60 + Number(p.minute),
    year: Number(p.year),
    month: today.slice(0, 7) + "-01",
  };
}
