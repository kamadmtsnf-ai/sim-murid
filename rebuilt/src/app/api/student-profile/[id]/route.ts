import type {NextRequest} from 'next/server';
import {z} from 'zod';
import {sameOrigin,privateJson} from '@/lib/auth/http';
import {createAuthAdmin} from '@/lib/auth/admin';
import {educationContext,jsonBody,failure,resultSchema,domainMessages} from '@/lib/education/server';
import {loadStudent} from '@/lib/student/server';
import {biodataRequest} from '@/lib/student/validation';
async function handle(request:NextRequest,params:Promise<{id:string}>,mutate:boolean){
 const {caller,reply}=await educationContext(request);if(!caller)return reply({message:'Sesi tidak berlaku.'},401);
 try{
  const target=z.uuid().parse((await params).id),args={p_actor:caller.principal.id,p_session:caller.sessionId,p_target:target};
  if(mutate){const input=biodataRequest.parse(await jsonBody(request));const r=await createAuthAdmin().rpc('app_student_save',{...args,p_request:input.requestId,p_revision:input.revision,p_data:input.data});if(r.error)throw new Error('Save unavailable');const result=resultSchema.parse(r.data);if(result.code!=='saved')return reply({message:domainMessages[result.code]??'Permintaan belum berhasil.',code:result.code},result.code==='denied'?403:409);}
  const student=await loadStudent(args.p_actor,args.p_session,target);return reply({student,message:mutate?(student.progress.complete?'Biodata dan dokumen wajib lengkap. Lanjutkan pengaturan keamanan akun.':'Biodata tersimpan. Lengkapi field atau dokumen wajib yang masih kurang.'):'',});
 }catch(error){const e=failure(error);return reply({message:e.message},e.status);}
}
export async function GET(request:NextRequest,{params}:{params:Promise<{id:string}>}){return handle(request,params,false);}
export async function POST(request:NextRequest,{params}:{params:Promise<{id:string}>}){if(!sameOrigin(request))return privateJson({message:'Permintaan tidak diizinkan.'},403);return handle(request,params,true);}
