import "server-only";
import { randomUUID } from "node:crypto";
import { createAuthAdmin } from "@/lib/auth/admin";
/** Read-only status probe, with real verified session. Never performs preview/commit or stores a request. */
export async function bulkImportAvailable(actor: string, session: string) {
  try {
    const r = await createAuthAdmin()
      .rpc("app_bulk_input", {
        p_actor: actor,
        p_session: session,
        p_request: randomUUID(),
        p_action: "status",
      })
      .abortSignal(AbortSignal.timeout(1500));
    return (
      !r.error &&
      typeof r.data === "object" &&
      r.data !== null &&
      !Array.isArray(r.data) &&
      r.data.code === "not_found"
    );
  } catch {
    return false;
  }
}
