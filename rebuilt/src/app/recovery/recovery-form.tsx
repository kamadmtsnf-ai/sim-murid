'use client';
import {useState,type FormEvent} from 'react';
import {Button} from '@/components/ui/button';
import {questions} from '@/lib/auth/security-validation';
import {recoveryRequestSchema} from '@/lib/auth/recovery-validation';
export function RecoveryForm(){
 const [manual,setManual]=useState(false);const [busy,setBusy]=useState(false);const [message,setMessage]=useState('');
 async function submit(e:FormEvent<HTMLFormElement>){
  e.preventDefault();if(busy)return;const form=e.currentTarget;const data=Object.fromEntries(new FormData(form));
  const input=recoveryRequestSchema.safeParse({...data,method:manual?'manual':'question'});if(!input.success){setMessage('Isi username, jenis permintaan, serta pertanyaan dan jawaban bila dipilih.');return;}
  setBusy(true);setMessage('');try{const r=await fetch('/api/auth/recovery',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(input.data)});const body:unknown=await r.json();setMessage(typeof body==='object'&&body!==null&&'message' in body&&typeof body.message==='string'?body.message:'Permintaan belum berhasil.');if(r.ok){form.reset();setManual(false);}}catch{setMessage('Tidak dapat menghubungi layanan. Coba kembali atau hubungi petugas madrasah.');}finally{setBusy(false);}
 }
 const field='mt-2 w-full rounded-md border bg-background p-2';
 return <form className="space-y-5" onSubmit={e=>void submit(e)}>
  <label className="block" htmlFor="recovery-username">Username<input id="recovery-username" name="username" autoComplete="username" className={field} required maxLength={100} disabled={busy}/></label>
  <label className="block" htmlFor="recovery-type">Bantuan yang dibutuhkan<select id="recovery-type" name="requestType" className={field} disabled={busy}><option value="password">Lupa password</option><option value="session">Tidak dapat mengakses sesi lama</option></select></label>
  <label className="flex items-center gap-2"><input type="checkbox" checked={manual} onChange={e=>setManual(e.target.checked)} disabled={busy}/>Saya belum mengatur atau lupa jawaban keamanan; minta pemeriksaan langsung oleh petugas.</label>
  {!manual&&<><label className="block" htmlFor="recovery-question">Pertanyaan keamanan<select id="recovery-question" name="question" className={field} disabled={busy}>{questions.map(q=><option key={q.code} value={q.code}>{q.label}</option>)}</select></label><label className="block" htmlFor="recovery-answer">Jawaban<input id="recovery-answer" name="answer" type="password" autoComplete="off" className={field} maxLength={256} required disabled={busy}/></label></>}
  <p role="status" aria-live="polite">{message}</p><Button type="submit" disabled={busy}>{busy?'Mengirim…':'Minta bantuan Admin'}</Button>
 </form>;
}
