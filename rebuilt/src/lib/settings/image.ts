import sharp from 'sharp';
export async function normalizeSchoolLogo(input:Uint8Array,mime:string){
 if(input.byteLength===0||input.byteLength>2*1024*1024)throw new Error('Ukuran logo harus 1 byte hingga 2 MB.');
 const formats:Record<string,string>={'image/png':'png','image/jpeg':'jpeg','image/webp':'webp'};
 if(!formats[mime])throw new Error('Logo harus PNG, JPEG, atau WebP.');
 try{
  const image=sharp(input,{limitInputPixels:16777216,failOn:'warning'});const meta=await image.metadata();
  if(meta.format!==formats[mime]||!meta.width||!meta.height||meta.width>4096||meta.height>4096||(meta.pages??1)>1)throw new Error('Invalid image');
  const output=await image.rotate().resize({width:1024,height:1024,fit:'inside',withoutEnlargement:true}).png().toBuffer();
  if(output.byteLength>2*1024*1024)throw new Error('Output too large');return output;
 }catch{throw new Error('Isi gambar tidak valid, terlalu besar, atau berupa animasi.');}
}
