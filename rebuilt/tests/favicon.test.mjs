import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import sharp from 'sharp';
test('conventional favicon contains valid16/32/48px PNG frames while preserving the SVG mark',async()=>{
 const ico=await readFile('src/app/favicon.ico');assert.equal(ico.readUInt16LE(0),0);assert.equal(ico.readUInt16LE(2),1);assert.equal(ico.readUInt16LE(4),3);
 let next=54;
 for(const [i,size] of [16,32,48].entries()){
  const entry=6+i*16,length=ico.readUInt32LE(entry+8),offset=ico.readUInt32LE(entry+12);assert.equal(ico[entry],size);assert.equal(ico[entry+1],size);assert.equal(offset,next);assert.ok(length>0&&offset+length<=ico.length);
  const info=await sharp(ico.subarray(offset,offset+length)).metadata();assert.equal(info.format,'png');assert.equal(info.width,size);assert.equal(info.height,size);next=offset+length;
 }
 assert.equal(next,ico.length);assert.match(await readFile('src/app/icon.svg','utf8'),/<svg[^>]*viewBox="0 0 64 64"/);
});
