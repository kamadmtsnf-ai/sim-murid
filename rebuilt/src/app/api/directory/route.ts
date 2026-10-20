import type {NextRequest} from 'next/server';
import {createAuthAdmin} from '@/lib/auth/admin';
import {educationContext,failure} from '@/lib/education/server';
import {directoryQuery,directorySnapshot} from '@/lib/education/validation';
export async function GET(request:NextRequest){
 const {caller,reply}=await educationContext(request);if(!caller)return reply({message:'Sesi tidak berlaku.'},401);
 try{const input=directoryQuery.parse(Object.fromEntries(request.nextUrl.searchParams));const r=await createAuthAdmin().rpc('app_directory_read',{p_actor:caller.principal.id,p_session:caller.sessionId,p_role:input.role,p_query:input.query,p_page:input.page,p_status:input.status});if(r.error)throw new Error('Unavailable');if(!r.data)return reply({message:'Akses tidak diizinkan atau keamanan akun belum lengkap.'},403);return reply({directory:directorySnapshot.parse(r.data)});}catch(error){const e=failure(error);return reply({message:e.message},e.status);}
}
