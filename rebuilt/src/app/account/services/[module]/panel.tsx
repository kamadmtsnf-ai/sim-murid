"use client";
import { useRef, useState, type FormEvent } from "react";
import { Button } from "@/components/ui/button";
import { TextField, SelectField } from "@/components/domain-controls";
import {
  snapshot,
  type ServiceSnapshot,
} from "@/lib/services/validation";
import { SurveyForm } from "./survey-form";
import { InsightsPanel } from "./insights";
type Row = Record<string, unknown>;
export const obj = (v: unknown): Row =>
  v && typeof v === "object" && !Array.isArray(v) ? (v as Row) : {};
export const list = (v: unknown): Row[] =>
  Array.isArray(v) ? (v as Row[]) : [];
const text = (r: Row, k: string) => String(r[k] ?? "");
export function ServicesPanel({
  initial,
  userId,
}: {
  initial: ServiceSnapshot;
  userId: string;
}) {
  const [data, setData] = useState(initial),
    [filters, setFilters] = useState<Record<string, string>>({}),
    [busy, setBusy] = useState(false),
    [message, setMessage] = useState(""),
    [catalog, setCatalog] = useState<Row | null>(null);
  const lock = useRef(false),
    api = "/api/services/" + data.module;
  async function load(f = filters) {
    const r = await fetch(api + "?" + new URLSearchParams(f), {
        cache: "no-store",
      }),
      b = await r.json();
    if (!r.ok) throw new Error(b.message);
    setData(snapshot.parse(b.data));
  }
  async function mutate(command: unknown) {
    if (lock.current) return false;
    lock.current = true;
    setBusy(true);
    try {
      const r = await fetch(api, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            requestId: crypto.randomUUID(),
            revision: data.revision,
            command,
          }),
        }),
        b = await r.json();
      setMessage(
        String(b.message) +
          (b.result?.missing ? " " + b.result.missing.join(", ") : ""),
      );
      if (r.ok) await load();
      return r.ok;
    } catch {
      setMessage("Koneksi terputus. Muat ulang untuk memastikan hasil.");
      return false;
    } finally {
      lock.current = false;
      setBusy(false);
    }
  }
  async function filter(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const f = Object.fromEntries(
      [...new FormData(e.currentTarget)]
        .filter(([, v]) => String(v))
        .map(([k, v]) => [k, String(v)]),
    );
    setBusy(true);
    try {
      await load(f);
      setFilters(f);
    } catch {
      setMessage("Filter atau akses belum tersedia.");
    } finally {
      setBusy(false);
    }
  }
  function pointSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const f = new FormData(e.currentTarget),
      get = (k: string) => String(f.get(k) ?? ""),
      type = get("type");
    if (type === "event")
      void mutate({
        type,
        studentId: get("studentId"),
        date: get("date"),
        code: get("code"),
        notes: get("notes"),
      });
    else if (type === "catalog")
      void mutate({
        type,
        code: get("code"),
        category: get("category"),
        description: get("description"),
        points: Number(get("points")),
        consequence: get("consequence"),
        active: f.has("active"),
      });
    else if (type === "settings")
      void mutate({
        type,
        email: f.has("email"),
        whatsapp: f.has("whatsapp"),
        threshold: Number(get("threshold")),
        subjectId: get("subjectId") || null,
      });
    else void mutate({ type, month: get("month") + "-01" });
  }
  return (
    <div className="space-y-6" aria-busy={busy}>
      
      <p role="status" aria-live="polite">
        {message}
      </p>
      {data.module === "discipline" && (
        <>
          <form
            onSubmit={filter}
            className="grid gap-3 rounded border p-4 sm:grid-cols-3"
          >
            <TextField
              label="Awal bulan"
              name="month"
              type="date"
              value={data.month}
            />
            <SelectField label="Kelas" name="classId">
              <option value="">Semua sesuai izin</option>
              {data.classes.map((c) => (
                <option value={text(c, "id")} key={text(c, "id")}>
                  {text(c, "name")}
                </option>
              ))}
            </SelectField>
            <Button disabled={busy}>Tampilkan</Button>
          </form>
          <div className="flex gap-4">
            {["csv", "xlsx", "pdf", "certificate"].map((f) => (
              <a
                className="underline"
                key={f}
                href={
                  api + "?" + new URLSearchParams({ ...filters, format: f })
                }
              >
                Unduh {f}
              </a>
            ))}
          </div>
          <p>
            Saldo awal50; rentang−50 sampai100. R02: tindak lanjut wali, R03:
            saldo0 pada kejadian tersebut. Label tingkat tidak menjalankan
            pengeluaran siswa.
          </p>
          {data.extra.canRecord === true && (
            <form
              onSubmit={pointSubmit}
              className="grid gap-3 rounded border p-4 sm:grid-cols-2"
            >
              <h2 className="font-semibold">Catat kejadian</h2>
              <input type="hidden" name="type" value="event" />
              <SelectField label="Siswa" name="studentId" required>
                <option value="">Pilih siswa</option>
                {data.rows.map((r) => (
                  <option
                    key={text(r, "student_id")}
                    value={text(r, "student_id")}
                  >
                    {text(r, "name")} — {text(r, "class_name")}
                  </option>
                ))}
              </SelectField>
              <TextField
                label="Tanggal"
                name="date"
                type="date"
                value={data.today}
                required
              />
              <SelectField label="Kode kejadian" name="code" required>
                {list(data.extra.catalog)
                  .filter((c) => c.active)
                  .map((c) => (
                    <option value={text(c, "code")} key={text(c, "code")}>
                      {text(c, "code")} {text(c, "description")} (
                      {text(c, "points")})
                    </option>
                  ))}
              </SelectField>
              <TextField label="Keterangan" name="notes" max={2000} />
              <Button disabled={busy}>Simpan kejadian</Button>
            </form>
          )}
          {data.rows.map((r) => {
            const s = obj(r.snapshot);
            return (
              <article
                key={text(r, "student_id")}
                className="space-y-2 rounded border p-4"
              >
                <h2 className="text-xl font-semibold">
                  {text(r, "name")} — {text(r, "class_name")}
                </h2>
                <p>
                  Saldo {text(s, "balance")} | Tingkat {text(s, "level")} |
                  Pelanggaran {text(s, "violations")}{" "}
                  {r.archived ? "(arsip bulanan)" : ""}
                </p>
                <ul>
                  {list(s.events).map((e) => (
                    <li className="border-b py-2" key={text(e, "id")}>
                      {text(e, "event_date")} {text(e, "code")} ×
                      {text(e, "multiplier")}{" "}
                      {e.r03 ? "R03" : e.r02 ? "R02" : ""}: {text(e, "before")}→
                      {text(e, "after")} — {text(e, "notes")}{" "}
                      {!r.archived &&
                        (data.isAdmin || e.created_by === userId) && (
                          <Button
                            variant="outline"
                            disabled={busy}
                            onClick={() => {
                              const reason = window.prompt("Alasan pembatalan");
                              if (reason)
                                void mutate({
                                  type: "cancel",
                                  id: e.id,
                                  reason,
                                });
                            }}
                          >
                            Batalkan
                          </Button>
                        )}
                    </li>
                  ))}
                </ul>
              </article>
            );
          })}
          {data.isAdmin && (
            <details className="rounded border p-4">
              <summary>Pengaturan, katalog dan arsip bulanan</summary>
              <div className="my-3 flex flex-wrap gap-2">
                {list(data.extra.catalog).map((c) => (
                  <Button
                    variant="outline"
                    key={text(c, "code")}
                    onClick={() => setCatalog(c)}
                  >
                    {text(c, "code")}
                  </Button>
                ))}
              </div>
              <form
                key={text(catalog ?? {}, "code") || "new"}
                onSubmit={pointSubmit}
                className="grid gap-3 sm:grid-cols-3"
              >
                <input name="type" value="catalog" type="hidden" />
                {[
                  "code",
                  "category",
                  "description",
                  "points",
                  "consequence",
                ].map((k) => (
                  <TextField
                    key={k}
                    name={k}
                    label={k}
                    value={text(catalog ?? {}, k)}
                    type={k === "points" ? "number" : "text"}
                    required={k !== "consequence"}
                    max={2000}
                  />
                ))}
                <label>
                  <input
                    name="active"
                    type="checkbox"
                    defaultChecked={catalog ? catalog.active === true : true}
                  />{" "}
                  Aktif
                </label>
                <Button disabled={busy}>Simpan katalog</Button>
              </form>
              <form
                onSubmit={pointSubmit}
                className="my-4 grid gap-3 sm:grid-cols-3"
              >
                <input type="hidden" name="type" value="settings" />
                <label>
                  <input
                    name="email"
                    type="checkbox"
                    defaultChecked={
                      obj(data.extra.settings).email_enabled === true
                    }
                  />{" "}
                  Aktifkan antrean email
                </label>
                <label>
                  <input
                    name="whatsapp"
                    type="checkbox"
                    defaultChecked={
                      obj(data.extra.settings).whatsapp_enabled === true
                    }
                  />{" "}
                  Aktifkan antrean WhatsApp (nomor E.164)
                </label>
                <TextField
                  label="Ambang tingkat notifikasi"
                  name="threshold"
                  type="number"
                  value={String(obj(data.extra.settings).point_threshold ?? 2)}
                />
                <SelectField
                  label="Mapel nilai afektif"
                  name="subjectId"
                  value={text(obj(data.extra.settings), "affective_subject_id")}
                >
                  <option value="">Belum ditetapkan</option>
                  {(data.subjects ?? []).map((s) => (
                    <option key={text(s, "id")} value={text(s, "id")}>
                      {text(s, "name")}
                    </option>
                  ))}
                </SelectField>
                <Button disabled={busy}>Simpan pengaturan</Button>
              </form>
              <form onSubmit={pointSubmit} className="flex flex-wrap gap-3">
                <SelectField label="Tindakan" name="type">
                  <option value="reset">Arsip bulan lalu</option>
                  <option value="affective">
                    Sinkron nilai afektif dari arsip
                  </option>
                </SelectField>
                <TextField label="Bulan" name="month" type="month" required />
                <Button disabled={busy}>Jalankan</Button>
              </form>
            </details>
          )}
        </>
      )}
      {data.module === "notifications" && (
        <>
          <p>Belum dibaca: {String(data.extra.unread ?? 0)}</p>
          <Button
            disabled={busy}
            onClick={() => void mutate({ type: "read", id: null })}
          >
            Tandai semua dibaca
          </Button>
          {data.rows.map((r) => (
            <article key={text(r, "id")} className="rounded border p-4">
              <h2 className="font-semibold">{text(r, "title")}</h2>
              <p>{text(r, "message")}</p>
              <p>{text(r, "created_at")}</p>
              {!r.read_at && (
                <Button
                  disabled={busy}
                  onClick={() => void mutate({ type: "read", id: r.id })}
                >
                  Tandai dibaca
                </Button>
              )}
            </article>
          ))}
        </>
      )}
      {data.module === "surveys" && (
        <SurveyForm data={data} userId={userId} busy={busy} mutate={mutate} />
      )}
      {data.module === "insights" && (
        <InsightsPanel
          data={data}
          busy={busy}
          mutate={mutate}
          load={async (periodId, role, quality) => {
            const f: Record<string, string> = {
              periodId,
              ...(role ? { role } : {}),
              ...(quality ? { quality } : {}),
            };
            await load(f);
            setFilters(f);
          }}
        />
      )}
      {data.module === "jobs" && (
        <>
          <p>
            Pengiriman aktual membutuhkan konfigurasi penyedia. Status ambigu
            tidak diulang otomatis.
          </p>
          <div className="flex gap-3">
            <Button
              disabled={busy}
              onClick={() => void mutate({ type: "tick", dryRun: true })}
            >
              Pratinjau pekerjaan
            </Button>
            <Button
              disabled={busy}
              onClick={() => {
                if (window.confirm("Antrekan pekerjaan yang memenuhi syarat?"))
                  void mutate({ type: "tick", dryRun: false });
              }}
            >
              Antrekan pekerjaan
            </Button>
            <Button
              disabled={busy}
              onClick={async () => {
                const r = await fetch("/api/services/dispatch", {
                    method: "POST",
                  }),
                  b = await r.json();
                setMessage(String(b.message));
                await load();
              }}
            >
              Proses satu email antrean
            </Button>
          </div>
          {data.rows.map((r) => (
            <article className="rounded border p-3" key={text(r, "id")}>
              {text(r, "event_type")}: {text(r, "status")} — percobaan{" "}
              {text(r, "attempts")}{" "}
              {r.status === "failed" && (
                <Button
                  disabled={busy}
                  onClick={() => void mutate({ type: "retry", id: r.id })}
                >
                  Antre ulang
                </Button>
              )}
            </article>
          ))}
        </>
      )}
      {data.module === "reconciliation" && (
        <>
          <form
            action="/api/services/exports"
            method="get"
            className="grid gap-3 rounded border p-4 sm:grid-cols-3"
          >
            <h2 className="font-semibold">Paket ekspor lintas modul</h2>
            <input
              name="domains"
              value="attendance,mentoring,fees,savings,discipline"
              type="hidden"
            />
            <TextField
              label="Tanggal awal operasional"
              name="start"
              type="date"
              required
            />
            <TextField
              label="Tanggal akhir operasional"
              name="end"
              type="date"
              required
            />
            <TextField
              label="Awal bulan SPK"
              name="month"
              type="date"
              value={data.month}
              required
            />
            <SelectField label="Kelas" name="classId">
              <option value="">Semua sesuai izin</option>
              {data.classes.map((c) => (
                <option value={String(c.id)} key={String(c.id)}>
                  {String(c.name)}
                </option>
              ))}
            </SelectField>
            <Button>Unduh paket XLSX</Button>
          </form>
          <p>
            Rekonsiliasi belum dapat dinyatakan selesai tanpa ekspor sumber dan
            backup yang diuji. Ringkasan target:
          </p>
          <dl>
            {Object.entries(data.extra).map(([k, v]) => (
              <div className="flex gap-4" key={k}>
                <dt>{k}</dt>
                <dd>{String(v)}</dd>
              </div>
            ))}
          </dl>
          <a className="underline" href={api + "?format=xlsx"}>
            Ekspor pemeriksaan target
          </a>
          <p>
            Gunakan paket runbook migrasi, pemeriksaan checksum, collision
            username, saldo, alokasi dan restore sebelum cutover.
          </p>
        </>
      )}
      {!data.rows.length && <p>Belum ada data sesuai filter dan izin.</p>}
    </div>
  );
}
