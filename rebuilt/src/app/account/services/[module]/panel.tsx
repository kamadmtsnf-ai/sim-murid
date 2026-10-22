"use client";
import { useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { TextField, SelectField } from "@/components/domain-controls";
import { snapshot, type ServiceSnapshot } from "@/lib/services/validation";
import { SurveyForm } from "./survey-form";
import { InsightsPanel } from "./insights";
import { DisciplinePanel } from "./discipline-panel";
import { disciplineSnapshot } from "@/lib/services/discipline";
import { NotificationsPanel } from "./notifications-panel";
type Row = Record<string, unknown>;
export const obj = (v: unknown): Row =>
  v && typeof v === "object" && !Array.isArray(v) ? (v as Row) : {};
export const list = (v: unknown): Row[] =>
  Array.isArray(v) ? (v as Row[]) : [];
const text = (r: Row, k: string) => String(r[k] ?? "");
export function ServicesPanel(props: {
  initial: ServiceSnapshot;
  userId: string;
}) {
  if (props.initial.module === "discipline")
    return (
      <DisciplinePanel
        key={`${props.userId}:${props.initial.revision}:${props.initial.month}`}
        initial={disciplineSnapshot.parse(props.initial)}
        userId={props.userId}
      />
    );
  return props.initial.module === "notifications" ? (
    <NotificationsPanel
      key={`${props.userId}:${props.initial.revision}`}
      initial={props.initial}
    />
  ) : (
    <ServiceModulesPanel {...props} />
  );
}
function ServiceModulesPanel({
  initial,
  userId,
}: {
  initial: ServiceSnapshot;
  userId: string;
}) {
  const [data, setData] = useState(initial),
    [filters, setFilters] = useState<Record<string, string>>({}),
    [busy, setBusy] = useState(false),
    [message, setMessage] = useState("");
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
  return (
    <div className="space-y-6" aria-busy={busy}>
      <p role="status" aria-live="polite">
        {message}
      </p>
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
