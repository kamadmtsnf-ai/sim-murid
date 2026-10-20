import 'server-only';
import {z} from 'zod';
import {createAuthAdmin} from '@/lib/auth/admin';
import {AccessDenied} from '@/lib/auth/authorization';
import {documentRow} from './validation';
export async function documentList(actor:string,session:string,owner:string){const r=await createAuthAdmin().rpc('app_document_list',{p_actor:actor,p_session:session,p_owner:owner});if(r.error)throw new Error('Unavailable');if(!r.data)throw new AccessDenied();return z.array(documentRow).parse(r.data);}
export const documentMetadata=documentRow.extend({owner_id:z.uuid(),path:z.string().regex(/^[a-f0-9-]{36}\/[a-f0-9-]{36}\.(pdf|png|jpg)$/)});
export async function documentGc(actor:string,session:string,owner:string){
 const admin=createAuthAdmin(),args={p_actor:actor,p_session:session,p_owner:owner};
 try{const r=await admin.rpc('app_document_gc',args);if(r.error||!r.data)return;for(const row of z.array(z.object({id:z.uuid(),path:z.string()})).parse(r.data)){const removed=await admin.storage.from('student-documents').remove([row.path]);if(!removed.error)await admin.rpc('app_document_gc',{...args,p_done:row.id});}}catch{/* Durable rows are retried after the next document mutation. */}
}
