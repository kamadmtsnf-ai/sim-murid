import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { stripTypeScriptTypes } from 'node:module';
import sharp from 'sharp';
const moduleUrl=source=>'data:text/javascript;base64,'+Buffer.from(stripTypeScriptTypes(source)).toString('base64');
const config=moduleUrl(await readFile(new URL('../src/config/app.ts',import.meta.url),'utf8'));
const source=(await readFile(new URL('../src/app/manifest.ts',import.meta.url),'utf8')).replace('@/config/app',config);
const manifest=(await import(moduleUrl(source))).default();
test('PWA identity launches the existing session-protected account entry',()=>{
 assert.equal(manifest.id,'/');assert.equal(manifest.start_url,'/account');assert.equal(manifest.scope,'/');assert.equal(manifest.display,'standalone');assert.equal(manifest.name,'SiM-Murid');assert.equal(manifest.lang,'id');
 assert.equal(new URL(manifest.start_url,'https://example.test').origin,'https://example.test');
});
test('every advertised icon exists with exact PNG size and distinct purpose',async()=>{
 assert.equal(manifest.icons.length,3);
 for(const icon of manifest.icons){const info=await sharp(new URL('../public'+icon.src,import.meta.url).pathname).metadata();assert.equal(info.format,'png');assert.equal(`${info.width}x${info.height}`,icon.sizes);assert.equal(icon.type,'image/png');}
 assert.equal(manifest.icons.filter(i=>i.purpose==='maskable').length,1);
 const apple=await sharp(new URL('../public/pwa/apple-touch-icon.png',import.meta.url).pathname).metadata();assert.equal(apple.width,180);assert.equal(apple.height,180);
});
test('maskable artwork stays in safe circle on an opaque brand background',async()=>{
 const {data,info}=await sharp(new URL('../public/pwa/maskable-512.png',import.meta.url).pathname).ensureAlpha().raw().toBuffer({resolveWithObject:true});
 for(let y=0;y<info.height;y++)for(let x=0;x<info.width;x++){
  const offset=(y*info.width+x)*4;assert.equal(data[offset+3],255);
  if(Math.hypot(x-255.5,y-255.5)>204.8)assert.ok([...data.subarray(offset,offset+3)].every((v,i)=>Math.abs(v-[15,118,110][i])<=2),'only brand background outside safe circle');
 }
});

test('installation guidance chooses iOS, desktop-style iPad, Android and desktop without changing access policy', async()=>{
 const {installPlatform,installInstructions}=await import('../src/lib/pwa/presentation.ts');
 assert.equal(installPlatform('iPhone'), 'ios');assert.equal(installPlatform('Macintosh',5),'ios');
 assert.equal(installPlatform('Macintosh',0),'desktop');assert.equal(installPlatform('Android'),'android');
 for(const platform of ['android','ios','desktop'])assert.equal(installInstructions[platform].length,3);
 assert.ok(installInstructions.ios.some(s=>s.includes('Safari')));
 assert.ok(installInstructions.desktop.some(s=>s.includes('ikon aplikasi')));
});
test('PWA manifest keeps session-protected launch and consistent brand metadata',()=>{
 assert.equal(manifest.start_url,'/account');assert.equal(manifest.display,'standalone');
 assert.equal(manifest.theme_color,'#125e64');assert.equal(manifest.orientation,'any');
 assert.ok(manifest.categories.includes('education'));
});
