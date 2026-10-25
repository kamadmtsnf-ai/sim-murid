"use client";
import {confirmAction} from "@/components/ui/confirm-action";
import { useWriteGuard } from "@/lib/forms/use-write-guard";
import { useEffect, useRef, useState } from "react";
import { commands, type ServiceSnapshot } from "@/lib/services/validation";
import { surveysSnapshot } from "@/lib/services/surveys";
import { Button } from "@/components/ui/button";
import { SurveyForm } from "./survey-form";
export function SurveysPanel({
  initial,
  userId,
}: {
  initial: ServiceSnapshot;
  userId: string;
}) {
  const [data, setData] = useState(initial),
    [busy, setBusy] = useState(false),
    [blocked, setBlocked] = useState(false),
    [message, setMessage] = useState(""),
    [generation, setGeneration] = useState(0);
  const lock = useRef(false),
    mounted = useRef(true),
    pending = useRef<AbortController | null>(null);
  useWriteGuard(() => lock.current, () => blocked);
  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
      pending.current?.abort();
    };
  }, []);
  async function request(command?: unknown) {
    const c = new AbortController();
    pending.current = c;
    const timer = setTimeout(() => c.abort(), 30000);
    try {
      const r = await fetch("/api/services/surveys", {
        method: command ? "POST" : "GET",
        cache: "no-store",
        signal: c.signal,
        ...(command
          ? {
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                requestId: crypto.randomUUID(),
                revision: data.revision,
                command,
              }),
            }
          : {}),
      });
      const body: unknown = await r.json();
      if (!body || typeof body !== "object") throw Error("Invalid response");
      return { r, b: body as Record<string, unknown> };
    } finally {
      clearTimeout(timer);
      pending.current = null;
    }
  }
  async function mutate(command: unknown) {
    if (lock.current || blocked) return false;
    const cmd = commands.surveys.safeParse(command);
    if (!cmd.success) {
      setMessage("Periksa isian, target, pertanyaan dan periode survei.");
      return false;
    }
    lock.current = true;
    setBusy(true);
    setMessage("Menyimpan…");
    try {
      const { r, b } = await request(cmd.data);
      if (!mounted.current) return false;
      if (!r.ok) {
        if (r.status >= 500) throw Error("Uncertain");
        if (
          [401, 403].includes(r.status) ||
          ["stale", "locked", "request_conflict", "not_found"].includes(
            String(b.code),
          )
        )
          setBlocked(true);
        setMessage(
          typeof b.message === "string"
            ? b.message
            : "Survei belum dapat disimpan.",
        );
        return false;
      }
      if (b.code !== "saved") throw Error("Unconfirmed");
      const next = surveysSnapshot.parse(b.data);
      if (next.rows.some((p) => p.response && p.response.user_id !== userId))
        throw Error("Wrong user");
      setData(next);
      setMessage("Perubahan survei tersimpan di server.");
      return true;
    } catch {
      if (mounted.current) {
        setBlocked(true);
        setMessage(
          "Hasil penyimpanan belum dapat dipastikan. Draft tetap dipertahankan. Muat ulang untuk memeriksa jawaban server sebelum mencoba kembali.",
        );
      }
      return false;
    } finally {
      lock.current = false;
      if (mounted.current) setBusy(false);
    }
  }
  async function reload() {
    if (lock.current) return;
    if (
      !await confirmAction(
        "Muat ulang jawaban dari server? Draft perangkat dengan versi berbeda tidak diterapkan otomatis.",
      )
    )
      return;
    lock.current = true;
    setBusy(true);
    try {
      const { r, b } = await request();
      if (!r.ok) throw Error("Unavailable");
      const next = surveysSnapshot.parse(b.data);
      if (next.rows.some((p) => p.response && p.response.user_id !== userId))
        throw Error("Wrong user");
      if (mounted.current) {
        setData(next);
        setBlocked(false);
        setGeneration((v) => v + 1);
        setMessage(
          "Data server berhasil dimuat ulang. Buka survei untuk memeriksa draft Anda.",
        );
      }
    } catch {
      if (mounted.current)
        setMessage(
          "Data belum dapat dimuat ulang. Draft tetap dipertahankan; periksa koneksi dan coba kembali.",
        );
    } finally {
      lock.current = false;
      if (mounted.current) setBusy(false);
    }
  }
  return (
    <div className="surveys-panel space-y-5" aria-busy={busy}>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <p className="text-muted-foreground">
          Sampaikan evaluasi untuk peningkatan layanan dan pembelajaran
          madrasah.
        </p>
        <Button
          type="button"
          variant="outline"
          disabled={busy}
          onClick={() => void reload()}
        >
          Muat ulang survei
        </Button>
      </div>
      {message && (
        <p role="status" className="rounded-lg border bg-muted p-3 text-sm">
          {message}
        </p>
      )}
      <SurveyForm
        key={generation}
        data={data}
        userId={userId}
        busy={busy}
        blocked={blocked}
        mutate={mutate}
      />
    </div>
  );
}
