import { z } from "zod";

export const loginSchema = z.object({
  // Exact text identity: no numeric conversion, case folding or trimming.
  username: z.string().min(1).max(100).refine((s) => s === s.trim() && !/[\u0000-\u001f\u007f]/u.test(s)),
  password: z.string().min(1).max(1024),
  remember: z.boolean(),
}).strict();

export const loginRequestSchema = loginSchema.extend({
  captchaToken: z.string().min(1).max(4096).refine(v => v === v.trim()).optional(),
});

export const principalSchema = z.object({
  id: z.uuid(), username: z.string(), full_name: z.string(),
  expires_at: z.string(), must_change_password: z.boolean(),
  is_admin: z.boolean().default(false),
});

/** Only called after Auth has verified this exact access token. Never authorization by itself. */
export function verifiedTokenSession(accessToken: string, userId: string): string {
  const payload: unknown = JSON.parse(Buffer.from(accessToken.split(".")[1] ?? "", "base64url").toString());
  return z.object({ sub: z.literal(userId), session_id: z.uuid() }).parse(payload).session_id;
}
