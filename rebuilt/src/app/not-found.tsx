import Link from "next/link";
import { Button } from "@/components/ui/button";

export default function NotFound() {
  return <main id="main-content" className="mx-auto flex min-h-dvh max-w-xl flex-col items-start justify-center gap-5 px-6"><p className="text-sm font-semibold text-primary">404</p><h1 className="text-3xl font-semibold">Halaman tidak ditemukan</h1><p className="leading-relaxed text-muted-foreground">Alamat yang Anda buka belum tersedia atau tidak ditemukan.</p><Button asChild><Link href="/">Kembali ke beranda</Link></Button></main>;
}
