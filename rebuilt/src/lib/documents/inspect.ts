import {createHash} from 'node:crypto';
import sharp from 'sharp';
import {PDFDocument} from 'pdf-lib';
export async function inspectDocument(bytes:Uint8Array,mime:string,size:number,maxBytes=50*1024*1024){
 if(bytes.length!==size||size<1||size>maxBytes)throw new Error('Ukuran file tidak sesuai.');
 if(mime==='application/pdf'){
  if(Buffer.from(bytes.subarray(0,5)).toString()!=='%PDF-')throw new Error('Isi bukan PDF.');
  const pdf=await PDFDocument.load(bytes,{ignoreEncryption:false,updateMetadata:false,throwOnInvalidObject:true});if(pdf.getPageCount()<1)throw new Error('PDF tanpa halaman.');
 }else{
  const image=sharp(bytes,{limitInputPixels:40000000,failOn:'warning'}),meta=await image.metadata();
  if(meta.format!==(mime==='image/png'?'png':'jpeg')||!meta.width||!meta.height||(meta.pages??1)>1)throw new Error('Isi gambar tidak cocok.');
  await image.resize({width:8,height:8,fit:'inside'}).raw().toBuffer();
 }
 return createHash('sha256').update(bytes).digest('hex');
}
