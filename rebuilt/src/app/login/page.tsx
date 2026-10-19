import type { Metadata } from "next";
import Link from "next/link";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import { LoginForm } from "./login-form";

export const metadata: Metadata = { title: "Masuk" };
export default async function LoginPage({ searchParams }: { searchParams: Promise<{ logout?: string; expired?: string }> }) {
  const query = await searchParams;
  return <main id="main-content" className="mx-auto flex min-h-dvh max-w-lg flex-col justify-center px-6 py-12">
    <Link href="/" className="mb-6 text-sm text-primary underline">Kembali ke beranda</Link>
    <Card><CardHeader><CardTitle className="text-2xl">Masuk ke SiM-Murid</CardTitle><CardDescription>Gunakan username dan password akun madrasah Anda.</CardDescription></CardHeader><CardContent>
      {query.logout === "1" && <p role="status" className="mb-5 text-sm">Anda berhasil keluar.</p>}
      {query.expired === "1" && <p role="status" className="mb-5 text-sm">Sesi tidak berlaku. Silakan masuk kembali.</p>}
      <LoginForm />
      <p className="mt-6 text-sm text-muted-foreground">Belum memiliki akun atau lupa password? Hubungi administrator madrasah.</p>
    </CardContent></Card>
  </main>;
}
