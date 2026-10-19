import { parseSupabasePublicEnvironment } from "@/lib/validation/environment";

/** Function-scoped validation keeps static builds possible before target selection. */
export function getSupabasePublicEnvironment() {
  const result = parseSupabasePublicEnvironment({
    url: process.env.NEXT_PUBLIC_SUPABASE_URL,
    publishableKey: process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY,
  });
  if (!result.success) {
    throw new Error("Konfigurasi publik Supabase belum lengkap atau tidak valid. Periksa environment project.");
  }
  return result.data;
}
