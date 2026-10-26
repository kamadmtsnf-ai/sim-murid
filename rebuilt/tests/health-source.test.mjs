import test from 'node:test';
import assert from 'node:assert/strict';
import { registerHooks } from 'node:module';
import { readFileSync, existsSync } from 'node:fs';
import ts from 'typescript';
const mocks={
 'server-only':'export {};',
 '@/lib/auth/admin':`export const createAuthAdmin=()=>({rpc:(name,args)=>{globalThis.hs.args={name,args};const result={data:globalThis.hs.data,error:globalThis.hs.error};return {abortSignal(signal){globalThis.hs.signal=signal;return Promise.resolve(result)},then(resolve,reject){return Promise.resolve(result).then(resolve,reject)}}}});`,
 '@/lib/auth/authorization':'export class AccessDenied extends Error {};',
 '@/lib/email/gmail-config':'export function parseGmailEnvironment(){throw Error("unconfigured");}',
};
registerHooks({resolve(s,c,next){if(s in mocks)return {url:'hs-mock:'+s,shortCircuit:true};if(s.startsWith('@/'))return {url:new URL('../src/'+s.slice(2)+'.ts',import.meta.url).href,shortCircuit:true};if(s.startsWith('.')&&!/\.[a-z]+$/.test(s)&&c.parentURL?.startsWith('file:')){const u=new URL(s+'.ts',c.parentURL);if(existsSync(u))return {url:u.href,shortCircuit:true};}return next(s,c);},load(u,c,next){if(u.startsWith('hs-mock:'))return {format:'module',source:mocks[u.slice(8)],shortCircuit:true};if(u.endsWith('.ts'))return {format:'module',source:ts.transpileModule(readFileSync(new URL(u),'utf8'),{compilerOptions:{module:ts.ModuleKind.ESNext,target:ts.ScriptTarget.ES2022}}).outputText,shortCircuit:true};return next(u,c);}});
const {servicesData}=await import('../src/lib/services/server.ts');
const {AccessDenied}=await import('@/lib/auth/authorization');
function reset(){return globalThis.hs={data:{module:'jobs',revision:1,today:'2026-10-26',month:'2026-10-01',isAdmin:true,isManager:true,rows:[],extra:{jobs:[]},classes:[],years:[],subjects:[]},error:null,signal:null};}
test('existing services reader forwards optional abort signal without changing scoped RPC',async()=>{const s=reset(),signal=AbortSignal.timeout(8000);const r=await servicesData('actor','session','jobs',{},signal);assert.equal(s.signal,signal);assert.deepEqual(s.args,{name:'app_services_read',args:{p_actor:'actor',p_session:'session',p_module:'jobs',p_filters:{}}});assert.equal(r.module,'jobs');});
test('legacy reader callers still await the query without a signal',async()=>{const s=reset();await servicesData('actor','session','jobs');assert.equal(s.signal,null);});
test('null/failed scoped RPC does not yield successful source data',async()=>{let s=reset();s.data=null;await assert.rejects(()=>servicesData('actor','session','jobs',{},AbortSignal.timeout(8000)),AccessDenied);s=reset();s.error={message:'private token'};await assert.rejects(()=>servicesData('actor','session','jobs',{},AbortSignal.timeout(8000)),e=>e.message==='Unavailable');});

const {securityState}=await import('../src/lib/auth/security.ts');
test('actual security reader forwards an optional deadline and preserves legacy callers',async()=>{
 for(const bounded of [false,true]){const s=reset();s.data={gate:'ready',destination:'/account',question_code:'q1',role:'teacher',can_set_question:false};const signal=bounded?AbortSignal.timeout(8000):undefined;assert.equal((await securityState('actor','session',signal)).gate,'ready');assert.equal(s.signal,signal??null);assert.deepEqual(s.args,{name:'app_security_state',args:{p_user:'actor',p_session:'session'}});}
});
test('security reader fails closed for aborted/error and malformed queries',async()=>{
 let s=reset();s.error={message:'private key'};await assert.rejects(()=>securityState('actor','session',AbortSignal.timeout(8000)),e=>e.message==='Security state unavailable');s=reset();s.data={gate:'ready'};await assert.rejects(()=>securityState('actor','session'));
});
