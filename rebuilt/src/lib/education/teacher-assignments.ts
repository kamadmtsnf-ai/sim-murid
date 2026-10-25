import { z } from "zod";
export const teacherTasks = {
  school_head: "Kepala Madrasah",
  committee_treasurer: "Bendahara Komite",
  savings_manager: "Pengelola Tabungan",
  student_mentor: "Guru Wali",
  counselor: "Guru BK",
} as const;
const day = z.iso.date().refine((v) => v >= "1900-01-01" && v <= "2199-12-31");
export const assignmentCommand = z.discriminatedUnion("action", [
  z
    .object({
      requestId: z.uuid(),
      action: z.literal("assign"),
      code: z.enum(
        Object.keys(teacherTasks) as [
          keyof typeof teacherTasks,
          ...(keyof typeof teacherTasks)[],
        ],
      ),
      validFrom: day,
      validUntil: day.nullable(),
    })
    .strict()
    .refine((v) => !v.validUntil || v.validUntil >= v.validFrom, {
      message: "Tanggal akhir harus sesudah atau sama dengan tanggal mulai.",
    }),
  z
    .object({
      requestId: z.uuid(),
      action: z.literal("revoke"),
      id: z.uuid(),
      reason: z.string().trim().min(5).max(500),
    })
    .strict(),
]);
export const assignmentRows = z.array(
  z.object({
    id: z.uuid(),
    code: z.string(),
    valid_from: z.iso.date(),
    valid_until: z.iso.date().nullable(),
    revoked_at: z.string().nullable(),
  }),
);
