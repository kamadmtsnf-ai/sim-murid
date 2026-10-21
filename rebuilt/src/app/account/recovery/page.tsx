import {redirect} from 'next/navigation';
import {readServerPrincipal} from '@/lib/auth/read-server';
import {securityState} from '@/lib/auth/security';
import {createAuthAdmin} from '@/lib/auth/admin';
import {recoveryListSchema} from '@/lib/auth/recovery-validation';
import {RecoveryPanel} from './recovery-panel';
export const dynamic='force-dynamic';
export default async function RecoveryAdminPage(){
 let caller;let gate;let list;
 try{caller=await readServerPrincipal();if(caller){gate=await securityState(caller.principal.id,caller.sessionId);if(gate?.gate==='ready'&&caller.principal.is_admin){const r=await createAuthAdmin().rpc('app_recovery_list',{p_actor:caller.principal.id,p_session:caller.sessionId});if(r.error)throw new Error('Unavailable');if(r.data!==null)list=recoveryListSchema.parse(r.data);}}}
 catch{return <main id="main-content" className="mx-auto max-w-xl px-6 py-12"><h1>Antrean belum tersedia</h1><p>Muat ulang beberapa saat lagi.</p></main>;}
 if(!caller)redirect('/login?expired=1');if(gate?.gate!=='ready')redirect('/account/security');if(!caller.principal.is_admin||!list)redirect('/account');
 return <main id="main-content" className="mx-auto max-w-2xl space-y-6 px-6 py-12"><h1 className="text-3xl font-semibold">Pemulihan akun</h1><p>Tampilkan maksimal 100 permintaan aktif tertua. Permintaan berlaku 24 jam. Verifikasi identitas melalui prosedur madrasah sebelum menyetujui; jawaban keamanan hanya bukti tambahan. Pemulihan akun sendiri harus ditangani Admin lain atau operator tepercaya.</p><RecoveryPanel initialRequests={list}/></main>;
}
