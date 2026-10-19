'use client';
import {useState,type FormEvent} from 'react';
import {useRouter} from 'next/navigation';
import {Button} from '@/components/ui/button';
import {Card,CardHeader,CardTitle,CardContent} from '@/components/ui/card';
import {recoveryResolveSchema,type RecoveryList} from '@/lib/auth/recovery-validation';
export function RecoveryPanel({initialRequests}:{initialRequests:RecoveryList}){
 const router=useRouter();const [requests,setRequests]=useState(initialRequests);const [busy,setBusy]=useState(false);const [message,setMessage]=useState('');const [password,setPassword]=useState('');
 async function submit(e:FormEvent<HTMLFormElement>){
  e.preventDefault();if(busy||password)return;const form=e.currentTarget;const fields=Object.fromEntries(new FormData(form));const button=(e.nativeEvent as SubmitEvent).submitter as HTMLButtonElement|null;
  const input=recoveryResolveSchema.safeParse({...fields,action:button?.value??'approve',identityConfirmed:fields.identityConfirmed==='on'});if(!input.success){setMessage('Lengkapi konfirmasi identitas, referensi verifikasi dan password Admin.');return;}
  setBusy(true);setMessage('');
  try{const r=await fetch('/api/account/recovery',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(input.data)});const body:unknown=await r.json();const data=typeof body==='object'&&body!==null?body as Record<string,unknown>:{};
   if(r.status===401){router.replace('/login?expired=1');router.refresh();return;}
   setMessage(typeof data.message==='string'?data.message:'Permintaan belum berhasil.');form.reset();
   if(r.ok){setRequests(list=>list.filter(item=>item.id!==input.data.requestId));if(typeof data.temporaryPassword==='string')setPassword(data.temporaryPassword);}
  }catch{setMessage('Koneksi terputus. Jangan menganggap pemulihan selesai; muat ulang daftar sebelum mencoba kembali.');form.reset();}finally{setBusy(false);}
 }
 const field='mt-2 w-full rounded-md border bg-background p-2';
 return <div className="space-y-5"><p role="status" aria-live="polite">{message}</p>
  {password&&<Card><CardHeader><CardTitle>Password sementara</CardTitle></CardHeader><CardContent className="space-y-4"><p>Serahkan langsung kepada pengguna yang identitasnya telah Anda verifikasi. Password ini tidak disimpan pada browser dan tidak akan ditampilkan kembali setelah halaman ditutup.</p><label className="block" htmlFor="recovery-temporary">Password baru<input id="recovery-temporary" type="text" autoComplete="off" className={field} value={password} readOnly/></label><Button onClick={()=>{setPassword('');setMessage('');router.refresh();}}>Selesai menyerahkan, hapus tampilan</Button></CardContent></Card>}
  <Button variant="outline" disabled={busy||Boolean(password)} onClick={()=>window.location.reload()}>Muat ulang antrean</Button>
  {requests.length===0?<p>Tidak ada permintaan aktif.</p>:<>
   <ul className="space-y-3">{requests.map(r=><li key={r.id} className="rounded-md border p-4 text-sm"><strong>{r.full_name}</strong> · {r.username}<p>{r.request_type==='password'?'Password':'Sesi'} · {r.status==='verified'?'Finalisasi tertunda':'Menunggu pemeriksaan'} · Jawaban keamanan {r.security_answer_verified?'sesuai':'belum dibuktikan'}</p><p>{new Intl.DateTimeFormat('id-ID',{dateStyle:'medium',timeStyle:'short',timeZone:'Asia/Jakarta'}).format(new Date(r.requested_at))} WIB{r.self_request?' · Akun Anda sendiri':''}</p></li>)}</ul>
   <form className="space-y-4" onSubmit={e=>void submit(e)}>
    <label className="block" htmlFor="recovery-request">Permintaan<select id="recovery-request" name="requestId" className={field} required disabled={busy||Boolean(password)} defaultValue=""><option value="" disabled>Pilih permintaan</option>{requests.map(r=><option key={r.id} value={r.id} disabled={r.self_request}>{r.username} · {r.request_type==='password'?'Password':'Sesi'}</option>)}</select></label>
    <label className="block" htmlFor="recovery-evidence">Referensi pemeriksaan identitas<input id="recovery-evidence" name="evidenceReference" className={field} minLength={8} maxLength={120} required autoComplete="off" disabled={busy||Boolean(password)}/><span className="text-sm text-muted-foreground">Gunakan nomor berita acara atau referensi internal; jangan masukkan NIK, jawaban keamanan atau data rahasia.</span></label>
    <label className="flex items-center gap-2"><input type="checkbox" name="identityConfirmed" required disabled={busy||Boolean(password)}/>Saya sudah memverifikasi identitas pemilik akun melalui prosedur madrasah.</label>
    <label className="block" htmlFor="recovery-current">Password Admin saat ini<input id="recovery-current" name="currentPassword" className={field} type="password" autoComplete="current-password" required disabled={busy||Boolean(password)}/></label>
    <div className="flex gap-3"><Button type="submit" name="action" value="approve" disabled={busy||Boolean(password)}>Setujui dan pulihkan</Button><Button type="submit" name="action" value="reject" variant="outline" disabled={busy||Boolean(password)}>Tolak permintaan</Button></div>
   </form></>}
 </div>;
}
