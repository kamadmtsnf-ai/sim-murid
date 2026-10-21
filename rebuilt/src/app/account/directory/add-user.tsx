'use client';
import {useEffect,useRef,useState} from 'react';
import {useRouter} from 'next/navigation';
import {UserPlus,Copy,Eye,EyeOff} from 'lucide-react';
import {Button} from '@/components/ui/button';
import {Dialog} from '@/components/ui/dialog';
import {Status} from '@/components/ui/status';
import {newUserSchema,userRoles,type NewUser} from '@/lib/users/validation';
function fresh():NewUser{
 const bytes=crypto.getRandomValues(new Uint8Array(24));
 return {requestId:crypto.randomUUID(),username:'',fullName:'',role:'student',contactEmail:'',password:'Aa1_'+Array.from(bytes,b=>b.toString(16).padStart(2,'0')).join('')};
}
export function AddUser(){
 const router=useRouter(),busyRef=useRef(false);
 const [open,setOpen]=useState(false),[draft,setDraft]=useState<NewUser|null>(null),[busy,setBusy]=useState(false),[locked,setLocked]=useState(false),[done,setDone]=useState(false),[message,setMessage]=useState(''),[visible,setVisible]=useState(false),[copied,setCopied]=useState(false);
 useEffect(()=>{if(!locked||done)return;const warn=(event:BeforeUnloadEvent)=>{event.preventDefault();};window.addEventListener('beforeunload',warn);return()=>window.removeEventListener('beforeunload',warn);},[locked,done]);
 function changeOpen(next:boolean){
  if(busyRef.current)return;
  if(!next&&done){setLocked(false);setDraft(null);setOpen(false);return;}
  if(!next&&!done&&locked){setOpen(false);return;}
  if(!next&&!done&&draft&&(draft.username||draft.fullName||draft.contactEmail)&&!window.confirm('Tutup formulir dan buang isian pengguna?'))return;
  if(next&&!locked){setDraft(fresh());setMessage('');setLocked(false);setDone(false);setVisible(false);setCopied(false);}
  setOpen(next);if(!next&&!locked)setDraft(null);
 }
 async function save(event:React.FormEvent<HTMLFormElement>){
  event.preventDefault();if(busyRef.current||!draft)return;
  const parsed=newUserSchema.safeParse(draft);if(!parsed.success){setMessage(parsed.error.issues[0]?.message??'Periksa isian.');return;}
  // Freeze the exact payload for ambiguous network retries; never persist credentials in browser storage.
  setDraft(parsed.data);busyRef.current=true;setBusy(true);setLocked(true);setMessage('');
  try{
   const response=await fetch('/api/directory/users',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(parsed.data),cache:'no-store',signal:AbortSignal.timeout(30000)});
   const body=await response.json();
   if(!response.ok){setMessage(body.message??'Pembuatan akun belum selesai.');if(body.retryable===false){setLocked(false);setDraft({...parsed.data,requestId:crypto.randomUUID()});}return;}
   if(body.created!==true)throw new Error('Unexpected response');
   setDone(true);router.refresh();
  }catch{setMessage('Hasil belum dapat dipastikan. Coba kembali dengan isian yang sama. Jangan tutup halaman sampai akun berhasil dibuat.');}
  finally{busyRef.current=false;setBusy(false);}
 }
 const field='mt-2 min-h-11 w-full min-w-0 rounded-lg border bg-background px-3 py-2 text-sm';
 return <Dialog className="[overflow-wrap:anywhere]" open={open} onOpenChange={changeOpen} title={done?'Pengguna berhasil ditambahkan':'Tambah pengguna'} description={done?'Sampaikan kredensial melalui saluran pribadi kepada pemilik akun.':'Buat akun baru. Pengguna wajib mengganti kata sandi saat login pertama.'} trigger={<Button type="button"><UserPlus aria-hidden="true"/>Tambah pengguna</Button>}>
  {draft&&(done?<div className="space-y-5">
   <Status tone="success">Akun {draft.fullName} berhasil dibuat sebagai {userRoles[draft.role]}.</Status>
   <div className="space-y-4 rounded-lg border p-4"><p className="break-all text-sm"><span className="font-medium">Username:</span> {draft.username}</p><label className="block text-sm font-medium" htmlFor="created-password">Kata sandi sementara</label><div className="flex min-w-0 gap-2"><input id="created-password" className={field+' mt-0'} readOnly type={visible?'text':'password'} value={draft.password} autoComplete="off"/><Button type="button" variant="outline" size="icon" aria-label={visible?'Sembunyikan kata sandi':'Tampilkan kata sandi'} onClick={()=>setVisible(v=>!v)}>{visible?<EyeOff aria-hidden="true"/>:<Eye aria-hidden="true"/>}</Button></div><Button type="button" variant="outline" onClick={async()=>{try{await navigator.clipboard.writeText(`Username: ${draft.username}\nKata sandi sementara: ${draft.password}`);setCopied(true);}catch{setMessage('Penyalinan tidak tersedia. Tampilkan dan salin kredensial secara manual.');}}}><Copy aria-hidden="true"/>{copied?'Kredensial disalin':'Salin kredensial'}</Button><p className="text-sm text-muted-foreground">Simpan sebelum menutup dialog. Kata sandi tidak ditampilkan kembali setelah dialog ditutup. Email kontak belum dianggap terverifikasi.</p></div>
   {message&&<Status>{message}</Status>}<Button type="button" onClick={()=>{setLocked(false);setDraft(null);setOpen(false);}}>Selesai</Button>
  </div>:<form onSubmit={save} className="space-y-5" aria-busy={busy}>
   <fieldset disabled={busy||locked} className="min-w-0 space-y-4 disabled:opacity-75">
    <label className="block text-sm font-medium">Nama lengkap<input className={field} required maxLength={200} value={draft.fullName} onChange={e=>setDraft({...draft,fullName:e.target.value})} autoComplete="off"/></label>
    <label className="block text-sm font-medium">Username<input className={field} required maxLength={100} value={draft.username} onChange={e=>setDraft({...draft,username:e.target.value})} autoCapitalize="none" autoCorrect="off" spellCheck={false} autoComplete="off" aria-describedby="new-username-hint"/></label><p id="new-username-hint" className="text-xs text-muted-foreground">Harus unik. Huruf besar/kecil dan angka nol di awal dipertahankan.</p>
    <div><label htmlFor="new-user-role" className="block text-sm font-medium">Peran</label><select id="new-user-role" className={field} value={draft.role} onChange={e=>setDraft({...draft,role:e.target.value as NewUser['role']})}>{Object.entries(userRoles).map(([value,label])=><option key={value} value={value}>{label}</option>)}</select></div>
    {draft.role==='admin'&&<Status>Admin dapat mengelola akun dan akses aplikasi. Pastikan peran ini sesuai kewenangan pengguna.</Status>}
    <label className="block text-sm font-medium">Email kontak (opsional)<input className={field} type="email" maxLength={320} value={draft.contactEmail} onChange={e=>setDraft({...draft,contactEmail:e.target.value})} autoComplete="off"/></label>
   </fieldset>
   {message&&<Status tone="error">{message}</Status>}
   <p className="text-sm text-muted-foreground">Kata sandi sementara dibuat otomatis dan ditampilkan setelah akun berhasil dibuat. Penugasan, kelas, dan hubungan keluarga diatur melalui modul terkait.</p>
   <div className="flex flex-wrap justify-end gap-3"><Button type="button" variant="outline" disabled={busy||locked} onClick={()=>changeOpen(false)}>Batal</Button><Button type="submit" disabled={busy}>{busy?'Memproses…':locked?'Coba kembali':'Buat pengguna'}</Button></div>
  </form>)}
 </Dialog>;
}
