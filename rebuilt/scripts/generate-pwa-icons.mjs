/** Rasterize the existing favicon; keep maskable artwork inside the central safe zone. */
import sharp from 'sharp';
import { readFile, mkdir } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
const root=fileURLToPath(new URL('../',import.meta.url));
const original=(await readFile(`${root}src/app/icon.svg`,'utf8')).trim();
await mkdir(`${root}public/pwa`,{recursive:true});
for(const size of [192,512,180]) {
  const name=size===180?'apple-touch-icon.png':`icon-${size}.png`;
  await sharp(Buffer.from(original)).resize(size,size).png().toFile(`${root}public/pwa/${name}`);
}
const artwork=original.replace(/^.*?<svg[^>]*>/,'').replace(/<\/svg>$/,'');
const maskable=`<svg xmlns="http://www.w3.org/2000/svg" width="512" height="512"><rect width="512" height="512" fill="#0f766e"/><svg x="77" y="77" width="358" height="358" viewBox="0 0 64 64">${artwork}</svg></svg>`;
await sharp(Buffer.from(maskable)).png().toFile(`${root}public/pwa/maskable-512.png`);
