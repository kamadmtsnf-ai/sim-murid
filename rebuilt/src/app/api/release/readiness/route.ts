import type { NextRequest } from "next/server";
import { educationContext, failure } from "@/lib/education/server";
import { createAuthAdmin } from "@/lib/auth/admin";
import { getSupabasePublicEnvironment } from "@/lib/supabase/environment";
export const runtime = "nodejs";
/** Authenticated target metadata, not a claim about backups, capacity or full readiness. */
export async function GET(request: NextRequest) {
  const { caller, reply } = await educationContext(request);
  if (!caller) return reply({ message: "Silakan masuk." }, 401);
  try {
    const access = await createAuthAdmin()
      .rpc("app_education_admin", {
        p_actor: caller.principal.id,
        p_session: caller.sessionId,
      })
      .abortSignal(AbortSignal.timeout(5000));
    if (access.error) throw Error("Access unavailable");
    if (access.data !== true)
      return reply({ message: "Akses tidak diizinkan." }, 403);
    const host = new URL(getSupabasePublicEnvironment().url).hostname,
      projectRef = /^([a-z0-9]{20})\.supabase\.co$/.exec(host)?.[1] ?? null;
    const deployEnvironment = ["production", "preview", "development"].includes(
      process.env.VERCEL_ENV ?? "",
    )
      ? process.env.VERCEL_ENV
      : "unknown";
    return reply({
      scope: "configuration-only",
      deployEnvironment,
      projectRef,
    });
  } catch (error) {
    const e = failure(error);
    return reply({ message: e.message }, e.status);
  }
}
