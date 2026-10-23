import { z } from "zod";
import { snapshot } from "./validation.ts";
export const surveyAnswers = z.record(
  z.string().max(80),
  z.union([z.string().max(10000), z.number().int().min(1).max(5)]),
);
export const peerAnswers = z.record(
  z.uuid(),
  z.record(
    z.string().regex(/^PTS-[1-7]$/),
    z.union([z.string().max(10000), z.number().int().min(1).max(5)]),
  ),
);
export const surveyQuestion = z
  .object({
    code: z.string().min(1).max(80),
    question: z.string(),
    kind: z.enum(["likert", "essay"]),
    required: z.boolean(),
    section: z.string(),
    aspect: z.string(),
  })
  .passthrough();
export const surveyResponse = z
  .object({
    period_id: z.uuid(),
    user_id: z.uuid(),
    role: z.enum(["student", "teacher", "parent"]),
    revision: z.number().int().nonnegative(),
    instrument: z.array(surveyQuestion),
    answers: surveyAnswers,
    peer_answers: peerAnswers,
    peers: z.array(z.uuid()),
    submitted_at: z.string().nullable(),
    peer_submitted_at: z.string().nullable(),
  })
  .passthrough();
export const surveyPeriod = z
  .object({
    id: z.uuid(),
    title: z.string(),
    academic_year_id: z.uuid(),
    semester: z.number().int().min(1).max(2),
    starts_on: z.iso.date(),
    ends_on: z.iso.date(),
    status: z.enum(["open", "closed"]),
    kind: z.enum(["main", "micro"]),
    instrument_version: z.string(),
    response: surveyResponse.nullable(),
    plan: z.array(z.record(z.string(), z.unknown())).nullable(),
  })
  .passthrough();
export const surveysSnapshot = snapshot
  .extend({
    module: z.literal("surveys"),
    revision: z.number().int().nonnegative(),
    rows: z.array(surveyPeriod),
    extra: z
      .object({
        required: z.array(z.uuid()),
        peers: z.array(z.object({ id: z.uuid(), name: z.string() })),
      })
      .passthrough(),
  })
  .superRefine((s, c) => {
    if (new Set(s.rows.map((p) => p.id)).size !== s.rows.length)
      c.addIssue({ code: "custom", message: "Duplicate survey periods" });
    for (const p of s.rows) {
      if (p.response && p.response.period_id !== p.id)
        c.addIssue({ code: "custom", message: "Survey response mismatch" });
      if (
        p.response &&
        new Set(p.response.instrument.map((q) => q.code)).size !==
          p.response.instrument.length
      )
        c.addIssue({ code: "custom", message: "Duplicate question codes" });
    }
  });
export type SurveyResponse = z.infer<typeof surveyResponse>;
export type Answers = z.infer<typeof surveyAnswers>;
export type PeerAnswers = z.infer<typeof peerAnswers>;
export function validAnswers(
  instrument: z.infer<typeof surveyQuestion>[],
  answers: Answers,
) {
  return Object.entries(answers).every(([code, v]) => {
    const q = instrument.find((q) => q.code === code);
    return (
      q &&
      (q.kind === "essay"
        ? typeof v === "string" && v.length <= 10000
        : typeof v === "number" && Number.isInteger(v) && v >= 1 && v <= 5)
    );
  });
}
export function validPeers(peers: string[], answers: PeerAnswers) {
  return Object.entries(answers).every(
    ([id, values]) =>
      peers.includes(id) &&
      Object.entries(values).every(([k, v]) =>
        k === "PTS-7"
          ? typeof v === "string"
          : /^PTS-[1-6]$/.test(k) &&
            (v === "TT" ||
              (typeof v === "number" &&
                Number.isInteger(v) &&
                v >= 1 &&
                v <= 5)),
      ),
  );
}
export const localSurveyDraft = z.object({
  version: z.number().int().nonnegative(),
  answers: surveyAnswers,
  peerAnswers: peerAnswers.default({}),
  mainDirty: z.boolean().default(true),
  peerDirty: z.boolean().default(false),
});
