import {redirect} from 'next/navigation';
import {readServerPrincipal} from '@/lib/auth/read-server';
import {securityState} from '@/lib/auth/security';
import {SecurityPanel} from './security-panel';
export const dynamic='force-dynamic';
export default async function SecurityPage(){
 let principal;let state;
 try{principal=await readServerPrincipal();if(principal)state=await securityState(principal.principal.id,principal.sessionId);}
 catch{return <main id="main-content" className="mx-auto max-w-xl px-6 py-16"><h1>Pemeriksaan keamanan belum tersedia</h1><p>Silakan muat ulang beberapa saat lagi.</p></main>;}
 if(!principal||!state)redirect('/login?expired=1');
 return <SecurityPanel key={`${state.gate}:${state.question_code}`} username={principal.principal.username} initialState={state}/>;
}
