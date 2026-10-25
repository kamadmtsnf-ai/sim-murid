"use client";
import { ErrorReference } from "@/components/feedback/error-reference";
import { Button } from "@/components/ui/button";
import { Status } from "@/components/ui/status";
export default function AccountError({
  error,
  reset,
  title = "Layanan belum dapat dimuat",
}: {
  title?: string;
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <main id="main-content" tabIndex={-1} className="space-y-5">
      <h1 className="text-2xl font-semibold">{title}</h1>
      <Status tone="error">
        Periksa koneksi dan coba kembali. Jika masalah berulang, hubungi
        administrator madrasah.
      </Status>
      <ErrorReference digest={error.digest} />
      <div className="flex flex-wrap gap-3">
        <Button onClick={reset}>Coba kembali</Button>
      </div>
    </main>
  );
}
