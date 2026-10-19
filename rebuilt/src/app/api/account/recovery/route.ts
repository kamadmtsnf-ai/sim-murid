import {randomBytes,randomUUID} from 'node:crypto';
import type {NextRequest} from 'next/server';
import {z} from 'zod';
import {createAuthAdmin} from '@/lib/auth/admin';
import {privateJson,requestAuth,sameOrigin,verifiedPrincipal} from '@/lib/auth/http';
import {requireCapability} from '@/lib/auth/authorization';
import {confirmCurrentPassword,securityState} from '@/lib/auth/security';
import {recoveryListSchema,recoveryResolveSchema} from '@/lib/auth/recovery-validation';
const begunSchema=z.object({user_id:z.uuid(),request_type:z.enum(['password','session']),rejected:z.boolean()});
async function handle(request:NextRequest,input?:z.infer<typeof recoveryResolveSchema>){
 const jar=privateJson({});const respond=(body:unknown,status=200)=>{const r=privateJson(body,status);jar.cookies.getAll().forEach(c=>r.cookies.set(c));return r;};let started=false;
 try{
  const client=requestAuth(request,jar);const caller=await verifiedPrincipal(client);if(!caller)return respond({message:'Sesi tidak berlaku.'},401);
  const gate=await securityState(caller.principal.id,caller.sessionId);
  if(gate?.gate!=='ready'||!caller.principal.is_admin)return respond({message:'Akses tidak diizinkan.'},403);
  await requireCapability(client,'accounts.manage');
  const admin=createAuthAdmin();const args={p_actor:caller.principal.id,p_session:caller.sessionId};
  if(!input){const result=await admin.rpc('app_recovery_list',args);if(result.error)throw new Error('Queue unavailable');if(result.data===null)return respond({message:'Akses tidak diizinkan.'},403);return respond({requests:recoveryListSchema.parse(result.data)});}
  const rate=await admin.rpc('app_security_rate',{p_user:caller.principal.id,p_session:caller.sessionId});if(rate.error)throw new Error('Rate unavailable');if(!rate.data)return respond({message:'Batas percobaan keamanan tercapai. Coba lagi setelah 15 menit.'},429);
  if(!await confirmCurrentPassword(caller.principal.id,input.currentPassword))return respond({message:'Password Admin tidak sesuai.'},400);
  const operation=randomUUID();const begin=await admin.rpc('app_recovery_begin',{...args,p_request:input.requestId,p_operation:operation,p_evidence:input.evidenceReference,p_reject:input.action==='reject'});
  if(begin.error)throw new Error('Recovery unavailable');const parsed=begunSchema.safeParse(begin.data);
  if(!parsed.success)return respond({message:'Permintaan tidak berlaku, sedang diproses, atau akun tidak dapat dipulihkan oleh Anda. Muat ulang daftar.'},409);
  if(parsed.data.rejected)return respond({message:'Permintaan ditolak dan dicatat.'});
  if(parsed.data.request_type==='session')return respond({message:'Seluruh sesi aplikasi akun tersebut dicabut. Pengguna dapat masuk kembali.'});
  started=true;
  const temporaryPassword='T!'+randomBytes(24).toString('base64url')+'z9';
  const changed=await admin.auth.admin.updateUserById(parsed.data.user_id,{password:temporaryPassword});if(changed.error)throw new Error('Auth unavailable');
  const finish=await admin.rpc('app_recovery_finish',{...args,p_request:input.requestId,p_operation:operation});if(finish.error||!finish.data)throw new Error('Finalization unavailable');
  return respond({message:'Password sementara unik dibuat. Serahkan langsung setelah verifikasi identitas. Pengguna wajib menggantinya setelah masuk.',temporaryPassword});
 }catch{return respond({message:started?'Sesi target telah dicabut. Pemulihan password belum dapat dipastikan selesai. Jangan menyerahkan password; muat ulang dan proses kembali setelah dua menit atau hubungi operator.':'Pengelolaan pemulihan belum tersedia. Coba kembali.'},503);}
}
export async function GET(request:NextRequest){return handle(request);}
export async function POST(request:NextRequest){
 if(!sameOrigin(request))return privateJson({message:'Permintaan tidak diizinkan.'},403);
 if(Number(request.headers.get('content-length')??0)>4096)return privateJson({message:'Permintaan terlalu besar.'},413);
 const text=await request.text();if(text.length>4096)return privateJson({message:'Permintaan terlalu besar.'},413);
 let body:unknown;try{body=JSON.parse(text);}catch{body=null;}const parsed=recoveryResolveSchema.safeParse(body);
 if(!parsed.success)return privateJson({message:'Konfirmasi identitas, referensi verifikasi dan password Admin wajib diisi.'},400);
 return handle(request,parsed.data);
}
