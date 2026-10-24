/** Dashboard server-flow regressions with dependency-boundary mocks, never a production identity. */
import test from 'node:test';
import assert from 'node:assert/strict';
import {registerHooks} from 'node:module';
import {readFileSync} from 'node:fs';
import ts from 'typescript';
const mocks={
 '@/lib/dashboard/server':`export const readDailyOverview=async(client,caller)=>{globalThis.dashboardMocks.overviewCalls.push(caller);return globalThis.dashboardMocks.overview;};`,
 '@/lib/auth/read-server':`export const readServerAuthClient=async()=>{if(globalThis.dashboardMocks.clientError)throw Error('private client detail');return {fixture:true}};`,
 '@/lib/auth/http':`export const verifiedPrincipal=async()=>{if(globalThis.dashboardMocks.principalError)throw Error('private principal detail');return globalThis.dashboardMocks.caller};`,
 '@/lib/auth/security':`export const securityState=async(...args)=>{globalThis.dashboardMocks.securityCalls.push(args);if(globalThis.dashboardMocks.securityError)throw Error('private security detail');return globalThis.dashboardMocks.onboarding};`,
 '@/lib/auth/admin':`export const createAuthAdmin=()=>({rpc:async(...args)=>{globalThis.dashboardMocks.rpcCalls.push(args);return globalThis.dashboardMocks.survey}});`,
 '@/lib/auth/authorization':`export const loadAccessContext=async()=>{if(globalThis.dashboardMocks.accessError)throw Error('private access detail');return globalThis.dashboardMocks.access};`,
 '@/components/account-dashboard':`export const AccountDashboard=()=>null;`,
 '@/components/workspace-shell':`export const WorkspaceShell=()=>null;`,
 'next/navigation':`export const redirect=destination=>{const error=new Error('NEXT_REDIRECT');error.destination=destination;throw error};`,
};
registerHooks({
 resolve(specifier,context,next){if(specifier in mocks)return {url:'dashboard-mock:'+specifier,shortCircuit:true};if(specifier==='@/config/account-navigation')return {url:new URL('../src/config/account-navigation.ts',import.meta.url).href,shortCircuit:true};return next(specifier,context);},
 load(url,context,next){if(url.startsWith('dashboard-mock:'))return {format:'module',source:mocks[url.slice('dashboard-mock:'.length)],shortCircuit:true};if(/\.tsx?$/.test(url))return {format:'module',source:ts.transpileModule(readFileSync(new URL(url),'utf8'),{compilerOptions:{module:ts.ModuleKind.ESNext,target:ts.ScriptTarget.ES2022,jsx:ts.JsxEmit.ReactJSX}}).outputText,shortCircuit:true};return next(url,context);}
});
const {default:page}=await import('../src/app/account/page.tsx');
const {default:layout}=await import('../src/app/account/layout.tsx');
function reset(){globalThis.dashboardMocks={caller:{principal:{id:'11111111-1111-4111-8111-111111111111',full_name:'Synthetic account',username:'qa-dashboard',expires_at:'2026-10-22T00:00:00Z',is_admin:false},sessionId:'synthetic-session'},onboarding:{gate:'ready'},survey:{data:false,error:null},access:{grants:[]},overviewCalls:[],overview:{contextReady:false},securityCalls:[],rpcCalls:[]};return globalThis.dashboardMocks;}
async function redirects(fn,destination){await assert.rejects(fn,error=>error.message==='NEXT_REDIRECT'&&error.destination===destination);}
test('Anonymous Dashboard preserves login redirect without invoking privileged gates',async()=>{const state=reset();state.caller=null;await redirects(page,'/login?expired=1');assert.deepEqual(state.securityCalls,[]);assert.deepEqual(state.rpcCalls,[]);});
test('Dashboard preserves every onboarding gate before the mandatory survey check',async()=>{for(const gate of ['password','profile_pending','security_question','email_pending','survey_pending','account_pending',null]){const state=reset();state.onboarding=gate===null?null:{gate};await redirects(page,'/account/security');assert.deepEqual(state.rpcCalls,[]);assert.deepEqual(state.securityCalls,[[state.caller.principal.id,state.caller.sessionId]]);}});
test('Dashboard survey gate keeps actor/session contract and redirects before rendering',async()=>{const state=reset();state.survey={data:true,error:null};await redirects(page,'/account/services/surveys');assert.deepEqual(state.rpcCalls,[['app_survey_required',{p_actor:state.caller.principal.id,p_session:state.caller.sessionId}]]);});
test('Verified ready Dashboard receives the unchanged identity and expiry',async()=>{const state=reset();const result=await page();assert.deepEqual(result.props,{name:state.caller.principal.full_name,expiresAt:state.caller.principal.expires_at,overview:state.overview});assert.deepEqual(state.overviewCalls,[state.caller]);assert.equal(state.rpcCalls.length,1);});
test('Auth, configuration and onboarding outages enter the retryable error boundary with safe errors',async()=>{for(const flag of ['clientError','principalError','securityError']){const state=reset();state[flag]=true;await assert.rejects(page,error=>error.message==='Account verification unavailable'&&!error.message.includes('private'));assert.deepEqual(state.rpcCalls,[]);}});
test('Unavailable mandatory survey check never renders a Dashboard',async()=>{const state=reset();state.survey={data:null,error:{message:'private survey detail'}};await assert.rejects(page,error=>error.message==='Survey access check unavailable');});
test('Empty legitimate grants differ from unavailable navigation without granting capabilities',async()=>{let state=reset();let result=await layout({children:'content'});assert.equal(result.props.navigationUnavailable,false);assert.equal(result.props.children,'content');assert.ok(result.props.navigation.flatMap(g=>g.items).every(i=>!i.adminOnly&&!i.capabilities));for(const missing of ['null','error']){state=reset();if(missing==='null')state.access=null;else state.accessError=true;result=await layout({children:'content'});assert.equal(result.props.navigationUnavailable,true);assert.ok(result.props.navigation.flatMap(g=>g.items).every(i=>!i.adminOnly&&!i.capabilities));}});
test('Navigation still uses verified admin identity and actual grants',async()=>{let state=reset();state.access={grants:[{capability:'grades.read'}]};let result=await layout({children:'content'});const items=result.props.navigation.flatMap(g=>g.items);assert.ok(items.some(i=>i.href==='/account/learning/grades'));assert.ok(!items.some(i=>i.href==='/account/operations/fees'));state=reset();state.caller.principal.is_admin=true;result=await layout({children:'content'});assert.ok(result.props.navigation.flatMap(g=>g.items).some(i=>i.adminOnly));});
test('Layout does not fabricate account context on anonymous or unavailable authentication',async()=>{for(const flag of ['anonymous','clientError','principalError']){const state=reset();if(flag==='anonymous')state.caller=null;else state[flag]=true;assert.equal(await layout({children:'content'}),'content');}});

test('Malformed required-survey results fail closed before reading overview',async()=>{for(const data of [null,{},'false',0]){const state=reset();state.survey={data,error:null};await assert.rejects(page,/Survey access check unavailable/);assert.deepEqual(state.overviewCalls,[]);}});
