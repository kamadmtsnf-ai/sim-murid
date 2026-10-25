import { test } from 'node:test';
import assert from 'node:assert/strict';
import { registerAuditHooks } from './audit-loader.mjs';
registerAuditHooks({
 'next/server': `export class NextResponse extends Response { cookies={set:(v)=>this.saved.push(v)};saved=[];static next(){return new NextResponse(null)};static redirect(url){return new NextResponse(null,{status:307,headers:{location:String(url)}})}};`,
 '@/lib/auth/http': `export const requestAuth=(req,res)=>{req.headers.set('cookie','refreshed');res.cookies.getAll=()=>[{name:'session',value:'refreshed'}];return {}};export const verifiedPrincipal=async()=>{if(globalThis.pa.authError)throw Error('private');return globalThis.pa.caller};`,
 '@/lib/auth/authorization': `export const loadAccessContext=async()=>{globalThis.pa.calls++;if(globalThis.pa.accessError)throw Error('private');return globalThis.pa.access};`,
});
const { canAccessAccountPage } = await import('../src/lib/auth/page-policy.ts');
const { accountNavigation } = await import('../src/config/account-navigation.ts');
const { proxy } = await import('../src/proxy.ts');
const id='11111111-1111-4111-8111-111111111111';
function reset(){globalThis.pa={caller:{principal:{id,is_admin:false}},access:{user_id:id,grants:[]},calls:0};return globalThis.pa;}
function request(path='/account/settings'){return {url:'https://app.test'+path,nextUrl:new URL('https://app.test'+path),headers:new Headers({'x-sim-path':'/account/profile'})};}
test('every registered page uses its navigation policy for direct access',()=>{
 for(const item of accountNavigation.flatMap(g=>g.items)){
  assert.equal(canAccessAccountPage(item.href,[],true),true,item.href);
  assert.equal(canAccessAccountPage(item.href,[],false),!item.adminOnly&&!item.capabilities,item.href);
  for(const cap of item.capabilities??[])assert.equal(canAccessAccountPage(item.href,[cap],false),true);
 }
});
test('unknown paths, prefix confusion, encoded paths and arbitrary descendants fail closed even for admin',()=>{
 for(const path of ['/accounting','/account/unknown','/account/profile/extra','/account/services/jobs/extra','/account/directory/not-an-id','/account/%73ettings','/account\\settings'])assert.equal(canAccessAccountPage(path,[],true),false,path);
 for(const root of ['/account/directory','/account/biodata'])assert.equal(canAccessAccountPage(root+'/'+id,['profiles.read'],false),true);
 assert.equal(canAccessAccountPage('/account/directory/'+id,[],false),false);
});
test('proxy denies direct URL without capability and overwrites forged path header',async()=>{
 const s=reset(),req=request();const res=await proxy(req);assert.equal(res.status,403);assert.equal(req.headers.get('x-sim-path'),'/account/settings');assert.equal(s.calls,1);assert.equal(res.headers.get('cache-control'),'private, no-store');assert.equal(res.saved[0].value,'refreshed');
});
test('proxy allows granted page, admin and personal pages; rejects mismatched identity and unavailable authorization',async()=>{
 reset();assert.equal((await proxy(request('/account/profile'))).status,200);
 let s=reset();s.access.grants=[{capability:'classes.read'}];assert.equal((await proxy(request('/account/classes'))).status,200);
 s=reset();s.caller.principal.is_admin=true;assert.equal((await proxy(request())).status,200);
 for(const kind of ['null','identity','accessError','authError']){s=reset();if(kind==='null')s.access=null;if(kind==='identity')s.access.user_id='other';if(kind==='accessError')s.accessError=true;if(kind==='authError')s.authError=true;assert.equal((await proxy(request())).status,503);}
});
test('anonymous or revoked session redirects to login and never loads permissions',async()=>{const s=reset();s.caller=null;const res=await proxy(request());assert.equal(res.status,307);assert.equal(res.headers.get('location'),'https://app.test/login?expired=1');assert.equal(s.calls,0);});
test('revoked grants are checked again on the next request, with no cached authorization',async()=>{const s=reset();s.access.grants=[{capability:'classes.read'}];assert.equal((await proxy(request('/account/classes'))).status,200);s.access.grants=[];assert.equal((await proxy(request('/account/classes'))).status,403);assert.equal(s.calls,2);});

test('onboarding account pages remain reachable when operational grants are not yet available',async()=>{for(const path of ['/account','/account/security','/account/email','/account/sessions','/account/access']){const s=reset();s.access=null;assert.equal((await proxy(request(path))).status,200,path);assert.equal(s.calls,0);}});
