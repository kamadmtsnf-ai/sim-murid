import {randomUUID} from 'node:crypto';
import type {NextRequest} from 'next/server';
import {after} from 'next/server';
import {z} from 'zod';
import {sameOrigin,privateJson} from '@/lib/auth/http';
import {AccessDenied} from '@/lib/auth/authorization';
import {createAuthAdmin} from '@/lib/auth/admin';
import {educationContext,jsonBody,failure,domainMessages} from '@/lib/education/server';
import {loadStudent} from '@/lib/student/server';
import {documentList,documentMetadata,documentGc} from '@/lib/documents/server';
import {documentPrepare,documentAction} from '@/lib/documents/validation';
import {inspectDocument} from '@/lib/documents/inspect';
export const runtime='nodejs';
export const maxDuration=60;
async function handle(request:NextRequest,params:Promise<{id:string}>,mutate:boolean){
 const {caller,reply}=await educationContext(request);if(!caller)return reply({message:'Sesi tidak berlaku.'},401);
 try{
  const owner=z.uuid().parse((await params).id),admin=createAuthAdmin(),args={p_actor:caller.principal.id,p_session:caller.sessionId};
  const student=await loadStudent(args.p_actor,args.p_session,owner);
  if(!mutate)return reply({documents:await documentList(args.p_actor,args.p_session,owner),student});
  const body=await jsonBody(request),prepare=documentPrepare.safeParse(body);
  if(prepare.success){
   if(!student.can_write)throw new AccessDenied();
   const input=prepare.data,id=randomUUID();
   const r=await admin.rpc('app_document_prepare',{...args,p_owner:owner,p_id:id,p_kind:input.kind,p_filename:input.filename,p_mime:input.mime,p_size:input.size});if(r.error)throw new Error('Prepare unavailable');
   const result=z.object({code:z.string(),id:z.uuid().optional(),path:z.string().optional()}).parse(r.data);if(result.code!=='prepared'||!result.path)return reply({message:domainMessages[result.code]??'Unggahan belum disiapkan.'},result.code==='denied'?403:409);
   const upload=await admin.storage.from('student-documents').createSignedUploadUrl(result.path,{upsert:false});if(upload.error||!upload.data)throw new Error('Storage unavailable');
   return reply({id,upload:{path:upload.data.path,token:upload.data.token},message:'Unggah file, lalu tunggu validasi isi.'});
  }
  const command=documentAction.parse(body),write=command.action!=='download';
  const found=await admin.rpc('app_document_get',{...args,p_id:command.id,p_write:write});if(found.error)throw new Error('Metadata unavailable');if(!found.data)throw new AccessDenied();const meta=documentMetadata.parse(found.data);if(meta.owner_id!==owner)throw new AccessDenied();
  if(command.action==='download'){
   const url=await admin.storage.from('student-documents').createSignedUrl(meta.path,60,command.download?{download:meta.filename}:{});if(url.error||!url.data)throw new Error('Download unavailable');return reply({url:url.data.signedUrl,expiresIn:60,mime:meta.mime,filename:meta.filename});
  }
  if(command.action==='finalize'){
   const file=await admin.storage.from('student-documents').download(meta.path);if(file.error||!file.data)return reply({message:'File belum ditemukan. Pastikan unggahan selesai, lalu coba validasi kembali.'},409);
   let hash:string;
   try{if(file.data.type.split(';')[0]!==meta.mime)throw new Error('Tipe tidak cocok');hash=await inspectDocument(new Uint8Array(await file.data.arrayBuffer()),meta.mime,meta.size);}
   catch{await admin.rpc('app_document_finish',{...args,p_id:meta.id,p_valid:false,p_sha256:''});after(()=>documentGc(args.p_actor,args.p_session,owner));return reply({message:'Isi file rusak, terenkripsi, kosong, atau tidak sesuai format/ukuran. Dokumen belum diterima.'},400);}
   const saved=await admin.rpc('app_document_finish',{...args,p_id:meta.id,p_valid:true,p_sha256:hash});if(saved.error)throw new Error('Finalize unavailable');const result=z.object({code:z.string()}).parse(saved.data);if(result.code!=='saved')return reply({message:domainMessages[result.code]??'Unggahan kedaluwarsa atau telah diganti. Muat ulang.'},409);
  }else{
   const begun=await admin.rpc('app_document_delete',{...args,p_id:meta.id,p_done:false});if(begun.error||!begun.data)throw new Error('Delete unavailable');
   const removed=await admin.storage.from('student-documents').remove([meta.path]);if(removed.error)return reply({message:'Penghapusan file belum berhasil. Dokumen tidak digunakan untuk kelengkapan; ulangi hapus untuk menyelesaikannya.'},503);
   const done=await admin.rpc('app_document_delete',{...args,p_id:meta.id,p_done:true});if(done.error||!done.data)throw new Error('Delete confirmation unavailable');
  }
  after(()=>documentGc(args.p_actor,args.p_session,owner));
  return reply({documents:await documentList(args.p_actor,args.p_session,owner),student:await loadStudent(args.p_actor,args.p_session,owner),message:command.action==='delete'?'Dokumen berhasil dihapus.':'Isi dokumen tervalidasi dan berhasil disimpan.'});
 }catch(error){const e=failure(error);return reply({message:e.message},e.status);}
}
export async function GET(request:NextRequest,{params}:{params:Promise<{id:string}>}){return handle(request,params,false);}
export async function POST(request:NextRequest,{params}:{params:Promise<{id:string}>}){if(!sameOrigin(request))return privateJson({message:'Permintaan tidak diizinkan.'},403);return handle(request,params,true);}
