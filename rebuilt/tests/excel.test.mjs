import test from 'node:test';import assert from 'node:assert/strict';import {registerHooks} from 'node:module';import {readFileSync} from 'node:fs';import ts from 'typescript';import ExcelJS from 'exceljs';
registerHooks({resolve(s,c,n){if(s==='server-only')return {url:'excel:empty',shortCircuit:true};if(s.startsWith('.')&&!/\.[cm]?[jt]sx?$/.test(s)&&c.parentURL?.startsWith('file:')){const u=new URL(s+'.ts',c.parentURL);try{readFileSync(u);return {url:u.href,shortCircuit:true}}catch{}}return n(s,c)},load(u,c,n){if(u==='excel:empty')return {format:'module',source:'export{}',shortCircuit:true};if(u.endsWith('.ts'))return {format:'module',source:ts.transpileModule(readFileSync(new URL(u),'utf8'),{compilerOptions:{module:ts.ModuleKind.ESNext,target:ts.ScriptTarget.ES2022}}).outputText,shortCircuit:true};return n(u,c)}});
const {excelBytes}=await import('../src/lib/spreadsheets/write.ts'),{readExcel,inspectExcelZip,decodeWorkbook}=await import('../src/lib/spreadsheets/read.ts'),{parseUserRows,userHeaders,createUserDraft}=await import('../src/lib/users/import.ts');
test('Real XLSX preserves zero/minus/long identifiers and formula-looking strings as text',async()=>{const ids=['001-02','1-2','00012345678901234567890','=SUM(A1:A2)'];const bytes=await excelBytes(['username'],ids.map(x=>[x]));assert.deepEqual(await readExcel(bytes,['username'],['username']),[['username'],...ids.map(x=>[x])]);const b=new ExcelJS.Workbook();await b.xlsx.load(Buffer.from(bytes));assert.equal(b.getWorksheet('Data').getCell('A2').numFmt,'@');assert.equal(b.getWorksheet('Data').getCell('A5').type,ExcelJS.ValueType.String);});
test('Excel rejects formula/date/hyperlink/numeric identity values and unexpected sheets/headers',async()=>{for(const value of [123,{formula:'1+1',result:2},{text:'visit',hyperlink:'https://example.org'},new Date()]){const b=new ExcelJS.Workbook();b.addWorksheet('Data').addRows([['username'],[value]]);await assert.rejects(readExcel(new Uint8Array(await b.xlsx.writeBuffer()),['username'],['username']));}const bytes=await excelBytes(['other'],[['x']]);await assert.rejects(readExcel(bytes,['username'],['username']));const b=new ExcelJS.Workbook();b.addWorksheet('Hidden').addRows([['username'],['x']]);await assert.rejects(readExcel(new Uint8Array(await b.xlsx.writeBuffer()),['username'],['username']));});
test('Excel caps actual ZIP decompression, forged archives, data rows and base64 encoding',async()=>{assert.throws(()=>inspectExcelZip(new Uint8Array(10)));assert.throws(()=>inspectExcelZip(new Uint8Array(1048577)));for(const v of ['bad','UEs=\n','!!!!'])assert.throws(()=>decodeWorkbook(v));const bytes=Buffer.from(await excelBytes(['username'],Array.from({length:101},(_,i)=>['u-'+i])));await assert.rejects(readExcel(bytes,['username'],['username']));const c=bytes.indexOf(Buffer.from([0x50,0x4b,0x01,0x02]));bytes.writeUInt32LE(0,c+24);assert.throws(()=>inspectExcelZip(bytes));});
test('User preview rejects duplicate and invalid role rows and preserves literal identities',()=>{const data=[userHeaders,['001-02','Nama','student',''],['1-2','Guru','teacher','g@example.org']];const r=parseUserRows(data);assert.equal(r.issues.length,0);assert.equal(r.rows[0].username,'001-02');assert.equal(parseUserRows([...data,data[1]]).issues[0].row,4);assert.equal(parseUserRows([userHeaders,['a','Nama','Guru','']]).issues.length,1);assert.equal(parseUserRows([userHeaders,['a','','student','bad']]).issues.length,1);});
test('Each user gets a fresh strong temporary credential, retained by a retry payload',()=>{const row={username:'001-02',fullName:'Nama',role:'student',contactEmail:''};const a=createUserDraft(row),b=createUserDraft(row);assert.notEqual(a.requestId,b.requestId);assert.notEqual(a.password,b.password);assert.match(a.password,/^Aa1_[a-f0-9]{48}$/);assert.equal(JSON.parse(JSON.stringify(a)).requestId,a.requestId);});

const {userTemplate,bulkTemplate,templateMarker,importQuality}=await import('../src/lib/spreadsheets/templates.ts');
test('versioned workbooks round-trip while old unversioned templates stay compatible',async()=>{
 const rows=[['001-02','Nama','student','']];
 for(const versioned of [true,false]){
  const bytes=await excelBytes(userHeaders,rows,['Contoh username 001-02'],versioned?userTemplate:undefined);
  assert.deepEqual(await readExcel(bytes,userHeaders,userHeaders,userTemplate),[userHeaders,...rows]);
  const book=new ExcelJS.Workbook();await book.xlsx.load(Buffer.from(bytes));
  if(versioned)assert.equal(book.getWorksheet('Panduan').getCell('A1').value,templateMarker(userTemplate));
 }
});
test('wrong version/type or duplicate template markers reject without accepting data rows',async()=>{
 for(const template of [{id:'users',version:2},bulkTemplate('grades')]){
  const bytes=await excelBytes(userHeaders,[['001-02','Nama','student','']],[],template);
  await assert.rejects(readExcel(bytes,userHeaders,userHeaders,userTemplate),/Versi atau jenis/);
 }
 const bytes=await excelBytes(userHeaders,[['001-02','Nama','student','']],[templateMarker(userTemplate)],userTemplate);
 await assert.rejects(readExcel(bytes,userHeaders,userHeaders,userTemplate),/Versi atau jenis/);
});
test('ordinary exports gain no template marker or changed data structure',async()=>{
 const bytes=await excelBytes(['baris_excel','username','status'],[[2,'001-02','Belum dapat dipastikan']]);
 const book=new ExcelJS.Workbook();await book.xlsx.load(Buffer.from(bytes));
 assert.equal(book.worksheets.length,1);assert.equal(book.getWorksheet('Data').getCell('B2').value,'001-02');assert.equal(book.getWorksheet('Data').getCell('B2').type,ExcelJS.ValueType.String);
});
test('user field diagnostics identify corrections without echoing source values',()=>{
 const result=parseUserRows([userHeaders,[' name','','GURU','sensitive-invalid-email']]);
 assert.equal(result.issues[0].row,2);assert.match(result.issues[0].message,/Username/);assert.match(result.issues[0].message,/Nama/);assert.match(result.issues[0].message,/kode peran/);assert.match(result.issues[0].message,/Email/);assert.doesNotMatch(result.issues[0].message,/sensitive-invalid-email/);
});
test('quality percentage counts distinct invalid rows and rejects impossible summaries',()=>{
 assert.deepEqual(importQuality(4,[2,2,3]),{count:4,valid:2,invalid:2,percentage:50});assert.equal(importQuality(3,[2]).percentage,67);
 for(const [n,issues] of [[0,[]],[101,[]],[2,[4]],[2,[-1]]])assert.throws(()=>importQuality(n,issues));
});

test('report layout wraps diagnostic cells without changing normal export defaults',async()=>{
 const report=await excelBytes(['baris_excel','keterangan'],[[2,'Periksa isian. '.repeat(20)]],[],undefined,{wrapText:true});
 const book=new ExcelJS.Workbook();await book.xlsx.load(Buffer.from(report));const sheet=book.getWorksheet('Data');assert.equal(sheet.getCell('B2').alignment.wrapText,true);assert.equal(sheet.getColumn(2).width,64);assert.ok(sheet.getRow(2).height>=30);assert.equal(sheet.getCell('B2').type,ExcelJS.ValueType.String);
});
