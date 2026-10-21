import assert from 'node:assert/strict';
import { test } from 'node:test';
import { loginSchema, verifiedTokenSession } from '../src/lib/auth/validation.ts';

test('username identity preserves zeroes/case and rejects implicit normalization',()=>{
 for(const username of ['00123','123','Guru.A','guru-001','001-002','-guru','guru-'])assert.equal(loginSchema.parse({username,password:' Password ',remember:false}).username,username);
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

test('device label uses coarse server classifications without raw UA retention',async()=>{
 const {deviceLabel}=await import('../src/lib/auth/devices.ts');
 assert.equal(deviceLabel('Mozilla Windows Chrome/126 Safari/1'),'Chrome · Windows');
 assert.equal(deviceLabel('Android Chrome/126 Edg/1'),'Edge · Android');
 assert.equal(deviceLabel('<script>secret username</script>'),'Browser · perangkat tidak dikenal');
});
test('session actions never infer revoke-all from a missing session id',async()=>{
 const {sessionCommand}=await import('../src/lib/auth/sessions.ts');
 assert.equal(sessionCommand.safeParse({action:'revoke',scope:'one'}).success,false);
 assert.equal(sessionCommand.safeParse({action:'revoke',scope:'all',actor:'forged'}).success,false);
 assert.equal(sessionCommand.safeParse({action:'revoke',scope:'all'}).success,true);
});
