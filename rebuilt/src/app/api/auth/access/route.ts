import {securityState} from '@/lib/auth/security';
import type {NextRequest} from 'next/server';
import {loadAccessContext} from '@/lib/auth/authorization';
import {privateJson,requestAuth,verifiedPrincipal} from '@/lib/auth/http';
export async function GET(request:NextRequest){
 const cookies=privateJson({});
 try{
  const client=requestAuth(request,cookies);
  const principal=await verifiedPrincipal(client);
  if(principal){const gate=await securityState(principal.principal.id,principal.sessionId);if(gate?.gate!=='ready')return privateJson({message:'Selesaikan langkah keamanan akun terlebih dahulu.',gate:gate?.gate,destination:'/account/security'},403);}
  const context=principal?await loadAccessContext(client):null;
  const result=privateJson(context??{message:'Sesi tidak berlaku atau peran akun belum tersedia.'},context?200:401);
  cookies.cookies.getAll().forEach(cookie=>result.cookies.set(cookie));
  return result;
 }catch{return privateJson({message:'Pemeriksaan akses sedang tidak tersedia.'},503);}
}
