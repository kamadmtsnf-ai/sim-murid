import {redirect} from 'next/navigation';
import {readServerPrincipal} from '@/lib/auth/read-server';
import {securityState} from '@/lib/auth/security';
import {createAuthAdmin} from '@/lib/auth/admin';
import {profileSchema} from '@/lib/auth/recovery-validation';
import {ProfileForm} from './profile-form';
export const dynamic='force-dynamic';
export default async function ProfilePage(){
 let caller;let gate;let profile;
 try{caller=await readServerPrincipal();if(caller){gate=await securityState(caller.principal.id,caller.sessionId);if(gate&&['ready','email_pending'].includes(gate.gate)){const r=await createAuthAdmin().rpc('app_profile_read',{p_user:caller.principal.id,p_session:caller.sessionId});if(r.error)throw new Error('Unavailable');if(r.data)profile=profileSchema.parse(r.data);}}}
 catch{return <main id="main-content" className="mx-auto max-w-xl px-6 py-12"><h1>Profil belum tersedia</h1><p>Muat ulang beberapa saat lagi.</p></main>;}
 if(!caller)redirect('/login?expired=1');if(!profile)redirect('/account/security');
 return <main id="main-content" className="mx-auto max-w-xl space-y-6 px-6 py-12"><h1 className="text-3xl font-semibold">Profil pribadi</h1><p>Perbarui nama, nomor HP, email kontak dan bio. Perubahan email membatalkan verifikasi lama. Formulir ini tidak menggantikan biodata wajib Siswa atau Calon Siswa.</p><ProfileForm initialProfile={profile}/></main>;
}
