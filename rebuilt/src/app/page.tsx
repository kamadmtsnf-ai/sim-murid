import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight, BookOpen, Check, School } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import styles from "./home.module.css";

export const metadata: Metadata = { title: "Beranda" };

const principles = [
  { title: "Layanan murid yang terhubung", description: "Akademik, kehadiran, bimbingan, dan administrasi dalam satu sistem." },
  { title: "Akses sesuai tanggung jawab", description: "Untuk guru, siswa, dan orang tua sesuai izin." },
  { title: "Riwayat tetap terjaga", description: "Catatan murid tetap tersimpan saat berpindah kelas." },
];

export default function HomePage() {
  return (
    <div className={styles.page}>
      <header className={styles.header}>
        <div className={styles.container}>
          <Link href="/" aria-label="SiM-Murid, beranda" className={styles.brand}>
            <span className={`brand-icon ${styles.brandIcon}`}><School aria-hidden="true" /></span>
            <span className="min-w-0"><span className="block text-lg font-bold tracking-tight">SiM-Murid</span><span className="block text-xs text-muted-foreground">MTs Nurul Falah</span></span>
          </Link>
        </div>
      </header>
      <main id="main-content" tabIndex={-1} aria-labelledby="welcome-title" className={`${styles.container} ${styles.main}`}>
        <section aria-labelledby="welcome-title" className={styles.hero}>
          <div>
            <p className="eyebrow mb-4">Sistem Informasi Murid</p>
            <h1 id="welcome-title" className={styles.title}>Layanan murid, lebih mudah.</h1>
            <p className={styles.lead}>Akademik, kehadiran, dan administrasi dalam satu akun.</p>
            <Button asChild size="lg" className={styles.login}><Link href="/login"><span className="min-w-0">Masuk ke akun</span><ArrowRight aria-hidden="true" /></Link></Button>
            <p className="mt-4 text-sm text-muted-foreground">Gunakan akun yang diberikan oleh madrasah.</p>
          </div>
          <Card className="min-w-0 gap-0 py-0">
            <CardHeader className={`${styles.serviceHeader} rounded-t-xl border-b bg-secondary/50`}>
              <div className="flex items-start gap-3">
                <span className={styles.serviceIcon}><BookOpen aria-hidden="true" /></span>
                <div className="min-w-0"><CardTitle><h2 className="text-xl leading-snug">Layanan madrasah terpadu</h2></CardTitle><CardDescription className="mt-2 leading-relaxed">Sesuai peran Anda.</CardDescription></div>
              </div>
            </CardHeader>
            <CardContent className={styles.serviceContent}>
              <ul className={styles.serviceList}>
                {principles.map((item) => (
                  <li key={item.title} className={styles.serviceItem}>
                    <Check aria-hidden="true" className="mt-1 size-4 shrink-0 text-primary" />
                    <div className="min-w-0"><h3 className="font-semibold">{item.title}</h3><p className="mt-1 text-sm leading-relaxed text-muted-foreground">{item.description}</p></div>
                  </li>
                ))}
              </ul>
            </CardContent>
          </Card>
        </section>
      </main>
      <footer className={styles.footer}><div className={styles.container}>MTs Nurul Falah · SiM-Murid</div></footer>
    </div>
  );
}
