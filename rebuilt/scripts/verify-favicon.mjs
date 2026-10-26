/** Real local Next production routes; GET only, no account or external request. */
import {spawn} from 'node:child_process';
import {createServer} from 'node:net';
import {mkdir,writeFile} from 'node:fs/promises';
import assert from 'node:assert/strict';
const port=await new Promise((resolve,reject)=>{const p=createServer();p.once('error',reject);p.listen(0,'127.0.0.1',()=>{const port=p.address().port;p.close(()=>resolve(port));});});
const origin=`http://127.0.0.1:${port}`,server=spawn(process.execPath,['node_modules/next/dist/bin/next','start','--hostname','127.0.0.1','--port',String(port)],{stdio:'ignore'});
const checks=[];const check=(value,name)=>{assert.ok(value,name);checks.push({name,passed:true});};
try{
 let ready=false;for(let i=0;i<100;i++){try{if((await fetch(origin)).ok){ready=true;break;}}catch{}await new Promise(r=>setTimeout(r,150));}assert.ok(ready&&server.exitCode===null,'owned production server ready');
 const ico=await fetch(origin+'/favicon.ico');check(ico.status===200,'conventional favicon200 without login');check(/image\/(x-icon|vnd.microsoft.icon)/.test(ico.headers.get('content-type')??''),'ICO MIME');const bytes=Buffer.from(await ico.arrayBuffer());check(bytes.readUInt16LE(2)===1&&bytes.readUInt16LE(4)===3,'ICO3 sizes');
 const svg=await fetch(origin+'/icon.svg');check(svg.status===200&&svg.headers.get('content-type')?.includes('image/svg+xml'),'SVG remains available');
 for(const path of ['/','/login','/recovery','/not-a-real-page']){
  const r=await fetch(origin+path);check(r.status===(path==='/not-a-real-page'?404:200),path+' status');const html=await r.text();const icons=[...html.matchAll(/<link\b[^>]*>/g)].map(m=>m[0]).filter(s=>/rel="icon"/.test(s));
  check(icons.some(s=>/href="\/favicon\.ico(?:[?"/])/.test(s)),path+' conventional icon in head');check(icons.some(s=>/href="\/icon\.svg(?:[?"/])/.test(s)),path+' scalable icon in head');
  for(const tag of icons){const href=/href="([^"]+)"/.exec(tag)?.[1];assert.ok(href);const target=new URL(href.replaceAll('&amp;','&'),origin);assert.equal(target.origin,origin);const image=await fetch(target);check(image.status===200,path+' advertised icon loads');}
 }
 const out=process.env.FAVICON_QA_OUTPUT??'/tmp/health-favicon';await mkdir(out,{recursive:true});await writeFile(out+'/http.json',JSON.stringify({checks,accountMutation:false,externalRequests:false},null,2)+'\n');console.log(JSON.stringify({checks:checks.length,status:'passed'}));
}finally{server.kill('SIGTERM');}
