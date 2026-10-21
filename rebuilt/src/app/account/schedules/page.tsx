import {redirect} from 'next/navigation';
import {z} from 'zod';
import {readServerPrincipal} from '@/lib/auth/read-server';
import {classesData,schedulesData} from '@/lib/education/server';
import {SchedulePanel} from './schedule-panel';
export const dynamic='force-dynamic';
export default async function SchedulesPage({searchParams}:{searchParams:Promise<Record<string,string|string[]|undefined>>}){
 const caller=await readServerPrincipal();if(!caller)redirect('/login?expired=1');
 let classes,schedules,filters;
 try{const q=await searchParams;classes=await classesData(caller.principal.id,caller.sessionId);filters={...(typeof q.year==='string'&&z.uuid().safeParse(q.year).success?{year:q.year}:classes.years.find(y=>y.is_active)?{year:classes.years.find(y=>y.is_active)!.id}:{}),...(typeof q.class==='string'&&z.uuid().safeParse(q.class).success?{classId:q.class}:{}),...(typeof q.day==='string'&&/^[1-7]$/.test(q.day)?{weekday:Number(q.day)}:{}),personal:q.personal==='1'};schedules=await schedulesData(caller.principal.id,caller.sessionId,filters);
}catch{return <main id="main-content" className="mx-auto max-w-xl space-y-4 px-6 py-12"><h1>Jadwal belum tersedia</h1><p>Periksa keamanan akun, tahun ajaran dan hak akses.</p></main>;}
 return <main id="main-content" className="mx-auto max-w-6xl space-y-5 px-6 py-10"><h1 className="text-3xl font-semibold">Jadwal pelajaran dan piket siswa</h1><SchedulePanel initial={schedules} classes={classes} filters={filters}/></main>;
}
