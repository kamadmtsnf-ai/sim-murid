/** Native disclosure, form preservation and readable layout with synthetic data only. */
import {createRequire} from 'node:module';
import {readFile,readdir,mkdtemp,mkdir,writeFile} from 'node:fs/promises';
import {join} from 'node:path';
import {tmpdir} from 'node:os';
import {pathToFileURL} from 'node:url';
import {createServer} from 'node:http';
import assert from 'node:assert/strict';
const root=process.cwd(),req=createRequire(import.meta.url),tools=process.env.UI_TEST_TOOLS||join(root,'node_modules');
const {chromium}=req(join(tools,'playwright')),{build}=await import(pathToFileURL(join(tools,'esbuild/lib/main.js')));
const out=process.env.READING_QA_OUTPUT??'/tmp/reading-qa';await mkdir(out,{recursive:true});
const temp=await mkdtemp(join(tmpdir(),'sim-health-'));
await build({entryPoints:[join(root,'tests/ui/reading-fixture.tsx')],outfile:join(temp,'app.js'),bundle:true,platform:'browser',format:'iife',jsx:'automatic',tsconfig:join(root,'tsconfig.json'),define:{'process.env.NODE_ENV':'"production"'}});
const cssFiles=(await readdir(join(root,'.next/static/chunks'))).filter(f=>f.endsWith('.css'));
const css=(await Promise.all(cssFiles.map(f=>readFile(join(root,'.next/static/chunks',f),'utf8')))).join('\n'),script=await readFile(join(temp,'app.js'));
const server=createServer((q,s)=>{
 if(q.url==='/app.js'){s.setHeader('Content-Type','text/javascript');s.end(script);}else if(q.url==='/app.css'){s.setHeader('Content-Type','text/css');s.end(css);}else{s.setHeader('Content-Type','text/html');s.end('<!doctype html><html lang="id"><head><meta name="viewport" content="width=device-width,initial-scale=1"><title>Tampilan ringkas QA</title><link rel="stylesheet" href="/app.css"></head><body><div id="root"></div><script src="/app.js"></script></body></html>');}
});
await new Promise(r=>server.listen(0,'127.0.0.1',r));const origin=`http://127.0.0.1:${server.address().port}`;
const checks=[],accessibility=[],errors=[];let browser;
const check=(v,name)=>{assert.ok(v,name);checks.push({name,passed:true});};
try{
 browser=await chromium.launch({headless:true,executablePath:process.env.UI_CHROMIUM_EXECUTABLE,args:['--no-sandbox']});const page=await browser.newPage({hasTouch:true});page.on('pageerror',e=>errors.push(e.message));
 const axe=await readFile(join(tools,'axe-core/axe.min.js'),'utf8');
 await page.route('**/*',r=>{assert.equal(new URL(r.request().url()).origin,origin);return r.continue();});
 async function geometry(label){check(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),label+' page fits');check(await page.locator('summary,input,button').evaluateAll(es=>es.every(e=>{const b=e.getBoundingClientRect();return b.width>0&&b.height>=44&&b.left>=-1&&b.right<=innerWidth+1;})),label+' controls reachable and 44px');}
 async function a11y(label){await page.evaluate(axe);const r=await page.evaluate(()=>window.axe.run(document,{runOnly:{type:'tag',values:['wcag2a','wcag2aa','wcag21aa','wcag22aa','best-practice']}}));accessibility.push({label,violations:r.violations.map(v=>v.id)});check(!r.violations.length,label+' axe');}
 for(const width of [320,390,768,1440]){
  await page.setViewportSize({width,height:800});await page.goto(origin);await page.getByRole('heading',{level:1}).waitFor();
  const summary=page.locator('summary'),explanation=page.getByText(/Penjelasan tambahan/);
  check(!await explanation.isVisible(),width+' optional explanation starts closed');check(await page.getByText('Nama wajib diisi.').isVisible(),width+' required instruction stays visible');check(await page.getByRole('status').filter({hasText:'Periksa data'}).isVisible(),width+' warning stays visible');
  await geometry(width+' closed');await a11y(width+' closed');
  await page.getByLabel('Nama',{exact:true}).fill('Isian tetap');await summary.focus();await page.keyboard.press('Enter');check(await explanation.isVisible(),width+' Enter reveals full explanation');
  await geometry(width+' expanded');await a11y(width+' expanded');await page.keyboard.press('Space');check(!await explanation.isVisible(),width+' Space closes explanation');
  check(await page.getByLabel('Nama',{exact:true}).inputValue()==='Isian tetap',width+' toggling preserves form');await summary.tap();check(await explanation.isVisible(),width+' touch reveals explanation');
  await page.getByRole('button',{name:'Simpan',exact:true}).click();check(await page.getByRole('status').filter({hasText:'Data contoh tersimpan.'}).isVisible(),width+' form handler preserved');
 }
 for(const percent of [200,400]){await page.setViewportSize({width:320,height:700});await page.goto(origin);await page.locator('summary').waitFor();await page.addStyleTag({content:`html{font-size:${percent}%}`});await geometry('text'+percent);await page.locator('summary').click();await geometry('expanded text'+percent);}
 await page.emulateMedia({forcedColors:'active'});await a11y('forced colors');await page.emulateMedia({forcedColors:'none'});
 for(const [width,height] of [[812,375],[375,812],[812,240]]){await page.setViewportSize({width,height});await geometry('resize'+width+'x'+height);}
 check(!errors.length,'no JavaScript errors');await page.setViewportSize({width:390,height:800});await page.goto(origin);await page.locator('summary').waitFor();await page.screenshot({path:join(out,'mobile.png'),fullPage:true});await page.setViewportSize({width:1440,height:1000});await page.screenshot({path:join(out,'desktop.png'),fullPage:true});
 await writeFile(join(out,'browser.json'),JSON.stringify({checks,accessibility,errors,synthetic:true,limits:['Synthetic form and actual shared components; no production mutation or human UAT']},null,2));console.log(JSON.stringify({checks:checks.length,axe:accessibility.length,errors}));
}finally{await browser?.close();await new Promise(r=>server.close(r));}
