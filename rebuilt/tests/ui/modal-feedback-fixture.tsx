import { useState } from "react";
import { createRoot } from "react-dom/client";
import { Dialog } from "../../src/components/ui/dialog";
import { Button } from "../../src/components/ui/button";
import { MutationFeedback } from "../../src/components/feedback/mutation-feedback";
import { confirmAction } from "../../src/components/ui/confirm-action";
import type { MutationPhase } from "../../src/lib/forms/mutation-result";
function Fixture() {
  const [open, setOpen] = useState(false),
    [busy, setBusy] = useState(false),
    [phase, setPhase] = useState<MutationPhase>("idle"),
    [count, setCount] = useState(0);
  return (
    <main id="main-content" className="min-w-0 p-4">
      <h1>Modal dan feedback</h1>
      <p>Perubahan: {count}</p>
      <Button
        type="button"
        onClick={async () => {
          if (
            await confirmAction(
              "Perubahan yang sudah dikonfirmasi akan dijalankan satu kali.",
              {
                title: "Hapus catatan?",
                confirmLabel: "Hapus catatan",
                tone: "danger",
              },
            )
          )
            setCount((v) => v + 1);
        }}
      >
        Uji konfirmasi
      </Button>
      <Dialog
        className={
          new URLSearchParams(window.location.search).get("variant") ?? ""
        }
        open={open}
        onOpenChange={setOpen}
        closeDisabled={busy}
        title="Formulir dengan konten panjang"
        description="Periksa isian sebelum menyimpan. Header dan tombol tutup tetap terjangkau; isi formulir dapat digulir."
        trigger={<Button type="button">Buka formulir</Button>}
      >
        <div className="min-w-0 space-y-4">
          <label className="block">
            Nama
            <input
              className="ds-field-control"
              defaultValue="Draf tetap tersimpan"
            />
          </label>
          <label className="block">
            Status feedback
            <select
              className="ds-field-control"
              value={phase}
              onChange={(e) => setPhase(e.target.value as MutationPhase)}
            >
              {[
                "idle",
                "pending",
                "success",
                "error",
                "blocked",
                "uncertain",
              ].map((v) => (
                <option key={v}>{v}</option>
              ))}
            </select>
          </label>
          <Button
            type="button"
            onClick={() => {
              setBusy(true);
              setPhase("pending");
              setTimeout(() => {
                setBusy(false);
                setPhase("success");
              }, 1200);
            }}
          >
            Mulai proses
          </Button>
          <MutationFeedback {...{tone:"success" as const}} phase={phase}>
            {phase === "uncertain"
              ? "Respons server belum diterima; hasil belum dapat dipastikan."
              : phase === "success"
                ? "Data telah dikonfirmasi oleh server."
                : "Keterangan proses sesuai status yang dipilih."}
          </MutationFeedback>
          {Array.from({ length: 25 }, (_, i) => (
            <label key={i} className="block">
              Isian {i + 1}
              <input className="ds-field-control" />
            </label>
          ))}
          <Button type="button">
            Tindakan dengan label panjang yang harus tetap mudah dibaca pada
            layar ponsel
          </Button>
        </div>
      </Dialog>
    </main>
  );
}
createRoot(document.getElementById("root")!).render(<Fixture />);
