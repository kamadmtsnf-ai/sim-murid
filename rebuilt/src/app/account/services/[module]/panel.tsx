"use client";
import { JobsPanel } from "./jobs-panel";
import { Button } from "@/components/ui/button";
import { TextField, SelectField } from "@/components/domain-controls";
import { type ServiceSnapshot } from "@/lib/services/validation";
import { SurveysPanel } from "./surveys-panel";
import { InsightsWorkspace } from "./insights-workspace";
import { DisciplinePanel } from "./discipline-panel";
import { disciplineSnapshot } from "@/lib/services/discipline";
import { NotificationsPanel } from "./notifications-panel";
type Row = Record<string, unknown>;
export const obj = (v: unknown): Row =>
  v && typeof v === "object" && !Array.isArray(v) ? (v as Row) : {};
export const list = (v: unknown): Row[] =>
  Array.isArray(v) ? (v as Row[]) : [];
export function ServicesPanel(props: {
  initial: ServiceSnapshot;
  userId: string;
}) {
  if (props.initial.module === "jobs")
    return <JobsPanel initial={props.initial} />;
  if (props.initial.module === "insights")
    return <InsightsWorkspace initial={props.initial} />;
  if (props.initial.module === "surveys")
    return (
      <SurveysPanel
        key={props.userId + ":" + props.initial.revision}
        {...props}
      />
    );
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
}: {
  initial: ServiceSnapshot;
  userId: string;
}) {
  const data = initial,
    api = "/api/services/" + data.module;
  return (
    <div className="space-y-6">
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
