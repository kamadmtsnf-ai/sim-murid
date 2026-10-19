import Link from "next/link";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { createServerClient } from "@supabase/ssr";
import { getSupabasePublicEnvironment } from "@/lib/supabase/environment";
import { verifiedPrincipal } from "@/lib/auth/http";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

export const dynamic = "force-dynamic";
export default async function AccountPage() {
  const jar = await cookies();
  let state;
  try {
    const { url, publishableKey } = getSupabasePublicEnvironment();
    const client = createServerClient(url, publishableKey, { cookies: { getAll: () => jar.getAll(), setAll: () => { /* Proxy handles refresh cookies. */ } } });
    state = await verifiedPrincipal(client);
  } catch {
    return <main id="main-content" className="mx-auto max-w-lg px-6 py-20"><h1 className="text-xl font-semibold">Pemeriksaan akun belum tersedia</h1><p className="mt-4">Silakan muat ulang halaman beberapa saat lagi.</p></main>;
  }
  if (!state) redirect("/login?expired=1");
  return <main id="main-content" className="mx-auto max-w-xl px-6 py-16"><Card><CardHeader><CardTitle>Selamat datang, {state.principal.full_name}</CardTitle></CardHeader><CardContent className="space-y-5">
    <p>Anda masuk sebagai <strong>{state.principal.username}</strong>.</p>
    <p className="text-sm text-muted-foreground">Sesi berlaku sampai {new Intl.DateTimeFormat("id-ID", { dateStyle: "medium", timeStyle: "short", timeZone: "Asia/Jakarta" }).format(new Date(state.principal.expires_at))} WIB.</p>
    {state.principal.must_change_password && <p className="rounded-md border p-4 text-sm">Akun menggunakan password sementara. Fitur penggantian password wajib akan tersedia pada tahap keamanan akun. Layanan operasional belum dibuka.</p>}
    <p className="text-sm text-muted-foreground">Akun berhasil diverifikasi. Modul layanan madrasah sedang dikembangkan.</p>
    <Button asChild variant="outline"><Link href="/account/sessions">Sesi dan perangkat</Link></Button>
    <form action="/api/auth/logout" method="post"><Button type="submit" variant="outline">Keluar</Button></form>
  </CardContent></Card></main>;
}
