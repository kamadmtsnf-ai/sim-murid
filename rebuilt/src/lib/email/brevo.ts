import 'server-only';
import {z} from 'zod';
import {emailTemplate} from './otp';
export class ProviderCheckError extends Error{constructor(readonly status:number,readonly reason:'ip_restricted'|'api_key_rejected'|'provider_rejected'='provider_rejected'){super('Provider status unavailable');}}
export function emailEnvironment(){
 return z.object({key:z.string().trim().min(16),email:z.string().trim().pipe(z.email()),name:z.string().trim().min(1).max(200),secret:z.string().min(32)}).parse({key:process.env.BREVO_API_KEY,email:process.env.BREVO_SENDER_EMAIL,name:process.env.BREVO_SENDER_NAME,secret:process.env.EMAIL_OTP_SECRET});
}
export async function sendOtp(email:string,name:string,code:string,purpose:'verify'|'recovery'){
 const env=emailEnvironment();
 const response=await fetch('https://api.brevo.com/v3/smtp/email',{method:'POST',headers:{'api-key':env.key,'Content-Type':'application/json','Accept':'application/json'},body:JSON.stringify({sender:{email:env.email,name:env.name},to:[{email,name}],...emailTemplate(name,code,purpose),tags:['sim-murid',purpose]}),signal:AbortSignal.timeout(12_000),cache:'no-store'});
 if(response.status!==201)throw new Error('Email provider rejected request');
 const body=z.object({messageId:z.string().min(1).max(512)}).parse(await response.json());return body.messageId;
}
export async function senderStatus(){
 const env=emailEnvironment();
 const r=await fetch('https://api.brevo.com/v3/senders',{headers:{'api-key':env.key,Accept:'application/json'},cache:'no-store',signal:AbortSignal.timeout(12_000)});
 if(!r.ok){
  let detail='';try{const body:unknown=await r.json();if(typeof body==='object'&&body!==null&&'message' in body&&typeof body.message==='string')detail=body.message;}catch{/* Do not expose raw provider errors. */}
  const reason=/unrecogni[sz]ed ip|ip address|unauthori[sz]ed ip/i.test(detail)?'ip_restricted':/api.?key|key not found|invalid key/i.test(detail)?'api_key_rejected':'provider_rejected';
  throw new ProviderCheckError(r.status,reason);
 }
 const data=z.object({senders:z.array(z.object({email:z.string(),active:z.boolean()})).default([])}).parse(await r.json());
 return {provider:'brevo' as const,email:env.email,name:env.name,active:data.senders.some(s=>s.active&&s.email.toLowerCase()===env.email.toLowerCase())};
}
