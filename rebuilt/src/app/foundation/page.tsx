import type { Metadata } from "next";
import Link from "next/link";
import { ArrowLeft, Layers3 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { appConfig } from "@/config/app";

export const metadata: Metadata = { title: "Kesiapan pengembangan" };
const foundations = ["Next.js App Router", "TypeScript strict", "Tailwind CSS", "shadcn/ui", "Zod", "Supabase: skema awal diuji lokal"];

export default function FoundationPage() {
  return (
    <main id="main-content" className="mx-auto min-h-dvh max-w-4xl px-6 py-12 sm:py-20">
      <Button asChild variant="ghost" className="mb-8"><Link href="/"><ArrowLeft aria-hidden="true" />Kembali ke beranda</Link></Button>
      <div className="flex items-start gap-4"><Layers3 className="mt-1 size-8 shrink-0 text-primary" aria-hidden="true" /><div><Badge variant="outline">Tahap {appConfig.foundationStage}</Badge><h1 className="mt-3 text-3xl font-semibold tracking-tight">Kesiapan pengembangan</h1></div></div>
      <p className="mt-5 max-w-2xl leading-relaxed text-muted-foreground">Halaman ini menampilkan ruang lingkup fondasi proyek. Fitur operasional madrasah akan dibangun dan diuji pada tahap berikutnya.</p>
      <div className="mt-10 grid gap-5 sm:grid-cols-2">
        <Card><CardHeader><CardTitle>Fondasi yang disiapkan</CardTitle></CardHeader><CardContent><ul className="space-y-3 text-sm">{foundations.map((name) => <li key={name} className="flex items-center gap-2"><span aria-hidden="true" className="size-1.5 rounded-full bg-primary" />{name}</li>)}</ul></CardContent></Card>
        <Card><CardHeader><CardTitle>Tahap berikutnya</CardTitle></CardHeader><CardContent className="space-y-4 text-sm leading-relaxed text-muted-foreground"><p>Tahap 5: autentikasi username dan password.</p><p>Autentikasi, hak akses, serta modul operasional akan ditambahkan sesuai urutan pengerjaan.</p><p>Belum terhubung ke proyek Supabase daring. Data murid belum dimasukkan.</p></CardContent></Card>
      </div>
    </main>
  );
}
