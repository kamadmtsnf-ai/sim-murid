import type {NextRequest} from 'next/server';
import {z} from 'zod';
import {sameOrigin,privateJson} from '@/lib/auth/http';
import {createAuthAdmin} from '@/lib/auth/admin';
import {educationContext,jsonBody,failure,resultSchema,domainMessages,familiesData} from '@/lib/education/server';
import {familyCommand,mutation} from '@/lib/education/validation';
async function handle(request:NextRequest,mutate:boolean){
 const {caller,reply}=await educationContext(request);if(!caller)return reply({message:'Sesi tidak berlaku.'},401);
 try{
  const args={p_actor:caller.principal.id,p_session:caller.sessionId};
  if(mutate){const input=mutation(familyCommand).parse(await jsonBody(request));const command=familyCommand.parse(input.command);const r=await createAuthAdmin().rpc('app_family_write',{...args,p_request:input.requestId,p_revision:input.revision,p_command:command});if(r.error)throw new Error('Write unavailable');const result=resultSchema.parse(r.data);if(result.code!=='saved')return reply({code:result.code,message:domainMessages[result.code]??'Permintaan belum berhasil.'},result.code==='denied'?403:409);}
  const year=request.nextUrl.searchParams.get('year');if(year)z.uuid().parse(year);
  return reply({families:await familiesData(args.p_actor,args.p_session),message:mutate?'Data berhasil disimpan.':''});
 }catch(error){const e=failure(error);return reply({message:e.message},e.status);}
}
export async function GET(request:NextRequest){return handle(request,false);}
export async function POST(request:NextRequest){if(!sameOrigin(request))return privateJson({message:'Permintaan tidak diizinkan.'},403);return handle(request,true);}
