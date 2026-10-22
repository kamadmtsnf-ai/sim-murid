"use client";
import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { slipDeliverySchema } from "@/lib/operations/savings";
/** Delivery actions never retry ambiguous sends automatically. They do not alter the savings ledger. */
export function SlipActions({ id, canSend }: { id: string; canSend: boolean }) {
  const [message, setMessage] = useState(""),
    [busy, setBusy] = useState(false),
    [uncertain, setUncertain] = useState(false),
    [reversed, setReversed] = useState(false);
  const lock = useRef(false),
    mounted = useRef(true),
    controller = useRef<AbortController | null>(null);
  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
      controller.current?.abort();
    };
  }, []);
  async function action(send: boolean) {
    if (lock.current || (send && (uncertain || reversed))) return;
    lock.current = true;
    setBusy(true);
    setMessage(send ? "Memproses antrean email…" : "Memuat status email…");
    const abort = new AbortController();
    controller.current = abort;
    const timer = setTimeout(() => abort.abort(), 30000);
    try {
      let acknowledgement = "";
      if (send) {
        const r = await fetch("/api/slips/" + id, {
            method: "POST",
            signal: abort.signal,
          }),
          body = await r.json();
        if (!r.ok || body.status === "ambiguous") throw Error("Uncertain send");
        acknowledgement =
          typeof body.message === "string" ? body.message : "Antrean diproses.";
      }
      const response = await fetch("/api/slips/" + id, {
        cache: "no-store",
        signal: abort.signal,
      });
      if (!response.ok) throw Error("Unavailable");
      const slip = slipDeliverySchema.parse((await response.json()).slip);
      if (!mounted.current) return;
      setReversed(slip.reversed);
      setUncertain(
        slip.deliveries.some(
          (d) => d.status === "sending" || d.status === "ambiguous",
        ),
      );
      const labels = {
        queued: "Dalam antrean",
        sending: "Sedang dikirim",
        sent: "Diterima server email",
        failed: "Gagal",
        ambiguous: "Hasil belum pasti",
      };
      setMessage(
        [
          acknowledgement,
          slip.reversed
            ? "Slip telah dibatalkan/dibalik."
            : slip.deliveries.length
              ? slip.deliveries
                  .map(
                    (d) =>
                      d.email +
                      ": " +
                      labels[d.status] +
                      " (" +
                      d.attempts +
                      " percobaan)",
                  )
                  .join("; ")
              : "Belum ada antrean email.",
        ]
          .filter(Boolean)
          .join(" "),
      );
    } catch {
      if (mounted.current) {
        if (send) setUncertain(true);
        setMessage(
          send
            ? "Hasil pengiriman belum dapat dipastikan. Periksa status sebelum melanjutkan; jangan mengirim ulang otomatis."
            : "Status email belum dapat dibaca. Coba periksa status kembali.",
        );
      }
    } finally {
      clearTimeout(timer);
      lock.current = false;
      controller.current = null;
      if (mounted.current) setBusy(false);
    }
  }
  return (
    <div className="min-w-0 space-y-2">
      <a
        className="inline-flex min-h-11 items-center underline"
        href={"/api/slips/" + id + "?format=html"}
        target="_blank"
        rel="noreferrer"
      >
        Lihat slip
      </a>
      <a
        className="ml-3 inline-flex min-h-11 items-center underline"
        href={"/api/slips/" + id + "?format=pdf"}
      >
        PDF slip
      </a>
      {canSend && (
        <div className="flex flex-wrap gap-2">
          <Button
            type="button"
            variant="outline"
            disabled={busy || uncertain || reversed}
            onClick={() => void action(true)}
          >
            Kirim / lanjutkan antrean email
          </Button>
          <Button
            type="button"
            variant="outline"
            disabled={busy}
            onClick={() => void action(false)}
          >
            Status email
          </Button>
        </div>
      )}
      <p role="status" className="break-words text-sm">
        {message}
      </p>
    </div>
  );
}
