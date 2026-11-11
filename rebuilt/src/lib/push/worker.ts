import 'server-only';
import {sendClaim} from './sender';
import type {PushRepository,Metrics} from './repository';
import type {SenderConfiguration} from './sender-config';
/** All side effects are awaited. Work ends at 42s; persisted metrics have a separate 2s bound. */
export async function runPushWorker(repository:PushRepository,config:SenderConfiguration,send:typeof sendClaim=sendClaim,now=Date.now){
 const metrics:Metrics={claimed:0,providerAccepted:0,accepted:0,retry:0,permanent:0,ambiguous:0,cancelled:0,unconfirmed:0,skipped:0};
 const controller=new AbortController(),timer=setTimeout(()=>controller.abort(),42000),signal=controller.signal,deadline=now()+42000;
 let token:string|undefined,scheduled=0,stop=false;
 try{
  const lease=await repository.enter(signal);if(lease.code!=='acquired')return {code:lease.code,metrics};token=lease.token;
  await repository.maintenance(config,signal);
  if(!config.enabled||!config.dispatch)return {code:'disabled' as const,metrics};
  await Promise.all(Array.from({length:4},async()=>{
   while(!stop&&!signal.aborted&&now()<deadline-24000&&scheduled<20){
    scheduled++;
    try{
     const claim=await repository.claim(signal);if(!claim){stop=true;return;}metrics.claimed++;
     let guardClosed=false;
     const outcome=await send(claim,config,async()=>{const r=await repository.preflight(claim,signal);guardClosed=!r;return r;},signal);
     if(outcome.status==='accepted')metrics.providerAccepted++;
     if(['vapid_invalid','provider_unauthorized'].includes(outcome.error??''))stop=true;
     if(guardClosed){metrics.skipped++;continue;}
     try{
      const persisted=await repository.complete(claim,outcome,signal);
      if(!persisted){metrics.unconfirmed++;stop=true;continue;}
      if(persisted==='accepted')metrics.accepted++;
      else if(persisted==='retry_wait')metrics.retry++;
      else if(persisted==='failed_permanent')metrics.permanent++;
      else if(persisted==='ambiguous')metrics.ambiguous++;
      else metrics.cancelled++;
     }catch{metrics.unconfirmed++;stop=true;}
    }catch{metrics.unconfirmed++;stop=true;}
   }
  }));
  return {code:metrics.unconfirmed?'unconfirmed' as const:'processed' as const,metrics};
 }catch{
  metrics.unconfirmed++;return {code:'unconfirmed' as const,metrics};
 }finally{
  clearTimeout(timer);
  if(token){try{if(!await repository.leave(token,metrics))metrics.unconfirmed++;}catch{metrics.unconfirmed++;}}
 }
}
