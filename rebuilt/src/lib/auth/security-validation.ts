import {z} from 'zod';
export const questions = [
 {code:'q1',label:'Apa nama panggilan masa kecil Anda?'},
 {code:'q2',label:'Apa nama hewan peliharaan pertama Anda?'},
 {code:'q3',label:'Apa makanan favorit yang sering dimasak ibu saat Anda kecil?'},
 {code:'q4',label:'Siapa nama guru MI/SD favorit Anda?'},
 {code:'q5',label:'Siapa nama guru MTs favorit Anda?'},
] as const;
const currentPassword=z.string().min(1).max(1024);
export const normalizeAnswer=(value:string)=>value.normalize('NFKC').trim();
export function passwordValueSchema(username:string){return z.string().min(8).max(72)
 .refine(s=>new TextEncoder().encode(s).length<=72,'Password maksimal 72 byte.')
 .refine(s=>/[a-z]/.test(s)&&/[A-Z]/.test(s)&&/[0-9]/.test(s)&&/[^a-zA-Z0-9]/.test(s),'Gunakan huruf besar/kecil, angka dan simbol.')
 .refine(s=>!/(.)\1\1/u.test(s),'Jangan mengulang karakter yang sama tiga kali.')
 .refine(s=>!s.toLowerCase().includes(username.toLowerCase()),'Password tidak boleh memuat username.')
 .refine(s=>!/[\u0000-\u001f\u007f]/u.test(s),'Karakter kontrol tidak diizinkan.');}
export function passwordChangeSchema(username:string){
 return z.object({action:z.literal('password'),currentPassword,newPassword:passwordValueSchema(username),confirmPassword:z.string().max(1024)}).strict()
 .refine(x=>x.newPassword===x.confirmPassword,'Konfirmasi password tidak sama.')
 .refine(x=>x.currentPassword!==x.newPassword,'Password baru harus berbeda.');
}
export const questionChangeSchema=z.object({action:z.literal('question'),currentPassword,question:z.enum(['q1','q2','q3','q4','q5']),answer:z.string().max(256).transform(normalizeAnswer).pipe(z.string().min(1).max(256))}).strict();
export const securityStateSchema=z.object({gate:z.enum(['password','profile_pending','security_question','email_pending','survey_pending','account_pending','ready']),destination:z.enum(['/account','/account/security']),question_code:z.enum(['q1','q2','q3','q4','q5']).nullable(),role:z.string().nullable(),can_set_question:z.boolean()});
export type SecurityState=z.infer<typeof securityStateSchema>;
