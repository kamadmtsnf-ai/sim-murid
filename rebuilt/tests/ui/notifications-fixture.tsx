/** Synthetic component QA. Not a production route or identity. */
import {createRoot} from 'react-dom/client';
import {ServicesPanel} from '../../src/app/account/services/[module]/panel';
import {WorkspaceShell} from '../../src/components/workspace-shell';
import {navigationFor} from '../../src/config/account-navigation';
import {snapshot} from '../../src/lib/services/validation';
const scenario=new URLSearchParams(location.search).get('scenario')??'normal';
const id=(n:number)=>'11111111-1111-4111-8111-'+String(n).padStart(12,'0');
const count=scenario==='empty'?0:scenario==='many'?200:3;
const rows=Array.from({length:count},(_,i)=>({id:id(i+1),title:scenario==='long'?'Judul'.repeat(100):'Pemberitahuan '+(i+1),message:scenario==='long'?'Pesan'.repeat(300)+'\nBaris berikutnya.':'Informasi kegiatan madrasah untuk akun Anda.',created_at:scenario==='invalid-date'?'invalid':'2026-10-21T09:30:00+00:00',read_at:i===2?'2026-10-21T10:00:00Z':null,entity_id:null}));
const data=snapshot.parse({module:'notifications',revision:5,today:'2026-10-21',month:'2026-10-01',isAdmin:false,isManager:false,rows,extra:{unread:scenario==='many'?250:rows.filter(r=>!r.read_at).length},classes:[],years:[],subjects:[]});
Object.assign(window,{notificationFixture:data});
const root=createRoot(document.getElementById('root')!);Object.assign(window,{unmountNotifications:()=>root.unmount()});
root.render(<WorkspaceShell name="Akun Uji Notifikasi" username="qa-notifications" navigation={navigationFor(['notifications.read'],false)}><main id="main-content" tabIndex={-1} className="space-y-6"><h1 className="text-3xl font-semibold">Notifikasi</h1><ServicesPanel initial={data} userId={id(999)}/></main></WorkspaceShell>);
