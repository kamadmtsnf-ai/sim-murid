import type { HealthSnapshot } from "@/lib/health/model";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Status } from "@/components/ui/status";
const dates = new Intl.DateTimeFormat("id-ID", { dateStyle: "medium", timeStyle: "short", timeZone: "Asia/Jakarta" });
function time(value: string | null) { return value ? dates.format(new Date(value)) + " WIB" : "Belum tersedia"; }
function Metrics({ items }: { items: [string, number][] }) {
  return <dl className="grid min-w-0 grid-cols-2 gap-3 sm:grid-cols-3">{items.map(([label,value])=><div key={label} className="min-w-0 rounded-lg bg-secondary/50 p-3"><dt className="break-words text-sm text-muted-foreground">{label}</dt><dd className="mt-1 break-words text-xl font-semibold tabular-nums">{value.toLocaleString("id-ID")}</dd></div>)}</dl>;
}
export function AdminHealth({ data }: { data: HealthSnapshot }) {
  const jobs=data.jobs, reconciliation=data.reconciliation;
  const issues=jobs.outbox && jobs.runs ? jobs.outbox.failed+jobs.outbox.ambiguous+jobs.runs.failed : null;
  return <div className="min-w-0 space-y-6">
    <div className="flex flex-wrap items-center justify-between gap-3">
      <p className="text-sm text-muted-foreground">Diperiksa: <time dateTime={data.checkedAt}>{time(data.checkedAt)}</time></p>
      <form action="/account/health" method="get"><Button type="submit" variant="outline">Perbarui status</Button></form>
    </div>
    <Status tone={issues===null?"warning":issues>0?"warning":"info"} heading="Ringkasan operasional" hint="Ringkasan ini bukan pemeriksaan kesehatan menyeluruh. Gunakan menu Pekerjaan atau Rekonsiliasi di sidebar untuk penanganan lebih lanjut.">
      {issues===null?"Status pekerjaan belum dapat diperiksa.":issues>0?`${issues} kegagalan atau hasil pengiriman belum pasti ditemukan pada sampel terbaru.`:"Tidak ada kegagalan tercatat pada sampel pekerjaan terbaru. Ini tidak membuktikan seluruh layanan sehat."}
    </Status>
    <div className="grid min-w-0 gap-6 lg:grid-cols-2">
      <Card className="min-w-0"><CardHeader><CardTitle><h2>Email dan pengiriman</h2></CardTitle></CardHeader><CardContent className="min-w-0 space-y-4 text-sm leading-relaxed">
        <p className="text-muted-foreground">Pemeriksaan: {time(jobs.checkedAt)}. Maksimal 200 outbox terbaru, semua kanal; bukan total seluruh antrean. Statistik ini tidak mencakup OTP verifikasi dan pemulihan akun yang dikirim langsung.</p>
        {jobs.outbox && jobs.providers ? <>
          <Metrics items={[["Menunggu",jobs.outbox.queued],["Diproses",jobs.outbox.processing],["Diterima penyedia",jobs.outbox.sent],["Gagal",jobs.outbox.failed],["Perlu pemeriksaan",jobs.outbox.ambiguous],["Dibatalkan",jobs.outbox.cancelled]]} />
          <p>{jobs.outbox.sampled} pengiriman dalam sampel. Menunggu sejak: {time(jobs.oldestQueuedAt)}.</p>
          <dl className="space-y-2"><div><dt className="font-medium">Konfigurasi Gmail</dt><dd>{jobs.providers.gmail?"Tersedia; koneksi dan penerimaan email belum dibuktikan.":"Belum tersedia atau tidak valid; periksa konfigurasi server."}</dd></div><div><dt className="font-medium">Konfigurasi WhatsApp</dt><dd>{jobs.providers.whatsapp?"Tersedia; pengiriman belum dibuktikan.":"Belum tersedia atau tidak valid; abaikan jika kanal tidak digunakan."}</dd></div><div><dt className="font-medium">Dispatch terjadwal</dt><dd>{jobs.providers.scheduledDispatch?"Diaktifkan pada konfigurasi; eksekusi aktual belum dibuktikan.":"Belum diaktifkan pada konfigurasi."}</dd></div></dl>
          <p>Diterima penyedia bukan bukti tiba di kotak masuk. Waktu penerimaan penyedia belum tersedia pada sumber ini. Periksa juga spam dan laporan penyedia jika pengguna belum menerima email.</p>
          <p className="font-medium">Tindakan: periksa pekerjaan gagal atau belum pasti pada menu Pekerjaan. Jangan mengulang pengiriman berstatus belum pasti sebelum memeriksa hasilnya.</p>
        </> : <Status tone="warning" heading="Data pengiriman tidak tersedia">Perbarui status. Jika tetap gagal, periksa layanan database dan log server; status ini tidak dianggap sehat.</Status>}
      </CardContent></Card>
      <Card className="min-w-0"><CardHeader><CardTitle><h2>Pekerjaan terjadwal</h2></CardTitle></CardHeader><CardContent className="space-y-4 text-sm leading-relaxed">
        <p className="text-muted-foreground">Pemeriksaan: {time(jobs.checkedAt)}. Maksimal 100 pekerjaan terbaru.</p>
        {jobs.runs ? <><Metrics items={[["Menunggu",jobs.runs.queued],["Berjalan",jobs.runs.running],["Selesai",jobs.runs.succeeded],["Gagal",jobs.runs.failed],["Dilewati",jobs.runs.skipped]]}/><p>{jobs.runs.sampled} pekerjaan dalam sampel. Selesai terakhir: {time(jobs.latestJobFinishedAt)}. Waktu ini mencakup semua hasil akhir, termasuk gagal.</p><p className="font-medium">Tindakan: periksa antrean yang tertahan dan pekerjaan gagal melalui menu Pekerjaan. Periksa hasil sebelumnya sebelum mencoba ulang; halaman ini tidak menjalankan atau mengirim ulang pekerjaan.</p></> : <Status tone="warning" heading="Data pekerjaan tidak tersedia">Perbarui status dan periksa sumber sebelum mengambil tindakan.</Status>}
      </CardContent></Card>
      <Card className="min-w-0"><CardHeader><CardTitle><h2>Backup dan pemulihan</h2></CardTitle></CardHeader><CardContent className="space-y-3 text-sm leading-relaxed">
        <p className="font-semibold text-warning">Belum dapat diverifikasi</p><dl className="space-y-2"><div><dt>Backup produksi terakhir</dt><dd>Belum tersedia; sumber metadata backup belum terhubung.</dd></div><div><dt>Restore produksi terakhir</dt><dd>Belum tersedia; keberhasilan restore belum dibuktikan.</dd></div></dl>
        <p>Keberadaan file backup atau hasil latihan database lokal tidak membuktikan backup produksi dapat dipulihkan.</p><p className="font-medium">Tindakan: admin operasional memeriksa backup pada penyedia database, mencatat waktu dan cakupan, lalu menguji restore pada lingkungan terisolasi sebelum menyatakan berhasil. Jangan menguji restore pada database produksi.</p>
      </CardContent></Card>
      <Card className="min-w-0"><CardHeader><CardTitle><h2>Rekonsiliasi</h2></CardTitle></CardHeader><CardContent className="space-y-4 text-sm leading-relaxed">
        <p className="text-muted-foreground">Pemeriksaan: {time(reconciliation.checkedAt)}.</p>
        {reconciliation.available ? <><Metrics items={[["Tabel aplikasi",reconciliation.tables!],["Arsip rapor",reconciliation.reportSnapshots!],["Arsip poin",reconciliation.pointSnapshots!],["Survei terkirim",reconciliation.submittedSurveys!]]}/><p>{reconciliation.sourceAvailable?"Sumber pembanding tersedia; angka ringkasan belum membuktikan data cocok.":"Sumber pembanding belum tersedia; kesesuaian data belum dapat diverifikasi."}</p><p className="font-medium">Tindakan: gunakan menu Rekonsiliasi untuk memeriksa bukti dan paket data. Jumlah arsip bukan bukti kesetaraan data atau kesiapan migrasi.</p></> : <Status tone="warning" heading="Data rekonsiliasi tidak tersedia">Perbarui status dan periksa sumber. Kegagalan baca bukan hasil rekonsiliasi berhasil.</Status>}
      </CardContent></Card>
    </div>
  </div>;
}
