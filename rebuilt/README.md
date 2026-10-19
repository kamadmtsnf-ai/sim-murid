# Rebuilt SiM-Murid — Fondasi Tahap 4

Proyek Next.js App Router + TypeScript strict + Tailwind CSS + shadcn/ui + Zod. Target hosting Vercel; SDK Supabase, migrasi dan schema awal tersedia; penerapan daring belum dilakukan.

## Menjalankan

Gunakan Node.js24.x dan npm11 atau versi kompatibel. Buka terminal pada folder proyek, lalu:

```bash
npm ci
npm run dev
```

Buka http://localhost:3000. Tidak perlu .env.local untuk halaman fondasi. Pada Windows PowerShell gunakan npm.cmd bila kebijakan eksekusi memblokir npm.ps1.

## Pemeriksaan

```bash
npm run typecheck
npm run lint
npm run test:foundation
npm run test:database
npm run db:advisory
npm run db:types:check
npm run build
npm run start
```

npm run start dijalankan setelah build. Healthcheck liveness: GET /api/health. Halaman / dan /foundation menginformasikan tahap pengembangan; akun dan modul bisnis belum tersedia.

## Batas tahap

Termasuk konfigurasi strict, dependensi versi eksak+package-lock, komponen UI, validasi Zod bersama, metadata Indonesia/WIB, error/404, registry17modul, kontrak Result, snapshot kebijakan disepakati, dokumentasi acuan dan template environment tanpa rahasia.

Termasuk schema awal dan RLS default-deny yang diuji pada PostgreSQL terisolasi. Belum termasuk koneksi Supabase daring, login (Tahap5), izin peran/RLS scoped (Tahap7), modul operasional (Tahap9+), dan deployment produksi. Tidak ada push GitHub, tidak ada proyek Vercel/Supabase baru yang dibuat otomatis.

## Struktur

- src/app: App Router, halaman dan API liveness.
- src/components/ui: komponen shadcn/ui dan style tokens.
- src/config: metadata, registry modul dan snapshot kebijakan.
- src/lib: utilities, kontrak response, Zod DTO.
- src/modules: direktori domain sesuai registry; belum diisi service dummy.
- docs/specifications: dokumen dasar dan matriks kesetaraan.
- docs/decisions: keputusan bisnis yang berlaku.
- docs/verification: catatan hasil validasi aktual.
- tests: verifikasi kontrak validasi fondasi.

## Environment dan pengembangan lanjutan

Lihat .env.example. Salin ke .env.local hanya saat mulai integrasi dan isi credential project yang benar. Publishable key berbeda dari secret key. Jangan memasukkan private key ke NEXT_PUBLIC_ atau commit. src/lib/validation/environment.ts hanya parser input publik, bukan bukti koneksi berhasil.

Dokumentasi resmi yang diperiksa: https://nextjs.org/docs/app/getting-started/installation, https://tailwindcss.com/docs/installation/framework-guides/nextjs, https://ui.shadcn.com/docs/installation/manual, https://ui.shadcn.com/docs/components/radix/button, https://zod.dev/ .

## Database Tahap 4

Lihat docs/database/README.md dan conventions.md untuk24tabel,3migrasi,runbooktarget,seedmaster,SDK dan batas verifikasi. TestPGlite bukan pengganti SupabaseAuth/PostgREST/Storage. Jalankan npm run test:database untuk18pengujian SQL nyata, db:advisory untuk cekcustom dan db:types:check untuk drift.

Hanya proyek lms-nurul-falah yang terlihat saat pemeriksaan; tidak ada perubahan pada proyek itu. Target Rebuilt SiM-Murid belum dipilih.
