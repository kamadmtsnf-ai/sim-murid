import {redirect} from 'next/navigation';
import Link from 'next/link';
import {readServerPrincipal} from '@/lib/auth/read-server';
import {createAuthAdmin} from '@/lib/auth/admin';
import {directoryQuery,directorySnapshot} from '@/lib/education/validation';
import {DirectoryPanel} from './directory-panel';
export const dynamic='force-dynamic';
export default async function DirectoryPage({searchParams}:{searchParams:Promise<Record<string,string|string[]|undefined>>}){
 const caller=await readServerPrincipal();if(!caller)redirect('/login?expired=1');
 let input,data;
 try{const parsed=directoryQuery.safeParse(await searchParams);input=parsed.success?parsed.data:directoryQuery.parse({});const r=await createAuthAdmin().rpc('app_directory_read',{p_actor:caller.principal.id,p_session:caller.sessionId,p_role:input.role,p_query:input.query,p_page:input.page,p_status:input.status});if(r.error||!r.data)throw new Error('Unavailable');data=directorySnapshot.parse(r.data);}catch{return <main id="main-content" className="mx-auto max-w-xl space-y-4 px-6 py-12"><h1>Direktori belum tersedia</h1><p>Selesaikan langkah keamanan akun dan muat ulang. Akun tanpa hubungan atau penugasan hanya melihat data yang diizinkan.</p><Link href="/account/security">Keamanan akun</Link></main>;}
 return <main id="main-content" className="mx-auto max-w-6xl space-y-5 px-6 py-10"><Link href="/account" className="underline">Kembali</Link><h1 className="text-3xl font-semibold">Direktori pengguna</h1><p>Daftar dan detail mengikuti peran, penugasan, kelas, serta relasi anak yang telah diverifikasi. Data di luar hak akses Anda tidak ditampilkan.</p><DirectoryPanel data={data} filter={input} isAdmin={caller.principal.is_admin}/></main>;
}
