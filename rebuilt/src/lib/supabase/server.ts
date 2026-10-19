import "server-only";
import { createServerClient, type CookieMethodsServer } from "@supabase/ssr";
import type { Database } from "@/lib/supabase/database.types";
import { getSupabasePublicEnvironment } from "@/lib/supabase/environment";

/** One client per request. Caller must propagate BOTH cookies and cache headers.
 * Cookie/Proxy wiring and verified identity checks belong to stage 5–6.
 * No service secret is used; this does not bypass RLS or authenticate a user.
 */
export function createRequestClient(cookies: Required<Pick<CookieMethodsServer, "getAll" | "setAll">>) {
  const { url, publishableKey } = getSupabasePublicEnvironment();
  return createServerClient<Database>(url, publishableKey, { cookies });
}
