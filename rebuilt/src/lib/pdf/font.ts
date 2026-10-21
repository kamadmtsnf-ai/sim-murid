import {readFile} from 'node:fs/promises';
import {join} from 'node:path';
import fontkit from '@pdf-lib/fontkit';
import type {PDFDocument,PDFFont} from 'pdf-lib';
// Only immutable asset bytes are cached, never caller or document data.
let fontBytes:Promise<Buffer>|undefined;
export async function embedReportFont(document:PDFDocument){
 document.registerFontkit(fontkit);
 fontBytes??=readFile(join(process.cwd(),'assets/fonts/DejaVuSans.ttf'));
 return document.embedFont(await fontBytes,{subset:true});
}
export function wrapPdfText(font:PDFFont,text:string,size:number,width:number){
 const allowed=new Set(font.getCharacterSet()),result:string[]=[];
 const normalized=text.normalize('NFC').replaceAll('\t','    ');
 for(const char of normalized){if(char!=='\n'&&char!=='\r'&&!allowed.has(char.codePointAt(0)!))throw new Error('Karakter pada dokumen belum didukung oleh font PDF. Gunakan ekspor Excel.');}
 for(const paragraph of normalized.split(/\r?\n/u)){
  let line='';
  for(const word of paragraph.split(' ')){
   const candidate=line+(line?' ':'')+word;
   if(font.widthOfTextAtSize(candidate,size)<=width){line=candidate;continue;}
   if(line){result.push(line);line='';}
   for(const {segment} of new Intl.Segmenter('id',{granularity:'grapheme'}).segment(word)){
    if(line&&font.widthOfTextAtSize(line+segment,size)>width){result.push(line);line='';}
    line+=segment;
   }
  }
  result.push(line);
 }
 return result;
}
