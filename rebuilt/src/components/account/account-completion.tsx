import { CheckCircle2, Circle, LockKeyhole, HelpCircle } from 'lucide-react';
import { accountCompletion } from '@/lib/auth/account-completion';
import type { SecurityState } from '@/lib/auth/security-validation';
export function AccountCompletion({state,emailVerified,needsSync=false}:{state:SecurityState;emailVerified?:boolean|null;needsSync?:boolean}) {
 if(needsSync) return <section aria-label="Pusat penyelesaian akun" className="rounded-xl border p-4"><h2 className="font-semibold">Periksa status akun</h2><p className="mt-2 text-sm text-muted-foreground">Hasil perubahan belum dapat dipastikan. Gunakan tombol muat ulang status di halaman ini sebelum melanjutkan.</p></section>;
 const progress=accountCompletion(state,emailVerified);
 const labels={complete:'Selesai',pending:'Belum selesai',blocked:'Belum tersedia',unknown:'Periksa status'};
 return <section aria-label="Pusat penyelesaian akun" className="min-w-0 space-y-4 rounded-xl border bg-card p-4 sm:p-5">
  <div className="space-y-1"><h2 className="text-lg font-semibold">Penyelesaian akun</h2><p className="text-sm text-muted-foreground">{progress.completed} dari {progress.total} langkah wajib selesai. Email opsional tidak menghambat kesiapan akun.</p></div>
  <ol className="grid min-w-0 gap-3 sm:grid-cols-2">{progress.steps.map(step=>{const Icon=step.status==='complete'?CheckCircle2:step.status==='blocked'?LockKeyhole:step.status==='unknown'?HelpCircle:Circle;return <li key={step.id} className="flex min-w-0 items-start gap-3 rounded-lg border p-3"><Icon aria-hidden="true" className="mt-0.5 size-5 shrink-0 text-primary"/><div className="min-w-0 space-y-1 [overflow-wrap:anywhere]"><h3 className="text-sm font-semibold">{step.label} <span className="font-normal text-muted-foreground">({step.required?'Wajib':'Opsional'})</span></h3><p className="text-xs font-medium">{labels[step.status]}</p><p className="text-sm leading-relaxed text-muted-foreground">{step.detail}</p></div></li>})}</ol>
  <div className="rounded-lg bg-muted/40 p-3 text-sm leading-relaxed"><p className="font-semibold">{progress.ready?'Langkah wajib selesai':'Langkah berikutnya'}</p><p>{progress.next}</p>{state.gate==='account_pending'&&<p>Perhitungan langkah di atas tidak menggantikan penetapan peran oleh administrator.</p>}</div>
 </section>;
}
