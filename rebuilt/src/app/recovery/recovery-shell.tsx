import type { ReactNode } from "react";
import Link from "next/link";
import {
  Card,
  CardHeader,
  CardDescription,
  CardContent,
} from "@/components/ui/card";
import { Status } from "@/components/ui/status";
import styles from "./recovery.module.css";
export function RecoveryShell({
  title,
  description,
  children,
}: {
  title: string;
  description: string;
  children: ReactNode;
}) {
  return (
    <div className={styles.page}>
      <main id="main-content" tabIndex={-1} className={styles.main}>
        <Link href="/login" className={styles.back}>
          Kembali ke login
        </Link>
        <Card className={styles.card}>
          <CardHeader className={styles.header}>
            <p className="eyebrow">Akses akun · SiM-Murid</p>
            <h1 className="text-2xl font-semibold">{title}</h1>
            <CardDescription>{description}</CardDescription>
          </CardHeader>
          <CardContent className={`${styles.content} ${styles.stack}`}>
            <noscript>
              <style>{`.${styles.form}{display:none}`}</style>
              <Status tone="error">
                Aktifkan JavaScript untuk meminta bantuan akun. Jika tidak dapat
                mengaktifkannya, hubungi petugas madrasah secara langsung.
              </Status>
            </noscript>
            {children}
          </CardContent>
        </Card>
      </main>
    </div>
  );
}
