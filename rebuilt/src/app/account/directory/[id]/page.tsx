import {redirect} from 'next/navigation';
import {z} from 'zod';
import {readServerPrincipal} from '@/lib/auth/read-server';
import {createAuthAdmin} from '@/lib/auth/admin';
import {directoryDetailSchema} from '@/lib/education/directory';
import {Status} from '@/components/ui/status';
import {DirectoryDetailView} from '../directory-detail';
export const dynamic='force-dynamic';
function Unavailable(){return <main id="main-content" className="space-y-4"><h1 className="text-2xl font-semibold">Detail tidak tersedia untuk akun Anda</h1><Status>Data mungkin sudah berubah atau berada di luar hak akses Anda.</Status></main>;}
export default async function DirectoryDetail({params}:{params:Promise<{id:string}>}){
 const caller=await readServerPrincipal();if(!caller)redirect('/login?expired=1');
 const target=z.uuid().safeParse((await params).id);if(!target.success)return <Unavailable/>;
 let person;
 try{const r=await createAuthAdmin().rpc('app_directory_detail',{p_actor:caller.principal.id,p_session:caller.sessionId,p_target:target.data});if(r.error)throw new Error('Unavailable');person=r.data===null?null:directoryDetailSchema.parse(r.data);}catch{throw new Error('Directory detail unavailable');}
 if(person===null)return <Unavailable/>;
 return <main id="main-content" tabIndex={-1}><DirectoryDetailView person={person}/></main>;
}
