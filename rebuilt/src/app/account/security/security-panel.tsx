'use client';
import Link from 'next/link';
import {useState,type FormEvent} from 'react';
import {useRouter} from 'next/navigation';
import {Button} from '@/components/ui/button';
import {Card,CardHeader,CardTitle,CardContent} from '@/components/ui/card';
import {questions,passwordChangeSchema,questionChangeSchema,securityStateSchema,type SecurityState} from '@/lib/auth/security-validation';
const pending={profile_pending:'Lengkapi profil sebelum melanjutkan. Formulir profil Siswa dan Calon Siswa belum tersedia. Hubungi administrator bila membutuhkan bantuan.',email_pending:'Alamat email kontak Guru harus diverifikasi sebelum melanjutkan. Minta kode verifikasi lalu masukkan kode dari email Anda.',survey_pending:'Survei wajib perlu diselesaikan sebelum melanjutkan.',account_pending:'Peran akun belum tersedia. Hubungi administrator.'};
const field='mt-2 w-full rounded-md border bg-background p-2';
export function SecurityPanel({username,initialState}:{username:string;initialState:SecurityState}){
 const router=useRouter();const [state,setState]=useState(initialState);const [busy,setBusy]=useState(false);const [message,setMessage]=useState('');const [show,setShow]=useState(false);
 async function submit(event:FormEvent<HTMLFormElement>,action:'password'|'question'){
  event.preventDefault();if(busy)return;
  const form=event.currentTarget;const fields=Object.fromEntries(new FormData(form));const input={...fields,action};
  const parsed=(action==='password'?passwordChangeSchema(username):questionChangeSchema).safeParse(input);
  if(!parsed.success){setMessage(parsed.error.issues[0]?.message??'Periksa kembali isian.');return;}
  setBusy(true);setMessage('');
  try{
   const response=await fetch('/api/auth/security',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(parsed.data)});
   const body:unknown=await response.json();
   const data=typeof body==='object'&&body!==null?body as Record<string,unknown>:{};
   if(data.signed_out===true||response.status===401){form.reset();router.replace(response.ok?'/login?password=changed':data.signed_out===true?'/login?password=pending':'/login?expired=1');router.refresh();return;}
   setMessage(typeof data.message==='string'?data.message:'Permintaan belum berhasil. Coba kembali.');
   if(response.ok){form.reset();const next=securityStateSchema.safeParse(data.state);if(next.success)setState(next.data);router.refresh();}
  }catch{setMessage('Tidak dapat menghubungi layanan. Periksa koneksi lalu muat ulang untuk memastikan status akun.');}
  finally{setBusy(false);}
 }
 return <main id="main-content" className="mx-auto max-w-2xl space-y-6 px-6 py-12">
  <h1 className="text-3xl font-semibold">Keamanan akun</h1><p className="text-muted-foreground">Akun {username}</p>
  <p role="status" aria-live="polite">{message}</p>
  {state.gate==='password'&&<p className="rounded-md border p-4">Ganti password sementara sebelum melanjutkan. Setelah berhasil, masuk kembali menggunakan password baru.</p>}
  {state.gate in pending&&<Card><CardContent className="pt-6"><p>{pending[state.gate as keyof typeof pending]}</p><Button className="mt-4" variant="outline" onClick={()=>{router.refresh();}}>Periksa kembali</Button></CardContent></Card>}
  {state.gate==='email_pending'&&<Link href="/account/email" className="text-primary underline">Verifikasi email Guru</Link>}
  {state.gate==='email_pending'&&<Link href="/account/profile" className="text-primary underline">Perbarui email kontak</Link>}
  {state.gate==='security_question'&&<p>Simpan pertanyaan keamanan untuk melanjutkan.</p>}
  {state.gate==='ready'&&<Link href="/account" className="text-primary underline">Lanjut ke akun</Link>}
  <Card><CardHeader><CardTitle>Ganti password</CardTitle></CardHeader><CardContent>
   <p id="password-rules" className="mb-4 text-sm text-muted-foreground">Minimal 8 karakter, maksimal 72 byte. Gunakan huruf besar, huruf kecil, angka, dan simbol. Hindari username, tiga karakter sama berurutan, dan password lama. Semua sesi akan diakhiri.</p>
   <form className="space-y-4" onSubmit={e=>void submit(e,'password')}>
    <label className="block" htmlFor="password-current">Password saat ini<input className={field} id="password-current" name="currentPassword" type={show?'text':'password'} autoComplete="current-password" required disabled={busy}/></label>
    <label className="block" htmlFor="password-new">Password baru<input className={field} id="password-new" name="newPassword" type={show?'text':'password'} autoComplete="new-password" minLength={8} maxLength={72} aria-describedby="password-rules" required disabled={busy}/></label>
    <label className="block" htmlFor="password-confirm">Konfirmasi password baru<input className={field} id="password-confirm" name="confirmPassword" type={show?'text':'password'} autoComplete="new-password" required disabled={busy}/></label>
    <label className="flex items-center gap-2"><input type="checkbox" checked={show} onChange={e=>setShow(e.target.checked)}/>Tampilkan password</label>
    <Button disabled={busy} type="submit">{busy?'Memproses…':'Simpan password baru'}</Button>
   </form>
  </CardContent></Card>
  {state.can_set_question&&<Card><CardHeader><CardTitle>{state.question_code?'Ubah':'Atur'} pertanyaan keamanan</CardTitle></CardHeader><CardContent>
   <p className="mb-4 text-sm text-muted-foreground">Jawaban peka huruf besar dan kecil. Spasi di awal dan akhir diabaikan. Jawaban lama tidak ditampilkan; konfirmasi dengan password saat ini.</p>
   <form className="space-y-4" onSubmit={e=>void submit(e,'question')}>
    <label className="block" htmlFor="security-question">Pertanyaan<select id="security-question" name="question" className={field} defaultValue={state.question_code??'q1'} disabled={busy}>{questions.map(q=><option key={q.code} value={q.code}>{q.label}</option>)}</select></label>
    <label className="block" htmlFor="security-answer">Jawaban<input id="security-answer" name="answer" className={field} type="password" autoComplete="off" maxLength={256} required disabled={busy}/></label>
    <label className="block" htmlFor="question-current">Password saat ini<input id="question-current" name="currentPassword" className={field} type="password" autoComplete="current-password" required disabled={busy}/></label>
    <Button type="submit" disabled={busy}>{busy?'Memproses…':'Simpan pertanyaan keamanan'}</Button>
   </form>
  </CardContent></Card>}
  <form action="/api/auth/logout" method="post"><Button variant="outline" type="submit" disabled={busy}>Keluar</Button></form>
 </main>;
}
