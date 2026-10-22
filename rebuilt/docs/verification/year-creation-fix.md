# Perbaikan pembuatan tahun ajaran — 22 Oktober 2026

Baseline main `79ed59767b380f76c3169c5125804491253b2342` (PR #16), branch `fix/year-creation-safeupdate`.

## Penyebab dan bukti

Log PostgreSQL produksi mencatat dua error SQLSTATE `21000` pada `app_classes_write`, tepat di statement `update sim_murid_private.education_state set revision=revision+1`. Role koneksi PostgREST `authenticator` memiliki `session_preload_libraries=supautils, safeupdate`. Fungsi tidak memiliki WHERE pada update tersebut. Tabel state hanya memiliki satu baris dan tidak memiliki trigger; hak INSERT/UPDATE service_role tersedia. Pengaman [pg-safeupdate](https://github.com/eradman/pg-safeupdate) menolak UPDATE tanpa kondisi, termasuk di dalam fungsi.

Transaksi dibatalkan, sehingga API mengembalikan kegagalan layanan dan UI menampilkan hasil belum dapat dipastikan. Pemeriksaan read-only saat diagnosis menemukan 0 tahun ajaran, 0 semester, dan revisi pendidikan 0. Tidak ada data tahun ajaran yang dibuat ulang atau dihapus oleh perbaikan ini.

## Perbaikan minimal

Tambahkan `where singleton=true` pada UPDATE state/settings yang memang menyimpan satu baris. Jangan mematikan safeupdate, mengubah RLS, menambah privilege, atau mengganti security invoker. Identitas caller, lock/revisi, request idempotency, audit, transaksi, dan logika bisnis tetap sama.

Pola yang sama ditemukan pada tujuh fungsi: `app_classes_write`, `app_family_write`, `app_schedules_write`, `app_operations_write`, `app_learning_write`, `app_services_write`, dan `app_point_admin`. Masing-masing hanya mendapat satu kondisi WHERE; seluruh body lainnya dibandingkan dengan produksi sebelum dibuatkan migrasi.

## File

- `supabase/migrations/*_singleton_write_predicates.sql`: mengganti tujuh fungsi dengan predikat baris tunggal yang eksplisit; tidak ada perubahan data/tabel/grants.
- `tests/database/singleton-writes.test.mjs`: verifikasi kontrak predikat yang diperlukan pengaman produksi, serta pembuatan tahun ajaran lewat role service_role, dua rentang semester, snapshot hasil, replay satu kali, duplicate dan stale.
- `tests/database/foundation.test.mjs`, `docs/database/schema-snapshot.json`: hitungan migrasi dan snapshot hasil replay.
- `package.json`: memasukkan regresi ini ke `npm run check`.
- Laporan ini dan `year-creation/*.json`: hasil, bukti teredaksi, dan batas pengujian.

## Batas pengujian

Database lokal PGlite tidak memuat ekstensi C safeupdate. Karena itu suite bisnis sebelumnya dapat lulus walaupun UPDATE tanpa WHERE ditolak oleh lingkungan produksi. Tes baru memeriksa definisi seluruh UPDATE singleton secara eksplisit, di samping menjalankan fungsi asli pada database terisolasi dengan role service_role. Tes baseline gagal pada persyaratan predikat, lalu lulus setelah perbaikan.

Tidak mengklaim pengujian admin terautentikasi di produksi atau membuat akun/tahun ajaran uji di produksi. Verifikasi produksi dilakukan pada body/grants/pengaturan pengaman dan batas akses tanpa identitas. Setelah rilis, halaman yang sudah terkunci oleh respons lama harus dimuat ulang sebelum mencoba kembali.

## Hasil final

`npm run check` lulus: 268 tes/0 gagal, TypeScript, lint, tipe database dan production build. Migrasi `20261022101238_singleton_write_predicates` sudah diterapkan. Ketujuh body fungsi produksi cocok dengan SQL yang diuji; invoker dan grants tetap sama. `safeupdate` tetap dimuat oleh authenticator; tidak ada konfigurasi pengaman yang dilonggarkan. Panggilan tanpa identitas ditolak. Jumlah tahun ajaran/semester tetap 0 karena tidak ada pembuatan data produksi untuk pengujian.

Advisor sebelum/sesudah identik. Peringatan leaked-password protection yang sudah ada berada di luar lingkup perbaikan ini; [rujukan](https://supabase.com/docs/guides/auth/password-security#password-strength-and-leaked-password-protection). Bukti mesin ada pada `year-creation/*.json`.
