import type { Metadata } from "next";
import Link from "next/link";
import { Card, CardHeader, CardDescription, CardContent } from "@/components/ui/card";
import { School, ShieldCheck, BookOpen, Users } from "lucide-react";
import { Status } from "@/components/ui/status";
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
  return <div className="auth-layout"><aside className="auth-story" aria-label="Tentang SiM-Murid"><Link href="/" className="flex items-center gap-3 text-xl font-semibold"><School className="size-8" aria-hidden="true"/>SiM-Murid</Link><div className="max-w-md"><p className="mb-4 text-sm font-medium">MTs Nurul Falah</p><h2 className="text-4xl font-semibold leading-tight">Layanan madrasah,<br/>dalam satu ruang kerja.</h2><p className="mt-6 leading-relaxed">Mendampingi perjalanan murid melalui layanan akademik dan administrasi yang terhubung.</p><ul className="mt-8 space-y-4 text-sm"><li className="flex items-center gap-3"><BookOpen aria-hidden="true" className="size-5"/>Akademik dan layanan siswa</li><li className="flex items-center gap-3"><Users aria-hidden="true" className="size-5"/>Kolaborasi sesuai tanggung jawab</li><li className="flex items-center gap-3"><ShieldCheck aria-hidden="true" className="size-5"/>Akses sesuai peran dan hubungan data</li></ul></div><p className="text-xs">Sistem Informasi Murid · MTs Nurul Falah</p></aside><main id="main-content" className="auth-main"><div className="mb-8 flex items-center gap-3 lg:hidden"><span className="brand-icon"><School aria-hidden="true" className="size-6"/></span><div><strong className="block text-lg">SiM-Murid</strong><span className="text-sm text-muted-foreground">MTs Nurul Falah</span></div></div>
    <Link href="/" className="mb-6 w-fit rounded text-sm text-primary underline underline-offset-4">Kembali ke beranda</Link>
    <Card><CardHeader><p className="eyebrow">Akses akun</p><h1 className="text-2xl font-semibold">Masuk ke SiM-Murid</h1><CardDescription>Gunakan username dan password akun madrasah Anda.</CardDescription></CardHeader><CardContent>
      {query.logout === "1" && <div className="mb-5"><Status>Anda berhasil keluar.</Status></div>}
      {query.expired === "1" && <div className="mb-5"><Status>Sesi tidak berlaku. Silakan masuk kembali.</Status></div>}
      {query.password === "changed" && <div className="mb-5"><Status>Password berhasil diperbarui. Masuk kembali dengan password baru.</Status></div>}
      {query.password === "pending" && <div className="mb-5"><Status>Sesi diakhiri untuk keamanan. Perubahan password belum dapat dipastikan selesai. Coba masuk kembali; jika password lama tidak berlaku, gunakan password baru atau hubungi administrator.</Status></div>}
      <LoginForm />
      <p className="mt-6 text-sm text-muted-foreground">Lupa password atau tidak bisa mengakses sesi lama? <Link href="/recovery" className="text-primary underline">Minta bantuan akun</Link>. Untuk akun baru, hubungi administrator madrasah.</p>
    </CardContent></Card>
  </main></div>;
}
