import {z} from 'zod';
import {guardianRequest,familyRequest} from '../student/validation.ts';
const ids=z.array(z.uuid()).max(500).refine(a=>new Set(a).size===a.length,'Pilih ID unik.');
const name=z.string().trim().min(1).max(50).refine(s=>!/[\u0000-\u001f\u007f]/.test(s));
export const classCommand=z.discriminatedUnion('type',[
 z.object({type:z.literal('year'),startYear:z.number().int().min(1900).max(2199)}).strict(),
 z.object({type:z.literal('year_activate'),id:z.uuid()}).strict(),
 z.object({type:z.literal('class'),id:z.uuid().nullable(),yearId:z.uuid(),level:z.union([z.literal(7),z.literal(8),z.literal(9)]),name,teacherId:z.uuid().nullable()}).strict(),
 z.object({type:z.literal('class_archive'),id:z.uuid()}).strict(),
 z.object({type:z.literal('enrollment'),classId:z.uuid(),studentIds:ids.refine(a=>a.length>0),startsOn:z.iso.date(),remove:z.boolean()}).strict(),
]);
export function endMinute(start:string,duration:number,jtm:number,rest:number){const [h,m]=start.split(':').map(Number);return(h??0)*60+(m??0)+duration*jtm+rest;}
export const clock=(n:number)=>`${String(Math.floor(n/60)).padStart(2,'0')}:${String(n%60).padStart(2,'0')}`;
export const weekdays=['','Senin','Selasa','Rabu','Kamis','Jumat','Sabtu','Minggu'];
export const scheduleCommand=z.discriminatedUnion('type',[
 z.object({type:z.literal('lesson'),id:z.uuid().nullable(),classId:z.uuid(),subjectId:z.uuid(),teacherId:z.uuid(),weekday:z.number().int().min(1).max(7),start:z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/),durationMinutes:z.number().int().min(1).max(240),jtm:z.number().int().min(1).max(12),breakMinutes:z.number().int().min(0).max(240)}).strict().refine(d=>endMinute(d.start,d.durationMinutes,d.jtm,d.breakMinutes)<1440,'Jadwal harus selesai pada hari yang sama.'),
 z.object({type:z.literal('duties'),classId:z.uuid(),items:z.array(z.object({weekday:z.number().int().min(1).max(7),studentId:z.uuid()}).strict()).max(500).refine(a=>new Set(a.map(d=>`${d.weekday}:${d.studentId}`)).size===a.length,'Piket siswa/hari tidak boleh duplikat.')}).strict(),
 z.object({type:z.literal('schedule_delete'),lessonIds:ids,dutyIds:ids}).strict().refine(d=>d.lessonIds.length+d.dutyIds.length>0&&d.lessonIds.length+d.dutyIds.length<=500),
]);
export const familyCommand=z.discriminatedUnion('type',[guardianRequest,familyRequest]);
export const mutation=(command:z.ZodType)=>z.object({requestId:z.uuid(),revision:z.number().int().nonnegative().max(Number.MAX_SAFE_INTEGER),command}).strict();
export const directoryQuery=z.object({role:z.enum(['teacher','student','applicant','parent','alumni']).default('student'),query:z.string().max(100).default(''),page:z.coerce.number().int().min(1).max(2000).default(1),status:z.enum(['active','inactive','all']).default('active')}).strict();
export const person=z.object({id:z.uuid(),username:z.string().optional(),name:z.string()});
export const classSnapshot=z.object({revision:z.number(),can_manage:z.boolean(),years:z.array(z.object({id:z.uuid(),start_year:z.number(),is_active:z.boolean()})),classes:z.array(z.object({id:z.uuid(),year_id:z.uuid(),level:z.number(),name:z.string(),teacher_id:z.uuid().nullable(),teacher_name:z.string().nullable(),archived:z.boolean(),can_schedule:z.boolean(),students:z.array(person.extend({enrollment_id:z.uuid(),starts_on:z.string(),status:z.string()}))})),teachers:z.array(person),students:z.array(person)});
export const familySnapshot=z.object({revision:z.number(),students:z.array(person),parents:z.array(person),guardians:z.array(z.object({id:z.uuid(),student_id:z.uuid(),parent_id:z.uuid(),relationship:z.enum(['father','mother','guardian'])})),families:z.array(z.object({id:z.uuid(),name:z.string(),members:z.array(z.object({student_id:z.uuid(),legacy_order:z.number()}))}))});
export const scheduleSnapshot=z.object({revision:z.number(),today:z.number(),lessons:z.array(z.object({id:z.uuid(),class_id:z.uuid(),class_name:z.string(),year_id:z.uuid(),subject_id:z.uuid(),subject:z.string(),teacher_id:z.uuid(),teacher_name:z.string(),weekday:z.number(),start_minute:z.number(),duration_minutes:z.number(),jtm:z.number(),break_minutes:z.number(),end_minute:z.number(),can_manage:z.boolean()})),duties:z.array(z.object({id:z.uuid(),class_id:z.uuid(),class_name:z.string(),student_id:z.uuid(),student_name:z.string(),weekday:z.number(),can_manage:z.boolean()})),duty_roster:z.array(z.object({class_id:z.uuid(),student_id:z.uuid(),weekday:z.number()})),subjects:z.array(z.object({id:z.uuid(),name:z.string(),active:z.boolean()})),teachers:z.array(person)});
export const directorySnapshot=z.object({rows:z.array(person.extend({username:z.string(),role:z.string(),status:z.string(),progress:z.object({percent:z.number()}).nullable(),classes:z.array(z.object({id:z.uuid(),name:z.string(),level:z.number(),year:z.number()})),assignments:z.array(z.object({code:z.string(),class_id:z.uuid().nullable()})),homerooms:z.array(person.pick({id:true,name:true})),schedule_count:z.number()})),page:z.number(),page_size:z.number(),total:z.number()});
