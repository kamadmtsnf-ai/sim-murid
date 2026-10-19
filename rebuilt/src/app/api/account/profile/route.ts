import type {NextRequest} from 'next/server';
import {createAuthAdmin} from '@/lib/auth/admin';
import {privateJson,requestAuth,sameOrigin,verifiedPrincipal} from '@/lib/auth/http';
import {profileSchema} from '@/lib/auth/recovery-validation';
async function handle(request:NextRequest,input?:ReturnType<typeof profileSchema.parse>){
 const jar=privateJson({});const respond=(body:unknown,status=200)=>{const r=privateJson(body,status);jar.cookies.getAll().forEach(c=>r.cookies.set(c));return r;};
 try{
  const caller=await verifiedPrincipal(requestAuth(request,jar));if(!caller)return respond({message:'Sesi tidak berlaku.'},401);
  const admin=createAuthAdmin();const args={p_user:caller.principal.id,p_session:caller.sessionId};
  if(input){
   if(input.username!==caller.principal.username)return respond({message:'Username tidak dapat diubah di sini.'},403);
   const result=await admin.rpc('app_profile_update',{...args,p_version:input.updated_at,p_name:input.full_name,p_phone:input.phone,p_email:input.contact_email,p_bio:input.bio});
   if(result.error)throw new Error('Update unavailable');if(!result.data)return respond({message:'Profil berubah atau langkah akun belum mengizinkan pembaruan. Muat ulang sebelum menyimpan.'},409);
  }
  const result=await admin.rpc('app_profile_read',args);if(result.error)throw new Error('Read unavailable');if(!result.data)return respond({message:'Selesaikan langkah keamanan atau profil wajib terlebih dahulu.',destination:'/account/security'},403);
  return respond({profile:profileSchema.parse(result.data),...(input?{message:'Profil berhasil diperbarui. Perubahan email membatalkan status verifikasi lama.'}:{})});
 }catch{return respond({message:'Layanan profil belum tersedia. Coba kembali.'},503);}
}
export async function GET(request:NextRequest){return handle(request);}
export async function POST(request:NextRequest){
 if(!sameOrigin(request))return privateJson({message:'Permintaan tidak diizinkan.'},403);
 if(Number(request.headers.get('content-length')??0)>16384)return privateJson({message:'Permintaan terlalu besar.'},413);
 const text=await request.text();if(text.length>16384)return privateJson({message:'Permintaan terlalu besar.'},413);
 let body:unknown;try{body=JSON.parse(text);}catch{body=null;}const parsed=profileSchema.safeParse(body);
 if(!parsed.success)return privateJson({message:'Periksa nama, nomor HP, email dan bio.'},400);
 return handle(request,parsed.data);
}
