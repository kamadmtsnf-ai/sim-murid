# Fondasi database — panduan penggunaan

## Target dan status

Migrations disiapkan untuk **proyek Supabase khusus Rebuilt SiM-Murid**. Penelusuran read-only pada19Oktober2026 hanya menemukan proyek lms-nurul-falah. Proyek tersebut tidak dipilih dan tidak diubah. Tidak ada project baru dibuat, tidak ada migration remote diterapkan, tidak ada data atau key produksi diunduh.

Di lingkungan pengerjaan ini tidak tersedia Docker/Postgres server native. SQL benar-benar dijalankan pada PGlite0.5.10 (PostgreSQL18.6 WebAssembly) dengan stub auth.users dan role test-only. Itu menguji DDL,constraint,FK,trigger,grant dan RLS di engine PostgreSQL terisolasi; **bukan** layanan Supabase Auth,PostgREST,Storage atau Supabase CLI local stack. Config CLI menarget PostgreSQL17. Verifikasi PostgreSQL17 dan layanan Supabase tetap diperlukan ketika target tersedia.

## Struktur

- supabase/config.toml dibuat Supabase CLI2.121.0; tidak menyimpan remote project link.
- supabase/migrations berisi3berkas yang namanya dibuat `supabase migration new` melalui CLI, lalu diisi SQL.
- Core:14tabel public,2domainrupiah,2triggerhelpers.
- Operations:10tabel privat untuk sesi,recovery,OTP,audit,outbox,job dan staging.
- Reference data:7role,7tugas,16mapel,3kebijakan yang disetujui. Tidak membuat user/password,kelas,tahun aktif atau tarif.
- supabase/seed.sql kosong secara fungsional, khusus fixture lokal opsional. Master yang wajib berada di migration agar tidak tergantung --include-seed saat deployment.
- scripts/database/harness.mjs hanya test adapter; jangan jalankan bootstrap auth/role test sebagai migration produksi.
- scripts/database/generate-types.mjs membentuk type snapshot dari katalog lokal; bukan hasil `supabase gen types` cloud.
- scripts/database/verify-foundation.sql adalah pemeriksaan read-only untuk target setelah migration.

## Memverifikasi tanpa Docker

```bash
npm ci
npm run test:database
npm run db:advisory
npm run db:types:check
npm run typecheck
```

Test menggunakan database in-memory terpisah; tidak membaca DATABASE_URL atau project Supabase lain. Generate ulang snapshot bila schema berubah:

```bash
npm run db:types
```

Snapshotpublic types tidak menyertakan schema privat. Regenerasi resmi dari target wajib sebelum API/live query diperluas; types tidak memberikan izin dan tidak menggantikan RLS.

## Memverifikasi dengan Supabase lokal penuh

Pada komputer dengan Docker dan Node.js yang sesuai, gunakan CLI yang dipin di package-lock:

```bash
npx supabase --help
npx supabase start
npx supabase db reset --local
npx supabase db advisors --local
npx supabase gen types --local --schema public
```

`db reset --local` menghapus data stack lokal tersebut. Gunakan hanya lingkungan pengembangan yang boleh dibangun ulang. Jangan menggunakan --linked untuk reset proyek daring. Simpan output gen types ke file sementara, periksa dan ganti database.types.ts secara atomik bila berhasil; jangan merusak file types dengan redirection yang gagal.

Langkah ini belum dijalankan pada sesi Tahap4 karena Docker tidak tersedia. Sebelum deploy, jalankan kembali seluruh tests dan cek mismatch versi/tipe pada stack Supabase aktual. Config PostgreSQL17 tidak sama dengan PGlite18, meski DDL memakai fitur umum yang tersedia pada17.

## Penerapan ke proyek daring yang dipilih

1. Pastikan nama/ref, lingkungan dan kepemilikan proyek Rebuilt SiM-Murid telah ditentukan; jangan pilih LMS hanya karena itu satu-satunya koneksi.
2. Baca schema/migration history target. Untuk database berisi, capture baseline/backup dan review benturan nama sebelum menerapkan. Migrasi awal bukan skrip penggabungan otomatis schema aplikasi lain.
3. Link melalui CLI sesuai project yang dikonfirmasi; periksa bantuan `supabase link --help` bila perlu. Jangan menyimpan credential dalam source atau command argument log.
4. Jalankan `npx supabase db push --dry-run` pada target benar dan review3migrasi; baru terapkan dalam lingkup deployment yang diminta.
5. Jalankan verify-foundation.sql read-only; pastikan24tabel RLS,zero grantclient,2helpers security-invoker,zero FK tanpaindex. Jalankan Supabase Advisors aktual pada target; laporan custom lokal tidak menggantikannya.
6. Generate types resmi dari target terpilih, cekdiff, jalankan typecheck dan tests API/RLS. Tidak membuka izin client hanya untuk membuat query berhasil; tahap7 menetapkan policy sesuai peran.
7. Konfigurasikan .env.local/Vercel hanya dari targetterpilih. URL+publishablekey boleh publik; secretkey server-only. Buatakun/profil melalui jalurAuth padaTahap5, bukan seedpasswordbersama.

CLI migrations melacak penerapan dan tidak diulang manual. Setiap file memakai transaksi. Rerun satu file DDL yang sudah diterapkan akan gagal karena objek sudahada; ini disengaja, bukan script IFNOTEXISTS yang menutupi drift. Reproducibility dibuktikan dengan replay pada database kosong terpisah, bukan menerapkan migrationdua kali ke database berisi.

## SDK dalam aplikasi

createClient browser dan createRequestClient server telah dipasang dengan generik Database. Server factory menerima cookie adapter dengan getAll+setAll termasuk cacheheaders versiSDK aktual. Belum ada route yang memakai factory ini; proxy/sessionrefresh/claims check adaTahap5–6. Hindari shared client global antarrequest. Tidak ada factory secret-bypass umum.

Parser env mengizinkan HTTPSremote serta HTTPlocalhost/loopback tepat untuk Supabase lokal, bukan hostseperti localhost.attacker.invalid. Build static tetap dapat berjalan tanpa environment, dan pemanggilan factory dengan konfigurasi kosong menghasilkan error yang tidak memuat key.
