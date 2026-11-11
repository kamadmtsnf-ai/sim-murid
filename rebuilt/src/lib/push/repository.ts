import 'server-only';
import {z} from 'zod';
import {createAuthAdmin} from '@/lib/auth/admin';
import {claimSchema,readySchema,type PushClaim,type Ready} from './sender';
import type {Outcome} from './transport';
import type {SenderConfiguration} from './sender-config';
export type Metrics={claimed:number;providerAccepted:number;accepted:number;retry:number;permanent:number;ambiguous:number;cancelled:number;unconfirmed:number;skipped:number};
export interface PushRepository{
 enter(signal:AbortSignal):Promise<{code:'acquired';token:string}|{code:'busy'|'rate_limited'}>;
 maintenance(config:SenderConfiguration,signal:AbortSignal):Promise<void>;
 claim(signal:AbortSignal):Promise<PushClaim|null>;
 preflight(claim:PushClaim,signal:AbortSignal):Promise<Ready|null>;
 complete(claim:PushClaim,result:Outcome,signal:AbortSignal):Promise<Outcome['status']|null>;
 leave(token:string,metrics:Metrics):Promise<boolean>;
}
const result=z.object({code:z.string(),status:z.string().optional()});
const scoped=(signal:AbortSignal)=>AbortSignal.any([signal,AbortSignal.timeout(4000)]);
export function pushRepository():PushRepository{
 const admin=createAuthAdmin();
 const checked=(r:{data:unknown;error:unknown})=>{if(r.error)throw Error('Push repository unavailable');return r.data;};
 return {
 async enter(signal){const d=checked(await admin.rpc('app_push_worker',{p_action:'enter'}).abortSignal(scoped(signal)));return z.union([z.object({code:z.literal('acquired'),token:z.uuid()}),z.object({code:z.enum(['busy','rate_limited'])})]).parse(d);},
 async maintenance(c,signal){const d=checked(await admin.rpc('app_push_maintenance',{p_enabled:c.enabled,p_test:c.test,p_categories:c.categories}).abortSignal(scoped(signal)));if(result.parse(d).code!=='saved')throw Error('Push maintenance unavailable');const cleanup=checked(await admin.rpc('app_push_cleanup').abortSignal(scoped(signal)));if(!['saved','disabled'].includes(result.parse(cleanup).code))throw Error('Push cleanup unavailable');if(c.enabled&&c.dispatch&&c.categories.includes('surveys')){const reminders=checked(await admin.rpc('app_push_reminders',{p_enabled:true,p_categories:c.categories}).abortSignal(scoped(signal)));if(result.parse(reminders).code!=='saved')throw Error('Push reminders unavailable');}},
 async claim(signal){const d=checked(await admin.rpc('app_push_claim').abortSignal(scoped(signal)));const code=z.object({code:z.enum(['claimed','empty'])}).parse(d).code;if(code==='empty')return null;return claimSchema.parse(d);},
 async preflight(c,signal){const d=checked(await admin.rpc('app_push_preflight',{p_id:c.delivery.id,p_token:c.delivery.claim_token,p_binding:c.delivery.binding_version}).abortSignal(scoped(signal)));const code=z.object({code:z.enum(['ready','stale','expired','cancelled','deferred'])}).parse(d).code;if(code!=='ready')return null;return readySchema.parse(d);},
 async complete(c,r,signal){const d=checked(await admin.rpc('app_push_result',{p_id:c.delivery.id,p_token:c.delivery.claim_token,p_binding:c.delivery.binding_version,p_status:r.status,p_code:r.providerCode??null,p_retry:r.retryAfter??null,p_error:r.error??null}).abortSignal(scoped(signal)));const saved=z.union([z.object({code:z.literal('saved'),status:z.enum(['accepted','retry_wait','failed_permanent','ambiguous','cancelled'])}),z.object({code:z.literal('stale')})]).parse(d);return saved.code==='saved'?saved.status:null;},
 async leave(token,metrics){const d=checked(await admin.rpc('app_push_worker',{p_action:'leave',p_token:token,p_metrics:metrics}).abortSignal(AbortSignal.timeout(2000)));return result.parse(d).code==='saved';},
 };
}
