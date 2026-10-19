import Link from 'next/link';
import {redirect} from 'next/navigation';
import {readServerPrincipal,readServerAuthClient} from '@/lib/auth/read-server';
import {requireCapability,AccessDenied} from '@/lib/auth/authorization';
import {loadSettings} from '@/lib/settings/server';
import {getSupabasePublicEnvironment} from '@/lib/supabase/environment';
import {SettingsPanel} from './settings-panel';
export const dynamic='force-dynamic';
export default async function SettingsPage(){
 const caller=await readServerPrincipal();if(!caller)redirect('/login?expired=1');
 let settings;
 try{if(!caller.principal.is_admin)throw new AccessDenied();await requireCapability(await readServerAuthClient(),'settings.manage');settings=await loadSettings(caller.principal.id,caller.sessionId);}
 catch(error){return <main id="main-content" className="mx-auto max-w-xl space-y-4 px-6 py-12"><Link href="/account">Kembali</Link><h1 className="text-2xl font-semibold">Pengaturan madrasah</h1><p>{error instanceof AccessDenied?'Akses khusus Admin yang telah menyelesaikan pengaturan keamanan akun.':'Pengaturan belum tersedia. Muat ulang beberapa saat lagi.'}</p></main>;}
 return <main id="main-content" className="mx-auto max-w-5xl space-y-6 px-6 py-10"><Link className="text-primary underline" href="/account">Kembali ke akun</Link><h1 className="text-3xl font-semibold">Pengaturan madrasah</h1><p>Kelola identitas sekolah, logo, mata pelajaran, hafalan dan hari libur.</p><SettingsPanel initial={settings} assetBase={`${getSupabasePublicEnvironment().url}/storage/v1/object/public/school-assets/`}/></main>;
}
