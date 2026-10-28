/** Actual local production pages, read-only. No installation or production account. */
import { spawn } from 'node:child_process';
import { createServer } from 'node:net';
import { createRequire } from 'node:module';
import { mkdir, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import assert from 'node:assert/strict';
const req=createRequire(import.meta.url),tools=process.env.UI_TEST_TOOLS||join(process.cwd(),'node_modules');
const {chromium}=req(join(tools,'playwright'));
const port=await new Promise((resolve,reject)=>{const p=createServer();p.once('error',reject);p.listen(0,'127.0.0.1',()=>{const port=p.address().port;p.close(()=>resolve(port));});});
const origin=`http://127.0.0.1:${port}`,server=spawn(process.execPath,['node_modules/next/dist/bin/next','start','--hostname','127.0.0.1','--port',String(port)],{stdio:'ignore'});
const checks=[],errors=[];let browser;
const check=(v,name)=>{assert.ok(v,name);checks.push({name,passed:true});};
try{
 let ready=false;for(let i=0;i<100;i++){try{if((await fetch(origin)).ok){ready=true;break;}}catch{}await new Promise(r=>setTimeout(r,150));}assert.ok(ready&&server.exitCode===null);
 browser=await chromium.launch({headless:true,executablePath:process.env.UI_CHROMIUM_EXECUTABLE,args:['--no-sandbox']});const page=await browser.newPage();page.on('pageerror',e=>errors.push(e.message));
 await page.route('**/*',r=>new URL(r.request().url()).origin===origin?r.continue():r.abort());
 for(const path of ['/','/login','/recovery','/not-a-real-page']){
  for(const width of [390,1280]){
   await page.setViewportSize({width,height:800});const response=await page.goto(origin+path);
   check(response.status()===(path==='/not-a-real-page'?404:200),path+width+' HTTP status');
   const launcher=page.getByRole('button',{name:'Pasang aplikasi',exact:true});await launcher.waitFor();
   check(await launcher.count()===1,path+width+' one global install control');
   check(await page.getByRole('dialog').count()===0,path+width+' no unsolicited modal');
   check(await launcher.evaluate(e=>Boolean(e.closest('footer'))),path+width+' control inside real footer');check(await page.locator('.pwa-install-footer').count()===0,path+width+' no appended utility strip');
   check(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),path+width+' no page overflow');
   await launcher.click();const dialog=page.getByRole('dialog',{name:'Pasang SiM-Murid di perangkat',exact:true});await dialog.waitFor();
   check(await dialog.getByText(/Login, verifikasi email/).isVisible(),path+width+' guide opens on request');
   await page.keyboard.press('Escape');await dialog.waitFor({state:'hidden'});await page.waitForFunction(()=>document.activeElement?.textContent?.trim()==='Pasang aplikasi');
   check(true,path+width+' focus restored');
  }
 }
 check(!errors.length,'no JavaScript errors');const out=process.env.PWA_QA_OUTPUT??'/tmp/pwa-footer-qa';await mkdir(out,{recursive:true});await writeFile(join(out,'pages.json'),JSON.stringify({checks,errors,scope:'Actual local Next production pages; GET navigation and UI only; no account/provider mutation'},null,2)+'\n');console.log(JSON.stringify({checks:checks.length,errors}));
}finally{await browser?.close();server.kill('SIGTERM');}
