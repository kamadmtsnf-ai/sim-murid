import type { NextRequest } from "next/server";
import { privateJson, requestAuth, verifiedPrincipal } from "@/lib/auth/http";
import { securityState } from "@/lib/auth/security";
import { createAuthAdmin } from "@/lib/auth/admin";
import { readDailyOverview } from "@/lib/dashboard/server";
export const dynamic = "force-dynamic";
/** Read only. Actor, session and capabilities never come from query parameters. */
export async function GET(request: NextRequest) {
  const jar = privateJson({});
  const reply = (body: unknown, status = 200) => {
    const response = privateJson(body, status);
    jar.cookies.getAll().forEach((c) => response.cookies.set(c));
    return response;
  };
  if (request.nextUrl.search)
    return reply({ message: "Parameter ringkasan tidak valid." }, 400);
  try {
    const client = requestAuth(request, jar),
      caller = await verifiedPrincipal(client);
    if (!caller)
      return reply({ message: "Sesi berakhir. Masuk kembali." }, 401);
    const security = await securityState(caller.principal.id, caller.sessionId);
    if (security?.gate !== "ready")
      return reply(
        {
          message: "Lengkapi keamanan akun sebelum melanjutkan.",
          redirect: "/account/security",
        },
        403,
      );
    const survey = await createAuthAdmin()
      .rpc("app_survey_required", {
        p_actor: caller.principal.id,
        p_session: caller.sessionId,
      })
      .abortSignal(AbortSignal.timeout(6000));
    if (survey.error || typeof survey.data !== "boolean")
      throw Error("Gate unavailable");
    if (survey.data)
      return reply(
        {
          message: "Selesaikan survei wajib terlebih dahulu.",
          redirect: "/account/services/surveys",
        },
        403,
      );
    return reply({ overview: await readDailyOverview(client, caller) });
  } catch {
    return reply(
      { message: "Ringkasan belum dapat dimuat. Coba kembali." },
      503,
    );
  }
}
