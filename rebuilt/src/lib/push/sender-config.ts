import 'server-only';
import {pushConfiguration} from './config';
export function senderConfiguration(url:string,env:NodeJS.ProcessEnv=process.env){
 const c=pushConfiguration(url,env);if(!c)return null;
 return {...c,dispatch:env.WEB_PUSH_DISPATCH_ENABLED==='true',privateKey:env.WEB_PUSH_VAPID_PRIVATE_KEY!,subject:env.WEB_PUSH_VAPID_SUBJECT!};
}
export type SenderConfiguration=NonNullable<ReturnType<typeof senderConfiguration>>;
