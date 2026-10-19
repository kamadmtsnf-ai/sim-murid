import "server-only";
import { cookies } from "next/headers";
import { createServerClient } from "@supabase/ssr";
import { getSupabasePublicEnvironment } from "@/lib/supabase/environment";
import { verifiedPrincipal } from "@/lib/auth/http";

export async function readServerPrincipal() {
  const jar = await cookies();
  const { url, publishableKey } = getSupabasePublicEnvironment();
  const client = createServerClient(url, publishableKey, { cookies: {
    getAll: () => jar.getAll(), setAll: () => { /* Proxy persists refresh cookies. */ },
  } });
  return verifiedPrincipal(client);
}
