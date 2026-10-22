import {z} from 'zod';
export const operationModules=z.enum(['duty','attendance','mentoring','fees','savings']);
export type OperationModule=z.infer<typeof operationModules>;
export const moduleTitles:Record<OperationModule,string>={duty:'Konfirmasi guru piket',attendance:'Absensi siswa',mentoring:'Guru Wali dan bimbingan',fees:'Iuran komite',savings:'Tabungan'};
const id=z.uuid(),date=z.iso.date().refine(v=>v>='2000-01-01'&&v<='2100-12-31','Tanggal di luar rentang.'),month=date.refine(v=>v.endsWith('-01'),'Pilih awal bulan.'),reason=z.string().trim().min(3).max(2000),notes=z.string().trim().max(2000).default(''),nullableId=id.nullable().default(null);
const money=z.number().int().safe().min(1).max(1e12);
export const commandSchemas={
 duty:z.discriminatedUnion('type',[
 z.object({type:z.literal('roster'),teacherId:id,assignTask:z.boolean().default(false),weekdays:z.array(z.number().int().min(1).max(6)).max(6).refine(v=>new Set(v).size===v.length)}).strict(),
 z.object({type:z.literal('primary'),teacherId:id}).strict(),z.object({type:z.literal('appoint'),teacherId:id,replacesId:id}).strict(),
 z.object({type:z.enum(['confirm','unconfirm','cancel']),id,reason}).strict()]),
 attendance:z.discriminatedUnion('type',[
 z.object({type:z.literal('batch'),items:z.array(z.object({studentId:id,classId:id,date,status:z.enum(['Hadir','Sakit','Izin','Alpha']),notes}).strict()).min(1).max(500).refine(v=>new Set(v.map(x=>x.studentId+x.date)).size===v.length,'Siswa/tanggal duplikat.')}).strict(),
 z.object({type:z.literal('edit'),id,status:z.enum(['Hadir','Sakit','Izin','Alpha']),notes,reason}).strict(),z.object({type:z.literal('void'),id,reason}).strict()]),
 mentoring:z.discriminatedUnion('type',[
 z.object({type:z.literal('assign'),teacherId:id,assignTask:z.boolean().default(false),studentIds:z.array(id).max(500).refine(v=>new Set(v).size===v.length)}).strict(),
 z.object({type:z.literal('report'),id:nullableId,studentId:id,date,kind:z.enum(['memorization','development']),catalogId:nullableId,subject:z.string().trim().max(200).default(''),predicate:z.string().trim().max(100).default(''),notes:z.string().trim().max(4000).default(''),reason:reason.optional()}).strict().refine(x=>x.kind!=='memorization'||x.predicate.length>0,'Predikat hafalan wajib diisi.').refine(x=>(x.catalogId&&x.kind==='memorization')||x.subject.length>0,'Nama hafalan lainnya / aspek wajib diisi.').refine(x=>x.kind!=='development'||x.notes.length>0,'Deskripsi perkembangan wajib diisi.').refine(x=>!x.id||(x.reason?.length??0)>=3,'Alasan koreksi minimal 3 karakter.'),
 z.object({type:z.literal('void'),id,reason}).strict()]),
 fees:z.discriminatedUnion('type',[
 z.object({type:z.literal('tariff'),classId:id,month,amount:money.or(z.literal(0))}).strict(),
 z.object({type:z.literal('payment'),id:nullableId,studentId:id,date,allocations:z.array(z.object({month,amount:money}).strict()).min(1).max(12).refine(v=>new Set(v.map(x=>x.month)).size===v.length),notes,reason:reason.optional()}).strict().refine(x=>!x.id||(x.reason?.length??0)>=3,'Alasan koreksi minimal 3 karakter.'),z.object({type:z.literal('void'),id,reason}).strict()]),
 savings:z.discriminatedUnion('type',[
 z.object({type:z.literal('bracket'),id:nullableId,minimum:z.number().int().min(0).max(1e12),maximum:z.number().int().min(0).max(1e12).nullable(),percent:z.number().min(0).max(100).multipleOf(0.0001),active:z.boolean(),reason:reason.optional()}).strict().refine(x=>x.maximum===null||x.maximum>=x.minimum).refine(x=>!x.id||(x.reason?.length??0)>=3,'Alasan perubahan tarif minimal 3 karakter.'),
 z.object({type:z.literal('account'),ownerId:id,category:z.enum(['S','G','N'])}).strict(),
 z.object({type:z.literal('transaction'),id:nullableId,accountId:id,date,kind:z.enum(['deposit','withdrawal']),amount:money.min(1000).multipleOf(1000),feeApplied:z.boolean().default(false),reason}).strict(),z.object({type:z.literal('void'),id,reason}).strict()])
};
export const mutationEnvelope=z.object({requestId:id,revision:z.number().int().min(0).safe(),command:z.unknown()}).strict();
export const filtersSchema=z.object({year:z.coerce.number().int().min(2000).max(2100).optional(),start:date.optional(),end:date.optional(),classId:id.optional(),studentId:id.optional(),page:z.coerce.number().int().min(1).max(100000).optional(),status:z.enum(['Hadir','Sakit','Izin','Alpha']).optional(),query:z.string().trim().max(100).optional(),export:z.boolean().optional()}).strict().refine(x=>!x.start||!x.end||x.start<=x.end,'Rentang tanggal tidak valid.');
const row=z.record(z.string(),z.unknown());
export const operationsSnapshot=z.object({module:operationModules,today:date,revision:z.number(),canManage:z.boolean(),isAdmin:z.boolean(),people:z.array(z.object({id,username:z.string(),full_name:z.string(),role_code:z.string(),class_id:id.nullable(),class_name:z.string().nullable()})),classes:z.array(z.object({id,name:z.string(),level:z.number(),academic_year_id:id})),rows:z.array(row),total:z.number(),page:z.number(),pageSize:z.number(),summary:row,extra:row});
export type OperationsSnapshot=z.infer<typeof operationsSnapshot>;
export function parseCommand(module:OperationModule,input:unknown){return commandSchemas[module].parse(input);}
