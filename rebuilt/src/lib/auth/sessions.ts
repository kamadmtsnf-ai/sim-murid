import { z } from "zod";
import { loginSchema } from "./validation.ts";

const target = loginSchema.shape.username.optional();
export const sessionCommand = z.union([
  z.object({ action: z.literal("list"), username: target }).strict(),
  z.object({ action: z.literal("revoke"), username: target, scope: z.literal("one"), sessionId: z.uuid() }).strict(),
  z.object({ action: z.literal("revoke"), username: target, scope: z.literal("all") }).strict(),
]);
export const sessionListSchema = z.object({ username: z.string(), sessions: z.array(z.object({
  id: z.uuid(), device: z.string(), issued_at: z.string(), expires_at: z.string(), last_seen_at: z.string(),
  remember: z.boolean(), current: z.boolean(), status: z.enum(["active", "expired", "revoked"]),
})).max(20) });
export type SessionList = z.infer<typeof sessionListSchema>;
