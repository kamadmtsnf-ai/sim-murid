# Penambahan pengguna oleh admin

Lokasi: sidebar **Direktori pengguna → Tambah pengguna**. Tombol membuka dialog dan hanya dirender untuk admin. Admin harus telah menyelesaikan pengaturan keamanan dan survei wajib. Halaman Hak akses saya tetap hanya menampilkan akses akun sendiri.

Isian: nama lengkap, username persis (termasuk nol awal dan kapital), salah satu dari tujuh peran yang sudah ada, dan email kontak opsional. Kata sandi sementara acak 192-bit dibuat dalam memori browser memakai Web Crypto, dengan tambahan karakter untuk kompatibilitas kebijakan password. Setelah berhasil, kredensial disamarkan dan bisa disalin; penutupan dialog menghapusnya dari state. Tidak ada localStorage/sessionStorage, kata sandi di respons API, ataupun pengiriman email otomatis. Pengguna wajib mengganti password dan menjalani onboarding yang sudah berlaku. Email kontak tidak otomatis terverifikasi; kelas/tugas/relasi keluarga tetap dikelola melalui modul terkait.

## Implementasi dan keamanan

- `src/app/account/directory/add-user.tsx`: dialog responsif, label, status, copy/toggle password, busy guard, payload beku saat hasil belum pasti, pemulihan fokus dan peringatan sebelum meninggalkan halaman.
- `src/app/account/directory/page.tsx`: memasang tombol hanya untuk admin.
- `src/app/api/directory/users/route.ts`: Origin, identitas dari sesi server, gate pendidikan/survei, pemeriksaan admin, Zod, respons privat tanpa rahasia.
- `src/lib/users/{validation,provision}.ts`: kontrak dan orkestrasi provider yang dapat diuji; retry tidak membuat identitas kedua dan tidak mengganti password akun yang sudah ada.
- `supabase/migrations/20261021180621_admin_user_provisioning.sql`: reservasi username/UUID, pemeriksaan admin terkini pada kedua RPC, maksimum 20 reservasi per admin per 15 menit, transaksi atomik profil/peran/onboarding/audit. RLS aktif; tabel/RPC tidak tersedia untuk anon/authenticated. Tidak mengubah akun yang sudah ada.
- `src/lib/supabase/runtime.types.ts`: kontrak dua RPC baru.
- `tests/{users.test.ts,users-route.test.mjs,database/users.test.mjs,directory-server.test.mjs}`: validasi, otorisasi, provider failure/retry, rahasia, uniqueness, onboarding, audit, rate limit dan rollback transaksi.
- `tests/ui/users-*`, `scripts/verify-users.mjs`: fixture komponen tanpa akun produksi.
- `package.json`, `scripts/verify-ui.mjs`: memasukkan tes dan penolakan API baru ke regresi.
- `tests/database/foundation.test.mjs`, `scripts/database/advisory.mjs`: jumlah baseline menjadi 34 migration/80 tabel setelah penambahan satu tabel privat.

Reservasi menyimpan command dan fingerprint HMAC, bukan password. Identitas Auth dibuat server dengan UUID reservasi dan alamat internal sintetis seperti skrip provisioning yang sudah ada. Jika provider atau respons database terputus setelah commit, request yang sama melanjutkan UUID yang sama. Perubahan payload/password dengan request ID sama ditolak. Profile+role+must-change+audit berhasil bersama atau seluruh transaksi dibatalkan.

## Verifikasi 21 Oktober 2026

- `npm ci --ignore-scripts`: berhasil; skrip wajib aplikasi dijalankan oleh prebuild.
- `npm run check`: lulus **199 tes**, TypeScript, lint, snapshot 14 tabel publik, dan production build.
- TypeScript, lint, build diulang sesudah perbaikan label select dan wrapping nama panjang; lulus. Tes pengguna diulang sesudah penguatan validasi SQL; **10 tes lulus**.
- Browser fitur: **11 pemeriksaan**, **6 tampilan axe**, nol pelanggaran dan nol uncaught JavaScript error. Viewport 320×700, 375×812, 768×1024, 1440×900, 812×375; dialog berada dalam viewport dan kontennya dapat digulir.
- Regresi browser: **69 pemeriksaan**, **8 tampilan axe**, nol pelanggaran. API produksi lokal menolak anonim (401) dan Origin asing (403). Next lokal menormalisasi origin request ke localhost; pengujian Origin sah mengikuti canonical URL tersebut.
- Migration `admin_user_provisioning` berhasil diterapkan ke proyek Supabase aplikasi. Pemeriksaan metadata langsung: RLS true, anon/authenticated table read false, authenticated RPC execute false, service_role RPC execute true.
- Advisors security/performance diperiksa. RLS tanpa policy pada tabel privat disengaja: browser tidak diberi grant/policy dan hanya server dapat mengakses. Informasi: https://supabase.com/docs/guides/database/database-linter?lint=0008_rls_enabled_no_policy
- Index baru diberi informasi `unused_index` karena fitur belum dipakai. Index actor/waktu diperlukan untuk pembatasan laju dan FK, sehingga dipertahankan. Tidak ada error advisor baru.
- Audit deadcode: 151 source files, 87 entry points, nol unreachable.
- Peringatan platform terpisah: leaked-password protection belum aktif. Tidak diubah sebagai bagian fitur ini. Panduan: https://supabase.com/docs/guides/auth/password-security#password-strength-and-leaked-password-protection

## Batas dan rekonsiliasi

Tidak membuat akun nyata atau menyimpan data pribadi produksi untuk QA. Pengujian sukses browser menggunakan respons fixture; provider diuji lewat port mock dan SQL lewat database terisolasi. Pembuatan akun end-to-end dengan sesi admin produksi belum dijalankan karena tidak ada data akun baru yang diminta pengguna.

Jangan memuat ulang/meninggalkan halaman saat hasil masih belum pasti: ulangi melalui dialog yang sama. Dialog pending dapat ditutup dan dibuka kembali selama halaman tetap terbuka. Jika halaman hilang, secret server diputar, hak admin dicabut, atau terjadi benturan dengan CLI di tengah proses, reservasi perlu direkonsiliasi operator. Jangan menghapus/mengadopsi identitas Auth otomatis. Operator berwenang memeriksa reservasi dan UUID terkait, memastikan identitas dan role, menyelesaikan transaksi yang sesuai atau melakukan reset terverifikasi dengan password sementara baru, lalu mengaudit tindakannya. Password lama tidak dapat dipulihkan dari fingerprint. Tidak ada fitur edit/hapus/reset pengguna baru dalam lingkup perubahan ini.
