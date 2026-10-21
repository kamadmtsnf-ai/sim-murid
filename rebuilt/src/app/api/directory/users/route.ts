import type {NextRequest} from 'next/server';
import {createAuthAdmin} from '@/lib/auth/admin';
import {sameOrigin,privateJson} from '@/lib/auth/http';
import {educationContext,jsonBody,failure} from '@/lib/education/server';
import {newUserSchema} from '@/lib/users/validation';
import {provisionUser} from '@/lib/users/provision';
import {z} from 'zod';
const result=z.object({code:z.string()});
export async function POST(request:NextRequest){
 if(!sameOrigin(request))return privateJson({message:'Asal permintaan tidak diizinkan.'},403);
 const {caller,reply}=await educationContext(request);
 if(!caller)return reply({message:'Sesi tidak berlaku.'},401);
 if(!caller.principal.is_admin)return reply({message:'Hanya admin yang dapat menambahkan pengguna.'},403);
 try{
  const input=newUserSchema.parse(await jsonBody(request)),client=createAuthAdmin();
  const args={p_actor:caller.principal.id,p_session:caller.sessionId,p_request:input.requestId};
  const code=await provisionUser(input,caller.principal.id,process.env.SUPABASE_SECRET_KEY!,{
   begin:async(command,fingerprint)=>{const r=await client.rpc('app_user_provision_begin',{...args,p_command:command,p_fingerprint:fingerprint});if(r.error)throw new Error('Unavailable');return result.parse(r.data).code;},
   find:async()=>{const r=await client.auth.admin.getUserById(input.requestId);if(r.error){if(r.error.status===404)return null;throw new Error('Unavailable');}return r.data.user;},
   create:async(email,password)=>{const r=await client.auth.admin.createUser({id:input.requestId,email,password,email_confirm:true});if(r.error||r.data.user?.id!==input.requestId)throw new Error('Unavailable');},
   finish:async(fingerprint)=>{const r=await client.rpc('app_user_provision_finish',{...args,p_fingerprint:fingerprint});if(r.error)throw new Error('Unavailable');return result.parse(r.data).code;},
  });
  if(code==='created')return reply({created:true,username:input.username},201);
  const messages:Record<string,string>={duplicate:'Username sudah digunakan atau sedang diproses. Gunakan username lain.',denied:'Akses admin atau pengaturan keamanan tidak berlaku.',request_conflict:'Permintaan tidak cocok. Hubungi operator sebelum mencoba permintaan baru.',rate_limited:'Batas 20 akun per 15 menit tercapai. Coba kembali nanti.',invalid:'Periksa isian pengguna.'};
  return reply({message:messages[code]??'Pembuatan akun belum selesai. Coba kembali dengan isian yang sama.',retryable:code==='pending'},code==='denied'?403:code==='rate_limited'?429:409);
 }catch(error){const e=failure(error);return reply({message:e.status===503?'Hasil pembuatan belum dapat dipastikan. Coba kembali dengan isian yang sama; akun tidak akan digandakan.':e.message,retryable:e.status===503},e.status);}
}
