# Rebuilt SiM-Murid — Tahap 7

Next.js App Router + TypeScript strict + Tailwind CSS + shadcn/ui + Zod + Supabase. Produksi: https://sim-muridv2.vercel.app . GitHub menyimpan aplikasi ini pada `rebuilt/`; gunakan folder tersebut sebagai Root Directory Vercel.

## Pengembangan

Node.js 24.x dan npm 11. Jalankan `npm ci`, isi `.env.local` dari `.env.example` dengan proyek SiM-Murid, lalu `npm run dev`. Halaman fondasi/build dapat berjalan tanpa credential, tetapi login memerlukan kedua konfigurasi publik dan SUPABASE_SECRET_KEY di server. Secret tidak boleh masuk NEXT_PUBLIC atau git. PowerShell dapat menggunakan `npm.cmd` bila diperlukan.

## Autentikasi

`/login` menerima username/password; `/account` memeriksa Supabase Auth dan registry sesi aktif di server. Logout melalui POST same-origin. Tidak ada pendaftaran publik atau password bawaan. Sesi biasa maksimum 1 jam, remember maksimum 168 jam; login kedua ditolak selama sesi lain aktif. Refresh Auth tidak memperpanjang TTL aplikasi. Cookie auth HttpOnly; jangan memakai browser auth SDK untuk sesi ini.

Provisioning akun hanya oleh operator tepercaya melalui terminal dengan secret server:

```bash
node --env-file=.env.local scripts/provision-account.mjs /absolute/private/account-credential.json < account-input.json
```

Input JSON: username (teks persis, nol awal dipertahankan), fullName, role, contactEmail opsional. Role: admin/teacher/student/applicant/customer/alumni/parent. Simpan input dan output di luar repositori. Password sementara unik otomatis ditulis ke output privat yang belum ada; jangan bagikan melalui git. Akun tanpa email menggunakan email teknis UUID khusus Auth, bukan email kontak/tujuan pemulihan. Flag wajib ganti password default true; UI penggantiannya mengikuti tahap keamanan akun. Tidak ada akun Admin dibuat otomatis.

## Validasi dan cakupan

`npm run check` menjalankan typecheck, ESLint, pengujian fondasi, 18 pengujian DB fondasi, 2 validasi auth, 3 pengujian DB auth, drift snapshot dan build. `npm run test:smoke` memeriksa HTTP build lokal; `npm run db:advisory` memeriksa katalog lokal. Keduanya tidak menggantikan Supabase Auth/PostgREST aktual. Lihat `docs/verification/stage-07.md` untuk bukti integrasi.

Enam migrasi cloud di Supabase qpzoukkhdxpmbtkcqemj; 27 tabel RLS. RPC autentikasi hanya service_role; izin modul belum dibuka. `cloud.types.ts` dihasilkan dari proyek daring; `database.types.ts` tetap snapshot replay PGlite untuk tabel publik. Regenerasikan keduanya bila schema berubah.

Tahap 6 menambahkan /account/sessions: riwayat perangkat, pencabutan sesi sendiri dan pencabutan oleh Admin dengan audit serta pemeriksaan role terkini. Tahap 7 melanjutkan izin modul dan RLS. RLS peran Tahap 7, onboarding/password/recovery/email dan modul operasional mengikuti tahap berikutnya. Dokumen bisnis di `docs/specifications` dan `docs/decisions` tetap menjadi acuan. Health `/api/health` hanya liveness; bukan readiness database. Tidak ada data murid yang dimigrasikan.

## Tahap 7

/account/access menampilkan konteks izin dari database. Empat belas tabel fondasi memiliki policy SELECT sesuai ownership/peran/kelas; seluruh mutasi client tetap ditutup hingga handler modul beraudit tersedia. Helper registry private memvalidasi Auth session dan TTL pada setiap akses. Relasi domain yang belum dibuat tetap default-deny; lihat laporan Tahap 7 untuk batas cakupan dan hasil pengujian positif dan negatif produksi yang telah lulus.
