import test from 'node:test';import assert from 'node:assert/strict';import {EventEmitter} from 'node:events';import {PassThrough} from 'node:stream';import {createECDH,randomBytes,randomUUID} from 'node:crypto';import {registerAuditHooks} from './audit-loader.mjs';
registerAuditHooks({'server-only':'export {};'});
const {pinnedRequest,providerOutcome,retryAfter}=await import('../src/lib/push/transport.ts');const {encrypt,validateEndpoint}=await import('../src/lib/push/security.ts');const {sendClaim}=await import('../src/lib/push/sender.ts');const {runPushWorker}=await import('../src/lib/push/worker.ts');
const key=Buffer.alloc(32,7),priv=Buffer.alloc(32);priv[31]=1;const vapid=createECDH('prime256v1');vapid.setPrivateKey(priv);const browser=createECDH('prime256v1');browser.generateKeys();
const config={enabled:true,dispatch:true,test:true,categories:['points'],publicKey:vapid.getPublicKey().toString('base64url'),privateKey:priv.toString('base64url'),key,encryptionVersion:'fixture-v1',vapidVersion:'fixture-v1',subject:'mailto:fixture@example.invalid'};
const endpoint='https://fcm.googleapis.com/fcm/send/synthetic';
function fixture(){const installation=randomUUID(),owner=randomUUID(),aad=`sim-push-v1:${installation}:${owner}:fixture-v1`;return {delivery:{id:randomUUID(),claim_token:randomUUID(),binding_version:1,delivery_ref:randomUUID()},subscription:{id:randomUUID(),installation_id:installation,user_id:owner,endpoint_ciphertext:encrypt(endpoint,key,aad+':endpoint'),keys_ciphertext:encrypt(JSON.stringify({p256dh:browser.getPublicKey().toString('base64url'),auth:randomBytes(16).toString('base64url')}),key,aad+':keys'),encryption_key_version:'fixture-v1',vapid_key_version:'fixture-v1'},expires_at:new Date(Date.now()+300000).toISOString()};}
const ready=c=>({code:'ready',event_ref:randomUUID(),delivery_ref:c.delivery.delivery_ref,category:'test',expires_at:c.expires_at});
const resolve=ep=>validateEndpoint(ep,async()=>[{address:'142.250.1.1',family:4}]);
test('provider classes separate accepted, endpoint invalidation, retries, VAPID/payload and redirect; Retry-After parses delta/date',()=>{
 for(const [code,status,error] of [[201,'accepted',undefined],[410,'failed_permanent','endpoint_invalid'],[404,'failed_permanent','endpoint_invalid'],[429,'retry_wait','provider_rate_limited'],[503,'retry_wait','provider_unavailable'],[401,'failed_permanent','provider_unauthorized'],[403,'failed_permanent','provider_unauthorized'],[400,'failed_permanent','payload_invalid'],[302,'failed_permanent','provider_redirect']]){const r=providerOutcome(code,120);assert.equal(r.status,status);assert.equal(r.error,error);}
 assert.equal(retryAfter('120'),120);assert.equal(retryAfter('Wed, 01 Jan 2031 00:01:00 GMT',Date.parse('2031-01-01T00:00:00Z')),60);assert.equal(retryAfter('garbage'),undefined);assert.equal(retryAfter('9999999'),86400);
});
test('transport pins IP literal, original TLS identity/Host, disables reuse/proxy/redirect and drops response body',async()=>{
 let options,closed=false;const request=(o,cb)=>{options=o;const req=new EventEmitter();req.destroy=()=>{};req.end=()=>queueMicrotask(()=>{req.emit('finish');const res=new PassThrough();res.statusCode=201;res.headers={};res.destroy=()=>{closed=true;return res;};cb(res);});return req;};
 const result=await pinnedRequest(new URL(endpoint),{address:'142.250.1.1',family:4},{Authorization:'synthetic-vapid'},Buffer.from('encrypted'),new AbortController().signal,request);
 assert.equal(result.status,'accepted');assert.equal(options.hostname,'142.250.1.1');assert.equal(options.servername,'fcm.googleapis.com');assert.equal(options.headers.Host,'fcm.googleapis.com');assert.equal(options.path,'/fcm/send/synthetic');assert.equal(options.agent,false);assert.equal(options.rejectUnauthorized,true);assert.equal(options.maxHeaderSize,8192);assert.equal(options.lookup,undefined);assert.equal(closed,true);
});
test('abort after possible TLS/write is ambiguous, before TLS is retryable, and no provider response body is leaked',async()=>{
 for(const maySend of [false,true]){const controller=new AbortController();const request=()=>{const req=new EventEmitter();req.destroy=()=>{};req.end=()=>queueMicrotask(()=>{if(maySend)req.emit('finish');controller.abort();});return req;};const r=await pinnedRequest(new URL(endpoint),{address:'142.250.1.1',family:4},{},Buffer.from('encrypted'),controller.signal,request);assert.equal(r.status,maySend?'ambiguous':'retry_wait');assert.equal(r.error,maySend?'send_uncertain':'transport_timeout');}
});
test('sender authenticates AAD, validates DNS before preflight, emits encrypted generic v1 payload and correct bounded TTL',async()=>{
 const c=fixture(),calls=[];let sent;
 const r=await sendClaim(c,config,async()=>{calls.push('preflight');return ready(c);},new AbortController().signal,async(url,address,headers,body)=>{calls.push('send');sent={url,address,headers,body};return {status:'accepted',providerCode:201};},async ep=>{calls.push('dns');return resolve(ep);});
 assert.equal(r.status,'accepted');assert.deepEqual(calls,['dns','preflight','send']);assert.equal(sent.headers['Content-Encoding'],'aes128gcm');assert.ok(sent.headers.TTL>0&&sent.headers.TTL<=300);assert.equal(sent.body.includes(Buffer.from('SiM-Murid')),false);assert.ok(sent.headers.Authorization);assert.equal(sent.address.address,'142.250.1.1');
});
test('wrong key generation/AAD, blocked DNS, revoked preflight and flags never perform network I/O',async()=>{
 const c=fixture();let sends=0;const transport=async()=>{sends++;return {status:'accepted'};};const signal=new AbortController().signal;
 assert.equal((await sendClaim(c,{...config,encryptionVersion:'other'},async()=>ready(c),signal,transport,resolve)).error,'key_version_unavailable');
 assert.equal((await sendClaim({...c,subscription:{...c.subscription,user_id:randomUUID()}},config,async()=>ready(c),signal,transport,resolve)).error,'cipher_invalid');
 assert.equal((await sendClaim(c,config,async()=>ready(c),signal,transport,ep=>validateEndpoint(ep,async()=>[{address:'127.0.0.1',family:4}]))).error,'endpoint_rejected');
 assert.equal((await sendClaim(c,config,async()=>ready(c),signal,transport,async()=>{throw Error('DNS offline');})).error,'dns_unavailable');
 assert.equal((await sendClaim(c,config,async()=>null,signal,transport,resolve)).status,'cancelled');assert.equal((await sendClaim(c,{...config,test:false},async()=>ready(c),signal,transport,resolve)).status,'cancelled');assert.equal(sends,0);
});
function repository(count=1){const queue=Array.from({length:count},fixture),calls=[];return {queue,calls,enter:async()=>({code:'acquired',token:randomUUID()}),maintenance:async()=>calls.push('maintenance'),claim:async()=>queue.shift()??null,preflight:async c=>ready(c),complete:async(c,r)=>{calls.push([c.delivery.id,r.status]);return r.status;},leave:async()=>{calls.push('leave');return true;}};}
test('bounded batch maximum 20 and concurrency maximum four; lease busy never claims and dispatch off only maintains',async()=>{
 const repo=repository(25);let active=0,max=0;const send=async(c,cfg,check)=>{active++;max=Math.max(max,active);await check();await new Promise(r=>setTimeout(r,2));active--;return {status:'accepted',providerCode:201};};const r=await runPushWorker(repo,config,send);assert.equal(r.metrics.claimed,20);assert.equal(r.metrics.accepted,20);assert.ok(max<=4);assert.equal(repo.queue.length,5);
 const busy=repository();busy.enter=async()=>({code:'busy'});assert.equal((await runPushWorker(busy,config,send)).code,'busy');assert.equal(busy.calls.length,0);
 const off=repository();assert.equal((await runPushWorker(off,{...config,dispatch:false},send)).code,'disabled');assert.deepEqual(off.calls,['maintenance','leave']);
});
test('accepted transport with failed completion is unconfirmed, not retried or reported persisted accepted',async()=>{
 const repo=repository();repo.complete=async()=>{throw Error('private persistence detail');};const r=await runPushWorker(repo,config,async()=>({status:'accepted',providerCode:201}));assert.equal(r.code,'unconfirmed');assert.equal(r.metrics.providerAccepted,1);assert.equal(r.metrics.accepted,0);assert.equal(r.metrics.unconfirmed,1);assert.equal(JSON.stringify(r).includes('private'),false);
 const late=repository();let n=0;const out=await runPushWorker(late,config,async()=>{throw Error('No send');},()=>n++===0?0:30000);assert.equal(out.metrics.claimed,0);
});

test('metrics use persisted outcome when revocation or attempt ceiling overrides transport result',async()=>{const revoked=repository();revoked.complete=async()=> 'cancelled';const r=await runPushWorker(revoked,config,async()=>({status:'accepted',providerCode:201}));assert.equal(r.metrics.providerAccepted,1);assert.equal(r.metrics.accepted,0);assert.equal(r.metrics.cancelled,1);const ceiling=repository();ceiling.complete=async()=> 'failed_permanent';const t=await runPushWorker(ceiling,config,async()=>({status:'retry_wait',providerCode:503}));assert.equal(t.metrics.retry,0);assert.equal(t.metrics.permanent,1);});

test('certificate failure is permanent before IO and auth misconfiguration stops further claims without blanket invalidation',async()=>{
 const request=()=>{const req=new EventEmitter();req.destroy=()=>{};req.end=()=>queueMicrotask(()=>req.emit('error',Object.assign(Error('secret upstream detail'),{code:'CERT_HAS_EXPIRED'})));return req;};
 const failed=await pinnedRequest(new URL(endpoint),{address:'142.250.1.1',family:4},{},Buffer.from('encrypted'),new AbortController().signal,request);assert.deepEqual(failed,{status:'failed_permanent',error:'tls_rejected'});
 const repo=repository(25),out=await runPushWorker(repo,config,async()=>({status:'failed_permanent',providerCode:401,error:'provider_unauthorized'}));assert.ok(out.metrics.claimed<=4);assert.equal(out.metrics.permanent,out.metrics.claimed);assert.ok(repo.queue.length>=21);assert.equal(repo.calls.at(-1),'leave');
});
