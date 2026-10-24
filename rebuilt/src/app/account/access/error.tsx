"use client";
import { Button } from "@/components/ui/button";
export default function AccessError({
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <main
      id="main-content"
      tabIndex={-1}
      className="mx-auto min-w-0 max-w-xl space-y-4 px-4 py-10"
    >
      <h1 className="text-2xl font-semibold">
        Hak akses saya belum dapat dimuat
      </h1>
      <p role="alert" className="text-sm text-muted-foreground">
        Koneksi atau layanan sedang bermasalah. Coba kembali untuk memeriksa
        status terbaru.
      </p>
      <Button onClick={reset}>Coba lagi</Button>
    </main>
  );
}
