'use client';
import {useState,type FormEvent} from 'react';
import {useRouter} from 'next/navigation';
import type {z} from 'zod';
import {Button} from '@/components/ui/button';
import {profileSchema} from '@/lib/auth/recovery-validation';
export function ProfileForm({initialProfile}:{initialProfile:z.infer<typeof profileSchema>}){
 const router=useRouter();const [profile,setProfile]=useState(initialProfile);const [busy,setBusy]=useState(false);const [message,setMessage]=useState('');
 async function submit(e:FormEvent<HTMLFormElement>){
  e.preventDefault();if(busy)return;const input=profileSchema.safeParse({...Object.fromEntries(new FormData(e.currentTarget)),username:profile.username,updated_at:profile.updated_at});if(!input.success){setMessage('Periksa nama, nomor HP, email dan bio.');return;}
  setBusy(true);setMessage('');try{const r=await fetch('/api/account/profile',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(input.data)});const body:unknown=await r.json();const data=typeof body==='object'&&body!==null?body as Record<string,unknown>:{};
   if(r.status===401){router.replace('/login?expired=1');router.refresh();return;}
   setMessage(typeof data.message==='string'?data.message:'Permintaan belum berhasil.');if(r.ok){const next=profileSchema.safeParse(data.profile);if(next.success)setProfile(next.data);router.refresh();}
  }catch{setMessage('Koneksi terputus. Muat ulang untuk memastikan data tersimpan sebelum mencoba kembali.');}finally{setBusy(false);}
 }
 const field='mt-2 w-full rounded-md border bg-background p-2';
 return <form key={profile.updated_at} className="space-y-4" onSubmit={e=>void submit(e)}><p>Username: <strong>{profile.username}</strong></p>
  <label className="block" htmlFor="profile-name">Nama lengkap<input id="profile-name" name="full_name" className={field} autoComplete="name" defaultValue={profile.full_name} required maxLength={200} disabled={busy}/></label>
  <label className="block" htmlFor="profile-phone">Nomor HP<input id="profile-phone" name="phone" type="tel" className={field} autoComplete="tel" defaultValue={profile.phone} maxLength={40} disabled={busy}/></label>
  <label className="block" htmlFor="profile-email">Email kontak<input id="profile-email" name="contact_email" type="email" className={field} autoComplete="email" defaultValue={profile.contact_email} maxLength={320} disabled={busy}/></label>
  <label className="block" htmlFor="profile-bio">Bio<textarea id="profile-bio" name="bio" className={field} defaultValue={profile.bio} maxLength={2000} rows={4} disabled={busy}/></label>
  <p role="status" aria-live="polite">{message}</p><div className="flex gap-3"><Button type="submit" disabled={busy}>{busy?'Menyimpan…':'Simpan profil'}</Button><Button type="button" variant="outline" disabled={busy} onClick={()=>window.location.reload()}>Muat ulang</Button></div>
 </form>;
}
