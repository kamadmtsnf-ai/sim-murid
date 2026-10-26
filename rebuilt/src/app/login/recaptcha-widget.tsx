"use client";
import { useEffect, useRef, useState } from "react";
import { ShieldCheck, CircleCheck, CircleAlert, LoaderCircle, RotateCw } from "lucide-react";
import { Button } from "@/components/ui/button";

type CaptchaApi = {
  render: (container: HTMLElement, options: {sitekey: string; size: "compact"; callback: (token: string) => void; "expired-callback": () => void; "error-callback": () => void}) => number;
  reset: (id: number) => void;
};
declare global { interface Window { grecaptcha?: CaptchaApi } }
let loader: Promise<CaptchaApi> | null = null;
let sequence = 0;
function loadCaptcha(): Promise<CaptchaApi> {
  if (typeof window.grecaptcha?.render === "function") return Promise.resolve(window.grecaptcha);
  if (loader) return loader;
  loader = new Promise<CaptchaApi>((resolve, reject) => {
    const name = `__simCaptchaReady${++sequence}`;
    const callbacks = window as unknown as Record<string, unknown>;
    const script = document.createElement("script");
    const cleanup = () => { clearTimeout(timer); delete callbacks[name]; script.onerror = null; };
    const fail = () => { cleanup(); script.remove(); reject(Error("Captcha unavailable")); };
    const timer = setTimeout(fail, 15000);
    callbacks[name] = () => {
      const api = window.grecaptcha;
      if (!api || typeof api.render !== "function") { fail(); return; }
      cleanup(); resolve(api);
    };
    script.src = `https://www.google.com/recaptcha/api.js?onload=${name}&render=explicit&hl=id`;
    script.async = true; script.defer = true; script.onerror = fail;
    document.head.append(script);
  }).catch(error => { loader = null; throw error; });
  return loader;
}
export function RecaptchaWidget({siteKey, onToken, disabled}: {siteKey: string; onToken: (token: string) => void; disabled: boolean}) {
  const container = useRef<HTMLDivElement>(null);
  const widget = useRef<{api: CaptchaApi; id: number} | null>(null);
  const [attempt, setAttempt] = useState(0);
  const [state, setState] = useState<"loading" | "ready" | "verified" | "expired" | "error">("loading");
  useEffect(() => {
    let live = true;
    const element = container.current;
    onToken("");
    loadCaptcha().then(api => {
      if (!live || !element) return;
      setState("ready");
      const id = api.render(element, {
        sitekey: siteKey, size: "compact",
        callback: token => { if (live) { onToken(token); setState("verified"); } },
        "expired-callback": () => { if (live) { onToken(""); setState("expired"); } },
        "error-callback": () => { if (live) { onToken(""); setState("error"); } },
      });
      widget.current = { api, id };
    }).catch(() => { if (live) { onToken(""); setState("error"); } });
    return () => {
      live = false;
      if (widget.current) { try { widget.current.api.reset(widget.current.id); } catch { /* Widget already detached. */ } }
      widget.current = null;
      element?.replaceChildren();
    };
  }, [siteKey, onToken, attempt]);
  return <section aria-label="Verifikasi keamanan" className="min-w-0 space-y-3 rounded-xl border border-border bg-muted/30 p-3 sm:p-4">
    <div className="flex min-w-0 items-start gap-2.5">
      <ShieldCheck aria-hidden="true" className="mt-0.5 size-5 shrink-0 text-primary" />
      <div className="min-w-0"><p className="text-sm font-semibold">Verifikasi keamanan</p><p className="mt-1 text-xs leading-relaxed text-muted-foreground">Selesaikan pemeriksaan berikut untuk melanjutkan masuk.</p></div>
    </div>
    <div className="flex min-h-[144px] min-w-0 items-center justify-center rounded-lg border border-border bg-background py-3"><div inert={disabled} aria-disabled={disabled} ref={container} /></div>
    <p role={state === "error" ? "alert" : "status"} className={`flex min-w-0 items-start gap-2 text-xs leading-relaxed ${state === "error" || state === "expired" ? "text-destructive" : "text-muted-foreground"}`}>
      {state === "loading" ? <LoaderCircle aria-hidden="true" className="mt-0.5 size-4 shrink-0 motion-safe:animate-spin" /> : state === "verified" ? <CircleCheck aria-hidden="true" className="mt-0.5 size-4 shrink-0" /> : state === "error" || state === "expired" ? <CircleAlert aria-hidden="true" className="mt-0.5 size-4 shrink-0" /> : null}<span>
      {state === "loading" ? "Memuat reCAPTCHA…" : state === "error" ? "reCAPTCHA belum dapat dimuat. Periksa koneksi, lalu coba kembali." : state === "expired" ? "Verifikasi kedaluwarsa. Centang kembali reCAPTCHA." : state === "verified" ? "Verifikasi selesai. Silakan masuk." : "Centang kotak reCAPTCHA sebelum masuk."}</span>
    </p>
    {state === "error" && <Button type="button" variant="outline" disabled={disabled} onClick={() => { setState("loading"); setAttempt(v => v + 1); }} className="min-h-11 w-full whitespace-normal"><RotateCw aria-hidden="true" className="size-4 shrink-0" />Muat ulang reCAPTCHA</Button>}
  </section>;
}
