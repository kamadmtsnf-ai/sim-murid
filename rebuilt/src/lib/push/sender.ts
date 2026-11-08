import 'server-only';
import {generateRequestDetails} from 'web-push';
import {z} from 'zod';
import {decrypt,subscriptionSchema,validateEndpoint} from './security';
import {pinnedRequest,type Outcome} from './transport';
import type {SenderConfiguration} from './sender-config';
const cipher=z.object({iv:z.string(),ciphertext:z.string(),tag:z.string()}).strict();
export const claimSchema=z.object({delivery:z.object({id:z.uuid(),claim_token:z.uuid(),binding_version:z.number().int(),delivery_ref:z.uuid()}),subscription:z.object({id:z.uuid(),installation_id:z.uuid(),user_id:z.uuid(),endpoint_ciphertext:cipher,keys_ciphertext:cipher,encryption_key_version:z.string(),vapid_key_version:z.string()}),expires_at:z.string()});
export type PushClaim=z.infer<typeof claimSchema>;
export const readySchema=z.object({code:z.literal('ready'),event_ref:z.uuid(),delivery_ref:z.uuid(),category:z.enum(['test','points']),expires_at:z.string()});
export type Ready=z.infer<typeof readySchema>;
export async function sendClaim(claim:PushClaim,config:SenderConfiguration,preflight:()=>Promise<Ready|null>,signal:AbortSignal,transport:typeof pinnedRequest=pinnedRequest,resolveEndpoint:typeof validateEndpoint=validateEndpoint):Promise<Outcome>{
 const s=claim.subscription;if(s.encryption_key_version!==config.encryptionVersion||s.vapid_key_version!==config.vapidVersion)return {status:'failed_permanent',error:'key_version_unavailable'};
 const aad=`sim-push-v1:${s.installation_id}:${s.user_id}:${s.encryption_key_version}`;
 let endpoint:string,keys:{p256dh:string;auth:string};
 try{endpoint=decrypt(s.endpoint_ciphertext,config.key,aad+':endpoint');keys=JSON.parse(decrypt(s.keys_ciphertext,config.key,aad+':keys')) as typeof keys;const parsed=subscriptionSchema.parse({subscription:{endpoint,expirationTime:null,keys}});endpoint=parsed.subscription.endpoint;keys=parsed.subscription.keys;}catch{return {status:'failed_permanent',error:'cipher_invalid'};}
 let target:Awaited<ReturnType<typeof validateEndpoint>>;
 try{target=await resolveEndpoint(endpoint);}catch(error){return {status:error instanceof Error&&error.message.startsWith('Invalid push')?'failed_permanent':'retry_wait',error:error instanceof Error&&error.message.startsWith('Invalid push')?'endpoint_rejected':'dns_unavailable'};}
 const ready=await preflight();if(!ready)return {status:'cancelled',error:'channel_disabled'};
 if(!config.enabled||!config.dispatch||(ready.category==='test'?!config.test:!config.categories.includes(ready.category)))return {status:'cancelled',error:'channel_disabled'};
 const ttl=Math.floor((Date.parse(ready.expires_at)-Date.now())/1000);if(!Number.isFinite(ttl)||ttl<=0)return {status:'cancelled',error:'ttl_expired'};
 const payload=JSON.stringify({v:1,deliveryRef:ready.delivery_ref,eventRef:ready.event_ref,title:'SiM-Murid',body:'Ada pemberitahuan baru. Buka aplikasi untuk melihat detail.'});
 if(Buffer.byteLength(payload)>2048)return {status:'failed_permanent',error:'payload_invalid'};
 let details:ReturnType<typeof generateRequestDetails>;
 try{details=generateRequestDetails({endpoint:target.endpoint,keys},payload,{vapidDetails:{subject:config.subject,publicKey:config.publicKey,privateKey:config.privateKey},TTL:Math.min(86400,ttl),contentEncoding:'aes128gcm',urgency:'normal'});}catch{return {status:'failed_permanent',error:'vapid_invalid'};}
 if(signal.aborted)return {status:'cancelled',error:'channel_disabled'};
 return transport(new URL(target.endpoint),target.addresses[0]!,details.headers,details.body,signal);
}
