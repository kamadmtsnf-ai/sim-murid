import {z} from 'zod';
const text=(max:number)=>z.string().trim().max(max).refine(s=>!/[\u0000-\u001f\u007f]/.test(s),'Teks mengandung karakter kontrol.');
const date=z.iso.date().refine(s=>s>='1900-01-01'&&s<='2200-12-31','Tanggal di luar rentang.');
export const identitySchema=z.object({head_name:text(200),head_nip:text(40),phone:text(40),npsn:text(30)}).strict();
export const addressSchema=z.object({street:text(500),province_id:text(20),province:text(150),regency_id:text(20),regency:text(150),district_id:text(20),district:text(150),village_id:text(20),village:text(150)}).strict();
export const schoolSchema=z.object({name:text(200).min(1),identity_data:identitySchema,address_data:addressSchema}).strict();
export const emptySchool={name:'',identity_data:{head_name:'',head_nip:'',phone:'',npsn:''},address_data:{street:'',province_id:'',province:'',regency_id:'',regency:'',district_id:'',district:'',village_id:'',village:''}};
export function schoolAddress(a:z.infer<typeof addressSchema>){return [a.street,a.village&&`Kel. ${a.village}`,a.district&&`Kec. ${a.district}`,a.regency,a.province].filter(Boolean).join(', ');}
const masterName=(kind:'subject'|'memorization')=>text(kind==='subject'?150:200).min(1).refine(s=>kind!=='subject'||!s.includes(','),'Nama mapel tidak boleh mengandung koma.').transform(s=>kind==='memorization'?s.replace(/;/g,','):s);
const catalog=(type:'subject'|'memorization')=>z.object({type:z.literal(type),id:z.uuid().nullable(),name:masterName(type),active:z.boolean()}).strict();
export const settingsCommand=z.discriminatedUnion('type',[
 z.object({type:z.literal('profile'),profile:schoolSchema}).strict(),catalog('subject'),catalog('memorization'),
 z.object({type:z.literal('deactivate'),catalog:z.enum(['subject','memorization']),id:z.uuid()}).strict(),
 z.object({type:z.literal('holiday'),id:z.uuid().nullable(),start:date,end:date,description:text(500).min(1)}).strict().refine(s=>s.end>=s.start&&(!s.id||s.start===s.end)&&((Date.parse(s.end)-Date.parse(s.start))/86400000<=365),'Rentang harus berurutan, maksimal 366 hari; edit hanya satu tanggal.'),
 z.object({type:z.literal('holiday_delete'),id:z.uuid()}).strict(),
 z.object({type:z.literal('logo_clear'),slot:z.enum(['school','cooperative'])}).strict(),
]);
export const settingsRequest=z.object({requestId:z.uuid(),revision:z.number().int().nonnegative().max(Number.MAX_SAFE_INTEGER),command:settingsCommand}).strict();
const row=z.object({id:z.uuid(),name:z.string(),active:z.boolean()});
export const settingsSnapshot=z.object({revision:z.number().int().nonnegative(),school:z.object({id:z.uuid(),name:z.string(),identity_data:identitySchema,address_data:addressSchema,asset_data:z.record(z.string(),z.string()),updated_at:z.string()}).nullable(),subjects:z.array(row.extend({code:z.string(),sort_order:z.number()})),memorization:z.array(row),holidays:z.array(z.object({id:z.uuid(),holiday_date:z.string(),description:z.string()}))});
export type SettingsSnapshot=z.infer<typeof settingsSnapshot>;
