"use client";
import Link from "next/link";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { sessionListSchema, type SessionList } from "@/lib/auth/sessions";

const format = (value: string) => new Intl.DateTimeFormat("id-ID", { dateStyle: "medium", timeStyle: "short", timeZone: "Asia/Jakarta" }).format(new Date(value));
const statusLabels = { active: "Aktif", expired: "Berakhir", revoked: "Dicabut" } as const;
export function SessionPanel({ canManageOthers }: { canManageOthers: boolean }) {
  const router = useRouter();
  const [target, setTarget] = useState("");
  const [input, setInput] = useState("");
  const [data, setData] = useState<SessionList | null>(null);
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  const [revision, setRevision] = useState(0);
  useEffect(() => {
    let alive = true;
    let controller = new AbortController();
    async function load() {
      if (document.hidden) return;
      controller.abort(); controller = new AbortController();
      try {
        const response = await fetch("/api/auth/sessions", { cache: "no-store", signal: controller.signal,
          ...(target ? { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "list", username: target }) } : {}),
        });
        const body: unknown = await response.json();
        if (!alive) return;
        if (response.status === 401) { setData(null); router.replace("/login?expired=1"); router.refresh(); return; }
        const parsed = sessionListSchema.safeParse(body);
        if (!response.ok || !parsed.success) { setData(null); setMessage("Sesi tidak tersedia atau akses tidak diizinkan. Coba muat ulang."); return; }
        setData(parsed.data);
      } catch (error) {
        if (alive && !(error instanceof DOMException && error.name === "AbortError")) { setData(null); setMessage("Tidak dapat memuat sesi. Periksa koneksi lalu coba kembali."); }
      }
    }
    void load();
    const timer = setInterval(() => { void load(); }, 60_000);
    const visible = () => { if (!document.hidden) void load(); };
    document.addEventListener("visibilitychange", visible);
    return () => { alive = false; controller.abort(); clearInterval(timer); document.removeEventListener("visibilitychange", visible); };
  }, [target, revision, router]);
  async function revoke(id?: string) {
    if (busy || !window.confirm(id ? "Cabut akses sesi ini? Perangkat tersebut harus masuk kembali." : "Cabut seluruh sesi akun yang sedang ditampilkan?")) return;
    setBusy(true); setMessage("");
    try {
      const response = await fetch("/api/auth/sessions", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "revoke", ...(target ? { username: target } : {}), ...(id ? { scope: "one", sessionId: id } : { scope: "all" }) }) });
      const body: unknown = await response.json();
      if (response.status === 401 || (response.ok && typeof body === "object" && body !== null && "signed_out" in body && body.signed_out === true)) { setData(null); router.replace("/login?logout=1"); router.refresh(); return; }
      setMessage(response.ok ? "Sesi berhasil diperiksa dan dicabut bila masih aktif." : "Sesi tidak dapat dicabut. Muat ulang dan periksa hak akses Anda.");
      setRevision((n) => n + 1);
    } catch { setMessage("Tidak dapat menghubungi layanan. Silakan coba kembali."); }
    setBusy(false);
  }
  return <main id="main-content" className="mx-auto max-w-3xl space-y-6 px-6 py-12">
    <Link href="/account" className="text-sm text-primary underline">Kembali ke akun</Link>
    <h1 className="text-3xl font-semibold">Sesi dan perangkat</h1>
    <p className="text-sm text-muted-foreground">Satu sesi aktif per akun. Sesi biasa berlaku maksimal 1 jam, atau 7 hari bila memilih Ingat saya. Ditampilkan 20 sesi terbaru; seluruh waktu dalam WIB.</p>
    {canManageOthers && <Card><CardHeader><CardTitle>Sesi pengguna lain</CardTitle></CardHeader><CardContent><form className="flex flex-wrap items-end gap-3" onSubmit={(e) => { e.preventDefault(); setData(null); setMessage(""); setTarget(input); setRevision((n) => n + 1); }}><label className="flex-1 text-sm" htmlFor="session-username">Username persis<input id="session-username" required maxLength={100} value={input} disabled={busy} onChange={(e) => setInput(e.target.value)} className="mt-2 w-full rounded-md border p-2" autoComplete="off" /></label><Button disabled={busy} type="submit">Cari sesi</Button><Button disabled={busy} type="button" variant="outline" onClick={() => { setTarget(""); setData(null); setMessage(""); }}>Akun saya</Button></form></CardContent></Card>}
    <p role="status" aria-live="polite" className="text-sm">{message}</p>
    <div className="flex flex-wrap items-center gap-3"><Button variant="outline" disabled={busy} onClick={() => { setMessage(""); setRevision((n) => n + 1); }}>Muat ulang</Button>{data && <Button variant="destructive" disabled={busy || !data.sessions.some((s) => s.status === "active")} onClick={() => { void revoke(); }}>Cabut seluruh sesi</Button>}</div>
    {!data ? <p role="status">Menunggu data sesi. Gunakan Muat ulang bila data belum tersedia.</p> : <section aria-label={`Sesi akun ${data.username}`} className="space-y-4"><h2 className="font-semibold">Akun: {data.username}</h2>
      {data.sessions.length === 0 && <p>Belum ada riwayat sesi.</p>}
      {data.sessions.map((s) => <Card key={s.id}><CardHeader><CardTitle className="text-base">{s.device || "Perangkat tidak dikenal"}{s.current ? " · Sesi Anda saat ini" : ""}</CardTitle></CardHeader><CardContent className="space-y-3 text-sm"><p>Status: <strong>{statusLabels[s.status]}</strong> · {s.remember ? "Ingat saya" : "Sesi biasa"}</p><dl className="grid gap-1 sm:grid-cols-[auto_1fr]"><dt>Masuk</dt><dd>{format(s.issued_at)}</dd><dt>Terakhir diperiksa</dt><dd>{format(s.last_seen_at)}</dd><dt>Batas sesi</dt><dd>{format(s.expires_at)}</dd></dl>{s.status === "active" && <Button variant="outline" disabled={busy} onClick={() => { void revoke(s.id); }}>{busy ? "Memproses…" : "Cabut sesi"}</Button>}</CardContent></Card>)}
    </section>}
  </main>;
}
