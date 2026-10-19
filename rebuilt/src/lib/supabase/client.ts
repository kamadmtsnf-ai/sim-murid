"use client";

import { createBrowserClient } from "@supabase/ssr";
import type { Database } from "@/lib/supabase/database.types";
import { getSupabasePublicEnvironment } from "@/lib/supabase/environment";

/** Not invoked on foundation pages. RLS/grants remain closed at stage 4. */
export function createClient() {
  const { url, publishableKey } = getSupabasePublicEnvironment();
  return createBrowserClient<Database>(url, publishableKey);
}
