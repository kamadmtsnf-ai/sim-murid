'use client';
import {FloatingLabel} from "@/components/ui/floating-label";
import {useState} from 'react';
import {Button} from '@/components/ui/button';
import {Status} from '@/components/ui/status';
import {usePush} from './push-provider';
const labels={loading:'Memeriksa perangkat…',unsupported:'Browser ini belum mendukung push',install:'Pasang di Home Screen terlebih dahulu',default:'Izin belum diminta',requesting:'Meminta izin…',denied:'Izin notifikasi ditolak',unregistered:'Belum terdaftar',active:'Aktif pada perangkat ini',offline:'Perangkat sedang offline',error:'Status perlu diperiksa',expired:'Binding atau kunci perlu diperbarui',disabled:'Push belum tersedia',account_changed:'Akun pada tab ini berubah'};
const categories={points:'Poin dan kedisiplinan',schedule:'Jadwal',reports:'Rapor',surveys:'Survei',follow_up:'Tindak lanjut',documents:'Dokumen'};
export function PushPanel(){
 const push=usePush(),[draft,setPrefs]=useState<NonNullable<ReturnType<typeof usePush>>['preferences']>(null),[dirty,setDirty]=useState(false);
 const prefs=dirty?draft:push?.preferences;
 if(!push)return null;
 const disabled=push.busy||push.phase==='offline'||push.phase==='account_changed';
 const savePrefs=async()=>{if(!prefs)return;if(await push.save(prefs))setDirty(false);};
 return <details className="rounded-2xl border bg-card p-4 sm:p-5">
  <summary className="cursor-pointer font-semibold focus-visible:outline-2 focus-visible:outline-offset-4">Notifikasi perangkat <span className="mt-1 block text-sm font-normal text-muted-foreground" role="status">{labels[push.phase]}</span></summary>
  <div className="mt-4 min-w-0 space-y-4">
   <p className="text-sm text-muted-foreground">Izin bersifat opsional. Pemberitahuan pada layar terkunci hanya menampilkan pesan umum.</p>
   {push.phase==='install'?<p className="text-sm">Pada iPhone/iPad yang mendukung: pilih Bagikan → Tambahkan ke Layar Utama, lalu buka SiM-Murid dari ikon tersebut. Gunakan iOS/iPadOS 16.4 atau lebih baru.</p>:null}
   {push.phase==='denied'?<p className="text-sm">Buka pengaturan izin situs pada browser atau pengaturan notifikasi perangkat, lalu izinkan SiM-Murid. Aplikasi tidak akan meminta izin berulang kali.</p>:null}
   {push.message?<Status tone={push.phase==='error'?'error':'info'}>{push.message}</Status>:null}
   <div className="flex flex-wrap gap-2">
    <Button type="button" onClick={()=>void push.enable()} disabled={disabled||!push.config?.enabled||['active','denied','unsupported','install','loading'].includes(push.phase)}>Aktifkan notifikasi</Button>
    <Button type="button" variant="secondary" onClick={()=>{if(push.currentId)void push.revoke(push.currentId);}} disabled={disabled||!push.currentId}>Nonaktifkan perangkat ini</Button>
    <Button type="button" variant="secondary" onClick={()=>void push.test()} disabled={disabled||!push.currentId||push.phase!=='active'||!push.config?.testEnabled}>Uji perangkat ini</Button>
    <Button type="button" variant="secondary" onClick={()=>void push.refresh()} disabled={disabled}>Periksa status</Button>
   </div>
   {prefs?<form onSubmit={e=>{e.preventDefault();void savePrefs();}} className="space-y-4">
    <fieldset disabled={disabled} className="min-w-0 space-y-2"><legend className="mb-2 font-medium">Kategori</legend>
     <div className="grid gap-2 sm:grid-cols-2">{Object.entries(categories).map(([key,label])=><label key={key} className="flex min-h-10 items-center gap-2 text-sm"><input type="checkbox" className="checkbox checkbox-sm" checked={prefs.categories.includes(key as keyof typeof categories)} disabled={!push.config?.categories.includes(key as keyof typeof categories)&&!prefs.categories.includes(key as keyof typeof categories)} onChange={e=>{setDirty(true);setPrefs({...prefs,categories:e.target.checked?[...prefs.categories,key as keyof typeof categories]:prefs.categories.filter(c=>c!==key)});}}/>{label}{!push.config?.categories.includes(key as keyof typeof categories)?' (belum tersedia)':''}</label>)}</div>
    </fieldset>
    <fieldset disabled={disabled} className="grid min-w-0 gap-3 sm:grid-cols-3"><legend className="mb-2 font-medium">Jam tenang</legend>
     <FloatingLabel className="min-w-0 text-sm" label="Mulai jam tenang"><input aria-label="Mulai jam tenang" type="time" required className="input mt-1 w-full min-w-0" value={prefs.quiet_start.slice(0,5)} onChange={e=>{setDirty(true);setPrefs({...prefs,quiet_start:e.target.value});}}/></FloatingLabel>
     <FloatingLabel className="min-w-0 text-sm" label="Selesai jam tenang"><input aria-label="Selesai jam tenang" type="time" required className="input mt-1 w-full min-w-0" value={prefs.quiet_end.slice(0,5)} onChange={e=>{setDirty(true);setPrefs({...prefs,quiet_end:e.target.value});}}/></FloatingLabel>
     <label className="min-w-0 text-sm">Zona waktu<select aria-label="Zona waktu notifikasi" className="select mt-1 w-full min-w-0" value={prefs.timezone} onChange={e=>{setDirty(true);setPrefs({...prefs,timezone:e.target.value});}}>{[...new Set([prefs.timezone,'Asia/Jakarta','Asia/Makassar','Asia/Jayapura'])].map(t=><option key={t}>{t}</option>)}</select></label>
    </fieldset>
    <p className="text-xs text-muted-foreground">Jam yang sama berarti tanpa jam tenang. Uji perangkat tidak mengikuti jam tenang.</p>
    <div className="flex flex-wrap gap-2"><Button type="submit" disabled={disabled||!dirty}>Simpan preferensi</Button><Button type="button" variant="secondary" disabled={disabled||!dirty} onClick={()=>{setPrefs(push.preferences);setDirty(false);}}>Batalkan perubahan</Button></div>
   </form>:null}
   <section aria-label="Perangkat terdaftar" className="space-y-2"><h3 className="font-medium">Perangkat terdaftar</h3>{push.devices.length?<ul className="space-y-2">{push.devices.map(d=><li key={d.id} className="flex min-w-0 flex-wrap items-center justify-between gap-2 rounded-xl border p-3"><span className="min-w-0 break-words text-sm">{d.label||'Perangkat'} — {d.status==='active'?'Terdaftar':d.status==='revoked'?'Dicabut':'Perlu diperbarui'}</span><Button type="button" variant="secondary" disabled={disabled||d.status==='revoked'} onClick={()=>void push.revoke(d.id)}>Cabut perangkat</Button></li>)}</ul>:<p className="text-sm text-muted-foreground">Belum ada perangkat yang terdaftar.</p>}</section>
  </div>
 </details>;
}
