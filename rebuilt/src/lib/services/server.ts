import { reconciliationSnapshot } from "./reconciliation";
import { jobsSnapshot } from "./jobs";
import { parseGmailEnvironment } from "@/lib/email/gmail-config";
import "server-only";
import { surveysSnapshot } from "./surveys";
import { parseDiscipline } from "./discipline";
import { createAuthAdmin } from "@/lib/auth/admin";
import { AccessDenied } from "@/lib/auth/authorization";
import { filters, snapshot, type ServiceModule } from "./validation";
import type { Json } from "@/lib/supabase/cloud.types";
export async function servicesData(
  actor: string,
  session: string,
  module: ServiceModule,
  input: unknown = {},
) {
  const f = filters.parse(input),
    r = await createAuthAdmin().rpc("app_services_read", {
      p_actor: actor,
      p_session: session,
      p_module: module,
      p_filters: f as Json,
    });
  if (r.error) throw new Error("Unavailable");
  if (!r.data) throw new AccessDenied();
  if (module === "discipline") {
    try {
      const data = parseDiscipline(r.data);
      if (f.month && data.month !== f.month)
        throw Error("Unexpected discipline month");
      let catalog = data;
      if (f.classId || f.studentId) {
        const full = await createAuthAdmin().rpc("app_services_read", {
          p_actor: actor,
          p_session: session,
          p_module: module,
          p_filters: { month: data.month },
        });
        if (full.error || !full.data)
          throw Error("Recording catalog unavailable");
        catalog = parseDiscipline(full.data);
        if (catalog.revision !== data.revision || catalog.month !== data.month)
          throw Error("Recording catalog changed");
      }
      data.extra.recordingStudents = catalog.rows.map(
        ({ student_id, name, class_id, class_name }) => ({
          student_id,
          name,
          class_id,
          class_name,
        }),
      );
      return data;
    } catch {
      throw Error("Discipline unavailable");
    }
  }
  if (module === "surveys") {
    try {
      const data = surveysSnapshot.parse(r.data);
      if (data.rows.some((p) => p.response && p.response.user_id !== actor))
        throw Error("Wrong respondent");
      if (data.isManager) {
        const role = await createAuthAdmin()
          .from("user_roles")
          .select("role_code")
          .eq("user_id", actor)
          .maybeSingle();
        if (role.error || !role.data) throw Error("Survey role unavailable");
        data.extra.respondentRole = role.data.role_code;
      }
      return data;
    } catch {
      throw Error("Surveys unavailable");
    }
  }
  const raw = snapshot.safeParse(r.data);
  if ((module === "jobs" || module === "reconciliation") && !raw.success)
    throw Error("Jobs unavailable");
  const parsed = raw.success ? raw.data : snapshot.parse(r.data);
  if (module === "insights") {
    const catalog = await createAuthAdmin().rpc("app_services_read", {
      p_actor: actor,
      p_session: session,
      p_module: "surveys",
      p_filters: {},
    });
    if (catalog.error || !catalog.data)
      throw Error("Survey catalog unavailable");
    const periods = surveysSnapshot.parse(catalog.data);
    if (periods.revision !== parsed.revision)
      throw Error("Survey catalog changed");
    parsed.rows = periods.rows.map((p) => ({
      id: p.id,
      title: p.title,
      kind: p.kind,
      status: p.status,
      start: p.starts_on,
      end: p.ends_on,
      academic_year_id: p.academic_year_id,
      semester: p.semester,
    }));
    if (f.periodId && !parsed.rows.some((p) => p.id === f.periodId))
      throw new AccessDenied();
    parsed.extra.appliedFilters = f;
  }
  if (module === "reconciliation") {
    const state = reconciliationSnapshot.safeParse(parsed);
    if (!state.success) throw Error("Reconciliation unavailable");
    return state.data;
  }
  if (module === "jobs") {
    let gmail = false;
    try {
      parseGmailEnvironment(process.env);
      gmail = true;
    } catch {
      /* Configuration availability only; no secrets returned. */
    }
    let whatsapp = false;
    try {
      const u = new URL(process.env.WHATSAPP_API_URL ?? "");
      whatsapp =
        u.protocol === "https:" &&
        !u.username &&
        !u.password &&
        Boolean(process.env.WHATSAPP_API_KEY);
    } catch {}
    parsed.extra.providers = {
      gmail,
      whatsapp,
      scheduledDispatch: process.env.SERVICES_DISPATCH_ENABLED === "true",
    };
    const jobs = jobsSnapshot.safeParse(parsed);
    if (!jobs.success) throw Error("Jobs unavailable");
    return jobs.data;
  }
  return parsed;
}
