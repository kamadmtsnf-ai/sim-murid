import type { Metadata } from "next";
import Link from "next/link";
import { EmailRecoveryForm } from "./recovery-form";
import { RecoveryShell } from "../recovery-shell";
import styles from "../recovery.module.css";
export const metadata: Metadata = { title: "Pemulihan melalui email" };
export default function EmailRecoveryPage() {
  return (
    <RecoveryShell
      title="Pulihkan password melalui email"
      description="Gunakan kode pemulihan dari email kontak yang sudah terverifikasi di SiM-Murid."
    >
      <EmailRecoveryForm />
      <div className="border-t pt-4">
        <p className={styles.note}>
          Belum memiliki email terverifikasi atau tidak dapat membuka email?
        </p>
        <Link href="/recovery" className={styles.link}>
          Minta bantuan Admin
        </Link>
      </div>
    </RecoveryShell>
  );
}
