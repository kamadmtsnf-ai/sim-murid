import {createHmac,randomInt} from 'node:crypto';
export function newOtp(){return String(randomInt(0,1_000_000)).padStart(6,'0');}
export function otpDigest(secret:string,id:string,user:string,email:string,purpose:'verify'|'recovery',code:string){
 if(secret.length<32)throw new Error('OTP secret missing');
 return 'hmac$v1$'+createHmac('sha256',secret).update(JSON.stringify(['v1',id,user,email,purpose,code])).digest('hex');
}
export function emailTemplate(name:string,code:string,purpose:'verify'|'recovery'){
 const escape=(s:string)=>s.replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]!));
 const title=purpose==='verify'?'Verifikasi email SiM-Murid':'Pemulihan password SiM-Murid';
 const text=`Assalamu’alaikum, ${name}.\n\nKode ${purpose==='verify'?'verifikasi email':'pemulihan password'} Anda: ${code}\n\nKode berlaku maksimal 10 menit dan hanya dapat digunakan sekali. Jangan membagikan kode ini kepada siapa pun, termasuk pihak yang mengaku sebagai petugas. Jika Anda tidak meminta kode ini, abaikan email dan hubungi administrator madrasah bila diperlukan.\n\nWassalamu’alaikum,\nSiM-Murid | MTs Nurul Falah`;
 return {subject:title,textContent:text,htmlContent:`<!doctype html><html lang="id"><body style="background:#f4f7f8;color:#18332e;font-family:Arial,sans-serif;padding:24px"><main style="max-width:560px;margin:auto;background:#fff;border-radius:12px;padding:32px"><p style="font-size:14px;color:#527066">SiM-Murid · MTs Nurul Falah</p><h1 style="font-size:24px">${title}</h1><p>Assalamu’alaikum, ${escape(name)}.</p><p>Gunakan kode berikut untuk ${purpose==='verify'?'memverifikasi email Anda':'memulihkan password akun Anda'}:</p><p style="font-size:32px;font-weight:bold;letter-spacing:8px;background:#edf6f1;padding:20px;text-align:center">${escape(code)}</p><p>Kode berlaku maksimal <strong>10 menit</strong> dan hanya dapat digunakan sekali.</p><p>Jangan membagikan kode kepada siapa pun, termasuk pihak yang mengaku sebagai petugas.</p><p style="font-size:13px;color:#527066">Jika Anda tidak meminta kode ini, abaikan email dan hubungi administrator madrasah bila diperlukan.</p><hr style="border:0;border-top:1px solid #dce7e2"><p>Wassalamu’alaikum,<br>SiM-Murid | MTs Nurul Falah</p></main></body></html>`};
}
