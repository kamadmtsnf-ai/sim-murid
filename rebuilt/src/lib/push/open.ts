import 'server-only';
import {z} from 'zod';
import {createAuthAdmin} from '@/lib/auth/admin';
import {pushDestination} from './navigation';
const entry=z.object({context:z.object({owner_id:z.uuid().nullable(),class_id:z.uuid().nullable(),year_id:z.uuid().nullable(),semester:z.number().int().min(1).max(2).nullable()}).nullable().default(null),category:z.enum(['test','points','schedule','reports','surveys','documents']).default('test'),id:z.uuid(),title:z.string(),message:z.string(),created_at:z.string(),read_at:z.string().nullable()});
export async function openPush(actor:string,session:string,ref:string,mark=false){
 if(!pushDestination(ref))return null;
 const {data,error}=await createAuthAdmin().rpc('app_push_open',{p_actor:actor,p_session:session,p_ref:ref,p_mark:mark});
 if(error)throw Error('Notification resolver unavailable');
 if(data===null)return null;
 const parsed=entry.safeParse(data);if(!parsed.success)throw Error('Notification resolver unavailable');return parsed.data;
}
