/** Isolated Notifications browser regression suite. No real account, API mutation or production data. */
import {createRequire} from 'node:module';
import {readFile,writeFile,mkdir,readdir,mkdtemp} from 'node:fs/promises';
import {createServer} from 'node:http';
import {join} from 'node:path';
import {tmpdir} from 'node:os';
import {pathToFileURL} from 'node:url';
import assert from 'node:assert/strict';
const root=process.cwd();
const out=process.env.NOTIFICATIONS_QA_OUTPUT??join(root,'docs/verification/notifications');await mkdir(out,{recursive:true});
const temp=await mkdtemp(join(tmpdir(),'sim-notifications-'));
const req=createRequire(import.meta.url),runtime=process.env.CODEX_PRIMARY_RUNTIME_NODE_MODULES;
const {chromium}=runtime?req(join(runtime,'playwright')):req('playwright');
const tools=process.env.UI_TEST_TOOLS??join(root,'node_modules');
const {build}=await import(pathToFileURL(join(tools,'esbuild/lib/main.js')));
const axe=await readFile(join(tools,'axe-core/axe.min.js'),'utf8');
await build({entryPoints:[join(root,'tests/ui/notifications-fixture.tsx')],outfile:join(temp,'fixture.js'),bundle:true,platform:'browser',format:'iife',jsx:'automatic',tsconfig:join(root,'tsconfig.json'),define:{'process.env.NODE_ENV':'"production"','process.env':'{}'},plugins:[{name:'fixture-navigation',setup(b){b.onResolve({filter:/^next\/navigation$/},()=>({path:join(root,'tests/ui/notifications-navigation-shim.ts')}));}}]});
const css=[];async function styles(dir){for(const f of await readdir(dir,{withFileTypes:true})){const p=join(dir,f.name);if(f.isDirectory())await styles(p);else if(p.endsWith('.css'))css.push(await readFile(p,'utf8'));}}await styles(process.env.UI_CSS_ROOT??join(root,'.next/static'));
const server=createServer(async(request,response)=>{
 if(request.url==='/fixture.js'){response.setHeader('Content-Type','text/javascript');response.end(await readFile(join(temp,'fixture.js')));}
 else if(request.url==='/fixture.css'){response.setHeader('Content-Type','text/css');response.end(css.join('\n'));}
 else{response.setHeader('Content-Type','text/html');response.end('<!doctype html><html lang="id"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Notifikasi QA SiM-Murid</title><link rel="stylesheet" href="/fixture.css"></head><body><a class="sr-only focus:not-sr-only" href="#main-content">Lewati ke konten utama</a><div id="root"></div><script src="/fixture.js"></script></body></html>');}
});await new Promise(r=>server.listen(0,'127.0.0.1',r));const base=`http://127.0.0.1:${server.address().port}`;
const checks=[],errors=[],axeResults=[];let browser;
function pass(name){checks.push(name);}
async function overflow(page,label){const size=await page.evaluate(()=>({viewport:innerWidth,document:document.documentElement.scrollWidth}));assert.ok(size.document<=size.viewport+1,label+': '+JSON.stringify(size));pass(label+' — no horizontal overflow');}
async function a11y(page,label){await page.evaluate(axe);const r=await page.evaluate(()=>window.axe.run(document,{runOnly:{type:'tag',values:['wcag2a','wcag2aa','wcag21aa','best-practice']}}));axeResults.push({label,violations:r.violations.map(v=>({id:v.id,impact:v.impact,targets:v.nodes.map(n=>n.target)}))});assert.deepEqual(r.violations,[],label);pass(label+' — axe violations 0');}
try{
 browser=await chromium.launch({headless:true,executablePath:process.env.UI_CHROMIUM_EXECUTABLE,args:['--no-sandbox','--disable-dev-shm-usage','--use-gl=angle','--use-angle=swiftshader','--disable-gpu']});
 const context=await browser.newContext({hasTouch:true,reducedMotion:'reduce'}),page=await context.newPage();page.setDefaultTimeout(10000);
 const networkErrors=[];page.on('pageerror',e=>errors.push(e.message));page.on('console',m=>{if(m.type()==='error'){if(m.text().startsWith('Failed to load resource:'))networkErrors.push(m.text());else errors.push(m.text());}});
 let data,mode='success',posts=[],gets=0;
 await page.route('**/api/services/notifications',async route=>{
  const writing=route.request().method()==='POST';
  if(writing){
   const payload=route.request().postDataJSON();posts.push(payload);
   if(mode==='post-network'){await route.abort('failed');return;}
   if(mode==='post-nonjson'){await route.fulfill({status:200,body:'<html>Unavailable</html>',contentType:'text/html'});return;}
   if(mode==='post-malformed'){await route.fulfill({json:{message:'not saved'}});return;}
   if(mode==='post-403'||mode==='post-409'){await route.fulfill({status:mode==='post-403'?403:409,json:{result:{code:'denied'},message:'synthetic internal detail'}});return;}
   assert.equal(payload.revision,data.revision);assert.match(payload.requestId,/^[a-f\d-]{36}$/);assert.deepEqual(Object.keys(payload).sort(),['command','requestId','revision']);assert.equal(payload.command.type,'read');
   const id=payload.command.id;assert.ok(id===null||data.rows.some(r=>r.id===id));
   const changed=data.rows.filter(r=>!r.read_at&&(id===null||r.id===id));for(const row of changed)row.read_at='2026-10-21T11:00:00Z';data.extra.unread=id===null?0:data.extra.unread-changed.length;data.revision++;
   await new Promise(r=>setTimeout(r,150));await route.fulfill({json:{result:{code:'saved'},message:'Perubahan disimpan.'}});
  }else{
   gets++;
   if(mode==='get-fail'){await route.fulfill({status:503,json:{message:'Unavailable'}});return;}
   if(mode==='get-malformed'){await route.fulfill({json:{data:{module:'jobs',rows:[]}}});return;}
   if(mode==='get-nonjson'){await route.fulfill({body:'<html>Unavailable</html>',contentType:'text/html'});return;}
   await route.fulfill({json:{data}});
  }
 });
 async function visit(scenario='normal',width=375,height=812){mode='success';posts=[];gets=0;await page.setViewportSize({width,height});await page.goto(base+'/?scenario='+scenario);await page.getByRole('heading',{name:'Kotak masuk Anda',exact:true}).waitFor();data=await page.evaluate(()=>structuredClone(window.notificationFixture));}
 const read=()=>page.getByRole('button',{name:/^Tandai dibaca:/});
 const reload=()=>page.getByRole('button',{name:'Muat ulang daftar',exact:true});
 async function settled(){await page.waitForFunction(()=>document.querySelector('section[aria-labelledby="notification-results-title"]')?.getAttribute('aria-busy')==='false');}
 for(const width of [320,360,375,390,768,1024,1280,1440]){await visit('normal',width,900);await overflow(page,'normal '+width);await page.screenshot({path:join(out,'notifications-'+width+'.png'),fullPage:true});}
 for(const scenario of ['empty','many','long','invalid-date']){
  for(const width of [320, 390, 768, 1440]){await visit(scenario,width,900);await overflow(page,scenario+' '+width);}
  await a11y(page,scenario);
  if(scenario==='empty'){await page.getByText('Belum ada notifikasi.',{exact:true}).waitFor();assert.equal(await page.getByRole('button',{name:'Tandai semua dibaca'}).isDisabled(),true);pass('Empty inbox disables mark-all and explains empty state');}
  if(scenario==='invalid-date'){assert.equal(await page.locator('time').count(),0);assert.equal(await page.getByText('Waktu tidak tersedia',{exact:true}).count(),3);pass('Invalid dates render a safe fallback');}
  if(scenario==='many'){
   assert.equal(await page.locator('article').count(),20);await page.getByText(/jumlah belum dibaca dan tindakan tandai semua mencakup seluruh kotak masuk/).waitFor();
   for(let n=0;n<9;n++)await page.getByRole('button',{name:'Berikutnya',exact:true}).click();assert.equal(await page.getByRole('button',{name:'Berikutnya'}).isDisabled(),true);await page.getByRole('heading',{name:'Pemberitahuan 200',exact:true}).waitFor();
   await page.getByRole('searchbox',{name:'Cari notifikasi'}).fill('Pemberitahuan 1');await page.getByText('Halaman 1 dari 6',{exact:true}).waitFor();pass('Pagination preserves all 200 rows and resets after search');
  }
 }
 await visit('normal',1440,900);await a11y(page,'normal desktop');assert.equal(await page.locator('main a').count(),0);pass('No duplicated module navigation');
 assert.match(await page.locator('time').first().innerText(),/21 Okt 2026, 16.30 WIB/);pass('Notification dates use id-ID and Asia/Jakarta');
 const search=page.getByRole('searchbox',{name:'Cari notifikasi'}),status=page.getByRole('combobox',{name:'Status notifikasi'});
 await search.fill('  PEMBERITAHUAN 2 ');assert.equal(await page.locator('article').count(),1);await search.fill('tidak ditemukan');await page.getByText('Tidak ada notifikasi yang cocok.',{exact:true}).waitFor();await a11y(page,'empty search results');await page.getByRole('button',{name:'Reset pencarian dan filter'}).click();assert.equal(await page.locator('article').count(),3);await status.selectOption('read');assert.equal(await page.locator('article').count(),1);await status.selectOption('unread');assert.equal(await page.locator('article').count(),2);pass('Search, status filters, empty results and reset work locally');
 await read().first().evaluate(e=>{e.click();e.click();});await page.getByRole('status').filter({hasText:'Menyimpan status'}).waitFor();assert.equal(await reload().isDisabled(),true);await settled();assert.equal(posts.length,1);assert.equal(gets,1);assert.equal(await page.locator('article').count(),1);assert.equal(await page.getByRole('heading',{name:'Daftar notifikasi',exact:true}).evaluate(e=>e===document.activeElement),true);pass('Rapid double-click produces one POST; reload is locked and focus survives unread filtering');
 await page.getByRole('button',{name:'Tandai semua dibaca'}).click();await settled();assert.equal(posts.at(-1).command.id,null);assert.equal(await page.getByRole('button',{name:'Tandai semua dibaca'}).isDisabled(),true);assert.equal(await page.locator('article').count(),0);await page.getByRole('status').filter({hasText:'Semua notifikasi ditandai dibaca.'}).waitFor();pass('Mark-all keeps null-ID contract and updates total unread');
 await visit();mode='get-fail';await read().first().click();await settled();await page.getByRole('alert').filter({hasText:'Perubahan tersimpan, tetapi daftar belum berhasil diperbarui.'}).waitFor();assert.equal(await read().first().isDisabled(),true);assert.equal(await page.getByRole('button',{name:'Tandai semua dibaca'}).isDisabled(),true);assert.equal(posts.length,1);await a11y(page,'saved write with refresh error');mode='success';await reload().click();await settled();assert.equal(posts.length,1);assert.equal(await read().count(),1);await page.getByRole('status').filter({hasText:'Daftar notifikasi diperbarui.'}).waitFor();pass('Committed write with failed refresh blocks writes until GET reconciles, without reposting');
 for(const failure of ['post-network','post-nonjson','post-malformed','post-403','post-409']){
  await visit();mode=failure;await read().first().click();await settled();await page.getByRole('alert').waitFor();assert.equal(await read().first().isDisabled(),true);assert.equal(await page.getByText('synthetic internal detail').count(),0);mode='success';await reload().click();await settled();assert.equal(await read().first().isEnabled(),true);assert.equal(posts.length,1);pass(failure+' gives safe feedback and recovers via GET');
 }
 for(const failure of ['get-fail','get-malformed','get-nonjson']){
  await visit();mode=failure;await reload().click();await settled();await page.getByRole('alert').waitFor();assert.equal(await page.locator('article').count(),3);mode='success';await reload().click();await settled();assert.equal(await page.getByRole('alert').count(),0);pass(failure+' retains data and recovers without corrupting state');
 }
 await visit('long',320,812);await page.addStyleTag({content:'html{font-size:200%}'});await overflow(page,'long content at 200 percent text');await page.locator('footer').scrollIntoViewIfNeeded();assert.ok(await page.locator('footer').isVisible());pass('Long content remains vertically scrollable to footer');await page.setViewportSize({width:1024,height:900});await overflow(page,'200 percent text at desktop breakpoint');
 await visit('many',375,812);await page.getByRole('button',{name:'Buka navigasi'}).tap();await page.getByRole('dialog').waitFor();await page.keyboard.press('Escape');await page.getByRole('dialog').waitFor({state:'hidden'});assert.equal(await page.getByRole('button',{name:'Buka navigasi'}).evaluate(e=>e===document.activeElement),true);pass('Existing drawer keyboard behavior preserved on Notifications');
 for(const viewport of [{width:812,height:375},{width:1280,height:900},{width:390,height:844}]){await page.setViewportSize(viewport);await overflow(page,'resize '+viewport.width+'x'+viewport.height);}
 assert.equal(await page.getByRole('searchbox',{name:'Cari notifikasi'}).evaluate(e=>getComputedStyle(e).borderTopWidth),'1px');pass('Search field uses a visible input boundary');
 const buttonSize=await reload().boundingBox();assert.ok(buttonSize.height>=44);pass('Action targets are at least 44px high');
 await page.route('**/api/services/notifications',async route=>{await new Promise(r=>setTimeout(r,1000));try{await route.fulfill({json:{data}});}catch{/* Expected cancelled fixture request after unmount. */}});
 const cancelled=page.waitForEvent('requestfailed',request=>request.url().endsWith('/api/services/notifications'));await reload().click();await page.waitForTimeout(50);await page.evaluate(()=>window.unmountNotifications());await cancelled;pass('Unmount aborts the outstanding request');
 assert.deepEqual(errors,[]);pass('No uncaught JavaScript errors or unexpected console errors');
 const result={status:'passed',checks,axe:axeResults,errors,expectedNetworkErrors:networkErrors.length,viewports:[320,360,375,390,768,1024,1280,1440],scope:'Synthetic component fixtures and intercepted API responses; no production writes or authenticated live-account UAT.'};await writeFile(join(out,'browser-results.json'),JSON.stringify(result,null,2)+'\n');console.log(JSON.stringify({status:'passed',checks:checks.length,axeScreens:axeResults.length}));
}catch(error){await writeFile(join(out,'failure.json'),JSON.stringify({error:String(error),checks,errors,axe:axeResults},null,2));throw error;}
finally{await browser?.close();await new Promise(r=>server.close(r));}
