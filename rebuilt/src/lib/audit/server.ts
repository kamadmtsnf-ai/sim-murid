import "server-only";
import { createAuthAdmin } from "@/lib/auth/admin";
import { AccessDenied } from "@/lib/auth/authorization";
import { auditQuery, auditSnapshot } from "./validation";
export async function auditHistory(
  actor: string,
  session: string,
  input: unknown = {},
  timeoutMs = 10000,
) {
  const q = auditQuery.parse(input);
  const r = await createAuthAdmin()
    .rpc("app_audit_read", {
      p_actor: actor,
      p_session: session,
      ...(q.domain ? { p_domain: q.domain } : {}),
      ...(q.before ? { p_before: q.before, p_before_id: q.beforeId! } : {}),
    })
    .abortSignal(AbortSignal.timeout(timeoutMs));
  if (r.error) throw Error("Audit unavailable");
  if (r.data === null) throw new AccessDenied();
  const parsed = auditSnapshot.safeParse(r.data);
  if (!parsed.success || parsed.data.domain !== (q.domain ?? null))
    throw Error("Audit acknowledgement invalid");
  return parsed.data;
}
export async function auditHistoryAvailable(actor: string, session: string) {
  try {
    await auditHistory(actor, session, { domain: "reports" }, 1500);
    return true;
  } catch {
    return false;
  }
}
