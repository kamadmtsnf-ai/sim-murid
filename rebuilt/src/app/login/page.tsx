import { publicRecaptcha } from "@/lib/auth/recaptcha";
import type { Metadata } from "next";
import Link from "next/link";
import { Card, CardHeader, CardDescription, CardContent } from "@/components/ui/card";
import { Status } from "@/components/ui/status";
import { LoginForm } from "./login-form";
import { LoginShell } from "./login-shell";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { readServerAuthClient } from "@/lib/auth/read-server";
import { verifiedPrincipal } from "@/lib/auth/http";
import styles from "./login.module.css";

export const metadata: Metadata = { title: "Masuk" };
type Query={logout?:string|string[];expired?:string|string[];password?:string|string[]};
export default async function LoginPage({ searchParams }: { searchParams: Promise<Query> }) {
  const query = await searchParams;
  const jar = await cookies();
  let signedIn = false;
  if (jar.getAll().some((cookie) => cookie.name.startsWith("sb-"))) {
    try { signedIn = Boolean(await verifiedPrincipal(await readServerAuthClient())); }
    catch { /* Keep the public form available when account verification is unavailable. */ }
  }
  if (signedIn) redirect("/account");
  const notice = query.password === "pending" ? {tone:"info" as const,text:"Sesi diakhiri untuk keamanan. Perubahan password belum dapat dipastikan selesai. Coba masuk kembali; jika password lama tidak berlaku, gunakan password baru atau hubungi administrator."}
    : query.password === "changed" ? {tone:"success" as const,text:"Password berhasil diperbarui. Masuk kembali dengan password baru."}
    : query.expired === "1" ? {tone:"info" as const,text:"Sesi tidak berlaku. Silakan masuk kembali."}
    : query.logout === "1" ? {tone:"success" as const,text:"Anda berhasil keluar."} : null;
  return <LoginShell>
    <Card className={styles.card}><CardHeader className={styles.cardHeader}><p className="eyebrow">Akses akun</p><h1 className="text-2xl font-semibold">Masuk ke SiM-Murid</h1><CardDescription>Masuk dengan akun madrasah Anda.</CardDescription></CardHeader><CardContent className={styles.cardContent}>
      {notice && <div className="mb-5"><Status tone={notice.tone}>{notice.text}</Status></div>}

      <LoginForm captcha={publicRecaptcha()} />
      <p className={styles.help}>Kesulitan masuk? <Link href="/recovery">Minta bantuan akun</Link>. Akun baru? Hubungi admin madrasah.</p>
    </CardContent></Card>
  </LoginShell>;
}
