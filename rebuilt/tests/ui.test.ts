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
