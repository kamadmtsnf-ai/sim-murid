import assert from 'node:assert/strict';
import {test} from 'node:test';
import {otpDigest,newOtp,emailTemplate} from '../src/lib/email/otp.ts';
import {emailCommand,recoveryEmailReset} from '../src/lib/email/validation.ts';
test('OTP uses six digits and HMAC binds every challenge field',()=>{
 const secret='a'.repeat(64),fields=['challenge','user','owner@example.org','verify','123456'] as const;
 const hash=otpDigest(secret,...fields);assert.match(hash,/^hmac\$v1\$[a-f0-9]{64}$/);
 assert.equal(hash,otpDigest(secret,...fields));
 for(let n=0;n<5;n++){const changed=[...fields] as [string,string,string,'verify'|'recovery',string];changed[n]=n===3?'recovery':'different';assert.notEqual(hash,otpDigest(secret,...changed));}
 for(let i=0;i<100;i++)assert.match(newOtp(),/^\d{6}$/);assert.throws(()=>otpDigest('',...fields));
});
test('transactional templates escape personal text and distinguish recovery from verification',()=>{
 const t=emailTemplate('<img src=x onerror="bad">','123456','verify');assert.ok(!t.htmlContent.includes('<img'));assert.ok(t.htmlContent.includes('&lt;img'));assert.ok(t.textContent.includes('123456'));assert.match(t.htmlContent,/10 menit/);assert.notEqual(t.subject,emailTemplate('Name','654321','recovery').subject);
});
test('OTP DTO refuses victim identity overrides and malformed codes',()=>{
 assert.ok(emailCommand.safeParse({action:'send'}).success);assert.equal(emailCommand.safeParse({action:'send',userId:'victim'}).success,false);
 for(const code of ['12345','1234567','12a456'])assert.equal(emailCommand.safeParse({action:'verify',challengeId:'00000000-0000-4000-8000-000000000001',code}).success,false);
 assert.equal(recoveryEmailReset.safeParse({action:'reset',username:'u',challengeId:'bad',code:'123456',newPassword:'A!Password92',confirmPassword:'A!Password92'}).success,false);
});

import {parseGmailEnvironment,gmailTransportOptions,gmailFailureReason} from '../src/lib/email/gmail-config.ts';
test('Gmail accepts App Password grouping, enforces TLS and refuses malformed configuration',()=>{
 const input={GMAIL_USER:'sender@gmail.com',GMAIL_APP_PASSWORD:'abcd efgh ijkl mnop',GMAIL_SENDER_NAME:'MTs Nurul Falah',EMAIL_OTP_SECRET:'s'.repeat(64)};
 const env=parseGmailEnvironment(input);assert.equal(env.password,'abcdefghijklmnop');
 const options=gmailTransportOptions(env);assert.equal(options.host,'smtp.gmail.com');assert.equal(options.port,465);assert.equal(options.secure,true);assert.equal(options.debug,false);assert.equal(options.auth.user,env.email);
 for(const invalid of [{GMAIL_USER:'bad'},{GMAIL_APP_PASSWORD:'regular-password'},{GMAIL_SENDER_NAME:'Name\r\nBcc: victim@example.org'},{EMAIL_OTP_SECRET:'short'}])assert.throws(()=>parseGmailEnvironment({...input,...invalid}));
});
test('Gmail errors expose only safe classifications',()=>{
 assert.equal(gmailFailureReason({code:'EAUTH',message:'secret password'}),'authentication');assert.equal(gmailFailureReason({code:'ETIMEDOUT'}),'connection');assert.equal(gmailFailureReason(new Error('private SMTP response')),'provider_rejected');
});
