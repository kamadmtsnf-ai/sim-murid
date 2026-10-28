"use client";

import { useEffect, useRef, useState } from "react";
import { Download } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";

type InstallEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
};

/** Installation only: no worker, private cache, background write, or automatic reload. */
export function PwaInstall() {
  const deferred = useRef<InstallEvent | null>(null);
  const busy = useRef(false);
  const returnFocus = useRef<HTMLElement | null>(null);
  const [open, setOpen] = useState(false);
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
      returnFocus.current = document.getElementById("main-content");
      setOpen(false);
    };
    const mode = () => {
      const active = display.matches || Boolean((navigator as Navigator & { standalone?: boolean }).standalone);
      setStandalone(active);
      if (active) {
        deferred.current = null;
        setAvailable(false);
        returnFocus.current = document.getElementById("main-content");
        setOpen(false);
      }
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
    <>
      {offline ? <aside aria-label="Koneksi aplikasi" className="mx-auto w-full min-w-0 max-w-7xl px-[16px] py-[12px] text-sm [overflow-wrap:anywhere] sm:px-[24px]">
        <p role="status" className="rounded-lg border border-warning/40 bg-warning/10 p-[12px]">Perangkat terdeteksi offline. Data belum dapat diperiksa atau disimpan. Sambungkan kembali lalu periksa status sebelum mengulangi penyimpanan; aplikasi tidak mengantrekan transaksi.</p>
      </aside> : null}
      {!standalone ? <div className="pwa-install-footer">
        <Button
          type="button"
          variant="ghost"
          className="pwa-install-launcher"
          aria-haspopup="dialog"
          aria-expanded={open}
          onClick={(event) => {
            returnFocus.current = event.currentTarget;
            setOpen(true);
          }}
        >
          <Download aria-hidden="true" />Pasang aplikasi
        </Button>
      </div> : null}
      <Dialog
        open={open}
        onOpenChange={setOpen}
        returnFocusRef={returnFocus}
        closeDisabled={pending}
        title="Pasang SiM-Murid di perangkat"
        description="Akses SiM-Murid melalui ikon perangkat. Instalasi bersifat opsional."
        className="pwa-install-dialog w-[calc(100%-32px)] max-h-[calc(100dvh-32px)]"
      >
        <div className="space-y-4 text-sm leading-relaxed">
          <p>Login, verifikasi email, dan seluruh penyimpanan tetap membutuhkan internet.</p>
          {available || pending ? <Button type="button" onClick={install} disabled={pending} aria-busy={pending}><Download aria-hidden="true" />{pending ? "Membuka instalasi…" : "Instal aplikasi"}</Button> : null}
          <ul className="list-disc space-y-3 pl-[20px] text-muted-foreground">
            <li>Chrome/Edge desktop atau Android: buka menu browser dan cari “Instal aplikasi” atau “Tambahkan ke layar utama”, jika tersedia.</li>
            <li>iPhone/iPad: buka melalui Safari, pilih Bagikan, lalu “Tambahkan ke Layar Utama”. Nama menu dapat berbeda menurut versi sistem.</li>
          </ul>
          <p className="text-muted-foreground">Jika pilihan pemasangan tidak tersedia, gunakan aplikasi di browser. Koneksi perangkat aktif belum menjamin layanan dapat dijangkau.</p>
          <div role="status" aria-live="polite" className="text-muted-foreground">{message}</div>
        </div>
      </Dialog>
    </>
  );
}
