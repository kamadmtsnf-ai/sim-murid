import {z} from 'zod';
export function parseGmailEnvironment(env:Record<string,string|undefined>){
 return z.object({email:z.string().trim().pipe(z.email()),password:z.string().transform(s=>s.replace(/\s/g,'')).pipe(z.string().regex(/^[a-zA-Z0-9]{16}$/)),name:z.string().trim().min(1).max(200).regex(/^[^\r\n]+$/),secret:z.string().min(32)}).parse({email:env.GMAIL_USER,password:env.GMAIL_APP_PASSWORD,name:env.GMAIL_SENDER_NAME,secret:env.EMAIL_OTP_SECRET});
}
export function gmailTransportOptions(env:ReturnType<typeof parseGmailEnvironment>){
 return {host:'smtp.gmail.com',port:465,secure:true,auth:{user:env.email,pass:env.password},tls:{minVersion:'TLSv1.2' as const},connectionTimeout:10_000,greetingTimeout:10_000,socketTimeout:15_000,logger:false,debug:false};
}
export function gmailFailureReason(error:unknown):'authentication'|'connection'|'provider_rejected'{
 const code=typeof error==='object'&&error!==null&&'code' in error?error.code:undefined;
 return code==='EAUTH'?'authentication':['ETIMEDOUT','ESOCKET','ECONNECTION','EDNS'].includes(String(code))?'connection':'provider_rejected';
}
