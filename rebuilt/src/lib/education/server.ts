import 'server-only';
import type {NextRequest} from 'next/server';
import {z} from 'zod';
import {privateJson,requestAuth,verifiedPrincipal} from '@/lib/auth/http';
import {createAuthAdmin} from '@/lib/auth/admin';
import {AccessDenied} from '@/lib/auth/authorization';
import {readBounded} from '@/lib/settings/server';
import {classSnapshot,familySnapshot,scheduleSnapshot} from './validation';
export async function educationContext(request:NextRequest){
 const jar=privateJson({});
 const reply=(body:unknown,status=200)=>{const response=privateJson(body,status);jar.cookies.getAll().forEach(c=>response.cookies.set(c));return response;};
 try {
 const client=requestAuth(request,jar),caller=await verifiedPrincipal(client);
 if(caller&&!['/api/services/surveys','/api/services/notifications'].includes(request.nextUrl.pathname)){const gate=await createAuthAdmin().rpc('app_survey_required',{p_actor:caller.principal.id,p_session:caller.sessionId});if(gate.error)return {caller:null,reply:()=>reply({message:'Pemeriksaan survei belum tersedia.'},503)};if(gate.data===true)return {caller:null,reply:()=>reply({message:'Selesaikan survei wajib terlebih dahulu.',redirect:'/account/services/surveys'},403)};}
 return {caller,reply};
 } catch {
 return {caller:null,reply:()=>reply({message:'Pemeriksaan akses belum tersedia. Silakan coba kembali.'},503)};
 }
}
export async function jsonBody(request:NextRequest,maxBytes=65536){return JSON.parse(new TextDecoder().decode(await readBounded(request,maxBytes))) as unknown;}
export const resultSchema=z.object({code:z.string(),id:z.uuid().nullable().optional()});
export const domainMessages:Record<string,string>={stale:'Data berubah. Muat ulang sebelum menyimpan.',denied:'Akses tidak diizinkan atau pengaturan keamanan belum lengkap.',duplicate:'Data duplikat. Periksa pilihan nama, siswa, atau tanggal.',invalid:'Periksa isian dan referensi data.',not_found:'Data tidak ditemukan atau sudah berubah.',request_conflict:'ID permintaan telah digunakan.',class_in_use:'Pindahkan atau keluarkan siswa sebelum mengarsipkan kelas.',overlap:'Waktu bertabrakan dengan jadwal kelas atau guru, termasuk durasi istirahat.',invalid_membership:'Siswa piket harus terdaftar aktif pada kelas yang dipilih.',rate_limited:'Terlalu banyak unggahan. Tunggu sepuluh menit sebelum mencoba kembali.'};
export function failure(error:unknown){return {status:error instanceof AccessDenied?403:error instanceof RangeError?413:error instanceof SyntaxError||error instanceof z.ZodError?400:503,message:error instanceof AccessDenied?'Akses tidak diizinkan.':error instanceof z.ZodError?error.issues[0]?.message??'Periksa isian.':error instanceof RangeError?'Permintaan terlalu besar.':error instanceof SyntaxError?'Format permintaan tidak valid.':'Layanan belum tersedia. Muat ulang untuk memastikan hasil sebelum mencoba kembali.'};}
export async function classesData(actor:string,session:string,year:string|null=null){const r=await createAuthAdmin().rpc('app_classes_read',{p_actor:actor,p_session:session,...(year?{p_year:year}:{})});if(r.error)throw new Error('Unavailable');if(!r.data)throw new AccessDenied();const parsed=classSnapshot.safeParse(r.data);if(!parsed.success)throw new Error('Classes data unavailable');return parsed.data;}
export async function familiesData(actor:string,session:string){const r=await createAuthAdmin().rpc('app_family_read',{p_actor:actor,p_session:session});if(r.error)throw new Error('Unavailable');if(!r.data)throw new AccessDenied();const parsed=familySnapshot.safeParse(r.data);if(!parsed.success)throw Error("Families unavailable");return parsed.data;}
export async function schedulesData(actor:string,session:string,filters:{year?:string;classId?:string;weekday?:number;personal?:boolean}={}){const r=await createAuthAdmin().rpc('app_schedules_read',{p_actor:actor,p_session:session,...(filters.year?{p_year:filters.year}:{}),...(filters.classId?{p_class:filters.classId}:{}),...(filters.weekday?{p_weekday:filters.weekday}:{}),p_personal:filters.personal??false});if(r.error)throw new Error('Unavailable');if(!r.data)throw new AccessDenied();const parsed=scheduleSnapshot.safeParse(r.data);if(!parsed.success)throw new Error('Schedules data unavailable');return parsed.data;}
