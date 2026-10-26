/** Actual health component with synthetic sources; no operational writes. */
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
const temp=await mkdtemp(join(tmpdir(),'sim-health-'));
await build({entryPoints:[join(root,'tests/ui/health-fixture.tsx')],outfile:join(temp,'app.js'),bundle:true,platform:'browser',format:'iife',jsx:'automatic',tsconfig:join(root,'tsconfig.json'),define:{'process.env.NODE_ENV':'"production"'}});
const cssFiles=(await readdir(join(root,'.next/static/chunks'))).filter(f=>f.endsWith('.css'));
const css=(await Promise.all(cssFiles.map(f=>readFile(join(root,'.next/static/chunks',f),'utf8')))).join('\n');
const script=await readFile(join(temp,'app.js'));
const server=createServer((q,s)=>{if(q.url==='/app.js'){s.setHeader('Content-Type','text/javascript');s.end(script);}else if(q.url==='/app.css'){s.setHeader('Content-Type','text/css');s.end(css);}else{s.setHeader('Content-Type','text/html');s.end('<!doctype html><html lang="id"><head><title>PWA QA</title><link rel="stylesheet" href="/app.css"></head><body><div id="root"></div><script src="/app.js"></script></body></html>');}});
await new Promise(r=>server.listen(0,'127.0.0.1',r));
const browser=await chromium.launch({headless:true,executablePath:process.env.UI_CHROMIUM_EXECUTABLE,args:['--no-sandbox']});
let checks=0,axeChecks=0; const errors=[];
const check=(v,m)=>{assert.ok(v,m);checks++;};
try{
 const context=await browser.newContext();const page=await context.newPage();page.on('pageerror',e=>errors.push(e.message));
 const url=`http://127.0.0.1:${server.address().port}`;
 const axe=await readFile(join(tools,'axe-core/axe.min.js'),'utf8');
 for(const mode of ['', 'unknown', 'partial']){
  await page.goto(url+'/?mode='+mode);await page.getByRole('heading',{name:'Kesehatan aplikasi',exact:true}).waitFor();
  for(const width of [320,390,768,1280]){
   await page.setViewportSize({width,height:720});
   check(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),'no horizontal overflow '+mode+width);
   check(await page.getByRole('heading',{name:'Backup dan pemulihan'}).count()===1,'backup card');
  }
  check(await page.getByText('Belum dapat diverifikasi',{exact:true}).count()===1,'backup not presumed healthy');
  check(await page.getByRole('button',{name:'Perbarui status'}).getAttribute('type')==='submit','GET refresh button');
  check(await page.locator('form').getAttribute('method')==='get','refresh does not mutate');
  check(await page.locator('form').getAttribute('action')==='/account/health','canonical existing route');
  if(mode==='unknown') {check(await page.getByText('Data pengiriman tidak tersedia',{exact:true}).count()===1,'unknown outbox');check(await page.getByText('Data rekonsiliasi tidak tersedia',{exact:true}).count()===1,'unknown reconciliation');}
  if(mode==='partial') {check(await page.getByText(/Sumber pembanding belum tersedia/).count()===1,'partial available source remains');}
  if(mode==='') {check(await page.getByText(/13 kegagalan atau hasil/).count()===1,'combined sample attention');check(await page.getByText(/Diterima penyedia bukan bukti/).count()===1,'no inbox assertion');}
  await page.addScriptTag({content:axe});const result=await page.evaluate(()=>window.axe.run(document,{runOnly:{type:'tag',values:['wcag2a','wcag2aa','wcag21aa']}}));
  check(result.violations.length===0,JSON.stringify(result.violations.map(v=>({id:v.id,nodes:v.nodes.map(n=>n.target)}))));axeChecks++;
 }
 await page.keyboard.press('Tab');await page.getByRole('button',{name:'Perbarui status'}).focus();check(await page.getByRole('button',{name:'Perbarui status'}).evaluate(e=>e===document.activeElement),'keyboard focus');
 const requests=[];page.on('request',r=>requests.push(r.method()));await page.keyboard.press('Enter');await page.waitForURL('**/account/health*');check(requests.every(m=>m==='GET'),'keyboard refresh only GET');
 check(errors.length===0,'no JavaScript errors');
 const out=join(root,'docs/verification/l07-admin-health');await mkdir(out,{recursive:true});await writeFile(join(out,'browser.json'),JSON.stringify({checks,axeChecks,errors,synthetic:true,productionData:false},null,2)+'\n');
 await page.setViewportSize({width:320,height:720});await page.screenshot({path:'/tmp/l07-health-320.png',fullPage:true});
 console.log(JSON.stringify({checks,axeChecks,errors}));
}finally{await browser.close();await new Promise(r=>server.close(r));}
