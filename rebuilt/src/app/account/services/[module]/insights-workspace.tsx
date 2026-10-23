"use client";
import { useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { snapshot, type ServiceSnapshot } from "@/lib/services/validation";
import { InsightsPanel } from "./insights";
export function InsightsWorkspace({ initial }: { initial: ServiceSnapshot }) {
  const [data, setData] = useState(initial),
    [busy, setBusy] = useState(false),
    [blocked, setBlocked] = useState(false),
    [message, setMessage] = useState("");
  const lock = useRef(false),
    scope = useRef<Record<string, string>>({});
  const api = "/api/services/insights";
  async function read(filters = scope.current) {
    const r = await fetch(api + "?" + new URLSearchParams(filters), {
      cache: "no-store",
      signal: AbortSignal.timeout(30000),
    });
    const b = await r.json();
    if (!r.ok)
      throw Error(
        typeof b.message === "string" ? b.message : "Hasil belum tersedia.",
      );
    const next = snapshot.parse(b.data);
    if (
      next.module !== "insights" ||
      Object.keys((next.extra.appliedFilters as object) ?? {}).length !==
        Object.keys(filters).length ||
      Object.keys(filters).some(
        (k) =>
          (next.extra.appliedFilters as Record<string, unknown>)?.[k] !==
          filters[k],
      )
    )
      throw Error("Cakupan hasil belum terkonfirmasi.");
    setData(next);
    scope.current = filters;
  }
  async function load(periodId: string, role?: string, quality?: string) {
    if (lock.current) return;
    lock.current = true;
    setBusy(true);
    try {
      await read({
        ...(periodId ? { periodId } : {}),
        ...(role ? { role } : {}),
        ...(quality ? { quality } : {}),
      });
      setBlocked(false);
      setMessage("");
    } catch {
      setBlocked(true);
      setMessage("Hasil belum dapat dimuat. Muat ulang sebelum melanjutkan.");
    } finally {
      lock.current = false;
      setBusy(false);
    }
  }
  async function mutate(command: unknown) {
    if (lock.current || blocked) return false;
    lock.current = true;
    setBusy(true);
    try {
      const r = await fetch(api + "?" + new URLSearchParams(scope.current), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          requestId: crypto.randomUUID(),
          revision: data.revision,
          command,
        }),
        signal: AbortSignal.timeout(30000),
      });
      const b = await r.json();
      if (!r.ok || b.result?.code !== "saved") {
        setMessage(String(b.message ?? "Penyimpanan belum berhasil."));
        if (r.status !== 400) setBlocked(true);
        return false;
      }
      const confirmed = snapshot.parse(b.data);
      if (confirmed.module !== "insights") throw Error("Wrong module");
      setData(confirmed);
      setMessage("Perubahan tersimpan dan hasil telah dimuat ulang.");
      return true;
    } catch {
      setBlocked(true);
      setMessage(
        "Hasil penyimpanan belum dapat dipastikan. Muat ulang sebelum melanjutkan.",
      );
      return false;
    } finally {
      lock.current = false;
      setBusy(false);
    }
  }
  return (
    <div className="min-w-0 space-y-4" aria-busy={busy}>
      <p role="status" aria-live="polite">
        {busy ? "Memproses hasil survei…" : message}
      </p>
      <Button
        variant="outline"
        disabled={busy}
        onClick={() =>
          void load(
            scope.current.periodId ?? "",
            scope.current.role,
            scope.current.quality,
          )
        }
      >
        Muat ulang hasil
      </Button>
      <fieldset disabled={busy || blocked} className="min-w-0">
        <InsightsPanel
          key={JSON.stringify(data.extra.appliedFilters)}
          data={data}
          busy={busy || blocked}
          load={load}
          mutate={mutate}
        />
      </fieldset>
    </div>
  );
}
