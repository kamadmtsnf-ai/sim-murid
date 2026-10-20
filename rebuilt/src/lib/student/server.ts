import 'server-only';
import {createAuthAdmin} from '@/lib/auth/admin';
import {AccessDenied} from '@/lib/auth/authorization';
import {studentSnapshot} from './validation';
export type {StudentSnapshot} from './validation';

export async function loadStudent(actor:string,session:string,target:string){const r=await createAuthAdmin().rpc('app_student_read',{p_actor:actor,p_session:session,p_target:target});if(r.error)throw new Error('Unavailable');if(!r.data)throw new AccessDenied();return studentSnapshot.parse(r.data);}
