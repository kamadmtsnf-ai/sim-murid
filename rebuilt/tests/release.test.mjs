import test from 'node:test';import assert from 'node:assert/strict';
import {sourcePreflight} from '../scripts/release/source-preflight.mjs';
const sheet=(name,headers,rows)=>({name,headers,rows});
test('Legacy preflight preserves username strings and blocks orphan grades and name-only fee allocations without leaking data',()=>{
 const book={sheets:[sheet('Users',['Username'],[['001'],['A']]),sheet('Nilai',['Username','Tipe','Nilai'],[['001','PH-1',0],['missing-person','ATS',80]]),sheet('Iuran_Komite',['Nama_Siswa','Jumlah'],[['Private person',10000]])]};const result=sourcePreflight(book);assert.equal(result.status,'blocked');assert.ok(result.issues.some(i=>i.code==='unmapped_username'&&i.count===1));assert.ok(result.issues.some(i=>i.code.includes('fee_name')));assert.doesNotMatch(JSON.stringify(result),/Private person|missing-person|001/);
 assert.equal(sourcePreflight({sheets:[sheet('Users',['Username'],[[1]])]}).status,'blocked');
});
test('Legacy preflight rejects duplicate/case collisions, malformed scores and unknown score types',()=>{
 const result=sourcePreflight({sheets:[sheet('Users',['Username'],[['same'],['same'],['SAME']]),sheet('Nilai',['Username','Tipe','Nilai'],[['same','invented',101]])]});for(const code of ['duplicate_username','username_case_collision_requires_review','unknown_assessment_type','score_out_of_range_or_unparsed'])assert.ok(result.issues.some(i=>i.code===code));
});
