import {z} from 'zod';
import rules from './rules.json' with {type:'json'};
export {rules};
export type Biodata=Record<string,string|boolean>;
export const emptyBiodata=()=>Object.fromEntries(rules.fields.map(k=>[k,rules.booleans.includes(k)?false:''])) as Biodata;
export const enums:Record<string,string[]>={AyahStatus:['Masih Hidup','Sudah Meninggal','Tidak Diketahui'],IbuStatus:['Masih Hidup','Sudah Meninggal','Tidak Diketahui'],WaliStatus:['Masih Hidup','Sudah Meninggal','Tidak Diketahui'],WaliPilihan:['Ayah','Ibu','Lainnya'],WaliAlamatStatus:['Samadengan Ayah Kandung','Samadengan Ibu Kandung','Lainnya'],JenisKelamin:['Laki-Laki','Perempuan'],SiswaStatusTempatTinggal:['Tinggal dengan Ayah Kandung','Tinggal dengan Ibu Kandung','Tinggal dengan Wali','Ikut Keluarga/Kerabat','Asrama Madrasah','Kontrakan/Kost','Lainnya']};
export function requiredFields(d:Biodata){
 const fields=[...rules.base];
 if(d.AyahStatus==='Masih Hidup'&&d.AyahAlamatTinggalLuarNegeri!==true)fields.push(...rules.fatherAddress);
 if(d.IbuStatus==='Masih Hidup'&&d.IbuAlamatTinggalLuarNegeri!==true&&d.IbuAlamatSamadenganAyah!==true)fields.push(...rules.motherAddress);
 if(d.WaliPilihan==='Lainnya'){fields.push(...rules.guardianBio);if(d.WaliAlamatStatus==='Lainnya'&&d.WaliAlamatTinggalLuarNegeri!==true)fields.push(...rules.guardianAddress);}
 return fields;
}
export function requiredDocuments(d:Biodata){return ['KK','AKTA','IJAZAH_MI',...(d.AyahStatus==='Masih Hidup'?['KTP_AYAH']:[]),...(d.IbuStatus==='Masih Hidup'?['KTP_IBU']:[]),...(d.WaliPilihan==='Lainnya'?['KTP_WALI']:[])];}
export function completion(d:Biodata,documents:string[]){const fields=requiredFields(d),docs=requiredDocuments(d);const missing=fields.filter(k=>String(d[k]??'').trim()==='');const missingDocuments=docs.filter(k=>!documents.includes(k));return {missing,missingDocuments,complete:missing.length+missingDocuments.length===0,percent:Math.round(100*(fields.length+docs.length-missing.length-missingDocuments.length)/(fields.length+docs.length))};}
export function normalizeBiodata(d:Biodata){
 const result={...emptyBiodata(),...d};
 const copy=(from:string,to:string)=>{for(const field of rules.fields)if(field.startsWith(to)&&!rules.booleans.includes(field)){const key=from+field.slice(to.length);if(key in result)result[field]=result[key]??'';}};
 if(result.IbuAlamatSamadenganAyah===true)for(const field of rules.motherAddress)result[field]=result['Ayah'+field.slice(3)]??'';
 if(result.WaliPilihan==='Ayah'||result.WaliPilihan==='Ibu')copy(String(result.WaliPilihan),'Wali');
 else if(result.WaliAlamatStatus==='Samadengan Ayah Kandung'||result.WaliAlamatStatus==='Samadengan Ibu Kandung'){const from=result.WaliAlamatStatus.includes('Ayah')?'Ayah':'Ibu';for(const field of rules.guardianAddress)result[field]=result[from+field.slice(4)]??'';}
 return result;
}
export const biodataSchema=z.record(z.string(),z.union([z.string(),z.boolean()])).superRefine((d,ctx)=>{
 for(const [key,value] of Object.entries(d)){
  if(!rules.fields.includes(key)){ctx.addIssue({code:'custom',path:[key],message:'Field tidak dikenali.'});continue;}
  if(rules.booleans.includes(key)){if(typeof value!=='boolean')ctx.addIssue({code:'custom',path:[key],message:'Pilihan harus boolean.'});continue;}
  if(typeof value!=='string'||value.length>500||/[\u0000-\u001f\u007f]/.test(value)){ctx.addIssue({code:'custom',path:[key],message:'Isi berupa teks maksimal 500 karakter.'});continue;}
  if(!value)continue;
  if(key.endsWith('TanggalLahir')||key==='TanggalLahir'){if(!z.iso.date().safeParse(value).success||value>new Date().toISOString().slice(0,10))ctx.addIssue({code:'custom',path:[key],message:'Tanggal lahir tidak valid.'});}
  if(key==='Email'&&!z.email().safeParse(value).success)ctx.addIssue({code:'custom',path:[key],message:'Email tidak valid.'});
  if((key==='JumlahSaudara'||key==='AnakKe')&&(!/^\d{1,3}$/.test(value)||Number(value)>100||(key==='AnakKe'&&Number(value)<1)))ctx.addIssue({code:'custom',path:[key],message:'Jumlah/urutan anak tidak valid.'});
  if(enums[key]&&!enums[key].includes(value))ctx.addIssue({code:'custom',path:[key],message:'Pilihan tidak valid.'});
 }
}).transform(d=>normalizeBiodata(Object.fromEntries(Object.entries(d).map(([k,v])=>[k,typeof v==='string'?v.trim():v]))));
export const biodataRequest=z.object({requestId:z.uuid(),revision:z.number().int().nonnegative(),data:biodataSchema}).strict();
export const guardianRequest=z.object({type:z.literal('guardian'),studentId:z.uuid(),parentId:z.uuid(),relationship:z.enum(['father','mother','guardian']),remove:z.boolean()}).strict();
export const familyRequest=z.object({type:z.literal('family'),id:z.uuid().nullable(),name:z.string().trim().min(1).max(150),studentIds:z.array(z.uuid()).min(1).max(30).refine(a=>new Set(a).size===a.length)}).strict();

export const studentSnapshot=z.object({id:z.uuid(),username:z.string(),name:z.string(),data:z.record(z.string(),z.union([z.string(),z.boolean()])),revision:z.number(),progress:z.object({missing:z.array(z.string()),missingDocuments:z.array(z.string()),complete:z.boolean(),percent:z.number()}),can_write:z.boolean()});
export type StudentSnapshot=z.infer<typeof studentSnapshot>;
