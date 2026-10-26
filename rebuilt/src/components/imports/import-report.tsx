"use client";
import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Status } from "@/components/ui/status";
/** Reports receive a whitelist of fields, never passwords or workbook payloads. */
export function ImportReport({ name, label, headers, rows, instructions = [], disabled = false }: {
  name: string; label: string; headers: readonly string[];
  rows: readonly (readonly (string | number | null)[])[];
  instructions?: readonly string[]; disabled?: boolean;
}) {
  const [busy, setBusy] = useState(false), [error, setError] = useState(false);
  const active = useRef(false), mounted = useRef(true);
  useEffect(()=>{mounted.current=true;return ()=>{mounted.current=false;};},[]);
  async function download() {
    if (active.current || disabled || !rows.length) return;
    active.current=true;setBusy(true);setError(false);
    try {
      const { downloadExcel } = await import("@/lib/spreadsheets/write");
      await downloadExcel(name, headers, rows, [
        "Laporan pemeriksaan, bukan template untuk diimpor. Cocokkan nomor baris dengan berkas sumber.",
        "Status belum pasti atau belum diproses bukan bukti tersimpan. Jangan mengirim ulang sebagai batch baru sebelum memeriksa hasil.",
        "Status merupakan cuplikan saat unduhan diminta. Unduh ulang setelah proses selesai untuk memperoleh hasil terbaru.",
        ...instructions,
      ], { wrapText: true });
    } catch { if(mounted.current)setError(true); }
    finally { active.current=false;if(mounted.current)setBusy(false); }
  }
  return <div className="min-w-0 space-y-2"><Button type="button" variant="outline" disabled={disabled||busy||!rows.length} aria-busy={busy} onClick={()=>void download()}>{busy?"Menyiapkan laporan…":label}</Button>{error?<Status tone="error" heading="Laporan belum dapat diunduh">Coba unduh kembali. Status impor dan isian tetap dipertahankan.</Status>:null}</div>;
}
