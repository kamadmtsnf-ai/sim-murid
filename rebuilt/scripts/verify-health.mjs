/** Read-only component regression with actual health/loading/error components and synthetic snapshots. */
import {createRequire} from 'node:module';
import {readFile,readdir,mkdtemp,mkdir,writeFile} from 'node:fs/promises';
import {join} from 'node:path';
import {tmpdir} from 'node:os';
import {pathToFileURL} from 'node:url';
import {createServer} from 'node:http';
import assert from 'node:assert/strict';
const root=process.cwd(),req=createRequire(import.meta.url),tools=process.env.UI_TEST_TOOLS||join(root,'node_modules');
const {chromium}=req(join(tools,'playwright')),{build}=await import(pathToFileURL(join(tools,'esbuild/lib/main.js')));
const out=process.env.HEALTH_QA_OUTPUT??'/tmp/health-qa';await mkdir(out,{recursive:true});
const temp=await mkdtemp(join(tmpdir(),'sim-health-'));
await build({entryPoints:[join(root,'tests/ui/health-fixture.tsx')],outfile:join(temp,'app.js'),bundle:true,platform:'browser',format:'iife',jsx:'automatic',tsconfig:join(root,'tsconfig.json'),define:{'process.env.NODE_ENV':'"production"'}});
const cssFiles=(await readdir(join(root,'.next/static/chunks'))).filter(f=>f.endsWith('.css'));
const css=(await Promise.all(cssFiles.map(f=>readFile(join(root,'.next/static/chunks',f),'utf8')))).join('\n'),script=await readFile(join(temp,'app.js'));
let render=0;
const server=createServer((q,s)=>{
 if(q.url==='/app.js'){s.setHeader('Content-Type','text/javascript');s.end(script);}else if(q.url==='/app.css'){s.setHeader('Content-Type','text/css');s.end(css);}else{s.setHeader('Content-Type','text/html');const checkedAt=new Date(Date.UTC(2026,9,27,8,0,++render)).toISOString();s.end('<!doctype html><html lang="id"><head><meta name="viewport" content="width=device-width,initial-scale=1"><title>Kesehatan aplikasi QA</title><link rel="stylesheet" href="/app.css"></head><body><a class="sr-only focus:not-sr-only" href="#main-content">Lewati ke konten utama</a><div id="root"></div><script>window.healthCheckedAt='+JSON.stringify(checkedAt)+'</script><script src="/app.js"></script></body></html>');}
});
await new Promise(r=>server.listen(0,'127.0.0.1',r));const origin=`http://127.0.0.1:${server.address().port}`;
const checks=[],accessibility=[],errors=[],methods=[];let browser,page;
const check=(value,name)=>{assert.ok(value,name);checks.push({name,passed:true});};
try{
 browser=await chromium.launch({headless:true,executablePath:process.env.UI_CHROMIUM_EXECUTABLE,args:['--no-sandbox']});page=await browser.newPage({hasTouch:true});page.on('pageerror',e=>errors.push(e.message));
 await page.route('**/*',route=>{const r=route.request();methods.push(r.method());assert.equal(new URL(r.url()).origin,origin);assert.equal(r.method(),'GET');return route.continue();});
 const axe=await readFile(join(tools,'axe-core/axe.min.js'),'utf8');
 async function visit(mode='normal',width=390,height=800){await page.setViewportSize({width,height});await page.goto(origin+'/?mode='+mode);await page.getByRole('heading',{level:1}).waitFor();}
 async function geometry(label){check(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),label+' no horizontal page overflow');check(await page.locator('button,summary').evaluateAll(nodes=>nodes.every(e=>{const b=e.getBoundingClientRect();return b.left>=-1&&b.right<=innerWidth+1&&e.scrollWidth<=e.clientWidth+1;})),label+' controls contained');}
 async function a11y(label){await page.evaluate(axe);const r=await page.evaluate(()=>window.axe.run(document,{runOnly:{type:'tag',values:['wcag2a','wcag2aa','wcag21aa','wcag22aa','best-practice']}}));accessibility.push({label,violations:r.violations.map(v=>({id:v.id,targets:v.nodes.map(n=>n.target)}))});check(!r.violations.length,label+' axe');}
 for(const mode of ['normal','empty','unknown','partial','reconciliation-error','providers-off','source-ready','large','offset','loading','error']){
  for(const width of [320,390,768,1440]){await visit(mode,width);await geometry(mode+width);check(!(await page.getByText('PRIVATE_TOKEN',{exact:false}).count()),mode+width+' internal error hidden');}
  await a11y(mode);
  if(mode==='loading'){check(await page.locator('main[aria-busy=true]').count()===1,'loading explicitly busy');continue;}
  if(mode==='error'){await page.getByRole('button',{name:'Coba kembali',exact:true}).click();check(await page.evaluate(()=>window.healthResets===1),'error retry invokes reset');continue;}
  check(await page.getByText('Belum dapat diverifikasi',{exact:true}).count()===1,mode+' backup remains unknown');
  check(await page.getByRole('button',{name:'Perbarui status'}).getAttribute('type')==='submit',mode+' refresh is submit');
  check(await page.locator('form').getAttribute('method')==='get',mode+' refresh GET');check(await page.locator('form').getAttribute('action')==='/account/health',mode+' refresh canonical URL');
  if(mode==='unknown'){check(await page.getByText('Data operasional belum tersedia',{exact:true}).count()===1,'all unknown summary');check(await page.getByText('Data rekonsiliasi tidak tersedia',{exact:true}).count()===1,'unknown reconciliation');}
  if(mode==='partial')check(await page.getByText('Data pengiriman tidak tersedia',{exact:true}).count()===1,'jobs unavailable remains unknown');
  if(mode==='reconciliation-error')check(await page.getByText('Sebagian data belum tersedia',{exact:true}).count()===1,'missing reconciliation promoted to summary');
  if(mode==='normal'){check(await page.getByText(/13 kegagalan atau hasil/).count()===1,'failures aggregated');await page.getByText('Cakupan data pengiriman',{exact:true}).click();check(await page.getByText(/tidak mencakup OTP/).isVisible(),'OTP excluded explanation reachable');check(await page.getByText(/Diterima penyedia bukan bukti/).isVisible(),'delivery is not inbox confirmation');}
  if(mode==='empty'){check(await page.getByText(/Belum ada data pengiriman atau pekerjaan/).count()===1,'empty distinguished from unavailable');check(await page.getByText('Data pengiriman tidak tersedia',{exact:true}).count()===0,'zero is not unavailable');}
  if(mode==='large')check(await page.getByText(Number.MAX_SAFE_INTEGER.toLocaleString('id-ID'),{exact:true}).count()===1,'large counts preserved in full');
  if(mode==='offset')check(await page.locator('time').first().textContent()==='27 Okt 2026, 16.00 WIB','offset correctly formatted in WIB');
 }
 for(const percent of [200,400]){await visit('normal',320,700);await page.addStyleTag({content:`html{font-size:${percent}%}`});await geometry('text'+percent);await page.getByText('Cakupan data pengiriman',{exact:true}).focus();await page.keyboard.press('Enter');check(await page.getByText(/tidak mencakup OTP/).isVisible(),'keyboard accordion at'+percent);await geometry('expanded text'+percent);}
 await visit('normal',320,568);await page.addStyleTag({content:'*{line-height:1.5!important;letter-spacing:.12em!important;word-spacing:.16em!important}p{margin-bottom:2em!important}'});await geometry('text spacing');
 await visit();await page.keyboard.press('Tab');await page.keyboard.press('Enter');await page.waitForFunction(()=>document.activeElement?.id==='main-content');check(true,'skip link focuses main');
 const refresh=page.getByRole('button',{name:'Perbarui status',exact:true}),before=await page.locator('time').first().getAttribute('datetime');await refresh.focus();check(await refresh.evaluate(e=>e===document.activeElement),'refresh keyboard focus');await page.keyboard.press('Enter');await page.waitForURL('**/account/health');await page.waitForFunction(before=>document.querySelector('time')?.getAttribute('datetime')!==before,before);check(true,'GET refresh receives a newer snapshot');
 await page.emulateMedia({forcedColors:'active'});await a11y('forced colors');await page.emulateMedia({forcedColors:'none'});
 for(const [width,height] of [[812,375],[375,812],[812,240],[320,568]]){await page.setViewportSize({width,height});await geometry('orientation'+width+'x'+height);}
 await page.screenshot({path:join(out,'mobile.png'),fullPage:true});await page.setViewportSize({width:1440,height:1000});await page.screenshot({path:join(out,'desktop.png'),fullPage:true});
 check(errors.length===0,'no JavaScript errors');check(methods.every(m=>m==='GET'),'no mutations or external requests');
 await writeFile(join(out,'browser.json'),JSON.stringify({checks,accessibility,errors,synthetic:true,productionData:false,limits:['Actual components with synthetic sources, not an authenticated production session','No provider delivery, OTP, backup or restore performed']},null,2)+'\n');console.log(JSON.stringify({checks:checks.length,axe:accessibility.length,errors}));
}catch(error){await writeFile(join(out,'failure.json'),JSON.stringify({error:String(error),checks,accessibility,errors},null,2));throw error;}finally{await browser?.close();await new Promise(r=>server.close(r));}
