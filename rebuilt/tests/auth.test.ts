import assert from 'node:assert/strict';
import { test } from 'node:test';
import { loginSchema, verifiedTokenSession } from '../src/lib/auth/validation.ts';

test('username identity preserves zeroes/case and rejects implicit normalization',()=>{
 for(const username of ['00123','123','Guru.A'])assert.equal(loginSchema.parse({username,password:' Password ',remember:false}).username,username);
 for(const username of [' 123','123 ','a\n',''])assert.equal(loginSchema.safeParse({username,password:'p',remember:false}).success,false);
 assert.equal(loginSchema.safeParse({username:123,password:'p',remember:false}).success,false);
 assert.equal(loginSchema.parse({username:'001',password:' Password ',remember:false}).password,' Password ');
 assert.equal(loginSchema.safeParse({username:'001',password:'p',remember:'true'}).success,false);
});
test('verified JWT session extraction refuses malformed/mismatched identities',()=>{
 const id='00000000-0000-4000-8000-000000000001', session='00000000-0000-4000-8000-000000000002';
 const token='header.'+Buffer.from(JSON.stringify({sub:id,session_id:session})).toString('base64url')+'.signature';
 assert.equal(verifiedTokenSession(token,id),session);
 assert.throws(()=>verifiedTokenSession(token,session));
 assert.throws(()=>verifiedTokenSession('bad',id));
});
