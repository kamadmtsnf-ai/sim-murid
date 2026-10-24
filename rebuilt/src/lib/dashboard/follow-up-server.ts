import "server-only";
import { createAuthAdmin } from "@/lib/auth/admin";
import { readDailyOverview } from "./server";
import { projectFollowUp } from "./follow-up";
export async function readFollowUp(
  ...args: Parameters<typeof readDailyOverview>
) {
  const overview = await readDailyOverview(...args);
  let plans: unknown;
  if (
    overview.contextReady &&
    (overview.role === "admin" || overview.assignments.includes("school_head"))
  ) {
    try {
      const r = await createAuthAdmin()
        .rpc("app_services_read", {
          p_actor: args[1].principal.id,
          p_session: args[1].sessionId,
          p_module: "surveys",
          p_filters: {},
        })
        .abortSignal(AbortSignal.timeout(6000));
      if (!r.error) plans = r.data;
    } catch {
      /* Preserve source failure without exposing private diagnostics. */
    }
  }
  return projectFollowUp(overview, plans);
}
