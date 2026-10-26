import {redirect} from 'next/navigation';
import {readServerPrincipal} from '@/lib/auth/read-server';
import {createAuthAdmin} from '@/lib/auth/admin';
import {directoryQuery,directorySnapshot} from '@/lib/education/validation';
import {directoryPageCount,directoryPageUrl} from '@/lib/education/directory';
import {AddUser} from './add-user';
import {ImportUsers} from './import-users';
import {Status} from '@/components/ui/status';
import {DirectoryPanel,DirectoryFilters} from './directory-panel';
export const dynamic='force-dynamic';
export default async function DirectoryPage({searchParams}:{searchParams:Promise<Record<string,string|string[]|undefined>>}){
 const caller=await readServerPrincipal();if(!caller)redirect('/login?expired=1');
 const parsed=directoryQuery.safeParse(await searchParams);
 if(!parsed.success)return <main id="main-content" tabIndex={-1} className="directory-panel space-y-6"><h1 className="text-3xl font-semibold">Direktori pengguna</h1><Status tone="error">Filter tidak valid. Pilih jenis pengguna, masukkan pencarian maksimal 100 karakter, dan gunakan halaman 1–2000.</Status><DirectoryFilters filter={directoryQuery.parse({})} isAdmin={caller.principal.is_admin}/></main>;
 const input=parsed.data;
 if(!caller.principal.is_admin&&input.status!=='active')redirect(directoryPageUrl({...input,status:'active'},1));
 let data;
 try{const r=await createAuthAdmin().rpc('app_directory_read',{p_actor:caller.principal.id,p_session:caller.sessionId,p_role:input.role,p_query:input.query,p_page:input.page,p_status:input.status});if(r.error)throw new Error('Unavailable');data=r.data===null?null:directorySnapshot.parse(r.data);}catch{throw new Error('Directory unavailable');}
 if(data===null)return <main tabIndex={-1} id="main-content" className="space-y-4"><h1 className="text-2xl font-semibold">Direktori tidak tersedia untuk akun Anda</h1><Status>Pastikan pengaturan akun telah lengkap. Data hanya tersedia sesuai peran dan hubungan yang telah diverifikasi.</Status></main>;
 if(input.page>directoryPageCount(data))redirect(directoryPageUrl(input,directoryPageCount(data)));
 return <main id="main-content" tabIndex={-1} className="space-y-6"><div><h1 className="text-3xl font-semibold">Direktori pengguna</h1><p className="mt-2 max-w-3xl text-muted-foreground">Cari pengguna dan lihat detail sesuai peran, penugasan, kelas, serta hubungan yang telah diverifikasi.</p></div>{caller.principal.is_admin?<div className="flex flex-wrap gap-3"><AddUser/><ImportUsers/></div>:null}<DirectoryPanel data={data} filter={input} isAdmin={caller.principal.is_admin}/></main>;
}
