import Link from "next/link";
import { ArrowRight, BookOpen, Check, School } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

const principles = [
  { title: "Layanan murid yang terhubung", description: "Akademik, kehadiran, bimbingan, dan administrasi dalam satu sistem." },
  { title: "Akses sesuai tanggung jawab", description: "Setiap peran memperoleh layanan sesuai tugas dan hubungan datanya." },
  { title: "Riwayat tetap terjaga", description: "Perubahan kelas dan status murid tetap mempertahankan catatan sebelumnya." },
];

export default function HomePage() {
  return (
    <div className="min-h-dvh bg-background">
      <header className="border-b bg-card">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-4 px-6 py-5">
          <Link href="/" aria-label="SiM-Murid, beranda" className="flex items-center gap-3 rounded-md focus-visible:outline-2 focus-visible:outline-ring">
            <span className="flex size-11 items-center justify-center rounded-xl bg-primary text-primary-foreground"><School className="size-6" aria-hidden="true" /></span>
            <span><span className="block text-lg font-bold tracking-tight">SiM-Murid</span><span className="block text-xs text-muted-foreground">MTs Nurul Falah</span></span>
          </Link>
        </div>
      </header>
      <main id="main-content" className="mx-auto max-w-6xl px-6 py-16 sm:py-24">
        <section aria-labelledby="welcome-title" className="grid gap-12 lg:grid-cols-[1.25fr_1fr] lg:items-center">
          <div className="max-w-2xl">
            <p className="mb-5 text-sm font-semibold tracking-widest text-primary uppercase">Sistem Informasi Murid</p>
            <h1 id="welcome-title" className="text-4xl leading-tight font-semibold tracking-tight text-foreground sm:text-5xl">Mendampingi setiap langkah<br className="hidden sm:block" /> perjalanan murid.</h1>
            <p className="mt-6 max-w-xl text-lg leading-relaxed text-muted-foreground">Kelola layanan akademik, kehadiran, bimbingan, dan administrasi murid melalui satu akun madrasah.</p>
            <Button asChild size="lg" className="mt-8"><Link href="/login">Masuk ke akun<ArrowRight aria-hidden="true" className="size-4" /></Link></Button>
            <p className="mt-4 text-sm text-muted-foreground">Gunakan akun yang diberikan oleh madrasah.</p>
          </div>
          <Card className="overflow-hidden border-primary/15 shadow-sm">
            <CardHeader className="border-b bg-primary/5 pb-6">
              <BookOpen aria-hidden="true" className="mb-3 size-8 text-primary" />
              <CardTitle className="text-xl">Layanan madrasah terpadu</CardTitle>
              <CardDescription>Informasi dan layanan sesuai peran Anda di madrasah.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6 pt-6">
              {principles.map((item) => (
                <div key={item.title} className="flex gap-3">
                  <Check aria-hidden="true" className="mt-1 size-4 shrink-0 text-primary" />
                  <div><h2 className="font-medium">{item.title}</h2><p className="mt-1 text-sm leading-relaxed text-muted-foreground">{item.description}</p></div>
                </div>
              ))}
            </CardContent>
          </Card>
        </section>
      </main>
      <footer className="mx-auto max-w-6xl border-t px-6 py-6 text-sm text-muted-foreground">MTs Nurul Falah · SiM-Murid</footer>
    </div>
  );
}
