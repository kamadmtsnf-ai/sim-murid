import assert from 'node:assert/strict';
import {test} from 'node:test';
import {passwordChangeSchema,questionChangeSchema} from '../src/lib/auth/security-validation.ts';
import {hashAnswer,verifyAnswer} from '../src/lib/auth/answer-hash.ts';
test('password requirements preserve legacy strength rules and reject mismatches/reuse',()=>{
 const schema=passwordChangeSchema('test-user');const valid={action:'password',currentPassword:'Old!Pass92',newPassword:'New!Secret72',confirmPassword:'New!Secret72'};assert.equal(schema.safeParse(valid).success,true);
 for(const p of ['short','onlylowercase99!','AAA!password9','Test-user99!','New!Secret72'.repeat(8),'Long!é'.repeat(14)])assert.equal(schema.safeParse({...valid,newPassword:p,confirmPassword:p}).success,false);
 assert.equal(schema.safeParse({...valid,confirmPassword:'different'}).success,false);assert.equal(schema.safeParse({...valid,currentPassword:valid.newPassword}).success,false);
 assert.equal(questionChangeSchema.safeParse({action:'question',question:'q1',answer:' ',currentPassword:'p'}).success,false);
});
test('answers have unique salts, normalized Unicode, fixed work factor and timing-safe comparison',async()=>{
 const a=await hashAnswer('  Ａyu  '),b=await hashAnswer('Ayu');assert.notEqual(a,b);assert.equal(await verifyAnswer('Ayu',a),true);assert.equal(await verifyAnswer('ayu',a),false);assert.equal(await verifyAnswer('wrong',a),false);assert.equal(await verifyAnswer('Ayu','scrypt$v1$99999999$8$1$bad'),false);
});
