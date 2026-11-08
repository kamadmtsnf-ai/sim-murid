import {redirect} from 'next/navigation';
import {readServerAuthClient} from '@/lib/auth/read-server';
import {verifiedPrincipal} from '@/lib/auth/http';
import {pushDestination} from '@/lib/push/navigation';
import {openPush} from '@/lib/push/open';
import {ReadNotification} from '@/components/push/read-notification';
export const dynamic='force-dynamic';
export default async function NotificationPage({params}:{params:Promise<{ref:string}>}){
 const {ref}=await params;
 const valid=pushDestination(ref);
 const state=await verifiedPrincipal(await readServerAuthClient());
 if(!state)redirect(valid?'/login?expired=1&push='+ref:'/login?expired=1');
 const entry=valid?await openPush(state.principal.id,state.sessionId,ref):null;
 return <main id="main-content" tabIndex={-1} className="mx-auto min-w-0 max-w-2xl space-y-5 p-4 sm:p-6">
  <h1 className="break-words text-2xl font-semibold">{entry?.title||'Pemberitahuan'}</h1>
  {entry?<><p className="whitespace-pre-wrap break-words">{entry.message}</p><ReadNotification reference={ref} read={!!entry.read_at}/></>:<p>Pemberitahuan tidak tersedia untuk akun ini atau akses sumbernya telah berubah. Gunakan menu Notifikasi untuk membuka kotak masuk.</p>}
 </main>;
}
