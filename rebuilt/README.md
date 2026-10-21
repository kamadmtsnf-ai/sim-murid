# Rebuilt SiM-Murid — Tahap 30

Next.js App Router + TypeScript strict + Tailwind CSS + shadcn/ui + Zod + Supabase; hosting Vercel. Produksi: https://sim-muridv2.vercel.app . Kode GitHub berada di `rebuilt/`, yang menjadi Root Directory Vercel. Aplikasi GAS lama tetap dipertahankan di root repositori.

## Status saat ini

Kode Tahap26–30 menambahkan SPK, notifikasi, arsip/reset bulanan, SoTM/afektif, survei utama/peer/mikro, analitik berizin, rencana aksi, adapter penyedia dan paket ekspor lintas modul. Lihat [laporan Tahap26–30](docs/verification/stages-26-30.md).

Tahap30 cutover belum dinyatakan selesai: ekspor sumber, rekonsiliasi aktual, percobaan restore, UAT lintas peran dan beban terautentikasi masih diperlukan. Runbook ada pada docs/release/cutover-runbook.md. Data historis belum diimpor. D10 koreksi arsip KKM/rapor tetap terbuka; tidak menimpa arsip terbit.

## Pengembangan dan validasi

Node24.x/npm11. Jalankan `npm ci`, isi `.env.local` dari `.env.example`, lalu `npm run dev`. Gunakan proyek Supabase khusus SiM-Murid. Secret Auth/Gmail/HMAC hanya di server, tidak pada NEXT_PUBLIC atau git. Preview/development harus memakai konfigurasi uji tersendiri.

`npm run check` menjalankan typecheck, lint,152 test, drift tipe dan build. `npm run test:smoke` memeriksa lima alur HTTP build. 32 migrasi replayable,79 tabel RLS; RPC keamanan hanya service_role. Tipe cloud berasal dari Supabase dan snapshot lokal dari PGlite. Pengujian lokal bukan pengganti bukti pengiriman aktual; status dan batas integrasi dicatat dalam docs/verification.

Sesi biasa1jam atau Ingat saya168jam, tidak diperpanjang oleh refresh. Cookie HttpOnly; tidak memakai browser Auth SDK untuk sesi ini. Tidak ada signup publik atau password default bersama. `/api/health` hanya liveness, bukan readiness database/email.

Provisioning hanya operator tepercaya:

```bash
node --env-file=.env.local scripts/provision-account.mjs /absolute/private/account-credential.json < account-input.json
```

Input: username teks persis, fullName, role, contactEmail opsional. Password sementara unik ditulis ke output privat di luar repo. Alamat teknis Auth bukan kontak terverifikasi atau tujuan pemulihan. Jangan menyimpan credential fixture atau data pengguna pada git.
