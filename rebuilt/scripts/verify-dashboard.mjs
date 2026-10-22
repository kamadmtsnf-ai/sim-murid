/** Isolated Dashboard browser regression suite. No real account, API mutation or production data. */
import {createRequire} from 'node:module';
import {readFile,writeFile,mkdir,readdir,mkdtemp} from 'node:fs/promises';
import {createServer} from 'node:http';
import {join} from 'node:path';
import {tmpdir} from 'node:os';
import {pathToFileURL} from 'node:url';
import assert from 'node:assert/strict';
const baseline=process.argv.includes('--baseline'),root=process.cwd();
const out=process.env.DASHBOARD_QA_OUTPUT??join(root,'docs/verification/dashboard');await mkdir(out,{recursive:true});
const temp=await mkdtemp(join(tmpdir(),'sim-dashboard-'));
const req=createRequire(import.meta.url),runtime=process.env.CODEX_PRIMARY_RUNTIME_NODE_MODULES;
const {chromium}=runtime?req(join(runtime,'playwright')):req('playwright');
const tools=process.env.UI_TEST_TOOLS??join(root,'node_modules');
const {build}=await import(pathToFileURL(join(tools,'esbuild/lib/main.js')));
const axe=await readFile(join(tools,'axe-core/axe.min.js'),'utf8');
await build({entryPoints:[join(root,'tests/ui/dashboard-fixture.tsx')],outfile:join(temp,'fixture.js'),bundle:true,platform:'browser',format:'iife',jsx:'automatic',tsconfig:join(root,'tsconfig.json'),define:{'process.env.NODE_ENV':'"production"','process.env':'{}'},plugins:[{name:'fixture-navigation',setup(b){b.onResolve({filter:/^next\/navigation$/},()=>({path:join(root,'tests/ui/navigation-shim.ts')}));}}]});
const css=[];async function styles(dir){for(const f of await readdir(dir,{withFileTypes:true})){const p=join(dir,f.name);if(f.isDirectory())await styles(p);else if(p.endsWith('.css'))css.push(await readFile(p,'utf8'));}}await styles(join(root,'.next/static'));
const server=createServer(async(request,response)=>{
 if(request.url==='/fixture.js'){response.setHeader('Content-Type','text/javascript');response.end(await readFile(join(temp,'fixture.js')));}
 else if(request.url==='/fixture.css'){response.setHeader('Content-Type','text/css');response.end(css.join('\n'));}
 else{response.setHeader('Content-Type','text/html');response.end('<!doctype html><html lang="id"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Dashboard QA SiM-Murid</title><link rel="stylesheet" href="/fixture.css"></head><body><a class="sr-only focus:not-sr-only" href="#main-content">Lewati ke konten utama</a><div id="root"></div><script src="/fixture.js"></script></body></html>');}
});await new Promise(r=>server.listen(0,'127.0.0.1',r));const base=`http://127.0.0.1:${server.address().port}`;
const checks=[],findings=[],errors=[],axeResults=[];let browser;
function pass(name){checks.push(name);}
async function overflow(page,label){const size=await page.evaluate(()=>({viewport:innerWidth,document:document.documentElement.scrollWidth}));assert.ok(size.document<=size.viewport+1,label+': '+JSON.stringify(size));pass(label+' — no horizontal overflow');}
async function a11y(page,label){await page.evaluate(axe);const r=await page.evaluate(()=>window.axe.run(document,{runOnly:{type:'tag',values:['wcag2a','wcag2aa','wcag21aa','best-practice']}}));axeResults.push({label,violations:r.violations.map(v=>({id:v.id,impact:v.impact,targets:v.nodes.map(n=>n.target)}))});assert.deepEqual(r.violations,[],label);pass(label+' — axe violations 0');}
try{
 browser=await chromium.launch({headless:true,...(process.env.UI_CHROMIUM_EXECUTABLE?{executablePath:process.env.UI_CHROMIUM_EXECUTABLE}:{}),args:['--no-sandbox','--disable-dev-shm-usage','--use-gl=angle','--use-angle=swiftshader','--disable-gpu']});
 const context=await browser.newContext({hasTouch:true,reducedMotion:'reduce'}),page=await context.newPage();page.setDefaultTimeout(10000);page.on('pageerror',e=>errors.push(e.message));page.on('console',m=>{if(m.type()==='error')errors.push(m.text());});
 async function visit(scenario='normal',width=375,height=812,extra=''){await page.setViewportSize({width,height});await page.goto(base+'/?scenario='+scenario+extra);await page.locator('main').waitFor();}
 if(baseline){
  await visit('invalid-date');assert.equal(await page.locator('#fixture-error').count(),1);findings.push('Invalid expiresAt throws RangeError and prevents Dashboard rendering.');
  await visit('empty');assert.equal(await page.locator('.dashboard-grid').innerText(),'');findings.push('Zero service groups render an unexplained empty grid.');
  await visit('missing');assert.equal(await page.getByText('@',{exact:true}).count(),1);findings.push('Missing Workspace context renders a bare @ identity.');
  await visit();await page.getByRole('button',{name:'Buka navigasi'}).tap();await page.getByRole('dialog').waitFor();await page.setViewportSize({width:1280,height:900});assert.equal(await page.getByRole('dialog').isVisible(),true);findings.push('Mobile drawer remains modal at desktop breakpoint and blocks the desktop interface.');
  await page.keyboard.press('Escape');await visit('long',1440,900);await page.screenshot({path:join(out,'baseline-long.png'),fullPage:true});
  await visit('long',812,375);await page.getByRole('button',{name:'Buka navigasi'}).tap();await page.getByRole('dialog').waitFor();const nav=await page.getByRole('navigation',{name:'Navigasi utama seluler'}).boundingBox();findings.push({longIdentityLandscapeNavHeight:nav.height});
  await page.screenshot({path:join(out,'baseline-drawer-landscape.png')});
 }else{
  for(const width of [320,360,375,390,768,1024,1280,1440]){await visit('normal',width,900);await page.getByRole('heading',{name:'Selamat datang, Akun Pengujian Antarmuka'}).waitFor();await overflow(page,'normal '+width);await page.screenshot({path:join(out,'dashboard-'+width+'.png'),fullPage:true});}
  await a11y(page,'normal desktop');assert.equal(await page.locator('main').locator('a,button').count(),0);pass('Dashboard has no duplicate module shortcuts');
  for(const scenario of ['long','many','empty','missing','unavailable','invalid-date','blank-date','loading','error']){
   for(const width of [320,768,1440]){await visit(scenario,width,900);assert.equal(await page.locator('#fixture-error').count(),0);await overflow(page,scenario+' '+width);}
   await a11y(page,scenario);
   if(scenario==='empty')await page.getByText('Belum ada layanan untuk ditampilkan.',{exact:true}).waitFor();
   if(scenario==='missing'){await page.getByText('Username belum tersedia',{exact:true}).waitFor();await page.getByRole('status').filter({hasText:'Daftar layanan belum dapat dimuat.'}).waitFor();}
   if(scenario==='unavailable')await page.getByRole('status').filter({hasText:'Daftar layanan belum dapat dimuat sepenuhnya.'}).waitFor();
   if(scenario==='invalid-date'||scenario==='blank-date'){await page.getByText('Waktu sesi belum tersedia',{exact:true}).waitFor();assert.equal(await page.locator('time').count(),0);}
   if(scenario==='loading')assert.equal(await page.locator('main').getAttribute('aria-busy'),'true');
   if(scenario==='error'){assert.equal(await page.getByText('synthetic internal detail').count(),0);await page.getByRole('button',{name:'Coba kembali'}).click();assert.equal(await page.locator('html').getAttribute('data-retried'),'true');pass('Error retry calls existing reset without exposing internals');}
  }
  await visit('normal',1440,900,'&role=student');assert.equal(await page.locator('main').getByText('Administrasi',{exact:true}).count(),0);await page.locator('time').evaluate(e=>{if(e.dateTime!=='2026-10-21T17:00:00Z'||!e.textContent.includes('22 Okt 2026')||!e.textContent.includes('00.00'))throw Error('Timezone changed');});pass('Restricted navigation and id-ID/Asia-Jakarta date preserved');
  await visit('normal',1440,900);const search=page.getByRole('searchbox',{name:'Cari menu navigasi',exact:true});await search.fill('rapor');assert.equal(await page.getByRole('navigation',{name:'Navigasi utama',exact:true}).getByRole('link').count(),1);await search.fill('tidak-ada-menu');await page.getByRole('status').filter({hasText:'Menu tidak ditemukan.'}).waitFor();await search.fill('');pass('Sidebar search, empty result and recovery');
  for(let cycle=0;cycle<3;cycle++){
   await page.setViewportSize({width:375,height:812});const opener=page.locator('button[aria-label="Buka navigasi"]');await opener.tap();const dialog=page.getByRole('dialog',{name:'Navigasi'});await dialog.waitFor();const portrait=await dialog.boundingBox();assert.ok(portrait.x>=0&&portrait.y>=0&&portrait.x+portrait.width<=376&&portrait.y+portrait.height<=813);assert.equal(await opener.getAttribute('aria-expanded'),'true');
   for(let n=0;n<12;n++){await page.keyboard.press('Tab');assert.equal(await dialog.evaluate(e=>e.contains(document.activeElement)),true);}for(let n=0;n<12;n++){await page.keyboard.press('Shift+Tab');assert.equal(await dialog.evaluate(e=>e.contains(document.activeElement)),true);}pass('Drawer forward/backward keyboard focus trap cycle '+cycle);
   await page.keyboard.press('Escape');await dialog.waitFor({state:'hidden'});await page.waitForFunction(()=>document.activeElement?.getAttribute('aria-label')==='Buka navigasi');assert.equal(await opener.evaluate(e=>e===document.activeElement),true);pass('Escape restores mobile trigger focus cycle '+cycle);
   await opener.tap();await dialog.waitFor();await page.setViewportSize({width:812,height:375});await overflow(page,'drawer landscape '+cycle);const bounds=await dialog.boundingBox();assert.ok(bounds.y>=0&&bounds.y+bounds.height<=376);
   const last=dialog.getByRole('link',{name:'Hak akses saya',exact:true});await last.focus();const box=await last.boundingBox();assert.ok(box.y>=0&&box.y+box.height<=375);pass('Landscape navigation scrolls to focused last item cycle '+cycle);
   await page.setViewportSize({width:1280,height:900});await dialog.waitFor({state:'hidden'});await page.waitForFunction(()=>document.activeElement?.classList.contains('workspace-brand'));assert.equal(await opener.getAttribute('aria-expanded'),'false');pass('Desktop resize closes drawer and restores visible focus cycle '+cycle);
  }
  await visit('normal',375,812);await page.getByRole('button',{name:'Buka navigasi'}).tap();const drawer=page.getByRole('dialog');await a11y(page,'mobile drawer');await drawer.getByRole('searchbox').fill('RAPOR');assert.equal(await drawer.getByRole('navigation').getByRole('link').count(),1);await drawer.getByRole('searchbox').fill('');const close=drawer.getByRole('button',{name:'Tutup dialog'});const target=await close.boundingBox();assert.ok(target.width>=44&&target.height>=44);await close.tap();await drawer.waitFor({state:'hidden'});pass('Touch search and close target >=44px');await page.getByRole('button',{name:'Buka navigasi'}).tap();await page.getByRole('dialog').getByRole('link',{name:'Dashboard',exact:true}).tap();await page.getByRole('dialog').waitFor({state:'hidden'});await page.getByRole('heading',{name:'Selamat datang, Akun Pengujian Antarmuka'}).waitFor();pass('Selecting the Dashboard menu closes mobile navigation');
  for(const scenario of ['normal','long','many']){
   await visit(scenario,812,320);await page.getByRole('button',{name:'Buka navigasi'}).tap();const dialog=page.getByRole('dialog');await dialog.waitFor();const searchbox=dialog.getByRole('searchbox');await searchbox.scrollIntoViewIfNeeded();await searchbox.fill('');await dialog.getByRole('navigation').getByRole('link').last().focus();const nav=await dialog.getByRole('navigation').boundingBox();assert.ok(nav.height>=44,'Navigation remains usable in short landscape');await overflow(page,scenario+' short landscape drawer');await page.screenshot({path:join(out,'drawer-'+scenario+'-812.png')});await page.keyboard.press('Escape');
  }
  await visit('long',812,240);await page.getByRole('button',{name:'Buka navigasi'}).tap();const short=page.getByRole('dialog');await short.waitFor();const logout=short.getByRole('button',{name:'Keluar dari akun'});await logout.focus();const logoutBounds=await logout.boundingBox();assert.ok(logoutBounds.y>=0&&logoutBounds.y+logoutBounds.height<=241);const shortSearch=short.getByRole('searchbox');await shortSearch.focus();const searchBounds=await shortSearch.boundingBox();assert.ok(searchBounds.y>=0&&searchBounds.y+searchBounds.height<=241);await overflow(page,'240px-high drawer');await page.keyboard.press('Escape');pass('Very short viewport keeps logout and search reachable by scrolling');
  await visit('long',320,812);await page.addStyleTag({content:'html{font-size:200%}'});await overflow(page,'long identity 200 percent text');await page.locator('footer').scrollIntoViewIfNeeded();assert.ok(await page.locator('footer').isVisible());pass('Long page remains vertically scrollable to footer at 200 percent text');
  assert.deepEqual(errors,[]);pass('No uncaught JavaScript errors or console errors');
 }
 const result={status:baseline?'baseline-reproduced':'passed',checks,findings,axe:axeResults,errors:baseline?['Expected invalid-date render error reproduced']:errors,scope:'Synthetic component fixtures. No authenticated production browser session or real data mutations.',viewports:[320,360,375,390,768,1024,1280,1440],landscape:[{width:812,height:375},{width:812,height:320},{width:812,height:240}]};await writeFile(join(out,baseline?'baseline-results.json':'browser-results.json'),JSON.stringify(result,null,2)+'\n');console.log(JSON.stringify({status:result.status,checks:checks.length,findings,axeScreens:axeResults.length}));
}catch(e){await writeFile(join(out,'failure.json'),JSON.stringify({error:String(e),checks,errors,axe:axeResults},null,2));throw e;}
finally{if(browser)await browser.close();await new Promise(r=>server.close(r));}
