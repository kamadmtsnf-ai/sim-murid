import type {NextRequest} from 'next/server';
import {z} from 'zod';
import {createAuthAdmin} from '@/lib/auth/admin';
import {educationContext,failure} from '@/lib/education/server';
export async function GET(request:NextRequest,{params}:{params:Promise<{id:string}>}){
 const {caller,reply}=await educationContext(request);if(!caller)return reply({message:'Sesi tidak berlaku.'},401);
 try{const target=z.uuid().parse((await params).id),r=await createAuthAdmin().rpc('app_directory_detail',{p_actor:caller.principal.id,p_session:caller.sessionId,p_target:target});if(r.error)throw new Error('Unavailable');if(!r.data)return reply({message:'Data tidak tersedia untuk akun Anda.'},404);return reply({detail:r.data});}catch(error){const e=failure(error);return reply({message:e.message},e.status);}
}
