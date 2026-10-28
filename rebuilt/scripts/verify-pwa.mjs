/** Synthetic install boundary: never installs on a user's device or touches production data. */
import { createRequire } from 'node:module';
import { readFile, readdir, mkdtemp, mkdir, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { pathToFileURL } from 'node:url';
import { createServer } from 'node:http';
import assert from 'node:assert/strict';
const root=process.cwd(),req=createRequire(import.meta.url),tools=process.env.UI_TEST_TOOLS||join(root,'node_modules');
const {chromium}=req(join(tools,'playwright'));
const {build}=await import(pathToFileURL(join(tools,'esbuild/lib/main.js')));
const temp=await mkdtemp(join(tmpdir(),'sim-pwa-'));
await build({entryPoints:[join(root,'tests/ui/pwa-fixture.tsx')],outfile:join(temp,'app.js'),bundle:true,platform:'browser',format:'iife',jsx:'automatic',tsconfig:join(root,'tsconfig.json'),define:{'process.env.NODE_ENV':'"production"'}});
const cssFiles=(await readdir(join(root,'.next/static/chunks'))).filter(f=>f.endsWith('.css'));
const css=(await Promise.all(cssFiles.map(f=>readFile(join(root,'.next/static/chunks',f),'utf8')))).join('\n');
const script=await readFile(join(temp,'app.js'));
const server=createServer((q,s)=>{if(q.url==='/app.js'){s.setHeader('Content-Type','text/javascript');s.end(script);}else if(q.url==='/app.css'){s.setHeader('Content-Type','text/css');s.end(css);}else{s.setHeader('Content-Type','text/html');s.end('<!doctype html><html lang="id"><head><meta name="viewport" content="width=device-width,initial-scale=1"><title>PWA QA</title><link rel="stylesheet" href="/app.css"></head><body><div id="root"></div><script src="/app.js"></script></body></html>');}});
await new Promise(r=>server.listen(0,'127.0.0.1',r));
const browser=await chromium.launch({headless:true,executablePath:process.env.UI_CHROMIUM_EXECUTABLE,args:['--no-sandbox']});
let checks=0,axeChecks=0; const errors=[];
const check=(v,m)=>{assert.ok(v,m);checks++;};
try{
 const context=await browser.newContext();const page=await context.newPage();page.on('pageerror',e=>errors.push(e.message));
 const url=`http://127.0.0.1:${server.address().port}`;
 await page.goto(url);await page.getByRole('heading',{name:'SiM-Murid',exact:true}).waitFor();
 const launcher=()=>page.getByRole('button',{name:'Pasang aplikasi',exact:true});
 const dialog=()=>page.getByRole('dialog',{name:'Pasang SiM-Murid di perangkat',exact:true});
 const close=async()=>{await dialog().getByRole('button',{name:'Tutup dialog',exact:true}).click();await dialog().waitFor({state:'hidden'});await page.waitForFunction(()=>document.activeElement?.textContent?.trim()==='Pasang aplikasi');};
 check(await dialog().count()===0,'guide is not shown automatically');
 await page.getByLabel('Catatan').fill('draft tetap');await page.getByLabel('Catatan').focus();
 for(const width of [320,390,768,1280]){
  await page.setViewportSize({width,height:720});
  check(await page.evaluate(()=>document.querySelector('.pwa-install-footer').getBoundingClientRect().top>=document.querySelector('main').getBoundingClientRect().bottom-1),'launcher stays after main '+width);
  check(await launcher().evaluate(e=>getComputedStyle(e.parentElement).position==='static'),'no floating install overlay '+width);
  check(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),'no horizontal overflow '+width);
 }
 await launcher().click();await dialog().waitFor();
 check(await dialog().getByRole('button',{name:'Instal aplikasi',exact:true}).count()===0,'no fake install button');
 await close();await page.getByLabel('Catatan').focus();
 const offer=async(outcome)=>page.evaluate(outcome=>{window.prompts=0;const e=new Event('beforeinstallprompt',{cancelable:true});e.prompt=async()=>{window.prompts++;};e.userChoice=outcome==='reject'?Promise.resolve({outcome:'dismissed'}):Promise.resolve({outcome});if(outcome==='reject')e.prompt=async()=>{window.prompts++;throw new Error('synthetic');};window.dispatchEvent(e);return e.defaultPrevented;},outcome);
 check(await offer('dismissed'),'prevent native unsolicited prompt');
 check(await dialog().count()===0,'install availability never opens guide');
 check(await page.getByLabel('Catatan').evaluate(e=>e===document.activeElement),'availability preserves work focus');
 await launcher().click();
 await page.getByRole('button',{name:'Instal aplikasi',exact:true}).click();await page.getByText(/Instalasi dibatalkan/).waitFor();
 check(await page.evaluate(()=>window.prompts)===1,'strict mode listener and single prompt');
 check(await page.getByRole('button',{name:'Instal aplikasi',exact:true}).count()===0,'consumed event not reused');
 await close();
 check(await page.getByLabel('Catatan').inputValue()==='draft tetap','install never reloads draft');
 await launcher().click();
 await offer('reject');await page.getByRole('button',{name:'Instal aplikasi',exact:true}).click();await page.getByText(/Instalasi belum berhasil/).waitFor();checks++;
 await page.evaluate(()=>{window.prompts=0;const event=new Event('beforeinstallprompt',{cancelable:true});event.prompt=async()=>{window.prompts++;};event.userChoice=new Promise(resolve=>{window.finishInstallChoice=resolve;});window.dispatchEvent(event);});
 await page.getByRole('button',{name:'Instal aplikasi',exact:true}).evaluate(e=>{e.click();e.click();});
 check(await page.getByRole('button',{name:'Membuka instalasi…',exact:true}).isDisabled(),'pending install locked');
 await page.keyboard.press('Escape');check(await dialog().count()===1,'pending browser choice keeps dialog stable');
 check(await dialog().getByRole('button',{name:'Tutup dialog',exact:true}).isDisabled(),'pending close is explicit');
 check(await page.evaluate(()=>window.prompts)===1,'double click prompts once');
 await page.evaluate(()=>window.finishInstallChoice({outcome:'dismissed'}));await page.getByText(/Instalasi dibatalkan/).waitFor();
 await offer('accepted');await page.getByRole('button',{name:'Instal aplikasi',exact:true}).click();await page.getByText(/Permintaan instalasi diterima/).waitFor();checks++;
 await page.evaluate(()=>window.dispatchEvent(new Event('appinstalled')));
 await dialog().waitFor({state:'hidden'});check(await launcher().count()===0,'installed hides launcher');await page.waitForFunction(()=>document.activeElement?.id==='main-content');checks++;
 await page.evaluate(()=>{Object.defineProperty(navigator,'onLine',{configurable:true,value:false});window.dispatchEvent(new Event('offline'));});
 await page.getByText(/Perangkat terdeteksi offline/).waitFor();checks++;
 check(await page.getByLabel('Catatan').inputValue()==='draft tetap','offline keeps draft');
 await page.evaluate(()=>{Object.defineProperty(navigator,'onLine',{configurable:true,value:true});window.dispatchEvent(new Event('online'));});
 await page.getByText(/Perangkat terdeteksi offline/).waitFor({state:'hidden'});checks++;
 check(await page.evaluate(async()=>!(await navigator.serviceWorker.getRegistrations()).length),'no worker registered');
 check(await page.evaluate(async()=>!(await caches.keys()).length),'no application caches');
 const axe=await readFile(join(tools,'axe-core/axe.min.js'),'utf8');await page.addScriptTag({content:axe});
 check((await page.evaluate(()=>window.axe.run(document,{runOnly:{type:'tag',values:['wcag2a','wcag2aa','wcag21aa']}}))).violations.length===0,'axe installed');axeChecks++;
 await page.reload();await launcher().click();await page.addScriptTag({content:axe});
 check((await page.evaluate(()=>window.axe.run(document,{runOnly:{type:'tag',values:['wcag2a','wcag2aa','wcag21aa']}}))).violations.length===0,'axe guide');axeChecks++;

 for(const width of [320,390,768,1280]){
  await page.setViewportSize({width,height:568});
  const b=await dialog().boundingBox();check(b.x>=-1&&b.y>=-1&&b.x+b.width<=width+1&&b.y+b.height<=569,'dialog fits '+width);
  await page.keyboard.press('Tab');check(await dialog().evaluate(e=>e.contains(document.activeElement)),'dialog traps keyboard '+width);
 }
 for(const percent of [200,400]){
  await page.setViewportSize({width:320,height:700});await page.addStyleTag({content:`html{font-size:${percent}%}`});
  check(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),'page text '+percent);
  check(await dialog().evaluate(e=>e.scrollWidth<=e.clientWidth+1),'dialog text '+percent);
 }
 await page.addStyleTag({content:'html{font-size:100%}'});await page.keyboard.press('Escape');await dialog().waitFor({state:'hidden'});
 await page.waitForFunction(()=>document.activeElement?.textContent?.trim()==='Pasang aplikasi');check(true,'Escape restores launcher focus');
 await launcher().focus();await page.keyboard.press('Enter');await dialog().waitFor();check(true,'keyboard opens guide');await close();
 await page.setViewportSize({width:390,height:800});await page.getByLabel('Catatan').scrollIntoViewIfNeeded();
 const screenshotOut=process.env.PWA_QA_OUTPUT??'/tmp/pwa-footer-qa';await mkdir(screenshotOut,{recursive:true});await page.screenshot({path:join(screenshotOut,'working-mobile.png'),fullPage:true});
 await launcher().click();await page.screenshot({path:join(screenshotOut,'dialog-mobile.png')});await close();
 await page.getByLabel('Catatan').focus();await page.evaluate(()=>window.dispatchEvent(new Event('appinstalled')));await launcher().waitFor({state:'hidden'});
 check(await page.getByLabel('Catatan').evaluate(e=>e===document.activeElement),'installation outside guide never steals focus');
 await context.close();
 const standalone=await browser.newContext();await standalone.addInitScript(()=>{const native=window.matchMedia;window.matchMedia=q=>q==='(display-mode: standalone)'?{matches:true,addEventListener(){},removeEventListener(){}}:native.call(window,q);});
 const installed=await standalone.newPage();await installed.goto(url);await installed.getByRole('heading',{name:'SiM-Murid'}).waitFor();
 await installed.waitForTimeout(100);
 check(await installed.getByRole('button',{name:'Pasang aplikasi',exact:true}).count()===0,'standalone initial state hides launcher');
 check(errors.length===0,'no JavaScript errors');
 const out=process.env.PWA_QA_OUTPUT??'/tmp/pwa-footer-qa';await mkdir(out,{recursive:true});await writeFile(join(out,'browser.json'),JSON.stringify({checks,axeChecks,errors,synthetic:true,physicalDeviceInstall:'not tested',privateData:'none'},null,2)+'\n');
 console.log(JSON.stringify({checks,axeChecks,errors}));
}finally{await browser.close();await new Promise(r=>server.close(r));}
