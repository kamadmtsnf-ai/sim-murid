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
const checks=[],axeResults=[],errors=[];
const check=(v,name)=>{assert.ok(v,name);checks.push({name,passed:true});};
try{
 const url=`http://127.0.0.1:${server.address().port}`;
 const context=await browser.newContext();
 await context.addInitScript(()=>{
  window.pwaStandalone=false;window.pwaFullscreen=false;const listeners=new Set();const original=window.matchMedia.bind(window);
  window.setPwaMode=value=>{window.pwaStandalone=value;for(const f of listeners)f();};
  window.matchMedia=query=>query==='(display-mode: standalone)'?{get matches(){return window.pwaStandalone;},addEventListener(type,f){listeners.add(f);},removeEventListener(type,f){listeners.delete(f);}}:query==='(display-mode: fullscreen)'?{get matches(){return window.pwaFullscreen;},addEventListener(){},removeEventListener(){}}:original(query);
 });
 const page=await context.newPage();page.setDefaultTimeout(10000);page.on('pageerror',e=>errors.push(e.message));
 const launcher=()=>page.getByRole('button',{name:'Pasang aplikasi',exact:true});
 const dialog=()=>page.getByRole('dialog',{name:'Pasang SiM-Murid di perangkat',exact:true});
 const axe=await readFile(join(tools,'axe-core/axe.min.js'),'utf8');
 async function a11y(label){await page.evaluate(axe);const r=await page.evaluate(()=>window.axe.run(document,{runOnly:{type:'tag',values:['wcag2a','wcag2aa','wcag21aa','wcag22aa','best-practice']}}));axeResults.push({label,violations:r.violations.map(v=>({id:v.id,targets:v.nodes.map(n=>n.target)}))});check(!r.violations.length,label+' axe '+JSON.stringify(r.violations.map(v=>({id:v.id,targets:v.nodes.map(n=>n.target)}))));}
 async function geometry(label){check(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),label+' no page overflow');}
 const offer=async outcome=>page.evaluate(outcome=>{window.prompts=0;const e=new Event('beforeinstallprompt',{cancelable:true});e.prompt=async()=>{window.prompts++;if(outcome==='error')throw Error('synthetic');};e.userChoice=outcome==='pending'?new Promise(resolve=>window.finishPwaChoice=resolve):Promise.resolve({outcome});window.dispatchEvent(e);return e.defaultPrevented;},outcome);
 async function close(){await page.keyboard.press('Escape');await dialog().waitFor({state:'hidden'});await page.waitForFunction(()=>document.activeElement?.textContent?.trim()==='Pasang aplikasi');}
 await page.goto(url);await launcher().waitFor();check(await dialog().count()===0,'no unsolicited guide');
 await page.getByLabel('Catatan').fill('draft tetap');await page.getByLabel('Catatan').focus();check(await offer('dismissed'),'prevent unsolicited browser prompt');check(await page.getByLabel('Catatan').evaluate(e=>e===document.activeElement),'offer keeps work focus');
 for(const width of [320,390,768,1280]){
  await page.setViewportSize({width,height:800});check(await launcher().evaluate(e=>Boolean(e.closest('footer'))),'button in real footer '+width);check(await page.locator('.pwa-install-footer').count()===0,'no separate footer strip '+width);await geometry('footer'+width);
 }
 await launcher().click();await dialog().waitFor();await page.getByText(/Instalasi dibatalkan/).waitFor();check(await page.evaluate(()=>window.prompts)===1,'footer directly triggers one native prompt in StrictMode');check(await page.getByRole('button',{name:'Instal aplikasi',exact:true}).count()===0,'event consumed once');await close();check(await page.getByLabel('Catatan').inputValue()==='draft tetap','closing guide retains draft');
 await launcher().click();await offer('error');await page.getByRole('button',{name:'Instal aplikasi',exact:true}).click();await page.getByText(/Instalasi belum berhasil/).waitFor();check(true,'native prompt error explained');
 await offer('pending');await page.getByRole('button',{name:'Instal aplikasi',exact:true}).evaluate(e=>{e.click();e.click();});check(await page.getByRole('button',{name:'Membuka instalasi…',exact:true}).isDisabled(),'pending locked');check(await page.locator('footer .pwa-install-launcher').isDisabled(),'footer trigger locked while prompt pending');await page.keyboard.press('Escape');check(await dialog().count()===1,'pending Escape stable');check(await page.evaluate(()=>window.prompts)===1,'double prompt locked');await page.evaluate(()=>window.finishPwaChoice({outcome:'accepted'}));await page.getByText(/Permintaan instalasi diterima/).waitFor();await close();
 // All non-admin account content remains unavailable until actually launched standalone.
 await page.goto(url+'/?required=1');await page.getByRole('heading',{name:'Buka SiM-Murid melalui aplikasi',exact:true}).waitFor();
 check(await page.getByText('Konten layanan akun',{exact:true}).count()===0,'blocked content not mounted');await page.keyboard.press('Tab');await page.keyboard.press('Enter');await page.waitForFunction(()=>document.activeElement?.id==='main-content');check(true,'skip link reaches required screen');
 await page.evaluate(()=>{localStorage.setItem('pwa-installed','true');window.pwaFullscreen=true;});await page.getByRole('button',{name:'Periksa mode aplikasi',exact:true}).click();check(await page.getByText('Konten layanan akun',{exact:true}).count()===0,'localStorage and fullscreen cannot bypass gate');
 await offer('accepted');await page.getByRole('button',{name:'Instal aplikasi',exact:true}).click();await page.getByText(/Permintaan instalasi diterima/).waitFor();check(await page.getByText('Konten layanan akun',{exact:true}).count()===0,'accepted prompt does not unlock');
 await page.evaluate(()=>window.dispatchEvent(new Event('appinstalled')));await page.getByText(/Instalasi selesai/).waitFor();check(await page.getByText('Konten layanan akun',{exact:true}).count()===0,'appinstalled in browser does not unlock');
 check(await page.getByText(/Sudah terpasang pada perangkat/).isVisible(),'installed browser gives launch instructions');
 for(const width of [320,390,768,1280]){await page.setViewportSize({width,height:800});await geometry('gate'+width);await a11y('gate'+width);}
 for(const percent of [200,400]){await page.setViewportSize({width:320,height:700});await page.addStyleTag({content:`html{font-size:${percent}%}`});await geometry('gate text'+percent);}
 await page.addStyleTag({content:'html{font-size:100%}'});await launcher().click();await dialog().waitFor();await page.evaluate(()=>window.setPwaMode(true));await page.getByText('Konten layanan akun',{exact:true}).waitFor();await dialog().waitFor({state:'hidden'});await page.waitForFunction(()=>document.activeElement?.id==='main-content');check(true,'standalone admission restores main focus after guide closes');check(await launcher().count()===0,'standalone hides install button');check(await page.getByRole('heading',{name:'Buka SiM-Murid melalui aplikasi',exact:true}).count()===0,'standalone admits non-admin');
 await page.getByLabel('Catatan').fill('draft mode berubah');await page.evaluate(()=>window.setPwaMode(false));await page.getByRole('heading',{name:'Buka SiM-Murid melalui aplikasi',exact:true}).waitFor();check(await page.getByLabel('Catatan').isVisible()===false,'mode loss blocks interaction');check(await page.evaluate(()=>{const ids=Array.from(document.querySelectorAll('[id]')).map(e=>e.id);return new Set(ids).size===ids.length;}),'mode loss has no duplicate DOM IDs');await a11y('mode loss');await page.evaluate(()=>window.setPwaMode(true));await page.getByLabel('Catatan').waitFor();check(await page.getByLabel('Catatan').inputValue()==='draft mode berubah','mode loss preserves mounted draft');
 await page.evaluate(()=>{Object.defineProperty(navigator,'onLine',{configurable:true,value:false});window.dispatchEvent(new Event('offline'));});await page.getByText(/Perangkat terdeteksi offline/).waitFor();check(await page.getByLabel('Catatan').inputValue()==='draft mode berubah','offline retains draft');
 await page.goto(url);await page.getByText('Konten layanan akun',{exact:true}).waitFor();check(true,'admin/public requirement=false admits browser');
 // Platform guidance is selectable and does not claim an unsupported native prompt.
 await launcher().click();await dialog().getByRole('button',{name:'iPhone / iPad',exact:true}).click();check(await dialog().getByText(/Buka situs ini melalui Safari/).isVisible(),'iOS instructions');await dialog().getByRole('button',{name:'Android',exact:true}).click();check(await dialog().getByText(/Buka situs ini melalui Chrome atau Edge\./).isVisible(),'Android instructions');await a11y('guide');
 for(const percent of [200,400]){await page.setViewportSize({width:320,height:700});await page.addStyleTag({content:`html{font-size:${percent}%}`});await geometry('guide text'+percent);check(await dialog().evaluate(e=>e.scrollWidth<=e.clientWidth+1),'guide content text'+percent);}
 await page.addStyleTag({content:'html{font-size:100%}'});await close();
 // Logout remains possible behind the non-admin usage screen, with the existing confirmation.
 await page.goto(url+'/?required=1');let posts=0;await page.route('**/api/auth/logout',r=>{posts++;return r.fulfill({status:200,contentType:'text/html',body:'<!doctype html><html lang="id"><title>Logout QA</title><body>Keluar</body></html>'});});
 await page.getByRole('button',{name:'Keluar akun',exact:true}).click();await page.getByRole('alertdialog').getByRole('button',{name:'Tetap di aplikasi',exact:true}).click();check(posts===0,'cancel logout never sends');await page.getByRole('alertdialog').waitFor({state:'hidden'});await page.getByRole('button',{name:'Keluar akun',exact:true}).click();await page.getByRole('alertdialog').getByRole('button',{name:'Ya, keluar',exact:true}).click();await page.waitForURL('**/api/auth/logout');check(posts===1,'confirmed logout sends once');
 const ios=await browser.newContext();await ios.addInitScript(()=>Object.defineProperty(navigator,'standalone',{value:true,configurable:true}));const iosPage=await ios.newPage();await iosPage.goto(url+'/?required=1');await iosPage.getByText('Konten layanan akun',{exact:true}).waitFor();check(true,'iOS standalone admitted');await ios.close();
 await page.goto(url+'/?required=1');await page.getByRole('heading',{name:'Buka SiM-Murid melalui aplikasi',exact:true}).waitFor();await page.setViewportSize({width:390,height:844});
 const out=process.env.PWA_QA_OUTPUT??'/tmp/pwa-required-qa';await mkdir(out,{recursive:true});await page.screenshot({path:join(out,'required-mobile.png'),fullPage:true});await page.setViewportSize({width:1280,height:900});await page.screenshot({path:join(out,'required-desktop.png'),fullPage:true});
 check(await page.evaluate(async()=>!(await navigator.serviceWorker.getRegistrations()).length),'no worker registered');check(await page.evaluate(async()=>!(await caches.keys()).length),'no private application caches');check(!errors.length,'no JavaScript errors');
 await writeFile(join(out,'browser.json'),JSON.stringify({checks,axe:axeResults,errors,synthetic:true,physicalDeviceInstall:'not tested',limits:['Display mode is a client usage signal, not proof of OS installation or an authorization credential','No authenticated production role UAT or real installation']},null,2)+'\n');console.log(JSON.stringify({checks:checks.length,axe:axeResults.length,errors}));
 await context.close();
}finally{await browser.close();await new Promise(r=>server.close(r));}
