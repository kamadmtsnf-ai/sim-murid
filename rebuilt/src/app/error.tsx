"use client";

import { ErrorReference } from "@/components/feedback/error-reference";
import { Status } from "@/components/ui/status";
import { Button } from "@/components/ui/button";

export default function ErrorPage({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <main tabIndex={-1}
      id="main-content"
      className="mx-auto flex min-h-dvh max-w-xl flex-col items-start justify-center gap-5 px-6"
    >
      <h1 className="text-3xl font-semibold">Halaman belum dapat dimuat</h1>
      <Status tone="error" heading="Terjadi gangguan saat membuka halaman">
        Coba muat kembali. Jika masalah berulang, sampaikan kode referensi kepada pengelola aplikasi jika tersedia.
      </Status>
      <ErrorReference digest={error.digest} />
      <Button onClick={reset}>Coba kembali</Button>
    </main>
  );
}
