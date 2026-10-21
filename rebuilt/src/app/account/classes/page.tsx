import {redirect} from 'next/navigation';
import {readServerPrincipal} from '@/lib/auth/read-server';
import {classesData} from '@/lib/education/server';
import {ClassPanel} from './class-panel';
export const dynamic='force-dynamic';
export default async function ClassesPage(){const caller=await readServerPrincipal();if(!caller)redirect('/login?expired=1');let data;try{data=await classesData(caller.principal.id,caller.sessionId);}catch{return <main id="main-content" className="mx-auto max-w-xl space-y-4 px-6 py-12"><h1>Kelas belum tersedia</h1><p>Selesaikan keamanan akun atau periksa koneksi.</p></main>;}
 return <main id="main-content" className="mx-auto max-w-6xl space-y-5 px-6 py-10"><h1 className="text-3xl font-semibold">Kelas dan penempatan siswa</h1><ClassPanel initial={data}/></main>;
}
