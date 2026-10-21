import {test} from 'node:test';
import assert from 'node:assert/strict';
import {newUserSchema} from '../src/lib/users/validation.ts';
import {provisionUser,type ProvisionPorts} from '../src/lib/users/provision.ts';
const input=newUserSchema.parse({requestId:'12345678-1234-4234-8234-123456789abc',username:'0012',fullName:' Test ',role:'student',contactEmail:'',password:'a'.repeat(48)});
test('new users preserve exact usernames and validate all roles and fields',()=>{
 assert.equal(input.username,'0012');assert.equal(input.fullName,'Test');
 for(const role of ['admin','teacher','student','applicant','parent','alumni','customer'])assert.ok(newUserSchema.safeParse({...input,role}).success);
 for(const update of [{username:' 0012'},{username:'12\n'},{role:'service_role'},{password:'12345678'},{contactEmail:'bad'},{actor:'forged'}])assert.equal(newUserSchema.safeParse({...input,...update}).success,false);
});
test('provider failure and ambiguous finish retry without creating a second identity or resetting password',async()=>{
 let existing:{id:string;email:string}|null=null,creates=0,finishes=0;const seen:string[]=[];
 const ports:ProvisionPorts={begin:async(_cmd,hash)=>{seen.push(hash);return 'pending';},find:async()=>existing,create:async(email)=>{creates++;existing={id:input.requestId,email};throw Error('network lost after provider commit');},finish:async()=>{finishes++;if(finishes===1)throw Error('database timeout');return 'created';}};
 await assert.rejects(provisionUser(input,'actor','server-secret',ports));await assert.rejects(provisionUser(input,'actor','server-secret',ports));assert.equal(await provisionUser(input,'actor','server-secret',ports),'created');assert.equal(creates,1);assert.equal(new Set(seen).size,1);
});
test('denied/duplicate/completed requests never call Auth; unrelated provider identity never adopted',async()=>{
 const nope=async()=>{throw Error('must not be called');};
 for(const state of ['denied','duplicate','created','request_conflict','rate_limited'])assert.equal(await provisionUser(input,'a','secret',{begin:async()=>state,find:nope,create:nope,finish:nope}),state);
 assert.equal(await provisionUser(input,'a','secret',{begin:async()=> 'pending',find:async()=>({id:input.requestId,email:'unrelated@example.org'}),create:nope,finish:nope}),'request_conflict');
});
