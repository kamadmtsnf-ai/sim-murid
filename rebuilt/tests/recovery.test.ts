import assert from 'node:assert/strict';
import {test} from 'node:test';
import {recoveryRequestSchema,recoveryResolveSchema,profileSchema} from '../src/lib/auth/recovery-validation.ts';
test('recovery request preserves exact username and rejects identity/role injection',()=>{
 assert.equal(recoveryRequestSchema.parse({username:'00123',requestType:'password',method:'manual'}).username,'00123');
 for(const x of [{username:' user',requestType:'password',method:'manual'},{username:'u',requestType:'password',method:'question',question:'q1',answer:' '},{username:'u',requestType:'session',method:'manual',userId:'victim'},{username:'u',requestType:'password',method:'question',question:'q9',answer:'A'}])assert.equal(recoveryRequestSchema.safeParse(x).success,false);
});
test('admin recovery requires explicit identity proof, evidence and current password',()=>{
 const valid={requestId:'00000000-0000-4000-8000-000000000001',action:'approve',identityConfirmed:true,evidenceReference:'BA-2026-0001',currentPassword:'Valid!Password92'};
 assert.ok(recoveryResolveSchema.safeParse(valid).success);
 for(const data of [{...valid,identityConfirmed:false},{...valid,currentPassword:''},{...valid,evidenceReference:'user@example.org'},{...valid,temporaryPassword:'12345678'}])assert.equal(recoveryResolveSchema.safeParse(data).success,false);
});
test('profile DTO rejects privileges, technical email and invalid addresses',()=>{
 const profile={username:'00123',full_name:'Name',phone:'081234567890',contact_email:'Contact@Example.org',bio:'Bio',updated_at:'2026-10-19T11:00:00.123456+00:00'};
 assert.equal(profileSchema.parse(profile).contact_email,'contact@example.org');
 assert.ok(profileSchema.safeParse({...profile,contact_email:''}).success);
 for(const data of [{...profile,role:'admin'},{...profile,full_name:''},{...profile,contact_email:'bad@'},{...profile,contact_email:'uuid@auth.sim-murid.invalid'},{...profile,teacher_email_verified_at:profile.updated_at}])assert.equal(profileSchema.safeParse(data).success,false);
});
