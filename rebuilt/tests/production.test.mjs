import test from 'node:test';
import assert from 'node:assert/strict';
import {registerHooks} from 'node:module';
import {readFileSync} from 'node:fs';
import {resolve} from 'node:path';
import ts from 'typescript';
import {NextRequest,NextResponse} from 'next/server.js';
const mockSources={
 'server-only':'export {};',
 '@/lib/auth/http':`export const privateJson=(body,status=200)=>globalThis.auditMocks.json(body,status);export const requestAuth=()=>{if(globalThis.auditMocks.authError)throw Error('secret configuration detail');return {}};export const verifiedPrincipal=async()=>globalThis.auditMocks.caller;export const sameOrigin=()=>globalThis.auditMocks.originValid!==false;`,
 '@/lib/auth/admin':`export const createAuthAdmin=()=>({rpc:(...args)=>globalThis.auditMocks.rpc(...args)});`,
 '@/lib/auth/authorization':`export class AccessDenied extends Error {}`,
 '@/lib/settings/server':`export const readBounded=async request=>new Uint8Array(await request.arrayBuffer());`,
 '@/lib/services/providers':`export const encryptKey=()=>'';export const analyzeEssays=async()=>({result:{summary:'Synthetic analysis'},tokens:{}});`,
 '@/lib/services/dispatch':`export const dispatchOne=async()=>{throw Error('provider secret')};`,
 '@/lib/services/server':`export const servicesData=async()=>({revision:1});`,
};
registerHooks({
 resolve(specifier,context,next){
  if(specifier in mockSources)return {url:'audit-mock:'+specifier,shortCircuit:true};
  if(specifier.startsWith('@/'))return {url:new URL('file://'+resolve('src',specifier.slice(2)+'.ts')).href,shortCircuit:true};
  if(specifier==='./validation'&&context.parentURL?.endsWith('/education/server.ts'))return {url:new URL('./validation.ts',context.parentURL).href,shortCircuit:true};
  return next(specifier,context);
 },
 load(url,context,next){
  if(url.startsWith('audit-mock:'))return {format:'module',source:mockSources[url.slice(11)],shortCircuit:true};
  if(url.endsWith('.ts'))return {format:'module',source:ts.transpileModule(readFileSync(new URL(url),'utf8'),{compilerOptions:{module:ts.ModuleKind.ESNext,target:ts.ScriptTarget.ES2022}}).outputText,shortCircuit:true};
  return next(url,context);
 }
});
const {educationContext}=await import('../src/lib/education/server.ts');
const {POST}=await import('../src/app/api/services/ai/route.ts');
function reset(){globalThis.auditMocks={json:(body,status)=>NextResponse.json(body,{status}),caller:{principal:{id:'00000000-0000-4000-8000-000000000001',is_admin:true},sessionId:'session'},authError:false,rpc:async()=>({data:false,error:null})};}
function request(){return new NextRequest('https://example.test/api/classes');}
test('Access context returns safe 503 on unavailable configuration and survey RPC; anonymous remains 401',async()=>{
 reset();globalThis.auditMocks.authError=true;let c=await educationContext(request());assert.equal(c.caller,null);let r=c.reply({message:'Login'},401);assert.equal(r.status,503);assert.doesNotMatch(await r.text(),/secret configuration/);
 reset();globalThis.auditMocks.rpc=async()=>({data:null,error:{message:'internal'}});c=await educationContext(request());assert.equal(c.caller,null);assert.equal(c.reply({},401).status,503);
 reset();globalThis.auditMocks.rpc=async()=>{throw Error('network')};c=await educationContext(request());assert.equal(c.reply({},401).status,503);
 reset();globalThis.auditMocks.caller=null;c=await educationContext(request());assert.equal(c.reply({},401).status,401);
});
test('Mandatory survey blocks other APIs and allows survey completion endpoint',async()=>{
 reset();globalThis.auditMocks.rpc=async()=>({data:true,error:null});let c=await educationContext(request());assert.equal(c.caller,null);const r=c.reply({},401);assert.equal(r.status,403);assert.equal((await r.json()).redirect,'/account/services/surveys');c=await educationContext(new NextRequest('https://example.test/api/services/surveys'));assert.ok(c.caller);
});
test('AI completion never claims success when persistence is denied, missing or malformed',async()=>{
 for(const completion of [{code:'denied'},null,{} ,{code:'saved'}]){
 reset();globalThis.auditMocks.rpc=async(name,args)=>name==='app_survey_required'?{data:false,error:null}:{error:null,data:args.p_action==='prepare'?{code:'saved',id:'00000000-0000-4000-8000-000000000002',essays:['one','two','three','four','five'],config:{encrypted_key:'synthetic',model:'test'}}:completion};
 const r=await POST(new NextRequest('https://example.test/api/services/ai',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({action:'analyze',provider:'gemini',periodId:'00000000-0000-4000-8000-000000000003'})}));assert.equal(r.status,completion?.code==='saved'?200:503);
 }
});

const {GET:cron}=await import('../src/app/api/services/cron/route.ts');
test('Cron rejects missing credentials and safely reports job or dispatch outages',async()=>{
 const old=process.env.CRON_SECRET,oldDispatch=process.env.SERVICES_DISPATCH_ENABLED;
 try{
 reset();delete process.env.CRON_SECRET;assert.equal((await cron(new NextRequest('https://example.test/api/services/cron'))).status,401);
 process.env.CRON_SECRET='synthetic-test-secret';const req=()=>new NextRequest('https://example.test/api/services/cron',{headers:{authorization:'Bearer synthetic-test-secret'}});
 globalThis.auditMocks.rpc=async()=>{throw Error('private configuration')};let r=await cron(req());assert.equal(r.status,503);assert.doesNotMatch(await r.text(),/private configuration/);
 globalThis.auditMocks.rpc=async()=>({error:null,data:[]});process.env.SERVICES_DISPATCH_ENABLED='true';r=await cron(req());assert.equal(r.status,503);assert.doesNotMatch(await r.text(),/provider secret/);
 }finally{if(old===undefined)delete process.env.CRON_SECRET;else process.env.CRON_SECRET=old;if(oldDispatch===undefined)delete process.env.SERVICES_DISPATCH_ENABLED;else process.env.SERVICES_DISPATCH_ENABLED=oldDispatch;}
});


const {POST:notificationWrite}=await import('../src/app/api/services/[module]/route.ts');
test('Notification API preserves actor/session envelope, safe statuses and read-one/read-all validation',async()=>{
 const params={params:Promise.resolve({module:'notifications'})};
 const payload={requestId:'11111111-1111-4111-8111-111111111111',revision:5,command:{type:'read',id:null}};
 const req=(body=payload)=>new NextRequest('https://example.test/api/services/notifications',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify(body)});
 for(const [code,status] of [['saved',200],['denied',403],['stale',409]]){
  reset();let rpc;globalThis.auditMocks.rpc=async(...args)=>{rpc=args;return {data:{code},error:null}};
  const response=await notificationWrite(req(),params);assert.equal(response.status,status);assert.equal((await response.json()).result.code,code);
  assert.equal(rpc[0],'app_services_write');assert.equal(rpc[1].p_actor,globalThis.auditMocks.caller.principal.id);assert.equal(rpc[1].p_session,globalThis.auditMocks.caller.sessionId);assert.deepEqual(rpc[1].p_command,payload.command);assert.equal(rpc[1].p_revision,5);assert.equal(rpc[1].p_request,payload.requestId);
 }
 reset();globalThis.auditMocks.rpc=async()=>({data:{code:'saved'},error:null});assert.equal((await notificationWrite(req({...payload,command:{type:'read',id:payload.requestId}}),params)).status,200);
 for(const command of [{type:'read'},{type:'read',id:'bad-id'},{type:'read',id:null,actorId:payload.requestId}]){reset();let called=false;globalThis.auditMocks.rpc=async()=>{called=true;return {data:{code:'saved'},error:null}};assert.equal((await notificationWrite(req({...payload,command}),params)).status,400);assert.equal(called,false);}
 reset();globalThis.auditMocks.caller=null;assert.equal((await notificationWrite(req(),params)).status,401);
 reset();globalThis.auditMocks.originValid=false;assert.equal((await notificationWrite(req(),params)).status,403);
 reset();globalThis.auditMocks.rpc=async()=>({data:null,error:{message:'private database detail'}});const failed=await notificationWrite(req(),params);assert.equal(failed.status,503);assert.doesNotMatch(await failed.text(),/private database detail/);
});
