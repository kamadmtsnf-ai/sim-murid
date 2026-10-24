import { z } from "zod";
import { loginSchema } from "./validation.ts";

const target = loginSchema.shape.username.optional();
export const sessionCommand = z.union([
  z.object({ action: z.literal("list"), username: target }).strict(),
  z
    .object({
      action: z.literal("revoke"),
      username: target,
      scope: z.literal("one"),
      sessionId: z.uuid(),
    })
    .strict(),
  z
    .object({
      action: z.literal("revoke"),
      username: target,
      scope: z.literal("all"),
    })
    .strict(),
]);
export const sessionListSchema = z
  .object({
    username: z.string().min(1).max(100),
    serverTime: z.iso.datetime({ offset: true }).optional(),
    sessions: z
      .array(
        z.object({
          id: z.uuid(),
          device: z.string(),
          issued_at: z.iso.datetime({ offset: true }),
          expires_at: z.iso.datetime({ offset: true }),
          last_seen_at: z.iso.datetime({ offset: true }),
          remember: z.boolean(),
          current: z.boolean(),
          status: z.enum(["active", "expired", "revoked"]),
        }),
      )
      .max(20),
  })
  .refine(
    (value) =>
      new Set(value.sessions.map((s) => s.id)).size === value.sessions.length,
    "Duplicate session IDs",
  );
export type SessionList = z.infer<typeof sessionListSchema>;

export const sessionRevokeSchema = z.object({
  revoked: z.number().int().nonnegative(),
  signed_out: z.boolean(),
});
export function effectiveSessionStatus(
  session: SessionList["sessions"][number],
  now: number,
) {
  return session.status === "active" && Date.parse(session.expires_at) <= now
    ? "expired"
    : session.status;
}
