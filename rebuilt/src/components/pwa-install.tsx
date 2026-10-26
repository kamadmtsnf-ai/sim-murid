"use client";

import { useEffect, useRef, useState } from "react";
import { Download } from "lucide-react";
import { Button } from "@/components/ui/button";

type InstallEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
};

/** Installation only: no worker, private cache, background write, or automatic reload. */
export function PwaInstall() {
  const deferred = useRef<InstallEvent | null>(null);
  const busy = useRef(false);
  const [available, setAvailable] = useState(false);
  const [standalone, setStandalone] = useState(false);
  const [offline, setOffline] = useState(false);
  const [pending, setPending] = useState(false);
  const [message, setMessage] = useState("");

  useEffect(() => {
    const display = window.matchMedia("(display-mode: standalone)");
    const installed = () => {
      deferred.current = null;
      setAvailable(false);
      setStandalone(true);
      setMessage("");
    };
    const mode = () => {
      const active = display.matches || Boolean((navigator as Navigator & { standalone?: boolean }).standalone);
      setStandalone(active);
      if (active) { deferred.current = null; setAvailable(false); }
    };
    const offer = (event: Event) => {
      event.preventDefault();
      if (display.matches || (navigator as Navigator & { standalone?: boolean }).standalone) return;
      deferred.current = event as InstallEvent;
      setAvailable(true);
      setMessage("");
    };
    const connection = () => setOffline(!navigator.onLine);
    window.addEventListener("beforeinstallprompt", offer);
    window.addEventListener("appinstalled", installed);
    window.addEventListener("online", connection);
    window.addEventListener("offline", connection);
    display.addEventListener("change", mode);
    mode(); connection();
    return () => {
      window.removeEventListener("beforeinstallprompt", offer);
      window.removeEventListener("appinstalled", installed);
      window.removeEventListener("online", connection);
      window.removeEventListener("offline", connection);
      display.removeEventListener("change", mode);
      deferred.current = null;
    };
  }, []);

  async function install() {
    const event = deferred.current;
    if (!event || busy.current) return;
    busy.current = true;
    deferred.current = null;
    setPending(true);
    try {
      await event.prompt();
      const choice = await event.userChoice;
      setMessage(choice.outcome === "accepted"
        ? "Permintaan instalasi diterima. Selesaikan langkah yang ditampilkan browser."
        : "Instalasi dibatalkan. Anda tetap dapat menggunakan aplikasi melalui browser.");
    } catch {
      setMessage("Instalasi belum berhasil. Gunakan menu browser untuk memeriksa pilihan pemasangan.");
    } finally {
      busy.current = false;
      setPending(false);
      setAvailable(false);
    }
  }

  return (
    <aside aria-label="Pemasangan dan koneksi aplikasi" className="mx-auto w-full max-w-7xl min-w-0 space-y-3 px-[16px] py-[16px] text-sm [overflow-wrap:anywhere] sm:px-[24px]">
      <div role="status" aria-live="polite" className="break-words">
        {offline ? <p className="rounded-lg border border-warning/40 bg-warning/10 p-3">Perangkat terdeteksi offline. Data belum dapat diperiksa atau disimpan. Sambungkan kembali lalu periksa status sebelum mengulangi penyimpanan; aplikasi tidak mengantrekan transaksi.</p> : null}
        {message ? <p className="mt-2 text-muted-foreground">{message}</p> : null}
      </div>
      {!standalone ? <details className="min-w-0 rounded-xl border bg-card p-[12px] text-card-foreground">
        <summary className="min-h-11 cursor-pointer content-center rounded-md font-medium outline-offset-4 focus-visible:outline-2 focus-visible:outline-primary">Pasang SiM-Murid di perangkat</summary>
        <div className="space-y-3 pt-2 leading-relaxed">
          <p>Akses aplikasi melalui ikon perangkat. Login, verifikasi email, dan seluruh penyimpanan tetap membutuhkan internet.</p>
          {available || pending ? <Button type="button" onClick={install} disabled={pending} aria-busy={pending}><Download aria-hidden="true" />{pending ? "Membuka instalasi…" : "Instal aplikasi"}</Button> : null}
          <ul className="list-disc space-y-2 pl-[20px] text-muted-foreground">
            <li>Chrome/Edge desktop atau Android: buka menu browser dan cari “Instal aplikasi” atau “Tambahkan ke layar utama”, jika tersedia.</li>
            <li>iPhone/iPad: buka melalui Safari, pilih Bagikan, lalu “Tambahkan ke Layar Utama”. Nama menu dapat berbeda menurut versi sistem.</li>
          </ul>
          <p className="text-muted-foreground">Jika pilihan pemasangan tidak tersedia, gunakan aplikasi di browser. Koneksi perangkat aktif belum menjamin layanan dapat dijangkau.</p>
        </div>
      </details> : null}
    </aside>
  );
}
