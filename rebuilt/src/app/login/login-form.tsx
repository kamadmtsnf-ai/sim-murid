"use client";

import { useRef, useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";

export function LoginForm() {
  const router = useRouter();
  const errorRef = useRef<HTMLDivElement>(null);
  const [pending, setPending] = useState(false);
  const [message, setMessage] = useState("");
  const [visible, setVisible] = useState(false);
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (pending) return;
    const form = new FormData(event.currentTarget);
    setPending(true); setMessage("");
    try {
      const response = await fetch("/api/auth/login", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username: form.get("username"), password: form.get("password"), remember: form.get("remember") === "on" }),
      });
      const data: unknown = await response.json();
      if (response.ok) { router.replace("/account"); router.refresh(); return; }
      setMessage(typeof data === "object" && data !== null && "message" in data && typeof data.message === "string" ? data.message : "Belum berhasil masuk. Silakan coba kembali.");
    } catch { setMessage("Tidak dapat menghubungi layanan. Periksa koneksi Anda."); }
    setPending(false);
    requestAnimationFrame(() => errorRef.current?.focus());
  }
  const input = "mt-2 w-full rounded-md border bg-card px-3 py-2 focus-visible:outline-2 focus-visible:outline-ring";
  return <form onSubmit={submit} className="space-y-5" aria-busy={pending} aria-describedby={message?"login-error":undefined}>
    <div><label htmlFor="username" className="text-sm font-medium">Username</label><input id="username" name="username" autoComplete="username" required maxLength={100} className={input} disabled={pending} /></div>
    <div><label htmlFor="password" className="text-sm font-medium">Password</label><input id="password" name="password" type={visible ? "text" : "password"} autoComplete="current-password" required maxLength={1024} className={input} disabled={pending} /><button type="button" aria-controls="password" aria-pressed={visible} disabled={pending} onClick={() => setVisible(!visible)} className="mt-1 min-h-11 rounded text-sm text-primary underline underline-offset-4 focus-visible:outline-2">{visible ? "Sembunyikan password" : "Tampilkan password"}</button></div>
    <label className="flex items-start gap-3 text-sm"><input type="checkbox" name="remember" className="mt-1" disabled={pending} /><span>Ingat saya selama 7 hari<span className="mt-1 block text-xs text-muted-foreground">Gunakan hanya pada perangkat pribadi. Sesi biasa berlaku 1 jam.</span></span></label>
    {message&&<div id="login-error" ref={errorRef} role="alert" tabIndex={-1} className="rounded-lg border border-destructive/30 bg-danger-subtle p-3 text-sm text-destructive">{message}</div>}
    <Button type="submit" className="w-full" disabled={pending}>{pending ? "Memeriksa akun…" : "Masuk"}</Button>
  </form>;
}
