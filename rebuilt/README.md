# Rebuilt SiM-Murid — Tahap 25

Next.js App Router + TypeScript strict + Tailwind CSS + shadcn/ui + Zod + Supabase; hosting Vercel. Produksi: https://sim-muridv2.vercel.app . Kode GitHub berada di `rebuilt/`, yang menjadi Root Directory Vercel. Aplikasi GAS lama tetap dipertahankan di root repositori.

## Status saat ini

Tahap25: biodata/dokumen, direktori, kelas/jadwal, piket, absensi, bimbingan, iuran dan tabungan tersedia. Tahap21–25 menambahkan biaya dan slip penarikan, nilai/KKM, rapor immutable, kenaikan kelas, ijazah berizin, serta buku digital premium. Lihat [laporan Tahap21–25](docs/verification/stages-21-25.md).

Login, satu sesi aktif, onboarding, pemulihan Admin/OTP dan Gmail SMTP tersedia. D01–D03 mengikuti kebijakan yang disepakati. D10 koreksi KKM/arsip tetap terbuka; tidak menimpa penilaian lama atau rapor terbit. Data historis belum diimpor.

## Pengembangan dan validasi

Node24.x/npm11. Jalankan `npm ci`, isi `.env.local` dari `.env.example`, lalu `npm run dev`. Gunakan proyek Supabase khusus SiM-Murid. Secret Auth/Gmail/HMAC hanya di server, tidak pada NEXT_PUBLIC atau git. Preview/development harus memakai konfigurasi uji tersendiri.

`npm run check` menjalankan typecheck, lint,129 test, drift tipe dan build. `npm run test:smoke` memeriksa lima alur HTTP build. 25 migrasi replayable,66 tabel RLS; RPC keamanan hanya service_role. Tipe cloud berasal dari Supabase dan snapshot lokal dari PGlite. Pengujian lokal bukan pengganti bukti pengiriman aktual; status dan batas integrasi dicatat dalam docs/verification.

Sesi biasa1jam atau Ingat saya168jam, tidak diperpanjang oleh refresh. Cookie HttpOnly; tidak memakai browser Auth SDK untuk sesi ini. Tidak ada signup publik atau password default bersama. `/api/health` hanya liveness, bukan readiness database/email.

Provisioning hanya operator tepercaya:

```bash
node --env-file=.env.local scripts/provision-account.mjs /absolute/private/account-credential.json < account-input.json
```

Input: username teks persis, fullName, role, contactEmail opsional. Password sementara unik ditulis ke output privat di luar repo. Alamat teknis Auth bukan kontak terverifikasi atau tujuan pemulihan. Jangan menyimpan credential fixture atau data pengguna pada git.
