import { z } from "zod";
import { learningSnapshot, learningFilters } from "./validation.ts";
import { semesterPeriod } from "../academic/period.ts";
const id = z.uuid(),
  score = z.number().min(0).max(100),
  semester = z.number().int().min(1).max(2);
export const gradeInputScore = score.multipleOf(0.01);
export const gradeFilters = z.preprocess(
  (v) =>
    typeof v === "object" && v !== null
      ? Object.fromEntries(
          Object.entries(v).filter(([, x]) => x !== "" && x !== undefined),
        )
      : v,
  z
    .object({
      classId: learningFilters.shape.classId,
      subjectId: learningFilters.shape.subjectId,
      studentId: learningFilters.shape.studentId,
      semester: learningFilters.shape.semester,
    })
    .strict(),
);
const person = z.object({
  id,
  username: z.string(),
  full_name: z.string(),
  role_code: z.string(),
  class_id: id.nullable(),
});
const assessment = z
  .object({
    id,
    class_id: id,
    subject_id: id,
    academic_year_id: id,
    semester,
    kind: z.enum(["PH", "ATS", "ASAS", "Praktik"]),
    ph_number: z.number().int().positive().nullable(),
    teacher_id: id,
    assessment_date: z.iso.date(),
    kkm_snapshot: score,
    kkm_fallback: z.boolean(),
    subject_name: z.string(),
    can_edit: z.boolean(),
    scores: z.array(
      z.object({
        student_id: id,
        name: z.string(),
        value: score.nullable(),
        notes: z.string(),
      }),
    ),
  })
  .passthrough();
export const gradesSnapshot = learningSnapshot
  .extend({
    module: z.literal("grades"),
    revision: z.number().int().nonnegative().safe(),
    today: z.iso.date(),
    semester,
    classes: z.array(
      z
        .object({
          id,
          name: z.string(),
          year: z.number().int().min(1900).max(2200),
          academic_year_id: id,
          archived_at: z.string().nullable().optional(),
        })
        .passthrough(),
    ),
    people: z.array(person),
    rows: z.array(assessment),
    extra: z
      .object({
        kkm: score.nullable(),
        subjects: z.array(z.object({ id, name: z.string() })),
        entryPeople: z.array(person).optional(),
        scope: z
          .object({
            classId: id.optional(),
            subjectId: id.optional(),
            studentId: id.optional(),
            semester,
          })
          .optional(),
      })
      .passthrough(),
  })
  .superRefine((s, ctx) => {
    if (
      new Set(s.rows.map((r) => r.id)).size !== s.rows.length ||
      s.rows.some(
        (r) =>
          r.semester !== s.semester ||
          (r.kind === "PH" ? r.ph_number === null : r.ph_number !== null) ||
          new Set(r.scores.map((x) => x.student_id)).size !== r.scores.length ||
          (() => {
            const c = s.classes.find((c) => c.id === r.class_id),
              p = c && semesterPeriod(c.year, r.semester);
            return (
              !c ||
              !p ||
              c.academic_year_id !== r.academic_year_id ||
              r.assessment_date < p.start ||
              r.assessment_date > p.end
            );
          })(),
      )
    )
      ctx.addIssue({
        code: "custom",
        message: "Data penilaian tidak konsisten.",
      });
  });
export type GradesSnapshot = z.infer<typeof gradesSnapshot>;
export type Assessment = GradesSnapshot["rows"][number];
export type EntryPerson = GradesSnapshot["people"][number];
export function gradeRoster(
  data: GradesSnapshot,
  row: Assessment | null = null,
): EntryPerson[] {
  const people = new Map<string, EntryPerson>();
  for (const p of data.extra.entryPeople ?? data.people) {
    if (["student", "alumni"].includes(p.role_code)) people.set(p.id, p);
  }
  for (const s of row?.scores ?? [])
    if (!people.has(s.student_id))
      people.set(s.student_id, {
        id: s.student_id,
        username: "",
        full_name: s.name,
        role_code: "student",
        class_id: row!.class_id,
      });
  return [...people.values()];
}
export const gradeDraft = (people: EntryPerson[], row: Assessment | null) =>
  Object.fromEntries(
    people.map((p) => {
      const s = row?.scores.find((s) => s.student_id === p.id);
      return [
        p.id,
        {
          value:
            s?.value === null || s?.value === undefined ? "" : String(s.value),
          notes: s?.notes ?? "",
        },
      ];
    }),
  );
