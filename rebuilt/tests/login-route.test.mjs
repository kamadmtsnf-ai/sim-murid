/** Login route tests at the SDK boundary: no live identity or provider requests. */
import test from 'node:test';
import assert from 'node:assert/strict';
import {registerHooks} from 'node:module';
import {readFileSync,existsSync} from 'node:fs';
import {resolve,dirname,join} from 'node:path';
import {fileURLToPath} from 'node:url';
import ts from 'typescript';
import {NextRequest} from 'next/server.js';
const sources={
 'server-only':'export {};',
 '@supabase/supabase-js':`export const createClient=(...args)=>globalThis.loginMocks.authClient(...args);`,
 '@supabase/ssr':`export const createServerClient=(...args)=>globalThis.loginMocks.cookieClient(...args);`,
 '@/lib/auth/admin':`export const createAuthAdmin=()=>{if(globalThis.loginMocks.configError)throw Error('private configuration');return globalThis.loginMocks.admin};`,
 '@/lib/supabase/environment':`export const getSupabasePublicEnvironment=()=>({url:'https://fixture.supabase.co',publishableKey:'sb_publishable_fixture'});`,
};
registerHooks({
 resolve(specifier,context,next){
  if(specifier in sources)return {url:'login-mock:'+specifier,shortCircuit:true};
  if(specifier==='next/server')return next('next/server.js',context);
  let path;if(specifier.startsWith('@/'))path=resolve('src',specifier.slice(2));else if(specifier.startsWith('.')&&context.parentURL?.includes('/src/'))path=join(dirname(fileURLToPath(context.parentURL)),specifier);
  if(path)for(const suffix of ['', '.ts','.tsx'])if(existsSync(path+suffix))return {url:new URL('file://'+path+suffix).href,shortCircuit:true};
  return next(specifier,context);
 },
 load(url,context,next){if(url.startsWith('login-mock:'))return {format:'module',source:sources[url.slice(11)],shortCircuit:true};if(/\.tsx?$/.test(url))return {format:'module',source:ts.transpileModule(readFileSync(new URL(url),'utf8'),{compilerOptions:{module:ts.ModuleKind.ESNext,target:ts.ScriptTarget.ES2022,jsx:ts.JsxEmit.ReactJSX}}).outputText,shortCircuit:true};return next(url,context);}
});
const {POST}=await import('../src/app/api/auth/login/route.ts');
const id='11111111-1111-4111-8111-111111111111',session='22222222-2222-4222-8222-222222222222';
const body={username:'001-guru',password:' Synthetic password ',remember:false};
const token='header.'+Buffer.from(JSON.stringify({sub:id,session_id:session,exp:Math.floor(Date.now()/1000)+3600})).toString('base64url')+'.signature';
function reset(){
 const s=globalThis.loginMocks={calls:[],profile:{id,status:'active'},claim:true,signouts:0,cookieOptions:null};
 s.admin={rpc:async(name,args)=>{s.calls.push([name,args]);if(name==='app_auth_attempt')return {data:s.rate!==false,error:null};if(name==='app_auth_claim'){s.onClaim?.();if(s.claimThrow)throw Error('private claim transport');return {data:s.claim,error:s.claimError?{message:'private registry'}:null};}if(name==='app_auth_device'){if(s.deviceThrow)throw Error('private device transport');return {data:null,error:s.deviceError?{}:null};}if(name==='app_auth_revoke'){if(s.revokeThrow)throw Error('private revoke');return {data:null,error:null};}throw Error('unexpected RPC '+name);},
 from:table=>({select:columns=>({eq:(key,value)=>({maybeSingle:async()=>{s.calls.push(['lookup',{table,columns,key,value}]);return {data:s.profile,error:s.lookupError?{message:'private lookup'}:null};}})})}),
 auth:{admin:{getUserById:async user=>{s.calls.push(['identity',user]);return {data:{user:s.identityError||user!==id?null:{id:user,email:'fixture@auth.sim-murid.invalid'}},error:s.identityError??(user!==id?{status:404}:null)};}}}};
 s.authClient=()=>({auth:{signInWithPassword:async payload=>{s.calls.push(['password',payload]);s.onPassword?.();if(s.authError||payload.email!=='fixture@auth.sim-murid.invalid')return {data:{user:null,session:null},error:s.authError??{status:400}};return {data:{user:{id:s.authUser??id},session:{access_token:s.token??token,refresh_token:'synthetic-refresh'}},error:null};},signOut:async options=>{s.signouts++;s.calls.push(['signOut',options]);if(s.signoutThrow)throw Error('private signout');return {error:null};}}});
 s.cookieClient=(_url,_key,options)=>{s.cookieOptions=options.cookieOptions;return {auth:{setSession:async tokens=>{s.calls.push(['setCookie',tokens]);if(s.cookieThrow)throw Error('private cookie transport');options.cookies.setAll([{name:'sb-fixture-auth-token',value:'synthetic-cookie',options:{...options.cookieOptions}}],{});s.onCookie?.();return {data:{},error:s.cookieError?{}:null};}}};};
 return s;
}
function request(data=body,options={}){return new NextRequest('https://app.test/api/auth/login',{method:'POST',headers:{Origin:'https://app.test','Content-Type':'application/json',...options.headers},body:JSON.stringify(data),...options});}
const calls=(s,name)=>s.calls.filter(x=>x[0]===name);
async function safe(response,status){assert.equal(response.status,status);assert.match(response.headers.get('cache-control'),/no-store/);const text=await response.text();assert.doesNotMatch(text,/synthetic-refresh|header\.|private |fixture@auth/);return JSON.parse(text);}
test('Login preserves exact credentials, remember, verified claim and secure HTTP-only session cookie',async()=>{
 const s=reset(),r=await POST(request({...body,remember:true}));const json=await safe(r,200);assert.deepEqual(json,{destination:'/account'});assert.equal(calls(s,'lookup')[0][1].value,'001-guru');assert.equal(calls(s,'password')[0][1].password,body.password);assert.deepEqual(calls(s,'app_auth_claim')[0][1],{p_user:id,p_session:session,p_remember:true});assert.equal(s.signouts,0);assert.deepEqual(s.cookieOptions,{httpOnly:true,secure:true,sameSite:'lax',path:'/'});assert.match(r.headers.get('set-cookie'),/HttpOnly/);assert.match(r.headers.get('set-cookie'),/Secure/);
});
test('Origin, malformed payload, forged actor and rate limit reject before password verification',async()=>{
 let s=reset();await safe(await POST(request(body,{headers:{Origin:'https://foreign.test'}})),403);assert.equal(s.calls.length,0);
 for(const data of [{...body,actor:id},{...body,username:' 001-guru'},null,{...body,remember:'true'}]){s=reset();await safe(await POST(request(data)),400);assert.equal(s.calls.length,0);}
 s=reset();s.rate=false;await safe(await POST(request()),429);assert.equal(calls(s,'password').length,0);
});
test('Unknown/inactive identities use generic credential failure without exposing account existence',async()=>{
 for(const profile of [null,{id,status:'inactive'}]){const s=reset();s.profile=profile;const json=await safe(await POST(request()),401);assert.match(json.message,/Username atau password/);assert.equal(calls(s,'identity').length,1);assert.notEqual(calls(s,'identity')[0][1],id);assert.equal(calls(s,'password').length,1);assert.equal(calls(s,'app_auth_claim').length,0);}
});
test('Auth outage and throttling are distinguished from invalid credentials',async()=>{
 for(const [providerStatus,responseStatus] of [[400,401],[429,429],[500,503],[503,503],[0,503]]){const s=reset();s.authError={status:providerStatus,message:'private provider'};await safe(await POST(request()),responseStatus);assert.equal(calls(s,'app_auth_claim').length,0);}
 const s=reset();s.identityError={status:503,message:'private identity'};await safe(await POST(request()),503);assert.equal(calls(s,'password').length,0);
});
test('Claim transport failure and cookie throw compensate only the issued session, without returning cookies',async()=>{
 for(const flag of ['claimThrow','claimError','cookieThrow','cookieError']){const s=reset();s[flag]=true;const r=await POST(request());assert.equal(r.headers.get('set-cookie'),null);await safe(r,503);assert.deepEqual(calls(s,'app_auth_revoke').map(c=>c[1]),[{p_user:id,p_session:session}]);assert.equal(s.signouts,1);assert.deepEqual(calls(s,'signOut')[0][1],{scope:'local'});}
});
test('Single-session conflict never revokes another session; malformed verified payload cleans up provider',async()=>{
 let s=reset();s.claim=false;await safe(await POST(request()),409);assert.equal(s.signouts,1);assert.ok(calls(s,'app_auth_revoke').every(c=>c[1].p_session===session));
 s=reset();s.token='bad-token';await safe(await POST(request()),503);assert.equal(s.signouts,1);assert.equal(calls(s,'app_auth_claim').length,0);
});
test('Optional display-device failure cannot strand a successfully verified login',async()=>{
 for(const flag of ['deviceThrow','deviceError']){const s=reset();s[flag]=true;await safe(await POST(request()),200);assert.equal(s.signouts,0);assert.equal(calls(s,'setCookie').length,1);}
});
test('Disconnected requests clean up issued sessions before returning success',async()=>{
 for(const stage of ['onPassword','onClaim','onCookie']){const s=reset(),controller=new AbortController();s[stage]=()=>controller.abort();await safe(await POST(request(body,{signal:controller.signal})),503);assert.equal(s.signouts,1);if(stage!=='onPassword')assert.equal(calls(s,'app_auth_revoke').length,1);}
});
test('Body limit is bounded in bytes, including a multibyte payload; read errors return safe JSON',async()=>{
 reset();await safe(await POST(request({padding:'漢'.repeat(3000)})),413);
 const stream=new ReadableStream({start(controller){controller.error(Error('private body transport'));}});
 const r=new NextRequest('https://app.test/api/auth/login',{method:'POST',headers:{Origin:'https://app.test'},body:stream,duplex:'half'});await safe(await POST(r),400);
});
test('Cleanup transport errors never hide the safe response or skip the other cleanup step',async t=>{
 const warnings=[];t.mock.method(console,'warn',(...args)=>warnings.push(args));
 for(const flag of ['revokeThrow','signoutThrow']){const s=reset();s.cookieThrow=true;s[flag]=true;await safe(await POST(request()),503);assert.equal(s.signouts,1);}
 assert.ok(warnings.length>=2);for(const args of warnings){assert.equal(args[0],'Login cleanup unavailable');assert.ok(['registry','provider'].includes(args[1].stage));assert.equal(JSON.stringify(args).includes('private'),false);assert.equal(JSON.stringify(args).includes('Synthetic password'),false);}
});

test('Identity provider outage has the same status for unknown and inactive usernames',async()=>{for(const profile of [null,{id,status:'inactive'}]){const s=reset();s.profile=profile;s.identityError={status:503};await safe(await POST(request()),503);assert.equal(calls(s,'password').length,0);}});

const {recaptchaConfig,publicRecaptcha}=await import('../src/lib/auth/recaptcha.ts');
async function captchaEnvironment(fn){
 const names=['RECAPTCHA_ENABLED','RECAPTCHA_SITE_KEY','RECAPTCHA_SECRET_KEY','RECAPTCHA_ALLOWED_HOSTNAMES'];
 const before=Object.fromEntries(names.map(n=>[n,process.env[n]]));
 Object.assign(process.env,{RECAPTCHA_ENABLED:'true',RECAPTCHA_SITE_KEY:'synthetic_site_key_for_tests_12345678',RECAPTCHA_SECRET_KEY:'synthetic_secret_key_for_tests_12345678',RECAPTCHA_ALLOWED_HOSTNAMES:'app.test'});
 try{return await fn();}finally{for(const name of names){if(before[name]===undefined)delete process.env[name];else process.env[name]=before[name];}}
}
test('reCAPTCHA configuration exposes only site key, requires exact domains, and rejects partial/test production configuration',()=>{
 assert.deepEqual(recaptchaConfig({}),{mode:'disabled'});
 assert.deepEqual(recaptchaConfig({RECAPTCHA_ENABLED:'false'}),{mode:'disabled'});
 for(const env of [{RECAPTCHA_ENABLED:'yes'},{RECAPTCHA_ENABLED:'true'},{RECAPTCHA_ENABLED:'true',RECAPTCHA_SITE_KEY:'site'.repeat(10),RECAPTCHA_SECRET_KEY:'secret'.repeat(7),RECAPTCHA_ALLOWED_HOSTNAMES:'https://app.test'}])assert.equal(recaptchaConfig(env).mode,'unavailable');
 assert.equal(recaptchaConfig({NODE_ENV:'production',RECAPTCHA_ENABLED:'true',RECAPTCHA_SITE_KEY:'6LeIxAcTAAAAAJcZVRqyHh71UMIEGNQ_MXjiZKhI',RECAPTCHA_SECRET_KEY:'6LeIxAcTAAAAAGG-vFI1TnRWxMZNFuojJ4WifJWe',RECAPTCHA_ALLOWED_HOSTNAMES:'app.test'}).mode,'unavailable');
 const config=recaptchaConfig({RECAPTCHA_ENABLED:'true',RECAPTCHA_SITE_KEY:'site'.repeat(10),RECAPTCHA_SECRET_KEY:'secret'.repeat(7),RECAPTCHA_ALLOWED_HOSTNAMES:'app.test, APP.TEST'});
 assert.deepEqual(publicRecaptcha(config),{mode:'enabled',siteKey:'site'.repeat(10)});assert.deepEqual(config.hostnames,['app.test']);
});
test('enabled reCAPTCHA cannot be bypassed by omitting a token; invalid configuration fails closed before Auth',async()=>captchaEnvironment(async()=>{
 let s=reset();await safe(await POST(request()),403);assert.equal(s.calls.length,0);
 for(const value of ['',null,' '.repeat(5),'x'.repeat(4097)]){s=reset();await safe(await POST(request({...body,captchaToken:value})),400);assert.equal(s.calls.length,0);}
 delete process.env.RECAPTCHA_SECRET_KEY;s=reset();await safe(await POST(request({...body,captchaToken:'synthetic-token'})),503);assert.equal(s.calls.length,0);
}));
test('valid Google token is verified before profile/password lookup and never forwarded into credentials',async t=>captchaEnvironment(async()=>{
 const s=reset(),requests=[];
 t.mock.method(globalThis,'fetch',async(url,options)=>{requests.push({url,options});s.calls.push(['captcha']);return Response.json({success:true,hostname:'app.test',challenge_ts:'2026-10-26T00:00:00Z'});});
 await safe(await POST(request({...body,captchaToken:'synthetic-token'})),200);
 assert.equal(requests.length,1);const {url,options}=requests[0];assert.equal(url,'https://www.google.com/recaptcha/api/siteverify');assert.equal(options.method,'POST');assert.equal(options.cache,'no-store');assert.equal(options.redirect,'error');
 assert.deepEqual(Object.fromEntries(options.body),{secret:process.env.RECAPTCHA_SECRET_KEY,response:'synthetic-token'});
 assert.equal(calls(s,'password')[0][1].password,body.password);assert.deepEqual(Object.keys(calls(s,'password')[0][1]).sort(),['email','password']);assert.ok(s.calls.findIndex(c=>c[0]==='captcha')<s.calls.findIndex(c=>c[0]==='lookup'));
}));
test('rejected/expired/replayed/wrong-domain tokens never reach lookup or password verification',async t=>captchaEnvironment(async()=>{
 const responses=[{success:false,'error-codes':['timeout-or-duplicate']},{success:false,'error-codes':['invalid-input-response']},{success:true,hostname:'evil.test'},{success:true,hostname:'app.test.evil.test'},{success:true}];
 t.mock.method(globalThis,'fetch',async()=>Response.json(responses.shift()));
 for(let i=0;i<5;i++){const s=reset();await safe(await POST(request({...body,captchaToken:'synthetic-token'})),403);assert.equal(calls(s,'lookup').length,0);assert.equal(calls(s,'password').length,0);}
}));
test('Google transport/JSON/configuration failures return safe 503; rate limiting still precedes verification',async t=>captchaEnvironment(async()=>{
 let outcome='network',count=0;
 t.mock.method(globalThis,'fetch',async()=>{count++;if(outcome==='network')throw Error('private recaptcha transport');if(outcome==='bad-json')return new Response('{');if(outcome==='http')return new Response('private upstream',{status:503});if(outcome==='schema')return Response.json({success:'true'});if(outcome==='v3')return Response.json({success:true,hostname:'app.test',score:0.1,action:'login'});return Response.json({success:false,'error-codes':['invalid-input-secret']});});
 for(outcome of ['network','bad-json','http','schema','secret','v3']){const s=reset();await safe(await POST(request({...body,captchaToken:'synthetic-token'})),503);assert.equal(calls(s,'password').length,0);assert.equal(calls(s,'lookup').length,0);}
 const before=count,s=reset();s.rate=false;await safe(await POST(request({...body,captchaToken:'synthetic-token'})),429);assert.equal(count,before);
}));

test('reCAPTCHA rejects invalid DNS labels while allowing exact localhost and valid hyphens',()=>{
 const env={RECAPTCHA_ENABLED:'true',RECAPTCHA_SITE_KEY:'site'.repeat(10),RECAPTCHA_SECRET_KEY:'secret'.repeat(7)};
 for(const host of ['app-.test','app.-test','a'.repeat(64)+'.test','app..test','*.test','app.test:443'])assert.equal(recaptchaConfig({...env,RECAPTCHA_ALLOWED_HOSTNAMES:host}).mode,'unavailable',host);
 for(const host of ['localhost','sim-muridv2.vercel.app','a'.repeat(63)+'.test'])assert.equal(recaptchaConfig({...env,RECAPTCHA_ALLOWED_HOSTNAMES:host}).mode,'enabled',host);
});
test('oversized Google response is canceled while streaming before authentication',async t=>captchaEnvironment(async()=>{
 let canceled=false;
 t.mock.method(globalThis,'fetch',async()=>new Response(new ReadableStream({pull(controller){controller.enqueue(new Uint8Array(9000));},cancel(){canceled=true;}})));
 const s=reset();await safe(await POST(request({...body,captchaToken:'synthetic-token'})),503);
 assert.equal(canceled,true);assert.equal(calls(s,'lookup').length,0);assert.equal(calls(s,'password').length,0);
}));
test('malformed UTF8 and interrupted Google streams fail closed',async t=>captchaEnvironment(async()=>{
 let interrupted=false;
 t.mock.method(globalThis,'fetch',async()=>new Response(new ReadableStream({start(c){if(interrupted)c.error(Error('private stream failure'));else {c.enqueue(new Uint8Array([0xff]));c.close();}}})));
 for(interrupted of [false,true]){const s=reset();await safe(await POST(request({...body,captchaToken:'synthetic-token'})),503);assert.equal(calls(s,'lookup').length,0);}
}));
