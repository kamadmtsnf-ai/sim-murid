"use client";

import { useEffect, useRef, useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { Eye, EyeOff, LoaderCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Status } from "@/components/ui/status";
import type { PublicRecaptcha } from "@/lib/auth/recaptcha";
import { RecaptchaWidget } from "./recaptcha-widget";
import { loginSchema } from "@/lib/auth/validation";
import styles from "./login.module.css";

type Phase = "idle" | "submitting" | "success" | "uncertain";
export function LoginForm({captcha = { mode: "disabled" }}: {captcha?: PublicRecaptcha}) {
  const router = useRouter();
  const busyRef = useRef(false);
  const mountedRef = useRef(true);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const errorRef = useRef<HTMLDivElement>(null);
  const successRef = useRef<HTMLDivElement>(null);
  const [captchaToken, setCaptchaToken] = useState("");
  const [captchaVersion, setCaptchaVersion] = useState(0);
  const [phase, setPhase] = useState<Phase>("idle");
  const [message, setMessage] = useState("");
  const [visible, setVisible] = useState(false);
  const [capsLock,setCapsLock]=useState(false);
  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
      if (timerRef.current) clearTimeout(timerRef.current);
      // Do not abort a login mutation on navigation away: its response may still deliver session cookies.
    };
  }, []);
  useEffect(() => { if (message) errorRef.current?.focus(); }, [message]);
  useEffect(() => { if (phase === "success") successRef.current?.focus(); }, [phase]);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busyRef.current) return;
    const form = new FormData(event.currentTarget);
    const parsed = loginSchema.safeParse({ username: form.get("username"), password: form.get("password"), remember: form.get("remember") === "on" });
    if (!parsed.success) {
      setMessage("Periksa username dan password. Username tidak boleh diawali atau diakhiri spasi.");
      return;
    }
    if (captcha.mode === "unavailable" || (captcha.mode === "enabled" && !captchaToken)) {
      setMessage(captcha.mode === "unavailable" ? "Verifikasi keamanan belum tersedia. Hubungi administrator." : "Selesaikan reCAPTCHA sebelum masuk.");
      return;
    }
    busyRef.current = true;
    setPhase("submitting"); setMessage(""); setVisible(false);
    const controller = new AbortController();
    timerRef.current = setTimeout(() => controller.abort(), 30_000);
    try {
      const response = await fetch("/api/auth/login", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...parsed.data, ...(captcha.mode === "enabled" ? {captchaToken} : {}) }), signal: controller.signal, cache: "no-store",
      });
      const data: unknown = await response.json();
      if (!mountedRef.current) return;
      if (response.ok) {
        if (typeof data !== "object" || data === null || !("destination" in data) || data.destination !== "/account") throw new Error("Unconfirmed login response");
        setPhase("success");
        try { router.replace("/account"); } catch { /* The native link below can complete navigation. */ }
        return;
      }
      if (typeof data !== "object" || data === null || !("message" in data) || typeof data.message !== "string" || !data.message.trim()) throw new Error("Unconfirmed login response");
      if (captcha.mode === "enabled") {
        setCaptchaToken(""); setCaptchaVersion(v => v + 1);
      }
      setMessage(data.message.slice(0, 1000));
      setPhase("idle"); busyRef.current = false;
    } catch {
      if (mountedRef.current) {
        setMessage("Hasil proses masuk belum dapat dipastikan. Periksa sesi Anda sebelum mencoba lagi agar tidak membuat permintaan ganda.");
        setPhase("uncertain");
      }
    } finally {
      if (timerRef.current) clearTimeout(timerRef.current);
      timerRef.current = null;
    }
  }

  const pending = phase === "submitting";
  return <form method="post" action="/api/auth/login" onSubmit={submit} className={styles.form} aria-busy={pending} aria-describedby={message ? "login-error" : undefined}>
    <fieldset disabled={phase !== "idle"} className={styles.fields}>
      <div><label htmlFor="username" className="text-sm font-medium">Username</label><input id="username" name="username" autoComplete="username" autoCapitalize="none" autoCorrect="off" spellCheck={false} required maxLength={100} className={styles.input} /></div>
      <div><label htmlFor="password" className="text-sm font-medium">Password</label><div className={styles.passwordField}><input id="password" name="password" type={visible ? "text" : "password"} autoComplete="current-password" onKeyUp={e=>setCapsLock(e.getModifierState("CapsLock"))} onBlur={()=>setCapsLock(false)} aria-describedby={capsLock?"login-caps-lock":undefined} required maxLength={1024} className={styles.input} /><button type="button" aria-controls="password" aria-pressed={visible} onClick={() => setVisible(value => !value)} aria-label={visible ? "Sembunyikan password" : "Tampilkan password"} title={visible ? "Sembunyikan password" : "Tampilkan password"} className={styles.passwordToggle}>{visible ? <EyeOff aria-hidden="true" /> : <Eye aria-hidden="true" />}<span className="sr-only">{visible ? "Sembunyikan password" : "Tampilkan password"}</span></button></div>{capsLock && <p id="login-caps-lock" role="status" className="text-sm text-muted-foreground">Caps Lock aktif. Periksa huruf besar pada password.</p>}</div>
      <label className={styles.remember}><input type="checkbox" name="remember" /><span>Ingat saya selama 7 hari<span className="mt-1 block text-xs text-muted-foreground">Gunakan hanya pada perangkat pribadi. Sesi biasa berlaku 1 jam.</span></span></label>
    </fieldset>
    {captcha.mode === "enabled" && <RecaptchaWidget key={captchaVersion} siteKey={captcha.siteKey} onToken={setCaptchaToken} disabled={phase !== "idle"} />}
    {captcha.mode === "unavailable" && <Status tone="error">Verifikasi keamanan belum tersedia. Silakan coba kembali atau hubungi administrator.</Status>}
    {message && <div id="login-error" ref={errorRef} role="alert" tabIndex={-1} className={styles.error}>{message}</div>}
    {pending && <p role="status" className="sr-only">Sedang memeriksa akun.</p>}
    {phase === "success" ? <div ref={successRef} tabIndex={-1}><Status tone="success"><p>Berhasil masuk. Membuka akun Anda…</p><a className={styles.textLink} href="/account">Lanjutkan ke akun</a></Status></div> : phase === "uncertain" ? <Button asChild className={styles.submit}><a href="/login">Periksa sesi saya</a></Button> : <Button type="submit" className={styles.submit} disabled={pending || captcha.mode === "unavailable" || (captcha.mode === "enabled" && !captchaToken)}>{pending && <LoaderCircle aria-hidden="true" className="size-4 shrink-0 animate-spin" />}{pending ? "Memeriksa akun…" : "Masuk"}</Button>}
  </form>;
}
