"use client";

import {
  createContext,
  useContext,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from "react";
import {
  CheckCircle2,
  Download,
  Monitor,
  School,
  Smartphone,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import { Status } from "@/components/ui/status";
import {
  installInstructions,
  installPlatform,
  type InstallPlatform,
} from "@/lib/pwa/presentation";

type InstallEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
};
type PwaState = {
  skipTarget: string;
  setSkipTarget: (id: string) => void;
  ready: boolean;
  standalone: boolean;
  installedHere: boolean;
  offline: boolean;
  available: boolean;
  pending: boolean;
  message: string;
  platform: InstallPlatform;
  setPlatform: (value: InstallPlatform) => void;
  install: () => Promise<void>;
  checkMode: () => void;
  showGuide: (trigger: HTMLElement) => void;
};
const PwaContext = createContext<PwaState | null>(null);
function currentStandalone() {
  return (
    window.matchMedia("(display-mode: standalone)").matches ||
    Boolean((navigator as Navigator & { standalone?: boolean }).standalone)
  );
}

/** One controller for all footers and the usage gate. No worker, private cache or reload. */
export function PwaInstall({ children }: { children?: ReactNode }) {
  const deferred = useRef<InstallEvent | null>(null),
    busy = useRef(false);
  const returnFocus = useRef<HTMLElement | null>(null);
  const [skipTarget, setSkipTarget] = useState("main-content");
  const [open, setOpen] = useState(false),
    [ready, setReady] = useState(false);
  const [standalone, setStandalone] = useState(false),
    [installedHere, setInstalledHere] = useState(false);
  const [offline, setOffline] = useState(false),
    [available, setAvailable] = useState(false);
  const [pending, setPending] = useState(false),
    [message, setMessage] = useState("");
  const [platform, setPlatform] = useState<InstallPlatform>("desktop");
  useEffect(() => {
    const display = window.matchMedia("(display-mode: standalone)");
    const mode = () => {
      const active = currentStandalone();
      setStandalone(active);
      setReady(true);
      if (active) {
        deferred.current = null;
        setAvailable(false);
        setMessage("");
        returnFocus.current = document.getElementById("main-content");
        setOpen(false);
      }
    };
    const installed = () => {
      deferred.current = null;
      setAvailable(false);
      setInstalledHere(true);
      setMessage(
        "Instalasi selesai. Buka SiM-Murid melalui ikon aplikasi pada perangkat, lalu masuk kembali jika diminta.",
      );
      // Installation in a browser tab is not proof of standalone launch.
      mode();
    };
    const offer = (event: Event) => {
      event.preventDefault();
      if (currentStandalone()) return;
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
    const frame = requestAnimationFrame(() => {
      setPlatform(
        installPlatform(navigator.userAgent, navigator.maxTouchPoints),
      );
      mode();
      connection();
    });
    return () => {
      cancelAnimationFrame(frame);
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
    if (!event || busy.current || offline) return;
    busy.current = true;
    deferred.current = null;
    setPending(true);
    try {
      await event.prompt();
      const choice = await event.userChoice;
      setMessage(
        choice.outcome === "accepted"
          ? "Permintaan instalasi diterima. Selesaikan langkah browser, lalu buka SiM-Murid melalui ikon aplikasi."
          : "Instalasi dibatalkan. Anda dapat mencoba lagi melalui menu browser. Pengguna non-admin perlu membuka PWA untuk menggunakan layanan.",
      );
    } catch {
      setMessage(
        "Instalasi belum berhasil. Ikuti panduan menu browser di bawah.",
      );
    } finally {
      busy.current = false;
      setPending(false);
      setAvailable(false);
    }
  }
  function checkMode() {
    const active = currentStandalone();
    setStandalone(active);
    setReady(true);
    setMessage(
      active
        ? "Mode aplikasi terdeteksi."
        : "Masih dibuka melalui browser. Buka SiM-Murid dari ikon aplikasi yang terpasang; tidak perlu memuat ulang atau mengirim ulang data.",
    );
  }
  const state: PwaState = {
    skipTarget,
    setSkipTarget,
    ready,
    standalone,
    installedHere,
    offline,
    available,
    pending,
    message,
    platform,
    setPlatform,
    install,
    checkMode,
    showGuide: (trigger) => {
      returnFocus.current = trigger;
      setOpen(true);
    },
  };
  return (
    <PwaContext.Provider value={state}>
      {children}
      {offline ? (
        <aside
          aria-label="Koneksi aplikasi"
          className="mx-auto w-full min-w-0 max-w-7xl px-[16px] py-[12px] text-sm [overflow-wrap:anywhere] sm:px-[24px]"
        >
          <Status tone="warning">
            Perangkat terdeteksi offline. Data belum dapat diperiksa atau
            disimpan. Sambungkan kembali lalu periksa status sebelum mengulangi
            penyimpanan; aplikasi tidak mengantrekan transaksi.
          </Status>
        </aside>
      ) : null}
      <Dialog
        open={open}
        onOpenChange={setOpen}
        returnFocusRef={returnFocus}
        closeDisabled={pending}
        headerScrollLabel="Judul panduan pemasangan"
        title="Pasang SiM-Murid di perangkat"
        description="Pasang, lalu buka melalui ikon aplikasi. Layanan akun non-admin wajib digunakan dalam mode PWA."
        className="pwa-install-dialog w-[calc(100%-32px)] max-h-[calc(100dvh-32px)]"
      >
        <InstallationGuide />
      </Dialog>
    </PwaContext.Provider>
  );
}

/** The usage screen has its own main ID so preserved, inert drafts never duplicate it. */
export function PwaSkipLink() {
  const state = useContext(PwaContext);
  return (
    <a
      href={`#${state?.skipTarget ?? "main-content"}`}
      className="sr-only z-50 rounded-md bg-primary p-3 text-primary-foreground focus:not-sr-only focus:fixed focus:top-3 focus:left-3"
      onClick={(event) => {
        const main = Array.from(
          document.querySelectorAll<HTMLElement>("main"),
        ).find(
          (node) =>
            !node.closest("[hidden],[inert]") &&
            node.getClientRects().length > 0,
        );
        if (main && main.id !== "main-content") {
          event.preventDefault();
          main.focus();
          main.scrollIntoView({ block: "start" });
        }
      }}
    >
      Lewati ke konten utama
    </a>
  );
}

/** Place inside the page's real footer; never render another footer after it. */
export function PwaInstallButton() {
  const state = useContext(PwaContext);
  if (!state || state.standalone) return null;
  return (
    <Button
      type="button"
      variant="ghost"
      className="pwa-install-launcher"
      aria-haspopup="dialog"
      disabled={state.pending}
      aria-busy={state.pending}
      onClick={(event) => {
        state.showGuide(event.currentTarget);
        if (state.available && !state.offline) void state.install();
      }}
    >
      <Download aria-hidden="true" />
      Pasang aplikasi
    </Button>
  );
}
function InstallationGuide() {
  const state = useContext(PwaContext);
  if (!state) return null;
  return (
    <div className="pwa-guide space-y-4 text-sm leading-relaxed">
      <div
        className="flex flex-wrap gap-2"
        role="group"
        aria-label="Perangkat pemasangan"
      >
        {(
          [
            ["android", "Android"],
            ["ios", "iPhone / iPad"],
            ["desktop", "Komputer"],
          ] as const
        ).map(([value, label]) => (
          <Button
            key={value}
            type="button"
            variant={state.platform === value ? "secondary" : "outline"}
            aria-pressed={state.platform === value}
            onClick={() => state.setPlatform(value)}
          >
            {label}
          </Button>
        ))}
      </div>
      <ol className="space-y-3" aria-label="Langkah pemasangan">
        {installInstructions[state.platform].map((step, index) => (
          <li key={step} className="flex min-w-0 gap-[12px]">
            <span
              aria-hidden="true"
              className="flex size-[28px] shrink-0 items-center justify-center rounded-full bg-secondary font-semibold text-primary"
            >
              {index + 1}
            </span>
            <span className="min-w-0">{step}</span>
          </li>
        ))}
      </ol>
      {state.available || state.pending ? (
        <Button
          type="button"
          onClick={() => void state.install()}
          disabled={state.pending || state.offline}
          aria-busy={state.pending}
        >
          <Download aria-hidden="true" />
          {state.pending ? "Membuka instalasi…" : "Instal aplikasi"}
        </Button>
      ) : (
        <p className="rounded-xl border bg-background p-[12px] text-muted-foreground">
          {state.installedHere
            ? "Sudah terpasang pada perangkat ini. Buka dari ikon aplikasi."
            : "Tombol instalasi belum tersedia. Gunakan menu browser sesuai panduan, atau gunakan Chrome/Edge di komputer/Android maupun Safari di iPhone/iPad."}
        </p>
      )}
      <p className="text-muted-foreground">
        Login, verifikasi email, dan penyimpanan membutuhkan internet. Akun
        mungkin perlu masuk kembali saat pertama membuka PWA.
      </p>
      <div role="status" aria-live="polite" className="text-primary">
        {state.message}
      </div>
    </div>
  );
}

/** Usage policy only. Display-mode is a client signal, never an auth/RBAC credential. */
export function PwaRequirement({
  required,
  children,
  signOut,
}: {
  required: boolean;
  children: ReactNode;
  signOut?: ReactNode;
}) {
  const state = useContext(PwaContext),
    [admitted, setAdmitted] = useState(false);
  const allowed = !required || Boolean(state?.ready && state.standalone);
  const wasBlocked = useRef(false);
  const setSkipTarget = state?.setSkipTarget;
  useEffect(() => {
    setSkipTarget?.(
      !required || allowed || !admitted
        ? "main-content"
        : "pwa-required-content",
    );
    return () => setSkipTarget?.("main-content");
  }, [setSkipTarget, required, allowed, admitted]);
  if (required && allowed && !admitted) setAdmitted(true);
  useEffect(() => {
    if (required && state?.ready && !state.standalone)
      wasBlocked.current = true;
    if (allowed && wasBlocked.current) {
      document.getElementById("main-content")?.focus();
      wasBlocked.current = false;
    }
  }, [allowed, required, state?.ready, state?.standalone]);
  if (!required) return children;
  return (
    <>
      {!allowed ? (
        <div className="pwa-required-shell">
          <main
            id={admitted ? "pwa-required-content" : "main-content"}
            tabIndex={-1}
            className="pwa-required-main"
            aria-labelledby="pwa-required-title"
          >
            <span className="brand-icon">
              <School aria-hidden="true" />
            </span>
            <h1 id="pwa-required-title" className="text-2xl font-semibold">
              {state?.ready
                ? "Buka SiM-Murid melalui aplikasi"
                : "Memeriksa mode aplikasi…"}
            </h1>
            {state?.ready ? (
              <>
                <p className="text-muted-foreground">
                  Akun non-admin wajib menggunakan PWA. Pasang SiM-Murid, lalu
                  buka melalui ikon aplikasi pada perangkat Anda.
                </p>
                <div className="flex flex-wrap items-center gap-2 text-sm font-medium text-primary">
                  <Smartphone aria-hidden="true" className="size-[18px]" />
                  <span>1. Pasang</span>
                  <Monitor aria-hidden="true" className="size-[18px]" />
                  <span>2. Buka ikon</span>
                  <CheckCircle2 aria-hidden="true" className="size-[18px]" />
                  <span>3. Masuk akun</span>
                </div>
                <InstallationGuide />
                <div className="ds-actions">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={state.checkMode}
                  >
                    Periksa mode aplikasi
                  </Button>
                  {signOut}
                </div>
                <p className="text-sm text-muted-foreground">
                  Jika perangkat tidak mendukung pemasangan, gunakan
                  perangkat/browser yang mendukung atau hubungi admin madrasah.
                  Mode layar penuh browser tidak menggantikan PWA.
                </p>
              </>
            ) : (
              <p role="status">
                Tunggu pemeriksaan perangkat sebelum menggunakan layanan.
              </p>
            )}
            <noscript>
              Aktifkan JavaScript, pasang SiM-Murid melalui menu browser, lalu
              buka dari ikon aplikasi. Hubungi admin jika mengalami kendala.
            </noscript>
          </main>
          <footer className="workspace-footer" aria-label="Informasi aplikasi">
            <p>SiM-Murid · MTs Nurul Falah</p>
            <PwaInstallButton />
          </footer>
        </div>
      ) : null}
      {allowed || admitted ? (
        <div hidden={!allowed} inert={!allowed}>
          {children}
        </div>
      ) : null}
    </>
  );
}
