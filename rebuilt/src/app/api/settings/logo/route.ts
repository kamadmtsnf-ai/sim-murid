import {randomUUID} from 'node:crypto';
import type {NextRequest} from 'next/server';
import {z} from 'zod';
import {privateJson,sameOrigin} from '@/lib/auth/http';
import {AccessDenied} from '@/lib/auth/authorization';
import {createAuthAdmin} from '@/lib/auth/admin';
import {settingsCaller,readBounded,writeResult,resultMessage,loadSettings,collectUnusedLogos} from '@/lib/settings/server';
import {normalizeSchoolLogo} from '@/lib/settings/image';
export const runtime='nodejs';
export async function POST(request:NextRequest){
 if(!sameOrigin(request))return privateJson({message:'Permintaan tidak diizinkan.'},403);
 const jar=privateJson({});const reply=(body:unknown,status=200)=>{const r=privateJson(body,status);jar.cookies.getAll().forEach(c=>r.cookies.set(c));return r;};
 let uploaded:string|undefined;let discard=false;
 try{
  const caller=await settingsCaller(request,jar);if(!caller)return reply({message:'Sesi tidak berlaku.'},401);
  let data:FormData;
  try{const bytes=await readBounded(request,2*1024*1024+16384);data=await new Response(bytes,{headers:{'Content-Type':request.headers.get('content-type')??''}}).formData();}
  catch(error){return reply({message:error instanceof RangeError?'Berkas terlalu besar.':'Form unggahan tidak valid.'},error instanceof RangeError?413:400);}
  if([...data.keys()].some(k=>!['file','slot','revision'].includes(k))||['file','slot','revision'].some(k=>data.getAll(k).length!==1))return reply({message:'Form unggahan tidak valid.'},400);
  const file=data.get('file');const meta=z.object({slot:z.enum(['school','cooperative']),revision:z.coerce.number().int().nonnegative().max(Number.MAX_SAFE_INTEGER)}).safeParse({slot:data.get('slot'),revision:data.get('revision')});
  if(!(file instanceof File)||!meta.success)return reply({message:'Pilih logo dan tujuan yang valid.'},400);
  let image:Buffer;try{image=await normalizeSchoolLogo(new Uint8Array(await file.arrayBuffer()),file.type);}catch(error){return reply({message:error instanceof Error?error.message:'Logo tidak valid.'},400);}
  const args={p_actor:caller.principal.id,p_session:caller.sessionId};
  const snapshot=await loadSettings(args.p_actor,args.p_session);
  if(!snapshot.school||snapshot.revision!==meta.data.revision)return reply({message:!snapshot.school?'Simpan profil sekolah dahulu.':'Pengaturan berubah. Muat ulang.'},409);
  const admin=createAuthAdmin(),path=`${randomUUID()}.png`;
  const staged=await admin.rpc('app_settings_asset_gc',{...args,p_stage:path});if(staged.error||!staged.data)throw new Error('Staging unavailable');
  const upload=await admin.storage.from('school-assets').upload(path,image,{contentType:'image/png',upsert:false,cacheControl:'3600'});if(upload.error)throw new Error('Upload unavailable');uploaded=path;
  const r=await admin.rpc('app_settings_write',{...args,p_request:randomUUID(),p_revision:meta.data.revision,p_command:{type:'logo',slot:meta.data.slot,path}});if(r.error)throw new Error('Metadata unavailable');
  const result=writeResult.parse(r.data);if(result.code!=='saved'){discard=true;return reply({message:resultMessage[result.code]??'Unggahan belum tersimpan.'},409);}
  await collectUnusedLogos(args.p_actor,args.p_session);return reply({settings:await loadSettings(args.p_actor,args.p_session),message:'Logo berhasil disimpan.'});
 }catch(error){return reply({message:error instanceof AccessDenied?'Akses tidak diizinkan.':'Unggahan belum dapat dipastikan tersimpan. Muat ulang sebelum mencoba kembali.'},error instanceof AccessDenied?403:503);}
 finally{if(uploaded&&discard){try{await createAuthAdmin().storage.from('school-assets').remove([uploaded]);}catch{/* Reconcile unreachable uploads using Storage inventory. */}}}
}
