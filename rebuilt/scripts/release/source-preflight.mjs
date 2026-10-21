import {readFile,writeFile} from 'node:fs/promises';
import {pathToFileURL} from 'node:url';

/** Read-only legacy preflight. Output contains counts, never cell values or credentials. */
export function sourcePreflight(workbook){
 if(!Array.isArray(workbook.sheets))throw Error('Workbook sheets required');
 const tables=new Map(workbook.sheets.map(s=>[s.name,s]));
 if(tables.size!==workbook.sheets.length)throw Error('Duplicate sheet name');
 const issues=[],warnings=[],counts={};
 const rows=name=>{const s=tables.get(name);if(!s)return [];return s.rows.filter(r=>r.some(v=>v!==''&&v!==null&&v!==undefined));};
 const field=(name,row,key)=>row[tables.get(name)?.headers.indexOf(key)??-1];
 for(const [name,s] of tables){
  if(!Array.isArray(s.headers)||!Array.isArray(s.rows))throw Error('Invalid sheet structure');
  counts[name]=rows(name).length;
 }
 const users=rows('Users'),names=users.map(r=>field('Users',r,'Username'));
 const stringNames=names.filter(n=>typeof n==='string'&&n.length>0),known=new Set(stringNames);
 if(!users.length)issues.push({code:'missing_users',count:1});
 if(stringNames.length!==names.length)issues.push({code:'non_string_or_empty_username',count:names.length-stringNames.length});
 const duplicates=stringNames.length-known.size;
 if(duplicates)issues.push({code:'duplicate_username',count:duplicates});
 const padded=stringNames.filter(n=>n!==n.trim()).length;
 if(padded)issues.push({code:'username_whitespace_requires_review',count:padded});
 const caseCollisions=known.size-new Set([...known].map(n=>n.toLowerCase())).size;
 if(caseCollisions)issues.push({code:'username_case_collision_requires_review',count:caseCollisions});
 const references={Nilai:'Username',Savings:'Username_Siswa',Laporan_Bimbingan:'Username_Siswa',PoinEvent:'username',Survei_Progress:'Username',Survei_Jawaban:'Username'};
 for(const [name,key]of Object.entries(references)){
  if(!tables.has(name))continue;
  const orphan=rows(name).filter(r=>!known.has(field(name,r,key))).length;
  if(orphan)issues.push({code:'unmapped_username',table:name,count:orphan});
 }
 if(rows('Iuran_Komite').length&&!tables.get('Iuran_Komite').headers.includes('Username'))issues.push({code:'fee_name_requires_identity_and_month_allocation_mapping',count:rows('Iuran_Komite').length});
 const unknownTypes=rows('Nilai').filter(r=>! /^(PH-\d+|PH|ATS|ASAS|Praktik)$/.test(String(field('Nilai',r,'Tipe')))).length;
 if(unknownTypes)issues.push({code:'unknown_assessment_type',count:unknownTypes});
 for(const [name,key]of [['Nilai','Nilai'],['KKM','KKM']]){
  const invalid=rows(name).filter(r=>{const v=field(name,r,key);return v!==''&&v!==null&&v!==undefined&&(!Number.isFinite(Number(v))||Number(v)<0||Number(v)>100);}).length;
  if(invalid)issues.push({code:'score_out_of_range_or_unparsed',table:name,count:invalid});
 }
 warnings.push('Preflight does not import data or verify document bytes, historical ordering, financial reconciliation, backups or cutover.');
 warnings.push('Never import legacy Password, Security_Answer_Hash, Sessions or Email_OTP as authentication state. Provision application Auth separately.');
 return {status:issues.length?'blocked':'preflight_passed',scope:'read-only supplied fields only; not full migration acceptance',counts,issues,warnings};
}
export async function loadSourceWorkbook(file){
 if(file.endsWith('.json'))return JSON.parse(await readFile(file,'utf8'));
 if(!file.endsWith('.xlsx'))throw Error('Use .xlsx or normalized .json');
 const {default:ExcelJS}=await import('exceljs'),book=new ExcelJS.Workbook();await book.xlsx.readFile(file);
 return {sheets:book.worksheets.filter(s=>!['Sessions','Email_OTP','Settings'].includes(s.name)).map(s=>{
  const headers=s.getRow(1).values.slice(1).map(v=>String(v??''));
  const safe=headers.map((h,i)=>({h,i})).filter(({h})=>! /password|security_answer|otp_hash|api.?key|secret|token/i.test(h));
  const rows=[];s.eachRow({includeEmpty:false},(r,n)=>{if(n>1)rows.push(safe.map(({i})=>{const c=r.getCell(i+1);return typeof c.value==='string'||typeof c.value==='number'||typeof c.value==='boolean'?c.value:c.text;}));});
  return {name:s.name,headers:safe.map(x=>x.h),rows};
 })};
}
if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href){
 const [input,output]=process.argv.slice(2);if(!input||!output)throw Error('Usage: node scripts/release/source-preflight.mjs /private/source.xlsx /private/report.json');
 const report=sourcePreflight(await loadSourceWorkbook(input));await writeFile(output,JSON.stringify(report,null,2)+'\n',{mode:0o600});console.log(JSON.stringify({status:report.status,tables:Object.keys(report.counts).length,issueGroups:report.issues.length}));
 if(report.status==='blocked')process.exitCode=2;
}
