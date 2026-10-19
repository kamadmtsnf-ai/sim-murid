'use client';
import Link from 'next/link';
import {useEffect,useState,type FormEvent} from 'react';
import {useRouter} from 'next/navigation';
import type {z} from 'zod';
import {Button} from '@/components/ui/button';
import {emailStateSchema} from '@/lib/email/validation';
export function EmailPanel({initialState}:{initialState:z.infer<typeof emailStateSchema>}){
 const router=useRouter();const [state,setState]=useState(initialState);const [busy,setBusy]=useState(false);const [message,setMessage]=useState('');const [now,setNow]=useState(0);
 useEffect(()=>{const timer=setInterval(()=>setNow(Date.now()),1000);return()=>clearInterval(timer);},[]);
 const remaining=state.challenge&&now?Math.max(0,Math.ceil((Date.parse(state.challenge.retry_at)-now)/1000)):0;
 async function run(command:{action:'send'}|{action:'verify';challengeId:string;code:string}){
  if(busy)return;setBusy(true);setMessage('');
  try{const response=await fetch('/api/account/email',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(command)});const body:unknown=await response.json();const data=typeof body==='object'&&body!==null?body as Record<string,unknown>:{};
   if(response.status===401){router.replace('/login?expired=1');router.refresh();return;}
   setMessage(typeof data.message==='string'?data.message:'Permintaan belum berhasil.');
   if(response.ok&&command.action==='verify'){router.replace('/account');router.refresh();return;}
   const fresh=await fetch('/api/account/email',{cache:'no-store'});if(fresh.ok){const loaded:unknown=await fresh.json();if(typeof loaded==='object'&&loaded!==null&&'state' in loaded){const parsed=emailStateSchema.safeParse(loaded.state);if(parsed.success)setState(parsed.data);}}
  }catch{setMessage('Koneksi terputus. Periksa status dan kotak masuk sebelum meminta kode baru.');}finally{setBusy(false);}
 }
 function verify(e:FormEvent<HTMLFormElement>){e.preventDefault();if(!state.challenge)return;const code=String(new FormData(e.currentTarget).get('code')??'');if(!/^\d{6}$/.test(code)){setMessage('Kode harus berupa enam digit angka.');return;}e.currentTarget.reset();void run({action:'verify',challengeId:state.challenge.id,code});}
 return <div className="space-y-5"><p>Email kontak: <strong className="break-all">{state.email||'Belum diisi'}</strong></p><Link href="/account/profile" className="text-primary underline">Perbarui email kontak</Link>
  {state.verified?<p>Email sudah terverifikasi.</p>:<><p>Kode berlaku maksimal 10 menit, hanya sekali pakai, dan maksimal 5 percobaan. Batas 5 permintaan per hari WIB; pengiriman ulang berjarak minimal 60 detik.</p><Button disabled={busy||now===0||remaining>0||state.sent_today>=5||!state.email} onClick={()=>void run({action:'send'})}>{busy?'Memproses…':remaining>0?`Kirim ulang dalam ${remaining} detik`:'Kirim kode verifikasi'}</Button><p className="text-sm text-muted-foreground">Permintaan hari ini: {state.sent_today}/5.</p>
  {state.challenge&&<form className="space-y-4" onSubmit={verify}><p className="text-sm">Sisa percobaan kode ini: {state.challenge.attempts_remaining}. Kode lama tidak berlaku setelah pengiriman ulang.</p><label className="block" htmlFor="email-otp">Kode enam digit<input id="email-otp" name="code" className="mt-2 w-full rounded-md border p-2" inputMode="numeric" autoComplete="one-time-code" pattern="[0-9]{6}" minLength={6} maxLength={6} required disabled={busy}/></label><Button type="submit" disabled={busy||state.challenge.status!=='pending'||state.challenge.delivery_state!=='accepted'||state.challenge.attempts_remaining===0}>Verifikasi email</Button></form>}</>}
  <p role="status" aria-live="polite">{message}</p><Button variant="outline" disabled={busy} onClick={()=>window.location.reload()}>Muat ulang status</Button>
 </div>;
}
