/** Preserve the existing school SVG; add conventional multi-resolution browser fallback. */
import sharp from 'sharp';
import {readFile,writeFile} from 'node:fs/promises';
const source=new URL('../src/app/icon.svg',import.meta.url),target=new URL('../src/app/favicon.ico',import.meta.url);
const svg=await readFile(source),sizes=[16,32,48];
const images=await Promise.all(sizes.map(size=>sharp(svg).resize(size,size).png().toBuffer()));
const header=Buffer.alloc(6+16*images.length);header.writeUInt16LE(1,2);header.writeUInt16LE(images.length,4);
let offset=header.length;
for(let i=0;i<images.length;i++){
 const index=6+i*16;header[index]=sizes[i];header[index+1]=sizes[i];header.writeUInt16LE(1,index+4);header.writeUInt16LE(32,index+6);header.writeUInt32LE(images[i].length,index+8);header.writeUInt32LE(offset,index+12);offset+=images[i].length;
}
await writeFile(target,Buffer.concat([header,...images]));
