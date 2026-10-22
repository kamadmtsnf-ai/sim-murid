/** Real mentoring UI, synthetic records; no application route or real session. */
import {createRoot} from 'react-dom/client';
import {MentoringPanel} from '../../src/app/account/operations/[module]/mentoring-panel';
import {WorkspaceShell} from '../../src/components/workspace-shell';
import {navigationFor} from '../../src/config/account-navigation';
import {mentoringSnapshot} from '../../src/lib/operations/mentoring';
import Loading from '../../src/app/account/loading';
import ErrorPage from '../../src/app/account/error';
const id=(n:number)=>`00000000-0000-4000-8000-${String(n).padStart(12,'0')}`;
const mode=new URLSearchParams(location.search).get('mode')??'normal',readonly=mode==='readonly',teacher=mode==='teacher';
const students=Array.from({length:mode==='large'?80:4},(_,i)=>({id:id(10+i),username:'siswa-'+i,full_name:i===3?'NamaPanjangTanpaSpasi'.repeat(7):'Siswa '+(i+1),role_code:'student',class_id:id(20),class_name:'7A'}));
const teachers=[{id:id(300),username:'guru-1',full_name:'Guru Satu',role_code:'teacher',class_id:null,class_name:null},{id:id(301),username:'guru-2',full_name:'Guru Dua',role_code:'teacher',class_id:null,class_name:null}];
const assignments=[{id:id(50),teacher_id:id(300),student_id:id(10),name:'Siswa 1',teacher_name:'Guru Satu'},{id:id(51),teacher_id:id(300),student_id:id(11),name:'Siswa 2',teacher_name:'Guru Satu'},{id:id(52),teacher_id:id(301),student_id:id(12),name:'Siswa 3',teacher_name:'Guru Dua'},{id:id(53),teacher_id:id(300),student_id:id(90),name:'Siswa lama',teacher_name:'Guru Satu'}];
const rows=Array.from({length:mode==='large'?50:2},(_,i)=>({id:id(100+i),student_id:id(10),teacher_id:id(300),name:'Siswa 1',teacher_name:'Guru Satu',date:'2026-10-02',kind:i%2?'development':'memorization',subject:i%2?'Kemandirian':'Al-Ikhlas',catalog_id:i%2?null:id(60),predicate:i%2?'':'Lancar',notes:'Catatan '+ 'panjang'.repeat(30),can_edit:!readonly}));
const data=mentoringSnapshot.parse({module:'mentoring',today:'2026-10-22',revision:1,canManage:!readonly,isAdmin:!readonly&&!teacher,people:mode==='empty'?[]:[...students,...(teacher?[teachers[0]!]:teachers)],classes:[],rows:mode==='empty'?[]:rows,total:mode==='empty'?0:mode==='large'?120:2,page:1,pageSize:50,summary:{},extra:{assignments:mode==='empty'?[]:teacher?assignments.filter(a=>a.teacher_id===id(300)):assignments,catalog:[{id:id(60),name:'Al-Ikhlas'}],canAssign:!readonly&&!teacher}});
Object.assign(window,{mentoringFixture:data});
createRoot(document.getElementById('root')!).render(<WorkspaceShell navigation={navigationFor(['mentoring.read'],true)} name="Petugas uji" username="qa-mentoring">{mode==='loading'?<Loading/>:mode==='error'?<ErrorPage error={Error('Synthetic')} reset={()=>location.reload()}/>:<main id="main-content" tabIndex={-1} className="mx-auto min-w-0 max-w-7xl space-y-6 p-6"><h1 className="text-3xl font-semibold">Guru Wali dan bimbingan</h1><MentoringPanel initial={data}/></main>}</WorkspaceShell>);
