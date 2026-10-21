import test from 'node:test';
import assert from 'node:assert/strict';
import {directoryQuery,directorySnapshot} from '../src/lib/education/validation.ts';
import {directoryPageCount,directoryPageUrl,directoryDate,directoryDetailSchema,directoryRoleLabel} from '../src/lib/education/directory.ts';
test('Directory pagination preserves encoded filters and enforces the existing 2000-page limit',()=>{
 const filter=directoryQuery.parse({role:'teacher',query:'A & B + /?',status:'all',page:2});const url=new URL(directoryPageUrl(filter,3),'https://example.test');assert.equal(url.searchParams.get('query'),filter.query);assert.equal(url.searchParams.get('role'),'teacher');assert.equal(url.searchParams.get('status'),'all');assert.equal(url.searchParams.get('page'),'3');
 assert.equal(directoryPageCount({total:0,page_size:50}),1);assert.equal(directoryPageCount({total:101,page_size:50}),3);assert.equal(directoryPageCount({total:100001,page_size:50}),2000);assert.throws(()=>directoryPageUrl(filter,2001));assert.equal(directoryRoleLabel('teacher'),'Guru');
});
test('Directory snapshots reject invalid pagination and completion data instead of rendering Infinity',()=>{
 const base={rows:[],page:1,page_size:50,total:0};assert.deepEqual(directorySnapshot.parse(base),base);for(const patch of [{page_size:0},{page_size:-1},{page:0},{page:2001},{total:-1},{total:1.5}])assert.equal(directorySnapshot.safeParse({...base,...patch}).success,false);
 assert.equal(directoryQuery.safeParse({query:'x'.repeat(101)}).success,false);assert.equal(directoryQuery.safeParse({page:['1','2']}).success,false);
});
test('Directory detail validates lesson bounds, nullable sensitive fields and stable localized dates',()=>{
 const id='11111111-1111-4111-8111-111111111111';const value={id,name:'Synthetic person',username:'qa',role:'teacher',status:'active',contact:null,student:null,children:[],siblings:[],enrollments:[],assignments:[],homerooms:[],lessons:[{id,class_name:'VII A',subject:'IPS',weekday:1,start_minute:420,end_minute:515,jtm:2,break_minutes:15}]};assert.deepEqual(directoryDetailSchema.parse(value),value);assert.equal(directoryDetailSchema.safeParse({...value,student:undefined}).success,false);for(const patch of [{weekday:8},{end_minute:420},{start_minute:-1}])assert.equal(directoryDetailSchema.safeParse({...value,lessons:[{...value.lessons[0],...patch}]}).success,false);assert.equal(directoryDate('not a date'),null);assert.equal(directoryDate('2026-10-21'),'21 Okt 2026');
});
