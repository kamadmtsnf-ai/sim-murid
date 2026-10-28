/** Public Home QA against the actual local production build; no provider/account writes. */
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {spawn} from 'node:child_process';
import {readFile,writeFile,mkdir} from 'node:fs/promises';
import {join} from 'node:path';
const baseline=process.argv.includes('--baseline'),root=process.cwd();
const out=process.env.HOME_QA_OUTPUT??join(root,'docs/verification/home');await mkdir(out,{recursive:true});
const require=createRequire(import.meta.url);
const runtime=process.env.CODEX_PRIMARY_RUNTIME_NODE_MODULES;
const {chromium}=runtime?require(join(runtime,'playwright')):require('playwright');
const axe=await readFile(join(process.env.UI_TEST_TOOLS??join(root,'node_modules'),'axe-core/axe.min.js'),'utf8');
const origin='http://127.0.0.1:3292';
const server=spawn(process.execPath,['node_modules/next/dist/bin/next','start','--hostname','127.0.0.1','--port','3292'],{cwd:root,env:{...process.env,NEXT_TELEMETRY_DISABLED:'1'},stdio:['ignore','pipe','pipe']});
let serverLog='';server.stdout.on('data',x=>serverLog+=x);server.stderr.on('data',x=>serverLog+=x);
const checks=[],issues=[],views=[],errors=[];let browser;
function check(ok,name,detail){checks.push({name,passed:!!ok,...(detail?{detail}:{} )});if(!ok){issues.push(name);if(!baseline)assert.fail(name+' '+JSON.stringify(detail??''));}}
async function geometry(page,name){
 const size=await page.evaluate(()=>({viewport:innerWidth,document:document.documentElement.scrollWidth}));check(size.document<=size.viewport+1,name+' — no horizontal page overflow',size);
 for(const control of await page.locator('main a').all()){
  const b=await control.boundingBox();check(b&&b.x>=-1&&b.x+b.width<=size.viewport+1,name+' — login control fits viewport',b);
 }
 await page.locator('footer').scrollIntoViewIfNeeded();const bottom=await page.locator('footer').boundingBox();check(bottom&&bottom.y>=-1&&bottom.y+bottom.height<=(await page.evaluate(()=>innerHeight))+1,name+' — footer reachable through normal document scrolling',bottom);
}
async function accessible(page,name){await page.evaluate(axe);const r=await page.evaluate(()=>window.axe.run(document,{runOnly:{type:'tag',values:['wcag2a','wcag2aa','wcag21aa','best-practice']}}));const violations=r.violations.map(x=>({id:x.id,impact:x.impact,targets:x.nodes.map(n=>n.target)}));views.push({name,violations});check(violations.length===0,name+' — axe has no violations',violations);}
try{
 const end=Date.now()+25000;let ready=false;
 while(Date.now()<end&&server.exitCode===null){try{const r=await fetch(origin,{signal:AbortSignal.timeout(1000)});if(r.ok){ready=true;break;}}catch{}await new Promise(r=>setTimeout(r,150));}
 assert.ok(ready,'Production server did not start: '+serverLog);
 browser=await chromium.launch({headless:true,...(process.env.UI_CHROMIUM_EXECUTABLE?{executablePath:process.env.UI_CHROMIUM_EXECUTABLE}:{}),args:['--no-sandbox','--disable-dev-shm-usage','--disable-gpu']});
 const context=await browser.newContext({reducedMotion:'reduce',hasTouch:true});const page=await context.newPage();page.setDefaultTimeout(10000);page.on('pageerror',e=>errors.push(e.message));page.on('console',m=>{if(m.type()==='error')errors.push(m.text());});
 async function visit(width=375,height=812){await page.setViewportSize({width,height});await page.goto(origin);await page.getByRole('heading',{level:1}).waitFor();}
 for(const [w,h] of [[320,700],[360,800],[375,812],[390,844],[768,1024],[1024,768],[1280,900],[1440,900],[1920,1080],[812,375],[812,240]]){
  await visit(w,h);await geometry(page,w+'x'+h);await page.screenshot({path:join(out,(baseline?'baseline-':'')+'home-'+w+'x'+h+'.png'),fullPage:true});
  if([320,768,1440].includes(w))await accessible(page,'Home '+w+'x'+h);
 }
 await visit(1440,1200);const footer=await page.locator('footer').boundingBox();check(footer.y+footer.height>=1199,'Footer anchors to bottom on tall desktop without hiding content',footer);
 for(const percent of [200,400]){await visit(320,700);await page.addStyleTag({content:`html{font-size:${percent}%}`});await geometry(page,'Text '+percent+'% at 320px');await accessible(page,'Text '+percent+'%');}
 await visit(320,700);await page.locator('h1').evaluate(e=>e.textContent='IdentitasMadrasah'.repeat(20));await geometry(page,'Synthetic unbroken heading stress');
 await visit();await page.keyboard.press('Tab');check(await page.getByRole('link',{name:'Lewati ke konten utama'}).evaluate(e=>e===document.activeElement),'First Tab focuses skip link');await page.keyboard.press('Enter');check(await page.locator('main').evaluate(e=>e===document.activeElement),'Skip link transfers keyboard focus to main content');await page.keyboard.press('Tab');check(await page.getByRole('link',{name:'Masuk ke akun',exact:true}).evaluate(e=>e===document.activeElement),'Next Tab reaches login after skipping header');
 await visit();check(await page.getByRole('heading',{level:1}).count()===1,'Exactly one main heading');check(await page.locator('main').getByRole('heading',{level:2,name:'Layanan madrasah terpadu'}).count()===1,'Service card has a semantic section heading');
 const login=page.getByRole('link',{name:'Masuk ke akun',exact:true});const hit=await login.boundingBox();check(hit.height>=44,'Login touch target >=44px');check(await login.getAttribute('href')==='/login','Existing login URL preserved');await login.tap();await page.waitForURL('**/login');await page.getByRole('heading',{name:'Masuk ke SiM-Murid'}).waitFor();check(true,'Touch navigation reaches actual login form');
 await page.getByRole('link',{name:'Kembali ke beranda'}).click();await page.waitForURL(origin+'/');check(true,'Login returns to Home');
 for(let i=0;i<3;i++){await page.setViewportSize({width:812,height:375});await page.setViewportSize({width:375,height:812});}await geometry(page,'Three orientation cycles');
 await page.emulateMedia({forcedColors:'active'});await accessible(page,'Forced colors');await page.emulateMedia({forcedColors:'none'});
 check(errors.length===0,'No uncaught JavaScript or browser console errors',errors);
 await context.close();
 const noJs=await browser.newContext({javaScriptEnabled:false,viewport:{width:320,height:700}}),staticPage=await noJs.newPage();await staticPage.goto(origin);await staticPage.getByRole('link',{name:'Masuk ke akun',exact:true}).click();await staticPage.waitForURL('**/login');await staticPage.getByRole('main').getByText('Aktifkan JavaScript pada browser untuk menggunakan formulir login. Jika tidak dapat mengaktifkannya, hubungi administrator madrasah.',{exact:true}).waitFor();check(true,'Home/login navigation with JavaScript disabled reaches explicit login guidance');await noJs.close();
 const response=await fetch(origin);check(response.status===200,'Public Home responds without auth/service environment');
 const report={status:issues.length?'issues_found':'passed',baseline,checks,issues,axe:views,limits:['Public / Home only; Dashboard /account is separate.','Static content has no CRUD, data pagination, modal or provider loading/empty state.','Chromium headless; no physical-device, screen-reader user or authenticated production role UAT.','Synthetic long heading is injected only for a layout stress test; no backend data is changed.']};await writeFile(join(out,baseline?'baseline-results.json':'browser-results.json'),JSON.stringify(report,null,2)+'\n');console.log(JSON.stringify({status:report.status,checks:checks.length,issues,axeViews:views.length}));
}finally{await browser?.close();server.kill('SIGTERM');}
