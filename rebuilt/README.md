# Rebuilt SiM-Murid — Tahap 10

Next.js App Router + TypeScript strict + Tailwind CSS + shadcn/ui + Zod + Supabase; hosting Vercel. Produksi: https://sim-muridv2.vercel.app . Kode GitHub berada di `rebuilt/`, yang menjadi Root Directory Vercel. Aplikasi GAS lama tetap dipertahankan di root repositori.

## Status saat ini

Tahap10: /account/settings menyediakan profil sekolah, kop/logo sekolah dan koperasi, master mapel/hafalan, serta CRUD hari libur/rentang inklusif. Hanya Admin ready; revision/idempotency/audit menjaga integritas. Rincian dan batas pengujian: [laporan Tahap10](docs/verification/stage-10.md).

Login username/password, registry satu sesi aktif, pengelolaan perangkat, otorisasi/RLS, ganti password, pertanyaan keamanan, pemulihan melalui Admin dan profil dasar telah tersedia. Pemulihan Admin memakai verifikasi identitas, password Admin, audit dan password sementara unik yang wajib diganti.

OTP Guru `/account/email` dan pemulihan kontak terverifikasi `/recovery/email` telah diimplementasikan melalui Gmail SMTP. Kode enam digit memakai HMAC, TTL600detik, cooldown60detik,5permintaan/hariWIB,5percobaan dan single-use. Kode pemulihan lama dibatalkan ketika password berubah; sesi dicabut sebelum perubahan Auth.

Konfigurasi Gmail Production tersedia. Pengguna membuktikan SMTP active=true; penerimaan pesan inbox/OTP belum diuji. App Password berbeda dari password login Google. Lihat [konfigurasi Gmail](docs/deployment/email-setup.md); laporan Brevo sebelumnya tetap disimpan sebagai riwayat.

Biodata wajib Siswa/Calon tetap Tahap11; survei dan modul operasional mengikuti tahapan terkait. Form profil dasar tidak menandai biodata lengkap. Tidak ada data murid yang dimigrasikan. D01/D02/D03 tetap sesuai docs/decisions; D10 KKM arsip masih terbuka.

## Pengembangan dan validasi

Node24.x/npm11. Jalankan `npm ci`, isi `.env.local` dari `.env.example`, lalu `npm run dev`. Gunakan proyek Supabase khusus SiM-Murid. Secret Auth/Gmail/HMAC hanya di server, tidak pada NEXT_PUBLIC atau git. Preview/development harus memakai konfigurasi uji tersendiri.

`npm run check` menjalankan typecheck, lint,80 test, drift tipe dan build. `npm run test:smoke` memeriksa lima alur HTTP build. Sepuluh migrasi replayable,30 tabel RLS; RPC keamanan hanya service_role. Tipe cloud berasal dari Supabase dan snapshot lokal dari PGlite. Pengujian lokal bukan pengganti bukti pengiriman aktual; status dan batas integrasi dicatat dalam docs/verification.

Sesi biasa1jam atau Ingat saya168jam, tidak diperpanjang oleh refresh. Cookie HttpOnly; tidak memakai browser Auth SDK untuk sesi ini. Tidak ada signup publik atau password default bersama. `/api/health` hanya liveness, bukan readiness database/email.

Provisioning hanya operator tepercaya:

```bash
node --env-file=.env.local scripts/provision-account.mjs /absolute/private/account-credential.json < account-input.json
```

Input: username teks persis, fullName, role, contactEmail opsional. Password sementara unik ditulis ke output privat di luar repo. Alamat teknis Auth bukan kontak terverifikasi atau tujuan pemulihan. Jangan menyimpan credential fixture atau data pengguna pada git.
