import {PDFDocument,StandardFonts,rgb} from 'pdf-lib';
import ExcelJS from 'exceljs';
import type {OperationsSnapshot} from './validation.ts';
import {moduleTitles} from './validation.ts';
const labels:Record<string,string>={date:'Tanggal',name:'Nama',class_name:'Kelas',teacher_name:'Guru Wali',kind:'Jenis',status:'Status',subject:'Hafalan / aspek',predicate:'Predikat',notes:'Catatan',amount:'Nominal',delta:'Perubahan saldo',balance:'Saldo sesudah',reversed:'Sudah dibalik'};
export function exportRows(snapshot:OperationsSnapshot){const keys=Object.keys(labels).filter(k=>snapshot.rows.some(r=>r[k]!==undefined));return {headers:keys.map(k=>labels[k]),rows:snapshot.rows.map(r=>keys.map(k=>typeof r[k]==='number'?r[k] as number:String(r[k]??'')))};}
export async function operationsExport(snapshot:OperationsSnapshot,format:'xlsx'|'pdf'){
 if(snapshot.total>snapshot.rows.length)throw new RangeError('Pilih rentang lebih sempit untuk ekspor lengkap.');
 const title=moduleTitles[snapshot.module],data=exportRows(snapshot);
 if(format==='xlsx'){const book=new ExcelJS.Workbook();book.creator='SiM-Murid';const sheet=book.addWorksheet('Riwayat');sheet.addRow([title]);sheet.addRow(data.headers);for(const r of data.rows)sheet.addRow(r);sheet.getRow(2).font={bold:true};sheet.views=[{state:'frozen',ySplit:2}];sheet.columns.forEach(c=>{c.width=25;});const sum=book.addWorksheet('Ringkasan');sum.addRow(['Metrik','Nilai']);Object.entries(snapshot.summary).forEach(([k,v])=>sum.addRow([k,typeof v==='number'?v:String(v??'')]));
 const months=snapshot.extra.months;if(Array.isArray(months)&&months.length){const detail=book.addWorksheet('Status bulan');detail.addRow(['Nama','Bulan','Status','Kas','Tarif','Tunggakan diketahui','Sumber gratis']);for(const m of months as Record<string,unknown>[])detail.addRow([String(m.name),String(m.month),String(m.status),Number(m.amount),m.tariff===null?'Tarif belum ditetapkan':Number(m.tariff),m.outstanding===null?'Tarif belum ditetapkan':Number(m.outstanding),Number(m.waiverSources)]);detail.columns.forEach(c=>{c.width=24;});}
 return new Uint8Array(await book.xlsx.writeBuffer());}
 const pdf=await PDFDocument.create(),font=await pdf.embedFont(StandardFonts.Helvetica);let page=pdf.addPage([842,595]),y=555;
 const plain=(s:string)=>s.normalize('NFKD').replace(/[^\x20-\x7E\n]/g,'?');
 const write=(s:string,bold=false)=>{if(y<45){page=pdf.addPage([842,595]);y=555;}page.drawText(plain(s),{x:35,y,size:bold?13:8,font,color:rgb(.1,.15,.2)});y-=bold?24:14;};
 write(title,true);write('SiM-Murid | '+snapshot.today+' WIB | '+snapshot.total+' catatan');for(const[k,v]of Object.entries(snapshot.summary))write(k+': '+String(v));y-=12;write(data.headers.join(' | '));for(const r of data.rows){const line=r.join(' | ');for(let i=0;i<line.length;i+=155)write(line.slice(i,i+155));}return pdf.save();
}
