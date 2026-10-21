import {z} from 'zod';
export const userRoles={student:'Siswa',teacher:'Guru',applicant:'Calon siswa',parent:'Orang tua',alumni:'Alumni',customer:'Pelanggan',admin:'Admin'} as const;
export const newUserSchema=z.object({
 requestId:z.uuid(),
 username:z.string().min(1,'Username wajib diisi.').max(100).refine(v=>v===v.trim()&&!/[\u0000-\u001f\u007f]/u.test(v),'Username tidak boleh memiliki spasi di awal/akhir atau karakter kontrol.'),
 fullName:z.string().trim().min(1,'Nama wajib diisi.').max(200),
 role:z.enum(['student','teacher','applicant','parent','alumni','customer','admin']),
 contactEmail:z.union([z.email().max(320),z.literal('')]),
 password:z.string().min(20).max(128).regex(/^[A-Za-z0-9_-]+$/,'Gunakan kata sandi sementara yang dihasilkan aplikasi.'),
}).strict();
export type NewUser=z.infer<typeof newUserSchema>;
