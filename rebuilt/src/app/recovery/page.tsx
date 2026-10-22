import type { Metadata } from "next";
import Link from "next/link";
import { RecoveryForm } from "./recovery-form";
import { RecoveryShell } from "./recovery-shell";
import styles from "./recovery.module.css";
export const metadata: Metadata = { title: "Bantuan akun" };
export default function RecoveryPage() {
  return (
    <RecoveryShell
      title="Bantuan akun"
      description="Minta bantuan untuk password atau sesi akun. Petugas madrasah akan memverifikasi identitas Anda sebelum melakukan pemulihan."
    >
      <p className={styles.note}>
        Jawaban keamanan membantu pemeriksaan, tetapi tidak langsung mengubah
        password atau mengakhiri sesi.
      </p>
      <RecoveryForm />
      <div className="border-t pt-4">
        <p className={styles.note}>
          Memiliki email kontak yang sudah terverifikasi?
        </p>
        <Link href="/recovery/email" className={styles.link}>
          Pulihkan password melalui email
        </Link>
      </div>
    </RecoveryShell>
  );
}
