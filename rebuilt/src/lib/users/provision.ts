import {createHmac} from 'node:crypto';
import type {NewUser} from './validation.ts';
// Ports keep Auth/API failure recovery independently testable. Roles come from SQL, never metadata.
export interface ProvisionPorts {
 begin:(command:Omit<NewUser,'password'|'requestId'>,fingerprint:string)=>Promise<string>;
 find:()=>Promise<{id:string;email?:string}|null>;
 create:(email:string,password:string)=>Promise<void>;
 finish:(fingerprint:string)=>Promise<string>;
}
export async function provisionUser(input:NewUser,actor:string,secret:string,ports:ProvisionPorts){
 const {requestId,password,...command}=input;
 const fingerprint=createHmac('sha256',secret).update(JSON.stringify([actor,requestId,command,password])).digest('hex');
 const state=await ports.begin(command,fingerprint);
 if(state!=='pending')return state;
 const email=`${requestId}@auth.sim-murid.invalid`;
 const existing=await ports.find();
 if(existing&&(existing.id!==requestId||existing.email!==email))return 'request_conflict';
 if(!existing)await ports.create(email,password);
 return ports.finish(fingerprint);
}
