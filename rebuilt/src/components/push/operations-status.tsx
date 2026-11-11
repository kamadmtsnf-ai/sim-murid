import {Status} from '@/components/ui/status';
import {alarmLabels,type PushOperations} from '@/lib/push/operations';
const date=new Intl.DateTimeFormat('id-ID',{dateStyle:'medium',timeStyle:'short',timeZone:'Asia/Jakarta'});
const time=(v:string|null)=>v?date.format(new Date(v))+' WIB':'Belum tercatat';
export function PushOperationsStatus({data}:{data:PushOperations|null}){
 if(!data)return <Status tone="warning">Pemantauan Web Push belum tersedia. Kegagalan baca tidak berarti antrean kosong.</Status>;
 return <section aria-label="Pemantauan Web Push" className="min-w-0 space-y-3 [overflow-wrap:anywhere]">
  <h3 className="font-medium">Otomatisasi Web Push</h3>
  {data.alarms.length?<Status tone="warning" heading="Perlu pemeriksaan"><ul className="list-inside list-disc space-y-1">{data.alarms.map(code=><li key={code}>{alarmLabels[code]}</li>)}</ul></Status>:<p className="text-sm text-muted-foreground">Tidak ada alarm tercatat pada pemeriksaan ini. Pengiriman tetap mengikuti izin dan kategori aktif.</p>}
  <dl className="grid min-w-0 gap-3 sm:grid-cols-2">
   {[
    ['Pemicu terjadwal',!data.scheduler.enabled?'Belum diaktifkan':data.scheduler.observed_recently?'Tick teramati dalam 3 menit':'Belum teramati / perlu diperiksa'],
    ['Pemeriksaan pemicu terakhir',time(data.scheduler.last_tick)],
    ['Worker selesai terakhir',time(data.worker.last_finished)],
    ['Respons pemicu terakhir',data.scheduler.http_status?String(data.scheduler.http_status)+' · '+time(data.scheduler.last_response):'Belum tercatat'],
    ['Antrean siap',String(data.queue.ready)],['Siap tertua',time(data.queue.oldest_ready)],
    ['p95 diterima layanan · 24 jam',data.queue.p95_accepted_seconds===null?'Belum ada sampel':data.queue.p95_accepted_seconds.toLocaleString('id-ID')+' detik · '+data.queue.accepted_samples_24h+' sampel'],
    ['Worker · 24 jam',data.worker.runs_24h+' pemeriksaan · '+data.worker.errors_1h+' bermasalah dalam 1 jam'],
   ].map(([label,value])=><div key={label} className="min-w-0 rounded-lg border p-3"><dt className="text-sm text-muted-foreground">{label}</dt><dd className="font-medium">{value}</dd></div>)}
  </dl>
  <details className="rounded-lg border p-3"><summary className="min-h-11 cursor-pointer py-2 font-medium focus-visible:ring-2 focus-visible:ring-ring">Retensi dan batas pengukuran</summary><div className="space-y-2 pt-2 text-sm text-muted-foreground"><p>Retensi {data.retention.enabled?'diaktifkan':'belum diaktifkan'}: delivery akhir {data.retention.delivery_days} hari, rahasia perangkat nonaktif {data.retention.subscription_days} hari, riwayat worker {data.retention.run_days} hari. Maksimal {data.retention.batch} catatan per kelompok per pemeriksaan.</p><p>Pembersihan terakhir: {time(data.retention.last_cleanup)}. Hasil ambigu dan perangkat aktif dipertahankan. Kotak masuk dan sumber bisnis tetap tersedia.</p><p>p95 dihitung sejak delivery dibuat sampai accepted; mencakup penundaan dan retry. Accepted bukan bukti tampil atau dibaca. Alarm hanya ditampilkan di aplikasi; belum ada pengiriman alarm eksternal.</p></div></details>
 </section>;
}
