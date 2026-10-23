import assert from 'node:assert/strict';
import {test} from 'node:test';
import sharp from 'sharp';
import {settingsRequest,emptySchool,schoolAddress} from '../src/lib/settings/validation.ts';
import {normalizeSchoolLogo} from '../src/lib/settings/image.ts';
const id='00000000-0000-4000-8000-000000000001';
const parse=(command:unknown)=>settingsRequest.safeParse({requestId:id,revision:0,command});
test('Settings preserve text identifiers, address components, and reject identity/asset injection',()=>{
 const profile={...emptySchool,name:'MTs',identity_data:{...emptySchool.identity_data,head_nip:'00123',npsn:'00012',phone:'0812'}};
 const p=parse({type:'profile',profile});assert.ok(p.success);assert.equal(p.data.command.type,'profile');if(p.data.command.type==='profile')assert.equal(p.data.command.profile.identity_data.npsn,'00012');
 assert.equal(parse({type:'profile',profile:{...profile,asset_data:{school:'evil.svg'}}}).success,false);assert.equal(settingsRequest.safeParse({requestId:id,revision:0,actor:id,command:{type:'profile',profile}}).success,false);
 assert.equal(schoolAddress({...emptySchool.address_data,street:'Jl. A',village:'B',district:'C',regency:'D',province:'E'}),'Jl. A, Kel. B, Kec. C, D, E');
});
test('Holiday date validation rejects impossible dates, reversed/oversized ranges and multi-day edits',()=>{
 const h={type:'holiday',id:null,start:'2028-02-28',end:'2028-03-01',description:'Libur'};assert.ok(parse(h).success);
 for(const patch of [{start:'2026-02-29'},{start:'2028-03-02'},{end:'2029-03-02'},{id},{start:'1899-12-31'},{description:''}])assert.equal(parse({...h,...patch}).success,false);
});
test('Catalog inputs reject delimiters/control characters and normalize memorization legacy delimiter',()=>{
 assert.equal(parse({type:'subject',id:null,name:'IPS,IPA',active:true}).success,false);
 assert.equal(parse({type:'subject',id:null,name:'IPS\nInjected',active:true}).success,false);
 const r=parse({type:'memorization',id:null,name:'Doa; harian',active:true});assert.ok(r.success);if(r.data.command.type==='memorization')assert.equal(r.data.command.name,'Doa, harian');
});
test('School logo decodes/re-encodes real images and rejects SVG, forged MIME, damaged and oversized images',async()=>{
 const png=await sharp({create:{width:64,height:32,channels:4,background:'#123456'}}).png().toBuffer();
 const out=await normalizeSchoolLogo(png,'image/png');const meta=await sharp(out).metadata();assert.equal(meta.format,'png');assert.equal(meta.width,64);assert.equal(meta.exif,undefined);
 await assert.rejects(normalizeSchoolLogo(png,'image/jpeg'));await assert.rejects(normalizeSchoolLogo(Buffer.from('<svg onload="alert(1)"/>'),'image/svg+xml'));await assert.rejects(normalizeSchoolLogo(new Uint8Array(0),'image/png'));await assert.rejects(normalizeSchoolLogo(new Uint8Array(2097153),'image/png'));
 const huge=await sharp({create:{width:4097,height:1,channels:3,background:'#fff'}}).png().toBuffer();await assert.rejects(normalizeSchoolLogo(huge,'image/png'));
});


test('Settings acknowledgement requires known status and safe revision; readback matches command content', async()=>{
 const {settingsAcknowledgement,confirmSettings}=await import('../src/lib/settings/confirmation.ts');
 for(const ack of [{code:'saved'},{code:'unknown'},{code:'saved',revision:-1},{code:'saved',revision:Number.MAX_SAFE_INTEGER+1}])assert.equal(settingsAcknowledgement.safeParse(ack).success,false);
 const profile={...emptySchool,name:'Madrasah',identity_data:{...emptySchool.identity_data,npsn:'00001'}};
 const data={revision:1,school:{...profile,id,asset_data:{school:id+'.png'},updated_at:'2026-10-23'},subjects:[{id,code:'IPS',sort_order:1,name:'IPS',active:true}],memorization:[],holidays:[{id,holiday_date:'2028-02-29',description:'Existing'}]};
 assert.doesNotThrow(()=>confirmSettings(data,{type:'profile',profile},1));
 assert.throws(()=>confirmSettings(data,{type:'profile',profile:{...profile,name:'Other'}},1));
 assert.throws(()=>confirmSettings(data,{type:'profile',profile},2));
 assert.doesNotThrow(()=>confirmSettings(data,{type:'subject',id:null,name:'IPS',active:true},1));
 assert.throws(()=>confirmSettings(data,{type:'subject',id:null,name:'IPA',active:true},1));
 assert.throws(()=>confirmSettings(data,{type:'deactivate',catalog:'subject',id},1));
 assert.doesNotThrow(()=>confirmSettings(data,{type:'holiday',id:null,start:'2028-02-29',end:'2028-02-29',description:'Skipped preserves original'},1));
 assert.throws(()=>confirmSettings(data,{type:'holiday',id:null,start:'2028-02-29',end:'2028-03-01',description:'Missing date'},1));
 assert.throws(()=>confirmSettings(data,{type:'holiday_delete',id},1));
 assert.doesNotThrow(()=>confirmSettings(data,{type:'logo',slot:'school',path:id+'.png'},1));
 assert.throws(()=>confirmSettings(data,{type:'logo',slot:'school',path:'other.png'},1));
 assert.throws(()=>confirmSettings(data,{type:'logo_clear',slot:'school'},1));
});
