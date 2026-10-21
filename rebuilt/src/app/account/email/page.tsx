import {redirect} from 'next/navigation';
import {readServerPrincipal} from '@/lib/auth/read-server';
import {createAuthAdmin} from '@/lib/auth/admin';
import {emailStateSchema} from '@/lib/email/validation';
import {EmailPanel} from './email-panel';
export const dynamic='force-dynamic';
export default async function EmailPage(){
 let caller;let state;
 try{caller=await readServerPrincipal();if(caller){const r=await createAuthAdmin().rpc('app_email_state',{p_user:caller.principal.id,p_session:caller.sessionId});if(r.error)throw new Error('Unavailable');if(r.data)state=emailStateSchema.parse(r.data);}}
 catch{return <main id="main-content" className="mx-auto max-w-lg px-6 py-12"><h1>Verifikasi email belum tersedia</h1><p>Muat ulang beberapa saat lagi.</p></main>;}
 if(!caller)redirect('/login?expired=1');if(!state)redirect('/account/security');
 return <main id="main-content" className="mx-auto max-w-lg space-y-6 px-6 py-12"><h1 className="text-3xl font-semibold">Verifikasi email Guru</h1><EmailPanel initialState={state}/></main>;
}
