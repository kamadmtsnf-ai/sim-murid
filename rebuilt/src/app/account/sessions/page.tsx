import { securityState } from "@/lib/auth/security";
import { redirect } from "next/navigation";
import { readServerPrincipal } from "@/lib/auth/read-server";
import { SessionPanel } from "./session-panel";
export const dynamic = "force-dynamic";
export default async function SessionsPage() {
  const caller = await readServerPrincipal();
  if (!caller) redirect("/login?expired=1");
  const onboarding = await securityState(caller.principal.id, caller.sessionId);
  if (!onboarding) redirect("/login?expired=1");
  if (onboarding.gate !== "ready") redirect("/account/security");
  return (
    <SessionPanel
      key={`${caller.principal.id}:${caller.sessionId}:${caller.principal.is_admin}`}
      ownUsername={caller.principal.username}
      canManageOthers={caller.principal.is_admin}
    />
  );
}
