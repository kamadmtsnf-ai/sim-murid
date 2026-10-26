import { createAuthAdmin } from "@/lib/auth/admin";
import { emailStateSchema } from "@/lib/email/validation";
import { redirect } from "next/navigation";
import { readServerPrincipal } from "@/lib/auth/read-server";
import { securityState } from "@/lib/auth/security";
import { SecurityPanel } from "./security-panel";
export const dynamic = "force-dynamic";
export default async function SecurityPage() {
  const principal = await readServerPrincipal();
  if (!principal) redirect("/login?expired=1");
  const state = await securityState(
    principal.principal.id,
    principal.sessionId,
  );
  if (!state) redirect("/login?expired=1");
  let emailVerified: boolean | null = null;
  if (state.gate !== "password" && state.gate !== "account_pending") {
    try {
      const email = await createAuthAdmin().rpc("app_email_state", {p_user:principal.principal.id,p_session:principal.sessionId});
      const parsed = emailStateSchema.safeParse(email.data);
      if (!email.error && parsed.success) emailVerified = parsed.data.verified;
    } catch { /* Email availability must not prevent mandatory password/question work. */ }
  }
  return (
    <SecurityPanel
      key={JSON.stringify(state)}
      emailVerified={emailVerified}
      username={principal.principal.username}
      initialState={state}
    />
  );
}
