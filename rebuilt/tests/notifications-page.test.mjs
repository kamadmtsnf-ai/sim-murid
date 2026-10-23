import test from 'node:test';
import assert from 'node:assert/strict';
import {registerHooks} from 'node:module';
import {readFileSync} from 'node:fs';
import ts from 'typescript';
const sources={
 '@/lib/auth/authorization':`export class AccessDenied extends Error{};`,
 'next/navigation':`export const redirect=url=>{const e=new Error('redirect');e.url=url;throw e};export const notFound=()=>{throw Error('not found')};`,
 '@/lib/auth/read-server':`export const readServerPrincipal=async()=>globalThis.notificationPage.caller;`,
 '@/lib/services/server':`export const servicesData=async(...args)=>{globalThis.notificationPage.args=args;if(globalThis.notificationPage.fail)throw Error('private database detail');return globalThis.notificationPage.data};`,
 './panel':`export const ServicesPanel=()=>null;`,
};
registerHooks({resolve(specifier,context,next){if(specifier in sources)return {url:'notification-page:'+specifier,shortCircuit:true};if(specifier==='@/lib/services/validation')return {url:new URL('../src/lib/services/validation.ts',import.meta.url).href,shortCircuit:true};return next(specifier,context);},load(url,context,next){if(url.startsWith('notification-page:'))return {format:'module',source:sources[url.slice('notification-page:'.length)],shortCircuit:true};if(/\.tsx?$/.test(url))return {format:'module',source:ts.transpileModule(readFileSync(new URL(url),'utf8'),{compilerOptions:{module:ts.ModuleKind.ESNext,target:ts.ScriptTarget.ES2022,jsx:ts.JsxEmit.ReactJSX}}).outputText,shortCircuit:true};return next(url,context);}});
const {default:page}=await import('../src/app/account/services/[module]/page.tsx');
function reset(){return globalThis.notificationPage={caller:{principal:{id:'synthetic-user'},sessionId:'synthetic-session'},data:{module:'notifications'},fail:false};}
const params=module=>({params:Promise.resolve({module})});
test('Notifications page preserves identity/session and successful server data',async()=>{const state=reset();const output=await page(params('notifications'));assert.deepEqual(state.args,['synthetic-user','synthetic-session','notifications']);assert.equal(output.type,'main');assert.equal(output.props.children[1].props.initial,state.data);});
test('Notifications page retains login redirect and invalid-module boundary',async()=>{reset().caller=null;await assert.rejects(()=>page(params('notifications')),error=>error.url==='/login?expired=1');reset();await assert.rejects(()=>page(params('invalid')),/not found/);});
test('Notifications load failures enter existing retry boundary; jobs and reconciliation outages also use retry boundaries',async()=>{reset().fail=true;await assert.rejects(()=>page(params('notifications')),error=>error.message==='Notifications unavailable');reset().fail=true;await assert.rejects(()=>page(params('jobs')),/Jobs unavailable/);await assert.rejects(()=>page(params('reconciliation')),/Reconciliation unavailable/);});
