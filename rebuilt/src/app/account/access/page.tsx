import {securityState} from '@/lib/auth/security';
import {redirect} from 'next/navigation';
import {verifiedPrincipal} from '@/lib/auth/http';
import {loadAccessContext} from '@/lib/auth/authorization';
import {readServerAuthClient} from '@/lib/auth/read-server';
import {Card,CardContent,CardHeader,CardTitle} from '@/components/ui/card';
export const dynamic='force-dynamic';
const resources:Record<string,string>={profiles:'Profil',roles:'Peran',assignments:'Penugasan',flags:'Fasilitas akun',accounts:'Akun pengguna',sessions:'Sesi',references:'Data referensi',school:'Profil madrasah',classes:'Kelas',attendance:'Kehadiran',fees:'Iuran',savings:'Tabungan',grades:'Nilai',mentoring:'Bimbingan',notifications:'Notifikasi',graduation:'Kelulusan',certificates:'Ijazah',books:'Buku',discipline:'SPK',surveys:'Survei',action_plan:'Rencana aksi',settings:'Konfigurasi',audit:'Log aktivitas',survey_ai:'Analisis survei'};
const actions:Record<string,string>={read:'Lihat',manage:'Kelola',revoke:'Cabut',write:'Tulis'};
export default async function AccessPage(){
 let context; let needsOnboarding=false;
 try{const client=await readServerAuthClient();const principal=await verifiedPrincipal(client);if(principal){const gate=await securityState(principal.principal.id,principal.sessionId);needsOnboarding=gate?.gate!=='ready';}context=principal&&!needsOnboarding?await loadAccessContext(client):null;}catch{return <main id="main-content" className="mx-auto max-w-xl px-6 py-16"><h1>Pemeriksaan hak akses belum tersedia</h1><p>Silakan muat ulang beberapa saat lagi.</p></main>;}
 if(needsOnboarding)redirect('/account/security');
 if(!context)redirect('/login?expired=1');
 return <main id="main-content" className="mx-auto max-w-3xl space-y-6 px-6 py-12"><h1 className="text-3xl font-semibold">Hak akses saya</h1><p className="text-sm text-muted-foreground">Izin mengikuti peran dan penugasan yang masih berlaku. Setiap layanan tetap memeriksa kepemilikan dan hubungan data. Layanan akan tersedia sesuai tahap pengembangannya.</p><Card><CardHeader><CardTitle>Cakupan izin</CardTitle></CardHeader><CardContent><ul className="divide-y">{context.grants.toSorted((a,b)=>a.capability.localeCompare(b.capability)).map((g,i)=>{const [r,a]=g.capability.split('.');return <li key={`${g.capability}-${i}`} className="flex flex-wrap justify-between gap-3 py-3 text-sm"><span>{actions[a??'']??a} {resources[r??'']??r}</span><span className="text-muted-foreground">{g.scope==='own'?'Data sendiri':g.scope==='class'?'Kelas yang ditugaskan':'Sesuai tanggung jawab peran'}</span></li>;})}</ul></CardContent></Card></main>;
}
