import { z } from "zod";

const supabaseEnvironmentSchema = z.object({
  url: z.url().refine((value) => new URL(value).protocol === "https:" || (new URL(value).protocol === "http:" && ["localhost", "127.0.0.1", "[::1]"].includes(new URL(value).hostname)), {
    error: "URL Supabase harus HTTPS; HTTP hanya untuk localhost/loopback lokal.",
  }),
  publishableKey: z.string().trim().min(1),
});

/** Tidak membaca env atau membuka koneksi saat module/build dimuat.
 * Tahap integrasi memanggil ini dengan dua field publik yang eksplisit.
 * Secret key tidak boleh diteruskan ke Client Component.
 */
export function parseSupabasePublicEnvironment(input: unknown) {
  return supabaseEnvironmentSchema.safeParse(input);
}
