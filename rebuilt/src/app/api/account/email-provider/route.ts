import type {NextRequest} from 'next/server';
import {privateJson,requestAuth,verifiedPrincipal} from '@/lib/auth/http';
import {requireCapability} from '@/lib/auth/authorization';
import {senderStatus,ProviderCheckError} from '@/lib/email/gmail';
export async function GET(request:NextRequest){
 const jar=privateJson({});const response=(data:unknown,status=200)=>{const r=privateJson(data,status);jar.cookies.getAll().forEach(c=>r.cookies.set(c));return r;};
 try{const client=requestAuth(request,jar);const caller=await verifiedPrincipal(client);if(!caller)return response({message:'Sesi tidak berlaku.'},401);if(!caller.principal.is_admin)return response({message:'Akses tidak diizinkan.'},403);
 try{await requireCapability(client,'accounts.manage');}catch{return response({message:'Selesaikan langkah akun atau periksa hak akses Admin.'},403);}
 return response({sender:await senderStatus()});
 }catch(error){return response({code:error instanceof ProviderCheckError?'GMAIL_SMTP_UNAVAILABLE':'EMAIL_CONFIG_UNAVAILABLE',reason:error instanceof ProviderCheckError?error.reason:'configuration',message:'Konfigurasi Gmail belum dapat diverifikasi. Periksa alamat pengirim, App Password, dan koneksi SMTP.'},503);}
}
