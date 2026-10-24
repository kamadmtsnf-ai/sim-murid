import { readDailyOverview } from "@/lib/dashboard/server";
import { securityState } from "@/lib/auth/security";
import { redirect } from "next/navigation";
import { readServerAuthClient } from "@/lib/auth/read-server";
import { verifiedPrincipal } from "@/lib/auth/http";
import { AccountDashboard } from "@/components/account-dashboard";

export const dynamic = "force-dynamic";
export default async function AccountPage() {
  let state;
  let onboarding;
  let client;
  try {
    client = await readServerAuthClient();
    state = await verifiedPrincipal(client);
    if (state)
      onboarding = await securityState(state.principal.id, state.sessionId);
  } catch {
    // Use the existing account error boundary and its retry action.
    throw new Error("Account verification unavailable");
  }
  if (!state) redirect("/login?expired=1");
  if (onboarding?.gate !== "ready") redirect("/account/security");
  const { createAuthAdmin } = await import("@/lib/auth/admin");
  const survey = await createAuthAdmin().rpc("app_survey_required", {
    p_actor: state.principal.id,
    p_session: state.sessionId,
  });
  if (survey.error || typeof survey.data !== "boolean")
    throw new Error("Survey access check unavailable");
  if (survey.data === true) redirect("/account/services/surveys");
  const overview = await readDailyOverview(client!, state);
  return (
    <AccountDashboard
      overview={overview}
      name={state.principal.full_name}
      expiresAt={state.principal.expires_at}
    />
  );
}
