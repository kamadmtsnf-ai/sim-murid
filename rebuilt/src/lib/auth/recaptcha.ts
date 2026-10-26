import "server-only";
import { z } from "zod";

export type RecaptchaConfig =
  | { mode: "disabled" }
  | { mode: "unavailable" }
  | { mode: "enabled"; siteKey: string; secret: string; hostnames: string[] };
export type PublicRecaptcha =
  | { mode: "disabled" | "unavailable" }
  | { mode: "enabled"; siteKey: string };

/** Explicit activation avoids locking out an installation before its keys exist. */
export function recaptchaConfig(env: NodeJS.ProcessEnv = process.env): RecaptchaConfig {
  const flag = env.RECAPTCHA_ENABLED?.trim();
  if (!flag || flag === "false") return { mode: "disabled" };
  if (flag !== "true") return { mode: "unavailable" };
  const siteKey = env.RECAPTCHA_SITE_KEY?.trim() ?? "";
  const secret = env.RECAPTCHA_SECRET_KEY?.trim() ?? "";
  const hostnames = (env.RECAPTCHA_ALLOWED_HOSTNAMES ?? "").split(",").map(v => v.trim().toLowerCase()).filter(Boolean);
  const key = /^[A-Za-z0-9_-]{20,256}$/;
  const hostname = /^(?=.{1,253}$)[a-z0-9]+(?:[.-][a-z0-9]+)*$/;
  if (!key.test(siteKey) || !key.test(secret) || !hostnames.length || hostnames.some(h => !hostname.test(h))) return { mode: "unavailable" };
  // Google's documented test keys always pass and must never protect production.
  if (env.NODE_ENV === "production" && (siteKey === "6LeIxAcTAAAAAJcZVRqyHh71UMIEGNQ_MXjiZKhI" || secret === "6LeIxAcTAAAAAGG-vFI1TnRWxMZNFuojJ4WifJWe")) return { mode: "unavailable" };
  return { mode: "enabled", siteKey, secret, hostnames: [...new Set(hostnames)] };
}
export function publicRecaptcha(config = recaptchaConfig()): PublicRecaptcha {
  return config.mode === "enabled" ? { mode: "enabled", siteKey: config.siteKey } : { mode: config.mode };
}
const verification = z.object({
  success: z.boolean(),
  hostname: z.string().optional(),
  // A v3 response needs separate score/action policy; never accept it as v2.
  score: z.never().optional(),
  action: z.never().optional(),
  "error-codes": z.array(z.string()).optional(),
});
/** No username, password or explicit client IP is sent to Google. */
export async function verifyRecaptcha(token: string, config: Extract<RecaptchaConfig, {mode: "enabled"}>, signal?: AbortSignal): Promise<"verified" | "rejected" | "unavailable"> {
  try {
    const response = await fetch("https://www.google.com/recaptcha/api/siteverify", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({ secret: config.secret, response: token }),
      cache: "no-store",
      redirect: "error",
      signal: signal ? AbortSignal.any([signal, AbortSignal.timeout(5000)]) : AbortSignal.timeout(5000),
    });
    if (!response.ok) return "unavailable";
    const raw = await response.text();
    if (raw.length > 16384) return "unavailable";
    const result = verification.parse(JSON.parse(raw));
    if (result["error-codes"]?.some(code => ["missing-input-secret", "invalid-input-secret", "bad-request"].includes(code))) return "unavailable";
    if (!result.success) return "rejected";
    return result.hostname && config.hostnames.includes(result.hostname.toLowerCase()) ? "verified" : "rejected";
  } catch {
    return "unavailable";
  }
}
