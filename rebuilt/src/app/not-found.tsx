import { PwaInstallButton } from "@/components/pwa-install";
import Link from "next/link";
import { ArrowLeft, FileSearch } from "lucide-react";
import { Button } from "@/components/ui/button";

export default function NotFound() {
  return (
    <>
    <main
      id="main-content"
      tabIndex={-1}
      aria-labelledby="not-found-title"
      className="mx-auto flex min-h-dvh w-full min-w-0 max-w-3xl items-center px-4 py-8 sm:px-6 sm:py-12"
    >
      <section className="w-full min-w-0 rounded-2xl border bg-card p-5 text-card-foreground shadow-sm [overflow-wrap:anywhere] sm:p-10">
        <div className="mb-6 flex flex-wrap items-center gap-3">
          <span className="inline-flex size-12 shrink-0 items-center justify-center rounded-xl bg-secondary text-primary">
            <FileSearch className="size-6" aria-hidden="true" />
          </span>
          <p className="text-sm font-semibold text-primary">Kesalahan 404</p>
        </div>
        <h1
          id="not-found-title"
          className="text-2xl font-semibold leading-tight tracking-tight sm:text-3xl"
        >
          Halaman tidak ditemukan
        </h1>
        <p className="mt-4 max-w-xl leading-relaxed text-muted-foreground">
          Alamat yang Anda buka tidak ditemukan. Periksa tautannya atau
          lanjutkan melalui beranda.
        </p>
        <Button
          asChild
          className="mt-7 w-full max-w-full whitespace-normal text-center sm:w-auto"
        >
          <Link href="/" prefetch={false}>
            <ArrowLeft aria-hidden="true" />
            <span className="min-w-0">Kembali ke beranda</span>
          </Link>
        </Button>
        <p className="mt-6 border-t pt-5 text-sm leading-relaxed text-muted-foreground">
          Jika tautan dari aplikasi tetap bermasalah, hubungi admin madrasah.
        </p>
      </section>
    </main>
    <footer className="public-app-footer"><span>SiM-Murid · MTs Nurul Falah</span><PwaInstallButton /></footer>
    </>
  );
}
