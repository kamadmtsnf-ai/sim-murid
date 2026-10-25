"use client";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { analysisSchema } from "@/lib/services/analysis-schema";
/** Review is local acknowledgement, never a domain approval or automatic plan write. */
export function AiReview({ value }: { value: unknown }) {
  const parsed = analysisSchema.safeParse(value);
  const [reviewed, setReviewed] = useState(false),
    [message, setMessage] = useState("");
  if (!parsed.success) return null;
  async function copy() {
    try {
      await navigator.clipboard.writeText(
        parsed.success
          ? parsed.data.rekomendasi_tindakan
              .map((s, i) => `${i + 1}. ${s}`)
              .join("\n")
          : "",
      );
      setMessage(
        "Draf disalin. Sesuaikan penanggung jawab dan target sebelum menyimpan rencana secara manual.",
      );
    } catch {
      setMessage(
        "Tidak dapat menyalin. Salin rekomendasi dari hasil secara manual.",
      );
    }
  }
  return (
    <section
      className="space-y-3 rounded-lg border bg-muted/30 p-4"
      aria-label="Tinjauan draf AI"
    >
      <p className="font-semibold">Draf AI · wajib ditinjau manusia</p>
      <p>
        Ringkasan sampel esai bukan fakta terverifikasi atau keputusan
        individual. Cocokkan sumber, periode, tema dan kutipan; rekomendasi
        tidak mengubah nilai, keuangan, sanksi atau hak akses.
      </p>
      <label className="flex min-h-11 items-start gap-3">
        <input
          type="checkbox"
          className="mt-1 size-5 shrink-0"
          checked={reviewed}
          onChange={(e) => {
            setReviewed(e.target.checked);
            setMessage("");
          }}
        />
        <span>
          Saya telah meninjau sumber dan isi draf untuk digunakan sebagai bahan
          pertimbangan.
        </span>
      </label>
      <Button
        type="button"
        variant="outline"
        disabled={!reviewed || !parsed.data.rekomendasi_tindakan.length}
        onClick={() => void copy()}
      >
        Salin draf rekomendasi
      </Button>
      <p role="status">{message}</p>
    </section>
  );
}
