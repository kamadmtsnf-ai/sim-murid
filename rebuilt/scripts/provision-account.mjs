/** Trusted operator CLI only. Never imported into a route or client bundle.
 * node --env-file=.env.local scripts/provision-account.mjs /absolute/private-credential.json < account.json
 * Input: {username,fullName,role,contactEmail?}. Output file contains temporary password.
 */
import { randomBytes, randomUUID } from 'node:crypto';
import { writeFile, unlink } from 'node:fs/promises';
import { isAbsolute, relative } from 'node:path';
import { createClient } from '@supabase/supabase-js';
import { z } from 'zod';
const schema=z.object({username:z.string().min(1).max(100).refine(s=>s===s.trim()&&!/[\u0000-\u001f\u007f]/u.test(s)),fullName:z.string().trim().min(1).max(200),role:z.enum(['admin','teacher','student','applicant','customer','alumni','parent']),contactEmail:z.email().optional()}).strict();
const output=process.argv[2];
if(!output)throw Error('A private credential output path is required.');
if(!isAbsolute(output)||!relative(process.cwd(),output).startsWith('..'))throw Error('Use an absolute credential path outside the repository.');
let input='';for await(const chunk of process.stdin){input+=chunk;if(input.length>8192)throw Error('Input too large.');}
const account=schema.parse(JSON.parse(input));
const url=process.env.NEXT_PUBLIC_SUPABASE_URL;
if(url!=='https://qpzoukkhdxpmbtkcqemj.supabase.co' && !/^http:\/\/(127\.0\.0\.1|localhost):\d+$/.test(url??''))throw Error('Wrong project target; review before provisioning.');
if(!process.env.SUPABASE_SECRET_KEY)throw Error('Server secret required.');
const client=createClient(url,process.env.SUPABASE_SECRET_KEY,{auth:{persistSession:false,autoRefreshToken:false}});
const password=randomBytes(24).toString('base64url');
// Reserve output atomically before creating any account; never overwrite an existing credential.
await writeFile(output,JSON.stringify({username:account.username,temporaryPassword:password},null,2)+'\n',{flag:'wx',mode:0o600});
let userId;
try {
 const {data,error}=await client.auth.admin.createUser({email:`${randomUUID()}@auth.sim-murid.invalid`,password,email_confirm:true});
 if(error||!data.user)throw Error('Auth provisioning failed.');
 userId=data.user.id;
 const profile=await client.from('profiles').insert({id:userId,username:account.username,full_name:account.fullName,contact_email:account.contactEmail??null});
 if(profile.error)throw Error('Profile provisioning failed.');
 const role=await client.from('user_roles').insert({user_id:userId,role_code:account.role});
 if(role.error)throw Error('Role provisioning failed.');
 // Absent auth_accounts row also defaults to must_change_password=true at login.
 console.log(JSON.stringify({id:userId,username:account.username,status:'created',credentialFile:output}));
} catch(error) {
 if(userId){
  const r=await client.from('user_roles').delete().eq('user_id',userId);
  const p=await client.from('profiles').delete().eq('id',userId);
  const a=await client.auth.admin.deleteUser(userId);
  if(r.error||p.error||a.error)throw Error('Provisioning incomplete; reconcile account '+userId+' before retrying. Credential file retained.');
 }
 await unlink(output);
 throw error;
}
