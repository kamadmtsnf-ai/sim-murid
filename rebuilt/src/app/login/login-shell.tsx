import type {ReactNode} from 'react';
import Link from 'next/link';
import {School,ShieldCheck,BookOpen,Users} from 'lucide-react';
import styles from './login.module.css';
import {Status} from '@/components/ui/status';

export function LoginShell({children}:{children:ReactNode}){
 return <div className={styles.layout}>
  <aside className={styles.story} aria-label="Tentang SiM-Murid">
   <Link href="/" prefetch={false} className={styles.storyBrand}><School aria-hidden="true"/>SiM-Murid</Link>
   <div><p className="mb-4 text-sm font-medium">MTs Nurul Falah</p><h2 className={styles.storyTitle}>Layanan madrasah, dalam satu ruang kerja.</h2><p className="mt-6 leading-relaxed">Mendampingi perjalanan murid melalui layanan akademik dan administrasi yang terhubung.</p><ul className={styles.storyList}><li><BookOpen aria-hidden="true"/>Akademik dan layanan siswa</li><li><Users aria-hidden="true"/>Kolaborasi sesuai tanggung jawab</li><li><ShieldCheck aria-hidden="true"/>Akses sesuai peran dan hubungan data</li></ul></div>
   <p className="text-xs">Sistem Informasi Murid · MTs Nurul Falah</p>
  </aside>
  <main id="main-content" tabIndex={-1} className={styles.main}>
   <noscript><style>{`.${styles.form}{display:none}`}</style><Status tone="error">Aktifkan JavaScript pada browser untuk menggunakan formulir login. Jika tidak dapat mengaktifkannya, hubungi administrator madrasah.</Status></noscript>
   <div className={styles.mobileBrand}><span className={`brand-icon ${styles.brandIcon}`}><School aria-hidden="true"/></span><div className="min-w-0"><strong className="block text-lg">SiM-Murid</strong><span className="text-sm text-muted-foreground">MTs Nurul Falah</span></div></div>
   <Link href="/" prefetch={false} className={styles.backLink}>Kembali ke beranda</Link>
   {children}
  </main>
 </div>;
}
