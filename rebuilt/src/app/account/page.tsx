import {securityState} from '@/lib/auth/security';
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
  let state; let onboarding;
  try {
    const { url, publishableKey } = getSupabasePublicEnvironment();
    const client = createServerClient(url, publishableKey, { cookies: { getAll: () => jar.getAll(), setAll: () => { /* Proxy handles refresh cookies. */ } } });
    state = await verifiedPrincipal(client);
    if(state)onboarding=await securityState(state.principal.id,state.sessionId);
  } catch {
    return <main id="main-content" className="mx-auto max-w-lg px-6 py-20"><h1 className="text-xl font-semibold">Pemeriksaan akun belum tersedia</h1><p className="mt-4">Silakan muat ulang halaman beberapa saat lagi.</p></main>;
  }
  if (!state) redirect("/login?expired=1");
  if(onboarding?.gate!=="ready")redirect("/account/security");
  return <main id="main-content" className="mx-auto max-w-xl px-6 py-16"><Card><CardHeader><CardTitle>Selamat datang, {state.principal.full_name}</CardTitle></CardHeader><CardContent className="space-y-5">
    <p>Anda masuk sebagai <strong>{state.principal.username}</strong>.</p>
    <p className="text-sm text-muted-foreground">Sesi berlaku sampai {new Intl.DateTimeFormat("id-ID", { dateStyle: "medium", timeStyle: "short", timeZone: "Asia/Jakarta" }).format(new Date(state.principal.expires_at))} WIB.</p>

    <div className="flex flex-wrap gap-2">{[["duty","Guru piket"],["attendance","Absensi"],["mentoring","Bimbingan"],["fees","Iuran komite"],["savings","Tabungan"]].map(([key,label])=><Button key={key} asChild variant="outline"><Link href={"/account/operations/"+key}>{label}</Link></Button>)}</div>
    <p className="text-sm text-muted-foreground">Akun berhasil diverifikasi. Modul layanan madrasah sedang dikembangkan.</p>
    {state.principal.is_admin && <Button asChild variant="outline"><Link href="/account/settings">Pengaturan madrasah</Link></Button>}
    <Button asChild variant="outline"><Link href="/account/biodata">Biodata dan dokumen saya</Link></Button>
    <Button asChild variant="outline"><Link href="/account/directory">Direktori pengguna</Link></Button>
    <Button asChild variant="outline"><Link href="/account/classes">Kelas dan siswa</Link></Button>
    <Button asChild variant="outline"><Link href="/account/schedules">Jadwal dan piket siswa</Link></Button>
    {state.principal.is_admin && <Button asChild variant="outline"><Link href="/account/families">Relasi keluarga</Link></Button>}
    <Button asChild variant="outline"><Link href="/account/profile">Profil pribadi</Link></Button>
    {state.principal.is_admin && <Button asChild variant="outline"><Link href="/account/recovery">Pemulihan akun</Link></Button>}
    <Button asChild variant="outline"><Link href="/account/security">Keamanan akun</Link></Button>
    <Button asChild variant="outline"><Link href="/account/sessions">Sesi dan perangkat</Link></Button>
    <Button asChild variant="outline"><Link href="/account/access">Hak akses saya</Link></Button>
    <form action="/api/auth/logout" method="post"><Button type="submit" variant="outline">Keluar</Button></form>
  </CardContent></Card></main>;
}
