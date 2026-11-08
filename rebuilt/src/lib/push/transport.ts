import {endpointURL,publicAddress} from './security';
import {request as httpsRequest,type RequestOptions} from 'node:https';
import {checkServerIdentity} from 'node:tls';
import type {LookupAddress} from 'node:dns';
export type Outcome={status:'accepted'|'retry_wait'|'failed_permanent'|'ambiguous'|'cancelled';providerCode?:number;retryAfter?:number;error?:string};
export function retryAfter(value:string|undefined,now=Date.now()){if(!value||value.length>128)return undefined;value=value.trim();const seconds=/^\d+$/.test(value)?Number(value):Math.ceil((Date.parse(value)-now)/1000);return Number.isFinite(seconds)?Math.min(86400,Math.max(0,Math.ceil(seconds))):undefined;}
export function providerOutcome(code:number,retry?:number):Outcome{
 if(code>=200&&code<300)return {status:'accepted',providerCode:code};
 if(code===404||code===410)return {status:'failed_permanent',providerCode:code,error:'endpoint_invalid'};
 if(code===429)return {status:'retry_wait',providerCode:code,...(retry!==undefined?{retryAfter:retry}:{}),error:'provider_rate_limited'};
 if(code>=500)return {status:'retry_wait',providerCode:code,error:'provider_unavailable'};
 return {status:'failed_permanent',providerCode:code,error:code===401||code===403?'provider_unauthorized':code===400||code===413?'payload_invalid':code>=300&&code<400?'provider_redirect':'provider_rejected'};
}
/** IP literal pins the connection; TLS identity and Host remain the original allowlisted provider.
 * No proxy Agent, second DNS lookup, redirect, response body parsing or connection reuse. */
export function pinnedRequest(target:URL,address:LookupAddress,headers:Record<string,string|number>,body:Buffer,signal:AbortSignal,request:typeof httpsRequest=httpsRequest):Promise<Outcome>{
 try{endpointURL(target.href);if(!publicAddress(address.address)||![4,6].includes(address.family))throw Error();}catch{return Promise.resolve({status:'failed_permanent',error:'endpoint_rejected'});}
 return new Promise(resolve=>{
  let settled=false,mayHaveSent=false;
  const finish=(value:Outcome)=>{if(settled)return;settled=true;clearTimeout(timer);signal.removeEventListener('abort',abort);resolve(value);};
  const failure=(code:string)=>{const tls=code.startsWith('CERT_')||['DEPTH_ZERO_SELF_SIGNED_CERT','UNABLE_TO_VERIFY_LEAF_SIGNATURE','ERR_TLS_CERT_ALTNAME_INVALID'].includes(code);finish({status:mayHaveSent?'ambiguous':tls?'failed_permanent':'retry_wait',error:mayHaveSent?'send_uncertain':tls?'tls_rejected':code==='TIMEOUT'?'transport_timeout':'network_unavailable'});};
  const abort=()=>{failure('TIMEOUT');req?.destroy();};
  const options:RequestOptions={protocol:'https:',hostname:address.address,family:address.family,port:443,servername:target.hostname,method:'POST',path:target.pathname+target.search,headers:{...headers,Host:target.hostname,'Content-Length':body.byteLength},agent:false,rejectUnauthorized:true,checkServerIdentity:(_host,cert)=>checkServerIdentity(target.hostname,cert),maxHeaderSize:8192};
  let req:ReturnType<typeof httpsRequest>|undefined;const timer=setTimeout(abort,10000);
  if(signal.aborted){abort();return;}signal.addEventListener('abort',abort,{once:true});
  try{req=request(options,res=>{const code=res.statusCode??0;if(code<100||code>599){failure('RESPONSE');res.destroy();return;}const raw=res.headers['retry-after'];const retry=retryAfter(Array.isArray(raw)?raw[0]:raw);res.on('error',()=>{});finish(providerOutcome(code,retry));res.destroy();});
   req.once('socket',socket=>{socket.once('secureConnect',()=>{mayHaveSent=true;});});
   req.once('finish',()=>{mayHaveSent=true;});req.once('error',(e:NodeJS.ErrnoException)=>failure(e.code??'UNKNOWN'));req.end(body);
  }catch{failure('REQUEST');req?.destroy();}
 });
}
