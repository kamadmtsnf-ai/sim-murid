import {redirect} from 'next/navigation';
import Link from 'next/link';
import {z} from 'zod';
import {readServerPrincipal} from '@/lib/auth/read-server';
import {loadStudent} from '@/lib/student/server';
import {documentList} from '@/lib/documents/server';
import {BiodataPanel} from '../biodata-panel';
export const dynamic='force-dynamic';
export default async function StudentBiodataPage({params}:{params:Promise<{id:string}>}){const caller=await readServerPrincipal();if(!caller)redirect('/login?expired=1');
 let student,documents;
 try{const target=z.uuid().parse((await params).id);[student,documents]=await Promise.all([loadStudent(caller.principal.id,caller.sessionId,target),documentList(caller.principal.id,caller.sessionId,target)]);}catch{return <main id="main-content" className="mx-auto max-w-xl px-6 py-12"><h1>Biodata tidak tersedia untuk akun Anda</h1><Link href="/account/directory">Kembali</Link></main>;}
 return <main id="main-content" className="mx-auto max-w-5xl space-y-5 px-6 py-10"><Link className="underline" href="/account/directory">Kembali ke direktori</Link><BiodataPanel initial={student} initialDocuments={documents}/></main>;
}
