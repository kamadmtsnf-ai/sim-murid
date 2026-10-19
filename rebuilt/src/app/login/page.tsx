import type { Metadata } from "next";
import Link from "next/link";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import { LoginForm } from "./login-form";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { createServerClient } from "@supabase/ssr";
import { getSupabasePublicEnvironment } from "@/lib/supabase/environment";
import { verifiedPrincipal } from "@/lib/auth/http";

export const metadata: Metadata = { title: "Masuk" };
export default async function LoginPage({ searchParams }: { searchParams: Promise<{ logout?: string; expired?: string; password?: string }> }) {
  const query = await searchParams;
  const jar = await cookies();
  let signedIn = false;
  if (jar.getAll().some((cookie) => cookie.name.startsWith("sb-"))) {
    try {
      const { url, publishableKey } = getSupabasePublicEnvironment();
      const client = createServerClient(url, publishableKey, { cookies: { getAll: () => jar.getAll(), setAll: () => {} } });
      signedIn = Boolean(await verifiedPrincipal(client));
    } catch { /* The public login form remains available during an outage. */ }
  }
  if (signedIn) redirect("/account");
  return <main id="main-content" className="mx-auto flex min-h-dvh max-w-lg flex-col justify-center px-6 py-12">
    <Link href="/" className="mb-6 text-sm text-primary underline">Kembali ke beranda</Link>
    <Card><CardHeader><CardTitle className="text-2xl">Masuk ke SiM-Murid</CardTitle><CardDescription>Gunakan username dan password akun madrasah Anda.</CardDescription></CardHeader><CardContent>
      {query.logout === "1" && <p role="status" className="mb-5 text-sm">Anda berhasil keluar.</p>}
      {query.expired === "1" && <p role="status" className="mb-5 text-sm">Sesi tidak berlaku. Silakan masuk kembali.</p>}
      {query.password === "changed" && <p role="status" className="mb-5 text-sm">Password berhasil diperbarui. Masuk kembali dengan password baru.</p>}
      {query.password === "pending" && <p role="status" className="mb-5 text-sm">Sesi diakhiri untuk keamanan. Perubahan password belum dapat dipastikan selesai. Coba masuk kembali; jika password lama tidak berlaku, gunakan password baru atau hubungi administrator.</p>}
      <LoginForm />
      <p className="mt-6 text-sm text-muted-foreground">Belum memiliki akun atau lupa password? Hubungi administrator madrasah.</p>
    </CardContent></Card>
  </main>;
}
