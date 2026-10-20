import "server-only";
import { createClient } from "@supabase/supabase-js";
import { getSupabasePublicEnvironment } from "@/lib/supabase/environment";
import type { Database } from "@/lib/supabase/runtime.types";

export function createAuthAdmin() {
  const secret = process.env.SUPABASE_SECRET_KEY;
  if (!secret || !/^(sb_secret_|eyJ)/.test(secret)) throw new Error("Auth server configuration unavailable");
  return createClient<Database>(getSupabasePublicEnvironment().url, secret, {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
  });
}
