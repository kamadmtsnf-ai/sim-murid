import 'server-only';
import nodemailer from 'nodemailer';
import {emailTemplate} from './otp';
import {parseGmailEnvironment,gmailTransportOptions,gmailFailureReason} from './gmail-config';
export class ProviderCheckError extends Error{constructor(readonly reason:ReturnType<typeof gmailFailureReason>){super('Gmail SMTP unavailable');}}
export function emailEnvironment(){return parseGmailEnvironment(process.env);}
export async function sendOtp(email:string,name:string,code:string,purpose:'verify'|'recovery'){
 const env=emailEnvironment(),transport=nodemailer.createTransport(gmailTransportOptions(env));
 const template=emailTemplate(name,code,purpose);
 try{
  const result=await transport.sendMail({from:{address:env.email,name:env.name},to:{address:email,name},subject:template.subject,text:template.textContent,html:template.htmlContent,disableFileAccess:true,disableUrlAccess:true});
  if(!result.accepted.some(address=>address.toLowerCase()===email.toLowerCase()))throw new Error('Recipient rejected');
  return result.messageId;
 }catch(error){throw new ProviderCheckError(gmailFailureReason(error));}finally{transport.close();}
}
export async function senderStatus(){
 const env=emailEnvironment(),transport=nodemailer.createTransport(gmailTransportOptions(env));
 try{await transport.verify();return {provider:'gmail' as const,email:env.email,name:env.name,active:true,deliveryVerified:false};}
 catch(error){throw new ProviderCheckError(gmailFailureReason(error));}finally{transport.close();}
}
