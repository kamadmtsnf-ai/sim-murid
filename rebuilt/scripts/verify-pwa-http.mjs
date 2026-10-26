/** Read-only public metadata/assets check against a running production build. */
import assert from 'node:assert/strict';
import { writeFile, mkdir } from 'node:fs/promises';
const base=process.env.PWA_QA_URL||'http://127.0.0.1:3127';let checks=0;
const res=await fetch(base+'/manifest.webmanifest');assert.equal(res.status,200);assert.match(res.headers.get('content-type'),/manifest/);const m=await res.json();assert.equal(m.start_url,'/account');checks+=3;
for(const icon of [...m.icons,{src:'/pwa/apple-touch-icon.png',sizes:'180x180'}]){const r=await fetch(new URL(icon.src,base));assert.equal(r.status,200);assert.match(r.headers.get('content-type'),/image\/png/);const b=Buffer.from(await r.arrayBuffer());assert.equal(`${b.readUInt32BE(16)}x${b.readUInt32BE(20)}`,icon.sizes);checks+=3;}
const home=await fetch(base);assert.equal(home.status,200);const html=await home.text();assert.match(html,/manifest.webmanifest/);assert.match(html,/apple-touch-icon/);assert.match(html,/theme-color/);checks+=4;
await mkdir('docs/verification/l06-pwa',{recursive:true});await writeFile('docs/verification/l06-pwa/http.json',JSON.stringify({checks,productionBuild:true,anonymousAssets:true},null,2)+'\n');console.log({checks});
