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
  const parsed = snapshot.parse(r.data);
  if (module === "jobs")
    parsed.extra.providers = {
      gmail: !!process.env.GMAIL_USER && !!process.env.GMAIL_APP_PASSWORD,
      whatsapp:
        !!process.env.WHATSAPP_API_URL && !!process.env.WHATSAPP_API_KEY,
      scheduledDispatch: process.env.SERVICES_DISPATCH_ENABLED === "true",
    };
  return parsed;
}
