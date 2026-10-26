/** QA-only web-vitals/Playwright; starts a loopback production build, never an external target. */
import {createRequire} from 'node:module';
import {spawn} from 'node:child_process';
import {readFile,writeFile} from 'node:fs/promises';
import {join} from 'node:path';
import {summarize} from './statistics.mjs';
import {createServer} from 'node:net';
const tools=process.env.UI_TEST_TOOLS;
if(!tools)throw Error('UI_TEST_TOOLS must point to isolated QA dependencies');
const require=createRequire(import.meta.url),{chromium}=require(join(tools,'playwright'));
const vitals=await readFile(join(tools,'web-vitals/dist/web-vitals.iife.js'),'utf8');
const origin='http://127.0.0.1:3139';
// Refuse an occupied port rather than accidentally measure another local application.
await new Promise((resolve,reject)=>{const probe=createServer();probe.once('error',reject);probe.listen(3139,'127.0.0.1',()=>probe.close(resolve));});
const server=spawn(process.execPath,['node_modules/next/dist/bin/next','start','--hostname','127.0.0.1','--port','3139'],{env:{...process.env,RECAPTCHA_ENABLED:'false'},stdio:'ignore'});
const errors=[],blockedWrites=[],samples=[];
let browser;
try{
 let ready=false;for(let i=0;i<100;i++){try{const r=await fetch(origin);if(r.ok){ready=true;break;}}catch{}await new Promise(r=>setTimeout(r,200));}
 if(!ready || server.exitCode!==null)throw Error('Loopback server did not become ready');
 browser=await chromium.launch({headless:true,executablePath:process.env.UI_CHROMIUM_EXECUTABLE,args:['--no-sandbox']});
 for(const device of ['desktop','mobile-emulated'])for(const path of ['/','/login','/recovery'])for(let n=0;n<5;n++){
  const context=await browser.newContext({viewport:device==='desktop'?{width:1366,height:900}:{width:390,height:844}});
  await context.route('**/*',async route=>{const r=route.request();if(!['GET','HEAD'].includes(r.method())){blockedWrites.push({method:r.method(),path:new URL(r.url()).pathname});return route.abort();}if(new URL(r.url()).origin!==origin)return route.abort();return route.continue();});
  await context.addInitScript({content:`${vitals}\nwindow.labMetrics={};for(const [key,fn] of Object.entries({LCP:webVitals.onLCP,INP:webVitals.onINP,CLS:webVitals.onCLS}))fn(m=>window.labMetrics[key]=m.value,{reportAllChanges:true});`});
  const page=await context.newPage();page.on('pageerror',e=>errors.push(e.message));
  const cdp=await context.newCDPSession(page);await cdp.send('Network.enable');await cdp.send('Network.setCacheDisabled',{cacheDisabled:true});
  if(device!=='desktop'){await cdp.send('Emulation.setCPUThrottlingRate',{rate:4});await cdp.send('Network.emulateNetworkConditions',{offline:false,latency:40,downloadThroughput:200000,uploadThroughput:100000});}
  await page.goto(origin+path,{waitUntil:'networkidle'});
  const textbox=page.getByRole('textbox').first();if(await textbox.count())await textbox.fill('lab-synthetic');
  const toggle=page.getByRole('button',{name:/tampilkan password/i}).first();if(await toggle.count())await toggle.click();
  await page.waitForTimeout(500);
  await page.evaluate(()=>{Object.defineProperty(document,'visibilityState',{configurable:true,get:()=> 'hidden'});document.dispatchEvent(new Event('visibilitychange'));});
  await page.waitForTimeout(100);
  samples.push({device,path,...await page.evaluate(()=>{const nav=performance.getEntriesByType('navigation')[0];return {...window.labMetrics,TTFB:nav.responseStart,DOMContentLoaded:nav.domContentLoadedEventEnd};})});
  await context.close();
 }
 const groups=[];for(const device of ['desktop','mobile-emulated'])for(const path of ['/','/login','/recovery']){const rows=samples.filter(s=>s.device===device&&s.path===path);groups.push({device,path,metrics:Object.fromEntries(['LCP','INP','CLS','TTFB','DOMContentLoaded'].map(k=>[k,summarize(rows.map(r=>r[k]))]))});}
 if(errors.length||blockedWrites.length)throw Error(JSON.stringify({errors,blockedWrites}));
 await writeFile(process.argv[2]??'/tmp/l09-public.json',JSON.stringify({kind:'lab, public control pages only; not authenticated/field CWV',buildId:(await readFile('.next/BUILD_ID','utf8')).trim(),browser:browser.version(),webVitalsVersion:'5.1.0',method:'5 fresh HTTP-cache-disabled contexts per page/device; desktop CPU1/unthrottled; mobile CPU4 RTT40ms down200000Bps up100000Bps; warmed local server; captcha disabled locally; input only, no submit; visibility flush at observation end',groups,samples,errors,blockedWrites},null,2)+'\n');
}finally{await browser?.close();server.kill('SIGTERM');}
