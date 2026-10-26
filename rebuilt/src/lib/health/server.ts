import "server-only";
import { AccessDenied } from "@/lib/auth/authorization";
import { securityState } from "@/lib/auth/security";
import { servicesData } from "@/lib/services/server";
import { healthFromSources } from "./model";

/** Defense in depth: callers and ready gate are checked before operational reads. */
export async function readAdminHealth(caller: { principal: { id: string; is_admin: boolean }; sessionId: string }) {
  if (!caller.principal.is_admin) throw new AccessDenied();
  const state = await securityState(caller.principal.id, caller.sessionId);
  if (state?.gate !== "ready") throw new AccessDenied();
  const results = await Promise.allSettled([
    servicesData(caller.principal.id, caller.sessionId, "jobs", {}, AbortSignal.timeout(8000)),
    servicesData(caller.principal.id, caller.sessionId, "reconciliation", {}, AbortSignal.timeout(8000)),
  ]);
  // An explicit revocation/denial must not become a partial operational dashboard.
  if (results.some(r=>r.status==="rejected" && r.reason instanceof AccessDenied)) throw new AccessDenied();
  return healthFromSources(
    results[0].status === "fulfilled" ? results[0].value : null,
    results[1].status === "fulfilled" ? results[1].value : null,
    new Date().toISOString(),
  );
}
