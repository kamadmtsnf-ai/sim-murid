import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {accountNavigation,navigationFor,currentNavItem,matchesNavigation} from '../src/config/account-navigation.ts';

test('Navigation never exposes administrative links to non-admin capability contexts',()=>{
 for(const capabilities of [[],['profiles.read'],['grades.read'],['attendance.read','mentoring.read'],['surveys.read','books.read']]){
  const links=navigationFor(capabilities,false).flatMap(g=>g.items);
  assert.ok(links.some(i=>i.href==='/account/security'));
  assert.ok(links.every(i=>!i.adminOnly));
  assert.ok(links.every(i=>!i.capabilities||i.capabilities.some(c=>capabilities.includes(c))));
 }
 const all=navigationFor([],true).flatMap(g=>g.items);
 assert.equal(all.length,accountNavigation.flatMap(g=>g.items).length);
 assert.equal(new Set(all.map(i=>i.href)).size,all.length);
});
test('Deep links retain their parent navigation, with exact dashboard and localized search',()=>{
 assert.equal(currentNavItem('/account/biodata/student-id')?.href,'/account/biodata');
 assert.equal(currentNavItem('/account/profile')?.label,'Profil pribadi');
 assert.equal(currentNavItem('/account/unknown'),undefined);
 assert.equal(currentNavItem('/account')?.label,'Dashboard');
 assert.ok(matchesNavigation({href:'/x',label:'Iuran komite',description:'Pembayaran bulanan'},'  PEMBAYARAN '));
 assert.ok(!matchesNavigation({href:'/x',label:'Rapor',description:'Hasil belajar'},'tabungan'));
});
test('Semantic text pairs meet AA contrast and input boundary exceeds 3:1',()=>{
 const css=readFileSync(new URL('../src/app/globals.css',import.meta.url),'utf8');
 const vars=Object.fromEntries([...css.matchAll(/--([\w-]+):\s*(#[\da-f]{6})\s*;/gi)].map(m=>[m[1],m[2]]));
 function lum(hex:string){const s=hex.slice(1).match(/../g)!.map(c=>parseInt(c,16)/255).map(c=>c<=.04045?c/12.92:((c+.055)/1.055)**2.4);return s[0]!*.2126+s[1]!*.7152+s[2]!*.0722;}
 function ratio(a:string,b:string){const x=lum(vars[a]!),y=lum(vars[b]!);return (Math.max(x,y)+.05)/(Math.min(x,y)+.05);}
 for(const [fg,bg] of [['foreground','card'],['muted-foreground','card'],['primary-foreground','primary'],['destructive','danger-subtle'],['success','success-subtle'],['warning','warning-subtle'],['info','info-subtle']])assert.ok(ratio(fg!,bg!)>=4.5,`${fg}/${bg}`);
 assert.ok(ratio('input','card')>=3);
});

test('Account pages have no static cross-page links duplicating sidebar destinations',async()=>{
 const ts=await import('typescript'),fs=await import('node:fs'),path=await import('node:path');
 const destinations=new Set(accountNavigation.flatMap(g=>g.items.map(i=>i.href)));
 const files:string[]=[];function walk(dir:string){for(const f of fs.readdirSync(dir,{withFileTypes:true})){const p=path.join(dir,f.name);if(f.isDirectory())walk(p);else if(p.endsWith('.tsx'))files.push(p);}}walk(new URL('../src/app/account',import.meta.url).pathname);
 const duplicates:string[]=[];
 function targets(n:import('typescript').Node):boolean{if(ts.isStringLiteral(n))return destinations.has(n.text);if(ts.isJsxExpression(n)&&n.expression)return targets(n.expression);if(ts.isConditionalExpression(n))return targets(n.whenTrue)&&targets(n.whenFalse);return false;}
 for(const f of files){const sf=ts.createSourceFile(f,fs.readFileSync(f,'utf8'),ts.ScriptTarget.Latest,true,ts.ScriptKind.TSX);function visit(n:import('typescript').Node){if(ts.isJsxOpeningElement(n)||ts.isJsxSelfClosingElement(n)){const tag=n.tagName.getText(sf);if(tag==='Link'||tag==='a'){const attr=n.attributes.properties.find(a=>ts.isJsxAttribute(a)&&a.name.getText(sf)==='href');if(attr&&ts.isJsxAttribute(attr)&&attr.initializer&&targets(attr.initializer))duplicates.push(f+':'+sf.getLineAndCharacterOfPosition(n.getStart()).line);}}ts.forEachChild(n,visit);}visit(sf);}
 assert.deepEqual(duplicates,[]);
 const dashboard=readFileSync(new URL('../src/components/account-dashboard.tsx',import.meta.url),'utf8');assert.ok(!dashboard.includes('<Link')&&!dashboard.includes('<a '));
 assert.ok(!fs.existsSync(new URL('../src/components/module-navigation.tsx',import.meta.url)));
 const directory=readFileSync(new URL('../src/app/account/directory/directory-panel.tsx',import.meta.url),'utf8');assert.ok(directory.includes('Lihat detail'));assert.ok(directory.includes('pageUrl'));
});
test('Both endpoints of the primary control gradient preserve readable white labels',()=>{
 const css=readFileSync(new URL('../src/app/globals.css',import.meta.url),'utf8');const vars=Object.fromEntries([...css.matchAll(/--([\w-]+):\s*(#[\da-f]{6})\s*;/gi)].map(m=>[m[1],m[2]]));
 const lum=(h:string)=>h.slice(1).match(/../g)!.map(c=>parseInt(c,16)/255).map(c=>c<=.04045?c/12.92:((c+.055)/1.055)**2.4).reduce((sum,v,i)=>sum+v*[.2126,.7152,.0722][i]!,0);
 for(const stop of ['primary','primary-to']){const a=lum(vars[stop]!),b=lum(vars['primary-foreground']!);assert.ok((Math.max(a,b)+.05)/(Math.min(a,b)+.05)>=4.5);}
 assert.ok(css.includes('prefers-reduced-transparency:reduce'));assert.ok(css.includes('forced-colors:active'));
});
