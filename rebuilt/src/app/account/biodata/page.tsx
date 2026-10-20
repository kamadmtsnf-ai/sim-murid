import {redirect} from 'next/navigation';
import {readServerPrincipal} from '@/lib/auth/read-server';
import {loadStudent} from '@/lib/student/server';
import {documentList} from '@/lib/documents/server';
import {BiodataPanel} from './biodata-panel';
import Link from 'next/link';
export const dynamic='force-dynamic';
export default async function BiodataPage(){const caller=await readServerPrincipal();if(!caller)redirect('/login?expired=1');
 let student,documents;
 try{[student,documents]=await Promise.all([loadStudent(caller.principal.id,caller.sessionId,caller.principal.id),documentList(caller.principal.id,caller.sessionId,caller.principal.id)]);}catch{return <main id="main-content" className="mx-auto max-w-xl space-y-4 px-6 py-12"><Link href="/account/security">Kembali</Link><h1 className="text-2xl font-semibold">Biodata belum tersedia</h1><p>Formulir ini untuk Siswa, Calon Siswa, atau Alumni setelah mengganti password sementara. Periksa koneksi dan langkah keamanan akun.</p></main>;}
 return <main id="main-content" className="mx-auto max-w-5xl space-y-5 px-6 py-10"><Link href="/account/security" className="underline">Kembali ke keamanan akun</Link><BiodataPanel initial={student} initialDocuments={documents}/></main>;
}
