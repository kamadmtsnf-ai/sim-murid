# Rebuilt SiM-Murid — Tahap 8

Next.js App Router + TypeScript strict + Tailwind CSS + shadcn/ui + Zod + Supabase. Produksi: https://sim-muridv2.vercel.app . GitHub menyimpan aplikasi ini pada `rebuilt/`; gunakan folder tersebut sebagai Root Directory Vercel.

## Pengembangan

Node.js 24.x dan npm 11. Jalankan `npm ci`, isi `.env.local` dari `.env.example` dengan proyek SiM-Murid, lalu `npm run dev`. Halaman fondasi/build dapat berjalan tanpa credential, tetapi login memerlukan kedua konfigurasi publik dan SUPABASE_SECRET_KEY di server. Secret tidak boleh masuk NEXT_PUBLIC atau git. PowerShell dapat menggunakan `npm.cmd` bila diperlukan.

## Autentikasi

`/login` menerima username/password; `/account` memeriksa Supabase Auth dan registry sesi aktif di server. Logout melalui POST same-origin. Tidak ada pendaftaran publik atau password bawaan. Sesi biasa maksimum 1 jam, remember maksimum 168 jam; login kedua ditolak selama sesi lain aktif. Refresh Auth tidak memperpanjang TTL aplikasi. Cookie auth HttpOnly; jangan memakai browser auth SDK untuk sesi ini.

Provisioning akun hanya oleh operator tepercaya melalui terminal dengan secret server:

```bash
node --env-file=.env.local scripts/provision-account.mjs /absolute/private/account-credential.json < account-input.json
```

Input JSON: username (teks persis, nol awal dipertahankan), fullName, role, contactEmail opsional. Role: admin/teacher/student/applicant/customer/alumni/parent. Simpan input dan output di luar repositori. Password sementara unik otomatis ditulis ke output privat yang belum ada; jangan bagikan melalui git. Akun tanpa email menggunakan email teknis UUID khusus Auth, bukan email kontak/tujuan pemulihan. Flag wajib ganti password default true; penggantian tersedia di /account/security. Tidak ada akun Admin dibuat otomatis.

## Validasi dan cakupan

`npm run check` menjalankan typecheck, ESLint, pengujian fondasi, 18 pengujian DB fondasi, 4 validasi auth, 3 pengujian DB auth, 4 sesi, 7 otorisasi, 6 keamanan, drift snapshot dan build. `npm run test:smoke` memeriksa HTTP build lokal; `npm run db:advisory` memeriksa katalog lokal. Keduanya tidak menggantikan Supabase Auth/PostgREST aktual. Lihat `docs/verification/stage-07.md` untuk bukti integrasi.

Tujuh migrasi cloud di Supabase qpzoukkhdxpmbtkcqemj; 27 tabel RLS. RPC internal keamanan hanya service_role; baca fondasi dibatasi RLS dan gate onboarding. `cloud.types.ts` dihasilkan dari proyek daring; `database.types.ts` tetap snapshot replay PGlite untuk tabel publik. Regenerasikan keduanya bila schema berubah.

Tahap 6 menambahkan /account/sessions: riwayat perangkat, pencabutan sesi sendiri dan pencabutan oleh Admin dengan audit serta pemeriksaan role terkini. Tahap 7 menambahkan izin fondasi dan RLS; Tahap 8 menambahkan keamanan akun dan gate. Pemulihan/email, profil lengkap dan modul operasional mengikuti tahap terkait. Dokumen bisnis di `docs/specifications` dan `docs/decisions` tetap menjadi acuan. Health `/api/health` hanya liveness; bukan readiness database. Tidak ada data murid yang dimigrasikan.

## Tahap 7

/account/access menampilkan konteks izin dari database. Empat belas tabel fondasi memiliki policy SELECT sesuai ownership/peran/kelas; seluruh mutasi client tetap ditutup hingga handler modul beraudit tersedia. Helper registry private memvalidasi Auth session dan TTL pada setiap akses. Relasi domain yang belum dibuat tetap default-deny; lihat laporan Tahap 7 untuk batas cakupan dan hasil pengujian positif dan negatif produksi yang telah lulus.

## Tahap 8

/account/security menyediakan ganti password dengan konfirmasi password lama, validasi kekuatan dan pencabutan seluruh registry sesi, serta lima pertanyaan keamanan dengan hash scrypt bersalt. Gate database dan server konsisten: password → profil wajib → pertanyaan → email Guru → layanan. Marker profil penuh hanya boleh diisi validator Tahap 11; email terverifikasi hanya oleh OTP Tahap 9. Survei wajib dihubungkan saat modul survei tersedia. Tidak ada reset berbasis jawaban saja. Lihat docs/verification/stage-08.md.

Pengujian integrasi keamanan memakai `python scripts/verify-security-live.py /absolute/private-fixtures.json` hanya untuk fixture sementara yang telah disetujui. File berisi publishableKey serta objek admin/student dengan id, username, oldPassword, newPassword dan answer. Skrip tidak mengaktifkan akun atau memberikan peran; operator wajib menonaktifkan fixture dan mencabut semua sesi setelah selesai. Jangan menyimpan file kredensial di repositori.
