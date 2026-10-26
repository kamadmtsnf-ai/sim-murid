import 'server-only';
import {createClient} from '@supabase/supabase-js';
import {createAuthAdmin} from '@/lib/auth/admin';
import {getSupabasePublicEnvironment} from '@/lib/supabase/environment';
import {securityStateSchema} from '@/lib/auth/security-validation';
export async function securityState(userId:string,sessionId:string,signal?:AbortSignal){
 const query=createAuthAdmin().rpc('app_security_state',{p_user:userId,p_session:sessionId});
 const {data,error}=await (signal?query.abortSignal(signal):query);
 if(error)throw new Error('Security state unavailable');
 return data===null?null:securityStateSchema.parse(data);
}
/** Separate ephemeral Auth session. Its token is never returned to the browser. */
export async function confirmCurrentPassword(userId:string,password:string){
 const admin=createAuthAdmin();const {data,error}=await admin.auth.admin.getUserById(userId);
 if(error||!data.user?.email)throw new Error('Identity verification unavailable');
 const {url,publishableKey}=getSupabasePublicEnvironment();
 const client=createClient(url,publishableKey,{auth:{persistSession:false,autoRefreshToken:false}});
 const result=await client.auth.signInWithPassword({email:data.user.email,password});
 if(result.error&&(!result.error.status||result.error.status>=500))throw new Error('Password verification unavailable');
 if(!result.data.session)return false;
 try{return result.data.user?.id===userId;}finally{await client.auth.signOut({scope:'local'});}
}
