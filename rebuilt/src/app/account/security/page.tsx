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
  return (
    <SecurityPanel
      key={JSON.stringify(state)}
      username={principal.principal.username}
      initialState={state}
    />
  );
}
