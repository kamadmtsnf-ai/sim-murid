/** Server Login gating and notices; verified-session implementation is tested separately. */
import test from 'node:test';import assert from 'node:assert/strict';import {registerHooks} from 'node:module';import {readFileSync} from 'node:fs';import ts from 'typescript';
const sources={
 'next/headers':`export const cookies=async()=>({getAll:()=>globalThis.loginPageMocks.cookies});`,
 'next/navigation':`export const redirect=destination=>{const error=Error('redirect');error.destination=destination;throw error;};`,
 'next/link':`export default function Link(){return null;}`,
 '@/lib/auth/read-server':`export const readServerAuthClient=async()=>{globalThis.loginPageMocks.clientCalls++;if(globalThis.loginPageMocks.clientError)throw Error('private client');return {}};`,
 '@/lib/auth/http':`export const verifiedPrincipal=async()=>{globalThis.loginPageMocks.verifyCalls++;if(globalThis.loginPageMocks.verifyError)throw Error('private auth');return globalThis.loginPageMocks.caller;};`,
 '@/components/ui/card':`export function Card(){return null}export function CardHeader(){return null}export function CardDescription(){return null}export function CardContent(){return null}`,
 '@/components/ui/status':`export function Status(){return null}`,
 './login-form':`export function LoginForm(){return null}`,
 './login-shell':`export function LoginShell(){return null}`,
 './login.module.css':`export default new Proxy({},{get:(_,key)=>key});`,
};
registerHooks({resolve(specifier,context,next){if(specifier in sources)return {url:'login-page:'+specifier,shortCircuit:true};return next(specifier,context);},load(url,context,next){if(url.startsWith('login-page:'))return {format:'module',source:sources[url.slice(11)],shortCircuit:true};if(url.endsWith('.tsx'))return {format:'module',source:ts.transpileModule(readFileSync(new URL(url),'utf8'),{compilerOptions:{module:ts.ModuleKind.ESNext,target:ts.ScriptTarget.ES2022,jsx:ts.JsxEmit.ReactJSX}}).outputText,shortCircuit:true};return next(url,context);}});
const {default:page}=await import('../src/app/login/page.tsx');
function reset(){return globalThis.loginPageMocks={cookies:[],caller:null,clientCalls:0,verifyCalls:0};}
function elements(node,predicate){if(!node||typeof node!=='object')return [];const children=node.type==='noscript'?undefined:node.props?.children;return [...(predicate(node)?[node]:[]),...(Array.isArray(children)?children.flatMap(x=>elements(x,predicate)):elements(children,predicate))];}
const render=query=>page({searchParams:Promise.resolve(query)});
test('Anonymous login renders form without configuring or calling Auth',async()=>{const s=reset();const result=await render({});assert.equal(elements(result,n=>n.type?.name==='LoginForm').length,1);assert.equal(s.clientCalls,0);assert.equal(s.verifyCalls,0);});
test('Only verified existing session redirects; cookie names alone grant no access',async()=>{let s=reset();s.cookies=[{name:'sb-fixture',value:'untrusted'}];s.caller={principal:{id:'synthetic'}};await assert.rejects(render({}),e=>e.destination==='/account');assert.equal(s.verifyCalls,1);s=reset();s.cookies=[{name:'sb-fixture',value:'untrusted'}];assert.equal(elements(await render({}),n=>n.type?.name==='LoginForm').length,1);assert.equal(s.verifyCalls,1);});
test('Verification/configuration outage keeps public login form available without internal details',async()=>{for(const flag of ['clientError','verifyError']){const s=reset();s.cookies=[{name:'sb-fixture'}];s[flag]=true;const output=await render({});assert.equal(elements(output,n=>n.type?.name==='LoginForm').length,1);assert.equal(JSON.stringify(output).includes('private'),false);}});
test('Login notices preserve each flow and give pending/changed precedence over conflicting flags',async()=>{for(const [query,text] of [[{logout:'1'},'Anda berhasil keluar.'],[{expired:'1'},'Sesi tidak berlaku.'],[{password:'changed'},'Password berhasil diperbarui.'],[{password:'pending'},'Sesi diakhiri untuk keamanan.'],[{password:'pending',expired:'1',logout:'1'},'Sesi diakhiri untuk keamanan.'],[{password:'changed',expired:'1'},'Password berhasil diperbarui.']]){reset();const notices=elements(await render(query),n=>n.type?.name==='Status');assert.equal(notices.length,1);assert.ok(notices[0].props.children.startsWith(text));}});
test('Unknown/repeated query flags never fabricate success or account access',async()=>{reset();const output=await render({logout:['1','0'],expired:'0',password:'unexpected'});assert.equal(elements(output,n=>n.type?.name==='Status').length,0);assert.equal(elements(output,n=>n.type?.name==='LoginForm').length,1);});

test('No-JavaScript branch provides explicit help and hides the credential form',async()=>{reset();const branch=elements(await render({}),n=>n.type==='noscript');assert.equal(branch.length,1);const text=JSON.stringify(branch[0]);assert.match(text,/Aktifkan JavaScript/);assert.match(text,/display:none/);});
