# Rebuilt SiM-Murid — Tahap 9

Next.js App Router + TypeScript strict + Tailwind CSS + shadcn/ui + Zod + Supabase; hosting Vercel. Produksi: https://sim-muridv2.vercel.app . Kode GitHub berada di `rebuilt/`, yang menjadi Root Directory Vercel. Aplikasi GAS lama tetap dipertahankan di root repositori.

## Status saat ini

Login username/password, registry satu sesi aktif, pengelolaan perangkat, otorisasi/RLS, ganti password, pertanyaan keamanan, pemulihan melalui Admin dan profil dasar telah tersedia. Pemulihan Admin memakai verifikasi identitas, password Admin, audit dan password sementara unik yang wajib diganti.

OTP Guru `/account/email` dan pemulihan kontak terverifikasi `/recovery/email` telah diimplementasikan melalui Brevo. Kode enam digit memakai HMAC, TTL600detik, cooldown60detik,5permintaan/hariWIB,5percobaan dan single-use. Kode pemulihan lama dibatalkan ketika password berubah; sesi dicabut sebelum perubahan Auth.

Pengiriman positif produksi **belum diterima**: Brevo mengembalikan HTTP401/api_key_rejected saat pemeriksaan API. Variabel sudah tersedia dan dibaca server. Perbaiki API key aktif pada Vercel Production dan redeploy, lalu lanjutkan uji kirim/kode. Tidak ada email diklaim terkirim. Lihat [laporan email](docs/verification/stage-09-email.md) dan [konfigurasi Brevo](docs/deployment/email-setup.md).

Biodata wajib Siswa/Calon tetap Tahap11; survei dan modul operasional mengikuti tahapan terkait. Form profil dasar tidak menandai biodata lengkap. Tidak ada data murid yang dimigrasikan. D01/D02/D03 tetap sesuai docs/decisions; D10 KKM arsip masih terbuka.

## Pengembangan dan validasi

Node24.x/npm11. Jalankan `npm ci`, isi `.env.local` dari `.env.example`, lalu `npm run dev`. Gunakan proyek Supabase khusus SiM-Murid. Secret Auth/Brevo/HMAC hanya di server, tidak pada NEXT_PUBLIC atau git. Preview/development harus memakai konfigurasi uji tersendiri.

`npm run check` menjalankan typecheck, lint,68 test, drift tipe dan build. `npm run test:smoke` memeriksa lima alur HTTP build. Sembilan migrasi replayable,27 tabel RLS; RPC keamanan hanya service_role. Tipe cloud berasal dari Supabase dan snapshot lokal dari PGlite. Pengujian lokal bukan pengganti bukti pengiriman aktual; status dan batas integrasi dicatat dalam docs/verification.

Sesi biasa1jam atau Ingat saya168jam, tidak diperpanjang oleh refresh. Cookie HttpOnly; tidak memakai browser Auth SDK untuk sesi ini. Tidak ada signup publik atau password default bersama. `/api/health` hanya liveness, bukan readiness database/email.

Provisioning hanya operator tepercaya:

```bash
node --env-file=.env.local scripts/provision-account.mjs /absolute/private/account-credential.json < account-input.json
```

Input: username teks persis, fullName, role, contactEmail opsional. Password sementara unik ditulis ke output privat di luar repo. Alamat teknis Auth bukan kontak terverifikasi atau tujuan pemulihan. Jangan menyimpan credential fixture atau data pengguna pada git.
