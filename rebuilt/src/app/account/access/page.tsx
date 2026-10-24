import { securityState } from "@/lib/auth/security";
import { redirect } from "next/navigation";
import { verifiedPrincipal } from "@/lib/auth/http";
import { readServerAuthClient } from "@/lib/auth/read-server";
import { loadOwnAccess } from "@/lib/auth/access-page";
import { accessViewKey } from "@/lib/auth/access-view";
import { AccessPanel } from "./access-panel";
export const dynamic = "force-dynamic";
export default async function AccessPage() {
  const client = await readServerAuthClient(),
    caller = await verifiedPrincipal(client);
  if (!caller) redirect("/login?expired=1");
  const gate = await securityState(caller.principal.id, caller.sessionId);
  if (!gate) redirect("/login?expired=1");
  if (gate.gate !== "ready") redirect("/account/security");
  const data = await loadOwnAccess(client, caller.principal.id);
  if (!data) redirect("/login?expired=1");
  return <AccessPanel key={accessViewKey(data)} initialData={data} />;
}
