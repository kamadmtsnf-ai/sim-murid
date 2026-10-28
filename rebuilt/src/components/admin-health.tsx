import type { ReactNode } from "react";
import { ArchiveRestore, CircleCheck, CircleHelp, Clock3, Files, Mail, RefreshCw, type LucideIcon } from "lucide-react";
import type { HealthSnapshot } from "@/lib/health/model";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Status } from "@/components/ui/status";

const dates = new Intl.DateTimeFormat("id-ID", { dateStyle: "medium", timeStyle: "short", timeZone: "Asia/Jakarta" });
function Time({ value }: { value: string | null }) {
  return value ? <time dateTime={value}>{dates.format(new Date(value))} WIB</time> : <span>Belum tersedia</span>;
}
function Metrics({ items }: { items: [string, number][] }) {
  return <dl className="grid min-w-0 gap-3" style={{ gridTemplateColumns: "repeat(auto-fit, minmax(min(100%, 8rem), 1fr))" }}>
    {items.map(([label, value]) => <div key={label} className="min-w-0 rounded-xl border bg-secondary/40 p-[12px]">
      <dt className="text-sm leading-relaxed text-muted-foreground [overflow-wrap:anywhere]">{label}</dt>
      <dd className="mt-2 text-2xl font-semibold tabular-nums [overflow-wrap:anywhere]">{value.toLocaleString("id-ID")}</dd>
    </div>)}
  </dl>;
}
function HealthCard({ id, title, icon: Icon, available, children }: { id: string; title: string; icon: LucideIcon; available: boolean | null; children: ReactNode }) {
  const Indicator = available ? CircleCheck : CircleHelp;
  return <section aria-labelledby={id} className="min-w-0">
    <Card className="h-full min-w-0 gap-5">
      <CardHeader className="gap-3">
        <div className="flex min-w-0 items-start gap-3">
          <span className="flex size-[40px] shrink-0 items-center justify-center rounded-xl bg-secondary text-primary"><Icon className="size-[20px]" aria-hidden="true" /></span>
          <div className="min-w-0 space-y-2">
            <CardTitle><h2 id={id} className="text-lg leading-snug">{title}</h2></CardTitle>
            <p className="flex items-center gap-2 text-xs font-medium text-muted-foreground"><Indicator className="size-[16px] shrink-0" aria-hidden="true" />{available === null ? "Belum dapat diverifikasi" : available ? "Sumber berhasil dibaca" : "Sumber belum dapat dibaca"}</p>
          </div>
        </div>
      </CardHeader>
      <CardContent className="min-w-0 space-y-4 text-sm leading-relaxed [overflow-wrap:anywhere]">{children}</CardContent>
    </Card>
  </section>;
}
function Note({ title, children }: { title: string; children: ReactNode }) {
  return <details className="min-w-0 rounded-xl border bg-background/60 p-[12px]">
    <summary className="min-h-11 cursor-pointer content-center rounded-md font-medium focus-visible:outline-2 focus-visible:outline-primary">{title}</summary>
    <div className="space-y-3 pt-3 text-muted-foreground">{children}</div>
  </details>;
}
function NextStep({ children }: { children: ReactNode }) {
  return <div className="rounded-xl border border-info/20 bg-info-subtle p-[12px] text-info"><p className="mb-1 font-semibold">Tindakan berikutnya</p><p>{children}</p></div>;
}
export function AdminHealth({ data }: { data: HealthSnapshot }) {
  const jobs = data.jobs, r = data.reconciliation;
  const delivery = jobs.available ? jobs.outbox : null;
  const runs = jobs.available ? jobs.runs : null;
  const providers = jobs.available ? jobs.providers : null;
  const issues = delivery && runs ? delivery.failed + delivery.ambiguous + runs.failed : null;
  const reconciliationItems: [string, number][] | null = r.available && r.sourceAvailable !== null && r.tables !== null && r.reportSnapshots !== null && r.pointSnapshots !== null && r.submittedSurveys !== null
    ? [["Tabel aplikasi", r.tables], ["Arsip rapor", r.reportSnapshots], ["Arsip poin", r.pointSnapshots], ["Survei terkirim", r.submittedSurveys]] : null;
  const reconciliationReady = reconciliationItems !== null;
  const unavailable = Number(issues === null) + Number(!reconciliationReady);
  const summary = unavailable === 2 ? "Kedua sumber operasional belum dapat diperiksa. Status layanan belum dapat dinilai."
    : issues === null ? "Data pengiriman dan pekerjaan belum tersedia. Data rekonsiliasi masih dapat dibaca."
    : !reconciliationReady ? "Data rekonsiliasi belum tersedia. Data pekerjaan masih dapat dibaca."
    : issues > 0 ? `${issues} kegagalan atau hasil pengiriman belum pasti ditemukan pada sampel terbaru.`
    : delivery?.sampled === 0 && runs?.sampled === 0 ? "Belum ada data pengiriman atau pekerjaan pada sampel terbaru."
    : "Tidak ada kegagalan tercatat pada sampel pekerjaan terbaru.";
  return <div className="min-w-0 space-y-6 [overflow-wrap:anywhere]">
    <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border bg-card p-[16px]">
      <div className="space-y-1"><p className="text-sm font-medium">Pemeriksaan terakhir</p><p className="text-sm text-muted-foreground"><Time value={data.checkedAt} /></p></div>
      <form action="/account/health" method="get"><Button type="submit" variant="outline"><RefreshCw className="size-[16px]" aria-hidden="true" />Perbarui status</Button></form>
    </div>
    <Status tone={unavailable || (issues ?? 0) > 0 ? "warning" : "info"} heading={unavailable === 2 ? "Data operasional belum tersedia" : unavailable === 1 ? "Sebagian data belum tersedia" : "Ringkasan operasional"} hint="Sampel operasional, bukan pemeriksaan seluruh layanan. Tindak lanjuti melalui sidebar.">{summary}</Status>
    <div className="grid min-w-0 items-stretch gap-6 xl:grid-cols-2">
      <HealthCard id="health-delivery" title="Email dan pengiriman" icon={Mail} available={!!(delivery && providers)}>
        {delivery && providers ? <>
          {delivery.sampled === 0 ? <p className="rounded-xl border border-dashed p-[12px]">Belum ada pengiriman dalam sampel terbaru.</p> : null}
          <Metrics items={[["Menunggu", delivery.queued], ["Diproses", delivery.processing], ["Diterima penyedia", delivery.sent], ["Gagal", delivery.failed], ["Perlu pemeriksaan", delivery.ambiguous], ["Dibatalkan", delivery.cancelled]]} />
          <p className="text-muted-foreground">{delivery.sampled.toLocaleString("id-ID")} pengiriman dalam sampel. Pengiriman menunggu tertua dibuat: <Time value={jobs.oldestQueuedAt} />.</p>
          <dl className="space-y-3 rounded-xl border p-[12px]">
            <div><dt className="font-medium">Konfigurasi Gmail</dt><dd className="text-muted-foreground">{providers.gmail ? "Dikonfigurasi · koneksi belum diuji" : "Konfigurasi belum valid"}</dd></div>
            <div><dt className="font-medium">Konfigurasi WhatsApp</dt><dd className="text-muted-foreground">{providers.whatsapp ? "Dikonfigurasi · pengiriman belum diuji" : "Opsional · belum dikonfigurasi"}</dd></div>
            <div><dt className="font-medium">Dispatch terjadwal</dt><dd className="text-muted-foreground">{providers.scheduledDispatch ? "Diaktifkan · eksekusi belum diuji" : "Belum diaktifkan"}</dd></div>
          </dl>
          <Note title="Cakupan data pengiriman"><p>Pemeriksaan: <Time value={jobs.checkedAt} />. Maksimal 200 outbox terbaru, semua kanal; bukan total seluruh antrean. Statistik ini tidak mencakup OTP verifikasi dan pemulihan akun yang dikirim langsung.</p><p>Diterima penyedia bukan bukti tiba di kotak masuk. Waktu penerimaan penyedia belum tersedia pada sumber ini. Periksa juga spam dan laporan penyedia jika pengguna belum menerima email.</p></Note>
          <NextStep>Buka Pekerjaan di sidebar. Periksa hasil pengiriman belum pasti sebelum mencoba ulang.</NextStep>
        </> : <Status tone="warning" heading="Data pengiriman tidak tersedia">Perbarui status. Jika tetap gagal, periksa layanan database dan log server. Kegagalan baca tidak berarti tidak ada antrean.</Status>}
      </HealthCard>
      <HealthCard id="health-runs" title="Pekerjaan terjadwal" icon={Clock3} available={!!runs}>
        {runs ? <>
          {runs.sampled === 0 ? <p className="rounded-xl border border-dashed p-[12px]">Belum ada pekerjaan dalam sampel terbaru.</p> : null}
          <Metrics items={[["Menunggu", runs.queued], ["Berjalan", runs.running], ["Selesai", runs.succeeded], ["Gagal", runs.failed], ["Dilewati", runs.skipped]]} />
          <p className="text-muted-foreground">{runs.sampled.toLocaleString("id-ID")} pekerjaan dalam sampel. Berakhir terakhir: <Time value={jobs.latestJobFinishedAt} />.</p>
          <Note title="Cakupan pekerjaan terjadwal"><p>Pemeriksaan: <Time value={jobs.checkedAt} />. Maksimal 100 pekerjaan terbaru. Waktu selesai mencakup semua hasil akhir, termasuk gagal.</p><p>Halaman ini hanya membaca status, tidak menjalankan atau mengirim ulang pekerjaan.</p></Note>
          <NextStep>Periksa antrean dan hasil sebelumnya melalui menu Pekerjaan sebelum mencoba ulang.</NextStep>
        </> : <Status tone="warning" heading="Data pekerjaan tidak tersedia">Perbarui status dan periksa sumber sebelum mengambil tindakan.</Status>}
      </HealthCard>
      <HealthCard id="health-backup" title="Backup dan pemulihan" icon={ArchiveRestore} available={null}>
        <dl className="space-y-3"><div><dt className="font-medium">Backup produksi terakhir</dt><dd className="text-muted-foreground">Belum tersedia; sumber metadata backup belum terhubung.</dd></div><div><dt className="font-medium">Restore produksi terakhir</dt><dd className="text-muted-foreground">Belum tersedia; keberhasilan restore belum dibuktikan.</dd></div></dl>
        <p>Keberadaan file backup atau hasil latihan database lokal tidak membuktikan backup produksi dapat dipulihkan.</p>
        <NextStep>Admin: periksa backup pada penyedia dan catat buktinya. Uji restore di lingkungan terisolasi, jangan di produksi.</NextStep>
      </HealthCard>
      <HealthCard id="health-reconciliation" title="Rekonsiliasi" icon={Files} available={reconciliationReady}>
        {reconciliationItems ? <>
          <Metrics items={reconciliationItems} />
          <p>{r.sourceAvailable ? "Sumber pembanding tersedia; angka ringkasan belum membuktikan data cocok." : "Sumber pembanding belum tersedia; kesesuaian data belum dapat diverifikasi."}</p>
          <Note title="Cakupan rekonsiliasi"><p>Pemeriksaan: <Time value={r.checkedAt} />. Jumlah arsip bukan bukti kesetaraan data atau kesiapan migrasi.</p></Note>
          <NextStep>Periksa bukti dan paket data melalui menu Rekonsiliasi.</NextStep>
        </> : <Status tone="warning" heading="Data rekonsiliasi tidak tersedia">Perbarui status dan periksa sumber. Kegagalan baca bukan hasil rekonsiliasi berhasil.</Status>}
      </HealthCard>
    </div>
  </div>;
}
