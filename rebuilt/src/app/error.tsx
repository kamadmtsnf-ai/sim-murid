"use client";

import { Button } from "@/components/ui/button";

export default function ErrorPage({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return <main id="main-content" className="mx-auto flex min-h-dvh max-w-xl flex-col items-start justify-center gap-5 px-6"><h1 className="text-3xl font-semibold">Halaman belum dapat dimuat</h1><p className="text-muted-foreground">Silakan coba kembali. Jika masalah berulang, hubungi pengelola aplikasi.</p><Button onClick={reset}>Coba kembali</Button></main>;
}
