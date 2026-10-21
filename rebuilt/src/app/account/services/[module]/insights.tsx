"use client";
import { useState, type FormEvent } from "react";
import { Button } from "@/components/ui/button";
import {
  TextField,
  SelectField,
  controlClass,
} from "@/components/domain-controls";
import type { ServiceSnapshot } from "@/lib/services/validation";
type Row = Record<string, unknown>;
const list = (v: unknown): Row[] => (Array.isArray(v) ? (v as Row[]) : []),
  obj = (v: unknown): Row => (v && typeof v === "object" ? (v as Row) : {});
export function InsightsPanel({
  data,
  busy,
  mutate,
  load,
}: {
  data: ServiceSnapshot;
  busy: boolean;
  mutate: (c: unknown) => Promise<boolean>;
  load: (periodId: string, role?: string, quality?: string) => Promise<void>;
}) {
  const [period, setPeriod] = useState(""),
    [message, setMessage] = useState(""),
    [points, setPoints] = useState(3),
    [role, setRole] = useState(""),
    [quality, setQuality] = useState("");
  async function ai(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const f = new FormData(e.currentTarget),
      body = Object.fromEntries(f);
    try {
      const r = await fetch("/api/services/ai", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            ...body,
            ...(body.action === "configure" ? {} : { periodId: period }),
          }),
        }),
        b = await r.json();
      setMessage(String(b.message));
      if (r.ok && period) await load(period);
    } catch {
      setMessage("Penyedia belum tersedia. Hasil tidak dinyatakan berhasil.");
    }
  }
  function plan(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const f = new FormData(e.currentTarget);
    void mutate({
      type: "plan",
      periodId: period,
      items: Array.from({ length: points }, (_, i) =>
        Object.fromEntries(
          ["description", "owner", "target", "aspect", "status"].map((k) => [
            k,
            String(f.get(k + i) ?? ""),
          ]),
        ),
      ),
    });
  }
  return (
    <section className="space-y-6">
      <p role="status">{message}</p>
      <label>
        Periode
        <select
          className={controlClass}
          value={period}
          onChange={async (e) => {
            setPeriod(e.target.value);
            if (e.target.value) await load(e.target.value);
          }}
        >
          <option value="">Pilih periode</option>
          {data.rows.map((p) => (
            <option key={String(p.id)} value={String(p.id)}>
              {String(p.title)} ({String(p.kind)})
            </option>
          ))}
        </select>
      </label>
      {data.extra.suppressed === true && (
        <p>
          Hasil personal disembunyikan sampai minimal{" "}
          {String(data.extra.minimum)} penilai substantif terpenuhi.
        </p>
      )}
      {data.extra.peer !== undefined && (
        <section>
          <h2 className="font-semibold">Hasil teman sejawat</h2>
          <p>Penilai substantif: {String(obj(data.extra.peer).count)}</p>
          {Object.entries(obj(obj(data.extra.peer).dimensions)).map(
            ([k, v]) => (
              <p key={k}>
                {k}: {String(v)}
              </p>
            ),
          )}
          {Array.isArray(obj(data.extra.peer).quotes) &&
            (obj(data.extra.peer).quotes as string[]).map((q, i) => (
              <blockquote className="border-l p-3" key={i}>
                {q}
              </blockquote>
            ))}
        </section>
      )}
      {data.isManager && (
        <form
          onSubmit={async (e) => {
            e.preventDefault();
            await load(period, role, quality);
          }}
          className="flex flex-wrap gap-3"
        >
          <label>
            Peran
            <select
              className={controlClass}
              value={role}
              onChange={(e) => setRole(e.target.value)}
            >
              <option value="">Semua</option>
              {["student", "teacher", "parent"].map((k) => (
                <option key={k}>{k}</option>
              ))}
            </select>
          </label>
          <label>
            Keandalan
            <select
              className={controlClass}
              value={quality}
              onChange={(e) => setQuality(e.target.value)}
            >
              <option value="">Semua (termasuk flag)</option>
              {["tinggi", "sedang", "rendah"].map((k) => (
                <option key={k}>{k}</option>
              ))}
            </select>
          </label>
          <Button disabled={!period || busy}>Terapkan filter hasil</Button>
        </form>
      )}
      {data.isManager && (
        <>
          <h2 className="font-semibold">Progres dan keandalan</h2>
          {list(data.extra.progress).map((r) => (
            <article key={String(r.user_id)} className="rounded border p-3">
              <p>
                {String(r.name)} — {r.submitted_at ? "Terkirim" : "Draft"} —{" "}
                {String(obj(r.flags).reliability ?? "belum final")}
              </p>
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  void mutate({
                    type: "note",
                    periodId: period,
                    userId: r.user_id,
                    note: String(
                      new FormData(e.currentTarget).get("note") ?? "",
                    ),
                  });
                }}
                className="flex gap-3"
              >
                <TextField
                  label="Catatan pemantau"
                  name="note"
                  value={String(r.note ?? "")}
                  max={2000}
                />
                <Button disabled={busy}>Simpan catatan</Button>
              </form>
            </article>
          ))}
          <div className="overflow-auto">
            <table className="w-full text-left">
              <thead>
                <tr>
                  {["Peran", "Aspek", "Kode", "Jumlah", "Rata-rata"].map(
                    (k) => (
                      <th key={k}>{k}</th>
                    ),
                  )}
                </tr>
              </thead>
              <tbody>
                {list(data.extra.aggregates).map((r, i) => (
                  <tr key={i}>
                    {["role", "aspect", "code", "n", "mean"].map((k) => (
                      <td className="border-b p-2" key={k}>
                        {String(r[k] ?? "")}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <details>
            <summary>Tren lintas periode</summary>
            {list(data.extra.trend).map((r, i) => (
              <p key={i}>
                {String(r.period_id)} / {String(r.role)} / {String(r.aspect)}:{" "}
                {String(r.mean)} (n={String(r.n)})
              </p>
            ))}
          </details>
          <details>
            <summary>Esai terotorisasi tanpa identitas responden</summary>
            {list(data.extra.essays).map((r, i) => (
              <p className="border-b p-3" key={i}>
                {String(r.code)} — {String(r.text)}
              </p>
            ))}
          </details>
          {data.extra.canPlan === true &&
            list(data.extra.plan).map((p, i) => (
              <form
                key={i}
                onSubmit={(e) => {
                  e.preventDefault();
                  void mutate({
                    type: "plan_status",
                    periodId: period,
                    index: i,
                    status: String(new FormData(e.currentTarget).get("status")),
                  });
                }}
                className="flex gap-3 rounded border p-3"
              >
                <p>{String(p.description)}</p>
                <SelectField
                  label="Ketercapaian"
                  name="status"
                  value={String(p.status)}
                >
                  {["belum", "proses", "selesai"].map((k) => (
                    <option key={k}>{k}</option>
                  ))}
                </SelectField>
                <Button disabled={busy}>Perbarui status</Button>
              </form>
            ))}
          {data.extra.canPlan === true && period && (
            <form className="space-y-3 rounded border p-4" onSubmit={plan}>
              <h2 className="font-semibold">Rencana aksi Kepala Madrasah</h2>
              <p>3–7poin, setelah akhir tanggal penutupan sampai H+30.</p>
              <label>
                Jumlah poin
                <input
                  type="number"
                  min="3"
                  max="7"
                  value={points}
                  className={controlClass}
                  onChange={(e) =>
                    setPoints(Math.max(3, Math.min(7, Number(e.target.value))))
                  }
                />
              </label>
              {Array.from({ length: points }, (_, i) => (
                <fieldset
                  key={i}
                  className="grid gap-3 border p-3 sm:grid-cols-3"
                >
                  <legend>Poin {i + 1}</legend>
                  <TextField
                    label="Deskripsi"
                    name={"description" + i}
                    required
                    max={2000}
                  />
                  <TextField
                    label="Penanggung jawab"
                    name={"owner" + i}
                    required
                  />
                  <TextField
                    label="Target waktu"
                    name={"target" + i}
                    type="date"
                    required
                  />
                  <SelectField label="Aspek" name={"aspect" + i}>
                    {[
                      "Pengajaran",
                      "Fasilitas",
                      "Kurikulum",
                      "Karakter",
                      "Disiplin",
                      "Budaya",
                    ].map((k) => (
                      <option key={k}>{k}</option>
                    ))}
                  </SelectField>
                  <SelectField label="Ketercapaian" name={"status" + i}>
                    {["belum", "proses", "selesai"].map((k) => (
                      <option key={k}>{k}</option>
                    ))}
                  </SelectField>
                </fieldset>
              ))}
              <Button disabled={busy}>Simpan rencana</Button>
            </form>
          )}
          {data.isAdmin && (
            <form
              onSubmit={ai}
              className="grid gap-3 rounded border p-4 sm:grid-cols-3"
            >
              <h2 className="font-semibold">Konfigurasi penyedia AI</h2>
              <input type="hidden" name="action" value="configure" />
              <SelectField label="Penyedia" name="provider">
                <option value="anthropic">Anthropic</option>
                <option value="gemini">Gemini</option>
              </SelectField>
              <TextField
                label="Model yang tersedia pada akun penyedia"
                name="model"
                required
              />
              <TextField
                label="API key baru (tidak ditampilkan ulang)"
                name="key"
                type="password"
                required
              />
              <Button disabled={busy}>Simpan terenkripsi</Button>
            </form>
          )}
          <p>
            Status:{" "}
            {list(data.extra.configs)
              .map(
                (c) =>
                  String(c.provider) +
                  " / " +
                  String(c.model) +
                  " terkonfigurasi",
              )
              .join("; ") || "Belum dikonfigurasi"}
          </p>
          <form onSubmit={ai} className="flex flex-wrap gap-3">
            <SelectField name="action" label="Tindakan">
              <option value="analyze">Analisis esai</option>
              <option value="invalidate">
                Hapus cache selesai untuk ulang
              </option>
            </SelectField>
            <SelectField label="Penyedia" name="provider">
              <option value="anthropic">Anthropic</option>
              <option value="gemini">Gemini</option>
            </SelectField>
            <Button disabled={busy || !period}>Jalankan</Button>
          </form>
          {list(data.extra.analyses).map((r) => (
            <article key={String(r.id)} className="rounded border p-3">
              <h3>
                {String(r.model)} — {String(r.status)}
              </h3>
              {r.result !== null &&
                Object.entries(obj(r.result)).map(([k, v]) => (
                  <p key={k}>
                    {k}: {typeof v === "string" ? v : JSON.stringify(v)}
                  </p>
                ))}
              {typeof r.error_code === "string" && (
                <p>Analisis gagal: {String(r.error_code)}</p>
              )}
            </article>
          ))}
        </>
      )}
    </section>
  );
}
