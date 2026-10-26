"use client";
import { useEffect, useRef, useState } from "react";
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
  return <section aria-label="Verifikasi keamanan" className="min-w-0 space-y-2">
    <p className="text-sm font-medium">Verifikasi keamanan</p>
    <div inert={disabled} aria-disabled={disabled} ref={container} />
    <p role={state === "error" ? "alert" : "status"} className="text-sm text-muted-foreground">
      {state === "loading" ? "Memuat reCAPTCHA…" : state === "error" ? "reCAPTCHA belum dapat dimuat. Periksa koneksi, lalu coba kembali." : state === "expired" ? "Verifikasi kedaluwarsa. Centang kembali reCAPTCHA." : state === "verified" ? "Verifikasi selesai. Silakan masuk." : "Centang kotak reCAPTCHA sebelum masuk."}
    </p>
    {state === "error" && <Button type="button" variant="outline" disabled={disabled} onClick={() => { setState("loading"); setAttempt(v => v + 1); }}>Muat ulang reCAPTCHA</Button>}
  </section>;
}
