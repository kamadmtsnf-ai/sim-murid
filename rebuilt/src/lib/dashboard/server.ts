import "server-only";
import { accessSchema } from "@/lib/auth/access-validation";
import { loadAccessContext } from "@/lib/auth/authorization";
import { createAuthAdmin } from "@/lib/auth/admin";
import type { requestAuth, verifiedPrincipal } from "@/lib/auth/http";
import { overviewSchema, overviewDay, type OverviewSource } from "./overview";
import { overviewPlan } from "./plan";
import { projectOverview, type SourceResult } from "./projections";
type Caller = NonNullable<Awaited<ReturnType<typeof verifiedPrincipal>>>;
/** No cross-account cache; the signed user context selects calls and every RPC enforces its row scope again. */
export async function readDailyOverview(
  client: ReturnType<typeof requestAuth>,
  caller: Caller,
  now = new Date(),
) {
  const day = overviewDay(now),
    base = {
      subject: caller.principal.id,
      today: day.today,
      loadedAt: now.toISOString(),
      role: null,
      assignments: [],
      contextReady: false,
      metrics: [],
      tasks: [],
      agenda: [],
      agendaCount: 0,
      calendar: "unknown" as const,
    };
  let access;
  try {
    access = accessSchema.parse(
      await loadAccessContext(client, AbortSignal.timeout(6000)),
    );
    if (
      access.user_id !== caller.principal.id ||
      ![
        "admin",
        "teacher",
        "student",
        "parent",
        "alumni",
        "customer",
        "applicant",
      ].includes(access.role) ||
      (access.role === "admin") !== caller.principal.is_admin
    )
      throw Error("Context mismatch");
  } catch {
    return overviewSchema.parse(base);
  }
  const api = createAuthAdmin(),
    daily = { year: day.year, start: day.today, end: day.today, page: 1 };
  const read = async (id: OverviewSource): Promise<SourceResult> => {
    try {
      const signal = AbortSignal.timeout(6000);
      const result =
        id === "schedule"
          ? await api
              .rpc("app_schedules_read", {
                p_actor: caller.principal.id,
                p_session: caller.sessionId,
                p_weekday: day.weekday,
                p_personal:
                  access.role === "teacher" &&
                  !access.assignments.some((t) => t.code === "school_head"),
              })
              .abortSignal(signal)
          : id === "notifications" || id === "jobs"
            ? await api
                .rpc("app_services_read", {
                  p_actor: caller.principal.id,
                  p_session: caller.sessionId,
                  p_module: id,
                  p_filters: {},
                })
                .abortSignal(signal)
            : await api
                .rpc("app_operations_read", {
                  p_actor: caller.principal.id,
                  p_session: caller.sessionId,
                  p_module: id,
                  p_filters: daily,
                })
                .abortSignal(signal);
      if (result.error) return { id, state: "unavailable" };
      if (result.data === null) return { id, state: "denied" };
      return { id, data: result.data };
    } catch {
      return { id, state: "unavailable" };
    }
  };
  const results = await Promise.all(overviewPlan(access).map(read));
  return overviewSchema.parse({
    ...base,
    role: access.role,
    assignments: [...new Set(access.assignments.map((t) => t.code))].slice(
      0,
      20,
    ),
    contextReady: true,
    ...projectOverview(access, results, now),
  });
}
