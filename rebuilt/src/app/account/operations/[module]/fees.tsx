"use client";
import { useState, type FormEvent } from "react";
import { Button } from "@/components/ui/button";
import { TextField, controlClass } from "@/components/domain-controls";
type Row = Record<string, unknown>;
export function FeeBrackets({
  brackets,
  busy,
  onSave,
}: {
  brackets: Row[];
  busy: boolean;
  onSave: (command: unknown) => Promise<void>;
}) {
  const [edit, setEdit] = useState<Row | null>(null);
  function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const f = new FormData(e.currentTarget);
    void onSave({
      type: "bracket",
      id: edit?.id ?? null,
      minimum: Number(f.get("minimum")),
      maximum:
        String(f.get("maximum")) === "" ? null : Number(f.get("maximum")),
      percent: Number(f.get("percent")),
      active: f.has("active"),
      ...(edit ? { reason: String(f.get("reason")) } : {}),
    });
  }
  return (
    <section className="space-y-3 rounded border p-4">
      <h2 className="font-semibold">Tarif biaya penarikan</h2>
      <p className="text-sm">
        Batas bawah dan atas termasuk dalam rentang. Maksimum kosong berarti
        tanpa batas. Rentang aktif tidak boleh bertumpang tindih.
      </p>
      <div className="flex flex-wrap gap-2">
        {brackets.map((b) => (
          <Button
            key={String(b.id)}
            variant="outline"
            type="button"
            onClick={() => setEdit(b)}
          >
            {String(b.minimum)}–{String(b.maximum ?? "∞")} / {String(b.percent)}
            % {b.active ? "aktif" : "nonaktif"}
          </Button>
        ))}
      </div>
      <form
        key={String(edit?.id ?? "new")}
        onSubmit={submit}
        className="grid gap-3 sm:grid-cols-3"
      >
        <TextField
          label="Minimum Rp"
          name="minimum"
          type="number"
          value={String(edit?.minimum ?? 0)}
          required
        />
        <TextField
          label="Maksimum Rp"
          name="maximum"
          type="number"
          value={edit?.maximum === null ? "" : String(edit?.maximum ?? "")}
        />
        <label>
          Persentase
          <input
            name="percent"
            type="number"
            min="0"
            max="100"
            step="0.0001"
            defaultValue={String(edit?.percent ?? 0)}
            required
            className={controlClass}
          />
        </label>
        <label>
          <input
            type="checkbox"
            name="active"
            defaultChecked={edit ? edit.active === true : true}
          />{" "}
          Aktif
        </label>
        {edit && <TextField label="Alasan perubahan" name="reason" required />}
        <Button disabled={busy}>Simpan tarif</Button>
        {edit && (
          <Button type="button" variant="outline" onClick={() => setEdit(null)}>
            Tarif baru
          </Button>
        )}
      </form>
    </section>
  );
}
export function FeePreview() {
  const [message, setMessage] = useState("");
  return (
    <div className="space-y-2">
      <label>
        <input type="checkbox" name="feeApplied" /> Terapkan biaya pada
        penarikan
      </label>
      <Button
        type="button"
        variant="outline"
        onClick={async (e) => {
          const f = e.currentTarget.closest("form");
          if (!f) return;
          const data = new FormData(f);
          try {
            const r = await fetch(
                "/api/slips/quote?amount=" +
                  String(data.get("amount")) +
                  "&apply=" +
                  String(data.has("feeApplied")),
              ),
              body = await r.json();
            if (!r.ok) throw new Error(body.message);
            setMessage(
              "Biaya Rp" +
                String(body.quote.fee) +
                "; uang diterima Rp" +
                String(body.quote.cash) +
                (body.quote.matched ? "" : " (tidak ada tarif yang cocok)"),
            );
          } catch {
            setMessage("Periksa nominal dan akses Anda.");
          }
        }}
      >
        Hitung biaya di server
      </Button>
      <p role="status">{message}</p>
    </div>
  );
}
export function SlipActions({ id, canSend }: { id: string; canSend: boolean }) {
  const [message, setMessage] = useState(""),
    [busy, setBusy] = useState(false);
  return (
    <div className="space-y-2">
      <a
        className="block underline"
        href={"/api/slips/" + id + "?format=html"}
        target="_blank"
        rel="noreferrer"
      >
        Lihat slip
      </a>
      <a className="block underline" href={"/api/slips/" + id + "?format=pdf"}>
        PDF slip
      </a>
      {canSend && (
        <Button
          type="button"
          variant="outline"
          disabled={busy}
          onClick={async () => {
            setBusy(true);
            try {
              const r = await fetch("/api/slips/" + id, { method: "POST" }),
                b = await r.json();
              setMessage(String(b.message));
            } catch {
              setMessage(
                "Hasil pengiriman belum pasti. Periksa status sebelum mengulang.",
              );
            } finally {
              setBusy(false);
            }
          }}
        >
          Kirim / lanjutkan antrean email
        </Button>
      )}
      {canSend && (
        <Button
          type="button"
          variant="outline"
          disabled={busy}
          onClick={async () => {
            try {
              const r = await fetch("/api/slips/" + id, { cache: "no-store" }),
                b = await r.json();
              if (!r.ok) throw new Error();
              const d = b.slip.deliveries as {
                email: string;
                status: string;
                attempts: number;
              }[];
              setMessage(
                d.length
                  ? d
                      .map(
                        (x) =>
                          x.email +
                          ": " +
                          x.status +
                          " (" +
                          x.attempts +
                          " percobaan)",
                      )
                      .join("; ")
                  : "Belum ada antrean email.",
              );
            } catch {
              setMessage("Status email belum dapat dibaca.");
            }
          }}
        >
          Status email
        </Button>
      )}
      <p role="status">{message}</p>
    </div>
  );
}
