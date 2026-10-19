import 'server-only';
import {randomUUID} from 'node:crypto';
import {z} from 'zod';
import {createAuthAdmin} from '@/lib/auth/admin';
import {emailEnvironment,sendOtp} from './gmail';
import {newOtp,otpDigest} from './otp';
export const emailContextSchema=z.object({user_id:z.uuid(),username:z.string(),email:z.string(),purpose:z.enum(['verify','recovery'])});
export async function reserveAndSend(userId:string,sessionId:string|null,email:string,purpose:'verify'|'recovery',id=randomUUID()){
 const env=emailEnvironment();const code=newOtp();const admin=createAuthAdmin();
 const result=await admin.rpc('app_email_reserve',{p_user:userId,p_session:sessionId!,p_purpose:purpose,p_id:id,p_hash:otpDigest(env.secret,id,userId,email,purpose,code),p_expected_email:email});
 if(result.error)throw new Error('Email reservation unavailable');
 const status=z.object({code:z.string(),retry_after:z.number().optional()}).parse(result.data);
 if(status.code!=='reserved')return {ok:false as const,code:status.code,retry_after:status.retry_after};
 const ticket=z.object({id:z.uuid(),email:z.email(),name:z.string(),expires_at:z.string()}).parse(result.data);
 try{
  const message=await sendOtp(ticket.email,ticket.name,code,purpose);
  const saved=await admin.rpc('app_email_delivery',{p_user:userId,p_id:id,p_accepted:true,p_message:message});
  if(saved.error)throw new Error('Email delivery recording failed');
  return saved.data?{ok:true as const,challengeId:id,expires_at:ticket.expires_at}:{ok:false as const,code:'address_changed'};
 }catch{
  await admin.rpc('app_email_delivery',{p_user:userId,p_id:id,p_accepted:false});
  return {ok:false as const,code:'delivery_failed'};
 }
}
