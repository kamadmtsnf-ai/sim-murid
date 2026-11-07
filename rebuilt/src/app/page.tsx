import type { Metadata } from "next";
import Link from "next/link";
import {
  ArrowDown, ArrowRight, BookOpen, CalendarCheck, Check, ChevronDown,
  ClipboardList, GraduationCap, HeartHandshake, School, ShieldCheck, Users,
} from "lucide-react";
import { PwaInstallButton } from "@/components/pwa-install";
import { Button } from "@/components/ui/button";
import styles from "./home.module.css";

export const metadata: Metadata = {
  title: "Beranda",
  description: "SiM-Murid MTs Nurul Falah. Akses layanan akademik, kehadiran, bimbingan, dan administrasi murid dalam satu akun.",
};

const services = [
  { icon: BookOpen, number: "01", title: "Akademik lebih tertata", description: "Jadwal, nilai, dan rapor dalam satu tempat untuk mendukung perjalanan belajar murid.", tags: ["Jadwal", "Nilai & rapor"] },
  { icon: CalendarCheck, number: "02", title: "Pendampingan lebih dekat", description: "Catatan kehadiran dan bimbingan membantu madrasah mendampingi perkembangan murid.", tags: ["Kehadiran", "Bimbingan"] },
  { icon: ClipboardList, number: "03", title: "Administrasi lebih mudah", description: "Biodata, dokumen, dan layanan murid tersusun rapi serta mudah ditelusuri.", tags: ["Biodata", "Dokumen"] },
];
const questions = [
  { question: "Bagaimana cara mendapatkan akun?", answer: "Gunakan akun yang diberikan oleh madrasah. Jika belum memiliki akun atau memerlukan bantuan akses, hubungi administrator madrasah." },
  { question: "Mengapa layanan setiap pengguna berbeda?", answer: "Layanan yang ditampilkan mengikuti peran, penugasan, dan izin akun Anda. Guru, murid, serta orang tua dapat memiliki akses yang berbeda." },
  { question: "Apakah SiM-Murid bisa dipasang di ponsel?", answer: "Bisa. Pilih Pasang aplikasi di bagian bawah halaman untuk melihat panduan sesuai perangkat Anda. Gunakan browser yang mendukung pemasangan aplikasi web." },
];

export default function HomePage() {
  return (
    <div className={styles.page}>
      <header className={styles.header}>
        <div className={`${styles.container} ${styles.headerInner}`}>
          <Link href="/" aria-label="SiM-Murid, beranda" className={styles.brand}>
            <span className={styles.brandIcon}><School aria-hidden="true" /></span>
            <span><strong>SiM-Murid</strong><span>MTs Nurul Falah</span></span>
          </Link>
          <nav aria-label="Navigasi beranda" className={styles.nav}>
            <a href="#layanan">Layanan</a>
            <a href="#bantuan">Bantuan</a>
            <Button asChild size="sm"><Link href="/login">Masuk <ArrowRight aria-hidden="true" /></Link></Button>
          </nav>
        </div>
      </header>

      <main id="main-content" tabIndex={-1} className={styles.main}>
        <section aria-labelledby="welcome-title" className={`${styles.container} ${styles.hero}`}>
          <div className={styles.heroCopy}>
            <p className={styles.eyebrow}><span /> Sistem Informasi Murid</p>
            <h1 id="welcome-title" className={styles.title}>Satu ruang untuk setiap <span>langkah murid.</span></h1>
            <p className={styles.lead}>Hubungkan pembelajaran, pendampingan, dan administrasi. Bersama SiM-Murid, layanan madrasah ada dalam satu akun.</p>
            <div className={styles.heroActions}>
              <Button asChild size="lg"><Link href="/login">Masuk ke akun <ArrowRight aria-hidden="true" /></Link></Button>
              <a className={styles.explore} href="#layanan">Jelajahi layanan <ArrowDown aria-hidden="true" /></a>
            </div>
            <p className={styles.accessNote}><ShieldCheck aria-hidden="true" /> Akses sesuai peran dan tanggung jawab Anda.</p>
          </div>

          <div className={styles.visual} aria-labelledby="visual-title">
            <div className={styles.visualTop}><span className={styles.visualMark}><School aria-hidden="true" /> SiM-Murid</span><span className={styles.visualLabel}>Terhubung dalam satu ruang</span></div>
            <div className={styles.visualBody}>
              <span className={styles.visualEyebrow}>DARI BELAJAR HINGGA BERTUMBUH</span>
              <h2 id="visual-title">Murid di pusat<br />setiap layanan.</h2>
              <div className={styles.orbit} aria-hidden="true">
                <div className={styles.orbitRing} />
                <span className={styles.orbitCenter}><GraduationCap /></span>
                <span className={`${styles.orbitNode} ${styles.nodeBook}`}><BookOpen /></span>
                <span className={`${styles.orbitNode} ${styles.nodeHeart}`}><HeartHandshake /></span>
                <span className={`${styles.orbitNode} ${styles.nodeCalendar}`}><CalendarCheck /></span>
                <span className={`${styles.orbitNode} ${styles.nodeUsers}`}><Users /></span>
              </div>
              <div className={styles.visualServices}><span><Check aria-hidden="true" /> Akademik</span><span><Check aria-hidden="true" /> Kehadiran</span><span><Check aria-hidden="true" /> Administrasi</span></div>
            </div>
            <div className={styles.visualBottom}><span className={styles.statusDot} /> Satu akun. Layanan sesuai kebutuhan.</div>
          </div>
        </section>

        <section id="layanan" aria-labelledby="services-title" className={styles.services}>
          <div className={styles.container}>
            <div className={styles.sectionHeading}><div><p className={styles.eyebrow}>Lebih terarah, setiap hari</p><h2 id="services-title">Layanan madrasah terpadu</h2></div><p>Lebih sedikit berpindah tempat.<br />Lebih mudah menemukan yang dibutuhkan.</p></div>
            <div className={styles.serviceGrid}>
              {services.map(({ icon: Icon, ...service }) => (
                <article key={service.number} className={`card ${styles.serviceCard}`}>
                  <div className={styles.cardTop}><span className={styles.serviceIcon}><Icon aria-hidden="true" /></span><span className={styles.cardNumber}>{service.number}</span></div>
                  <h3>{service.title}</h3><p>{service.description}</p>
                  <ul className={styles.tags} aria-label={`Layanan ${service.title.toLowerCase()}`}>{service.tags.map(tag => <li key={tag} className="badge badge-secondary">{tag}</li>)}</ul>
                </article>
              ))}
            </div>
          </div>
        </section>

        <section aria-labelledby="community-title" className={`${styles.container} ${styles.community}`}>
          <div className={styles.communityIntro}><span className={styles.communityIcon}><Users aria-hidden="true" /></span><div><p className={styles.eyebrow}>Satu madrasah, saling terhubung</p><h2 id="community-title">Peran berbeda.<br />Tujuan yang sama.</h2></div></div>
          <div className={styles.roleList}>
            <div><h3>Guru & tenaga kependidikan</h3><p>Kelola layanan sesuai tugas dan penugasan.</p></div>
            <div><h3>Murid</h3><p>Akses informasi dan layanan pembelajaran.</p></div>
            <div><h3>Orang tua & wali</h3><p>Ikuti informasi anak sesuai hubungan dan izin.</p></div>
          </div>
        </section>

        <section id="bantuan" aria-labelledby="help-title" className={`${styles.container} ${styles.help}`}>
          <div><p className={styles.eyebrow}>Mulai dengan mudah</p><h2 id="help-title">Ada yang ingin<br />Anda ketahui?</h2><p className={styles.helpLead}>Beberapa hal sebelum masuk ke SiM-Murid.</p></div>
          <div className={styles.questions}>{questions.map(item => <details key={item.question} className={styles.question}><summary>{item.question}<ChevronDown aria-hidden="true" /></summary><p>{item.answer}</p></details>)}</div>
        </section>

        <section aria-labelledby="start-title" className={styles.start}>
          <div className={`${styles.container} ${styles.startInner}`}><div><p className={styles.eyebrow}>Siap melanjutkan?</p><h2 id="start-title">Layanan Anda dimulai di sini.</h2><p>Masuk menggunakan akun yang diberikan oleh madrasah.</p></div><Button asChild size="lg" variant="secondary"><Link href="/login">Buka SiM-Murid <ArrowRight aria-hidden="true" /></Link></Button></div>
        </section>
      </main>

      <footer className={styles.footer}>
        <div className={`${styles.container} ${styles.footerInner}`}><div><strong>SiM-Murid</strong><p>Sistem Informasi Murid · MTs Nurul Falah</p></div><PwaInstallButton /></div>
      </footer>
    </div>
  );
}
