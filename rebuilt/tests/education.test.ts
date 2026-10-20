import assert from 'node:assert/strict';
import {test} from 'node:test';
import sharp from 'sharp';
import {PDFDocument} from 'pdf-lib';
import {rules,biodataSchema,emptyBiodata,completion,requiredFields,normalizeBiodata} from '../src/lib/student/validation.ts';
import {documentPrepare} from '../src/lib/documents/validation.ts';
import {inspectDocument} from '../src/lib/documents/inspect.ts';
import {endMinute,clock,scheduleCommand,classCommand,directoryQuery} from '../src/lib/education/validation.ts';
const uuid='00000000-0000-4000-8000-000000000001';
test('ST11: exact source fields, zero is filled and identity/URL privilege injections rejected',()=>{
 assert.equal(rules.fields.length,87);const d=emptyBiodata();d.JumlahSaudara='0';d.AnakKe='1';d.NIK='0012345678901234';d.NomorKK='0012345678901234';const parsed=biodataSchema.parse(d);assert.equal(parsed.NIK,'0012345678901234');assert.ok(!completion(parsed,[]).missing.includes('JumlahSaudara'));
 for(const field of ['username','Username_Ortu','KK_FileUrl','must_change_password','profile_completed_at'])assert.equal(biodataSchema.safeParse({...d,[field]:'injected'}).success,false);
 assert.equal(biodataSchema.safeParse({...d,AyahAlamatTinggalLuarNegeri:'false'}).success,false);
});
test('ST11: conditional fields match life status/foreign/same address/other guardian and copy is consistent',()=>{
 const d={...emptyBiodata(),AyahStatus:'Sudah Meninggal',IbuStatus:'Masih Hidup',IbuAlamatSamadenganAyah:true,WaliPilihan:'Ayah'};let req=requiredFields(d);assert.ok(!req.includes('AyahJalan'));assert.ok(!req.includes('IbuJalan'));assert.ok(!req.includes('WaliNama'));assert.ok(req.includes('AyahNIK'));
 req=requiredFields({...d,AyahStatus:'Masih Hidup',WaliPilihan:'Lainnya',WaliAlamatStatus:'Lainnya'});assert.ok(req.includes('AyahJalan'));assert.ok(req.includes('WaliJalan'));assert.ok(!requiredFields({...d,WaliPilihan:'Lainnya',WaliAlamatStatus:'Lainnya',WaliAlamatTinggalLuarNegeri:true}).includes('WaliJalan'));
 const copied=normalizeBiodata({...d,AyahJalan:'Jl. A',AyahNama:'Ayah'});assert.equal(copied.IbuJalan,'Jl. A');assert.equal(copied.WaliNama,'Ayah');
});
test('ST12: document kind/extension/MIME/50MB boundary and real content validation',async()=>{
 assert.ok(documentPrepare.safeParse({action:'prepare',kind:'KK',filename:'kk.pdf',mime:'application/pdf',size:52428800}).success);
 for(const patch of [{kind:'UNKNOWN'},{filename:'kk.png'},{size:52428801},{size:0},{filename:'../kk.pdf'},{mime:'text/html'}])assert.equal(documentPrepare.safeParse({action:'prepare',kind:'KK',filename:'kk.pdf',mime:'application/pdf',size:10,...patch}).success,false);
 assert.equal(documentPrepare.safeParse({action:'prepare',kind:'KTP_AYAH',filename:'ktp.pdf',mime:'application/pdf',size:10}).success,false);
 const pdf=await PDFDocument.create();pdf.addPage();const bytes=await pdf.save();assert.match(await inspectDocument(bytes,'application/pdf',bytes.length),/^[a-f0-9]{64}$/);
 const png=await sharp({create:{width:20,height:20,channels:3,background:'#fff'}}).png().toBuffer();assert.match(await inspectDocument(png,'image/png',png.length),/^[a-f0-9]{64}$/);
 await assert.rejects(inspectDocument(png,'image/jpeg',png.length));await assert.rejects(inspectDocument(bytes,'application/pdf',bytes.length+1));await assert.rejects(inspectDocument(Buffer.from('%PDF-broken'),'application/pdf',11));await assert.rejects(inspectDocument(Buffer.from('<svg/>'),'image/png',6));
});
test('ST14/15: DTOs reject duplicate IDs, forged end time, overnight lesson, invalid scope/filter; time includes break',()=>{
 assert.equal(clock(endMinute('07:00',40,2,15)),'08:35');const lesson={type:'lesson',id:null,classId:uuid,subjectId:uuid,teacherId:uuid,weekday:1,start:'07:00',durationMinutes:40,jtm:2,breakMinutes:15};assert.ok(scheduleCommand.safeParse(lesson).success);
 for(const patch of [{start:'24:00'},{start:'23:40'},{jtm:0},{durationMinutes:0},{end:'09:00'},{weekday:0}])assert.equal(scheduleCommand.safeParse({...lesson,...patch}).success,false);
 assert.equal(scheduleCommand.safeParse({type:'duties',classId:uuid,items:[{weekday:1,studentId:uuid},{weekday:1,studentId:uuid}]}).success,false);assert.equal(scheduleCommand.safeParse({type:'schedule_delete',lessonIds:[],dutyIds:[]}).success,false);
 assert.equal(classCommand.safeParse({type:'enrollment',classId:uuid,studentIds:[uuid,uuid],startsOn:'2026-07-01',remove:false}).success,false);assert.equal(directoryQuery.safeParse({role:'admin'}).success,false);assert.equal(directoryQuery.safeParse({page:2001}).success,false);
});
