'use client';
import {useState,type FormEvent} from 'react';
import {useRouter} from 'next/navigation';
import {Button} from '@/components/ui/button';
import {recoveryEmailRequest,recoveryEmailReset} from '@/lib/email/validation';
import {passwordValueSchema} from '@/lib/auth/security-validation';
export function EmailRecoveryForm(){
 const router=useRouter();const [username,setUsername]=useState('');const [challenge,setChallenge]=useState('');const [busy,setBusy]=useState(false);const [message,setMessage]=useState('');
 async function submit(e:FormEvent<HTMLFormElement>,action:'send'|'reset'){
  e.preventDefault();if(busy)return;const form=e.currentTarget;const fields=Object.fromEntries(new FormData(form));const input=action==='send'?recoveryEmailRequest.safeParse({...fields,action}):recoveryEmailReset.safeParse({...fields,username,challengeId:challenge,action});
  if(!input.success){setMessage('Periksa username, kode enam digit, dan password.');return;}
  if(input.data.action==='reset'&&(!passwordValueSchema(username).safeParse(input.data.newPassword).success||input.data.newPassword!==input.data.confirmPassword)){setMessage('Periksa kekuatan dan konfirmasi password sesuai ketentuan.');return;}
  setBusy(true);setMessage('');
  try{const response=await fetch('/api/auth/email-recovery',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(input.data)});const body:unknown=await response.json();const data=typeof body==='object'&&body!==null?body as Record<string,unknown>:{};setMessage(typeof data.message==='string'?data.message:'Permintaan belum berhasil.');
   if(response.ok&&input.data.action==='send'&&typeof data.challengeId==='string'){setUsername(input.data.username);setChallenge(data.challengeId);form.reset();}
   if(response.ok&&input.data.action==='reset'){form.reset();setChallenge('');router.replace('/login?password=changed');router.refresh();}
  }catch{setMessage('Koneksi terputus. Jika sedang mengganti password, pastikan statusnya dengan mencoba login atau hubungi Admin.');}finally{setBusy(false);}
 }
 const field='mt-2 w-full rounded-md border bg-background p-2';
 return <div className="space-y-5"><p role="status" aria-live="polite">{message}</p>{!challenge?<form className="space-y-4" onSubmit={e=>void submit(e,'send')}><label className="block" htmlFor="email-recovery-user">Username<input id="email-recovery-user" name="username" className={field} autoComplete="username" maxLength={100} required disabled={busy}/></label><Button type="submit" disabled={busy}>{busy?'Memproses…':'Minta kode pemulihan'}</Button></form>:<><p>Akun: {username}. Gunakan kode terbaru dari email Anda. Kode berlaku maksimal 10 menit dan 5 percobaan.</p><form className="space-y-4" onSubmit={e=>void submit(e,'reset')}>
  <label className="block" htmlFor="recovery-email-code">Kode enam digit<input id="recovery-email-code" name="code" className={field} inputMode="numeric" autoComplete="one-time-code" pattern="[0-9]{6}" maxLength={6} required disabled={busy}/></label>
  <p id="reset-password-rules" className="text-sm text-muted-foreground">Password minimal 8 karakter, maksimal 72 byte; huruf besar/kecil, angka dan simbol. Hindari username dan tiga karakter sama berurutan.</p>
  <label className="block" htmlFor="recovery-new-password">Password baru<input id="recovery-new-password" name="newPassword" type="password" autoComplete="new-password" className={field} minLength={8} maxLength={72} aria-describedby="reset-password-rules" required disabled={busy}/></label>
  <label className="block" htmlFor="recovery-confirm-password">Konfirmasi password<input id="recovery-confirm-password" name="confirmPassword" type="password" autoComplete="new-password" className={field} required disabled={busy}/></label><Button type="submit" disabled={busy}>{busy?'Memproses…':'Simpan password baru'}</Button></form><Button variant="outline" disabled={busy} onClick={()=>{setChallenge('');setMessage('Pengiriman ulang harus berjarak 60 detik dan maksimal 5 permintaan per hari WIB.');}}>Minta kode baru atau ganti username</Button></>}
 </div>;
}
