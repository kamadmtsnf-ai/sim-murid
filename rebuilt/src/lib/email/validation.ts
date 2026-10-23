import { z } from "zod";
import { loginSchema } from "../auth/validation.ts";
export const emailCommand = z.discriminatedUnion("action", [
  z.object({ action: z.literal("send") }).strict(),
  z
    .object({
      action: z.literal("verify"),
      challengeId: z.uuid(),
      code: z.string().regex(/^\d{6}$/),
    })
    .strict(),
]);
export const emailStateSchema = z.object({
  email: z.string(),
  verified: z.boolean(),
  sent_today: z.number().int().nonnegative(),
  challenge: z
    .object({
      id: z.uuid(),
      expires_at: z.iso.datetime({ offset: true }),
      retry_at: z.iso.datetime({ offset: true }),
      status: z.enum([
        "pending",
        "verified",
        "expired",
        "superseded",
        "locked",
      ]),
      delivery_state: z.enum(["queued", "accepted", "failed"]),
      attempts_remaining: z.number().int().min(0).max(5),
    })
    .nullable(),
});
export type EmailState = z.infer<typeof emailStateSchema>;
export function emailTiming(state: EmailState, now: number, retryUntil = 0) {
  return {
    remaining: Math.max(
      0,
      Math.ceil(
        (Math.max(
          state.challenge ? Date.parse(state.challenge.retry_at) : 0,
          retryUntil,
        ) -
          now) /
          1000,
      ),
    ),
    expired: !!state.challenge && now >= Date.parse(state.challenge.expires_at),
    canVerify:
      !state.verified &&
      !!state.challenge &&
      state.challenge.status === "pending" &&
      state.challenge.delivery_state === "accepted" &&
      state.challenge.attempts_remaining > 0 &&
      now < Date.parse(state.challenge.expires_at),
  };
}
export const recoveryEmailRequest = z
  .object({ action: z.literal("send"), username: loginSchema.shape.username })
  .strict();
export const recoveryEmailReset = z
  .object({
    action: z.literal("reset"),
    username: loginSchema.shape.username,
    challengeId: z.uuid(),
    code: z.string().regex(/^\d{6}$/),
    newPassword: z.string().max(72),
    confirmPassword: z.string().max(1024),
  })
  .strict();
