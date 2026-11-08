import {type NextRequest} from 'next/server';
import {privateJson,requestAuth,verifiedPrincipal,sameOrigin} from '@/lib/auth/http';
import {openPush} from '@/lib/push/open';
export const runtime='nodejs';
export async function POST(request:NextRequest,context:{params:Promise<{ref:string}>}){
 if(!sameOrigin(request))return privateJson({message:'Permintaan tidak diizinkan.'},403);
 const response=privateJson({});
 try{
 const state=await verifiedPrincipal(requestAuth(request,response));
 const entry=state?await openPush(state.principal.id,state.sessionId,(await context.params).ref,true):null;
 const result=!state?privateJson({message:'Silakan masuk kembali.'},401):!entry?privateJson({message:'Pemberitahuan tidak tersedia.'},404):privateJson({code:'saved',read_at:entry.read_at});
 response.cookies.getAll().forEach(c=>result.cookies.set(c));return result;
 }catch{const result=privateJson({message:'Hasil perubahan belum dapat dipastikan. Muat ulang pemberitahuan.'},503);response.cookies.getAll().forEach(c=>result.cookies.set(c));return result;}
}
