# P08 — Input massal dan kualitas data

24 Oktober 2026 WIB. Baseline main `d49876342ccf9c9596f2ad12c4a87410705aef27`; branch `feat/bulk-input-p08`. Siklus P01–P12, bukan pembangunan ulang 1–30.

## Status dan gerbang aktivasi

Implementasi/QA disiapkan untuk merge; **aktivasi Supabase bersama masih diblokir persetujuan**. Auto-review menolak `apply_migration` dengan alasan: “Applying this migration directly to the shared Supabase project persistently creates an index and privileged RPCs, which is a production/shared database mutation not explicitly authorized by the user’s request to implement and merge P08; local isolated migration tests are a safer alternative.” Tidak memakai execute_sql, CLI atau jalur lain untuk mengakali penolakan. Pemeriksaan metadata read-only setelah penolakan menunjukkan kedua RPC dan indeks belum ada.

Kode dirilis aman dengan pemeriksaan ketersediaan server per sesi: hanya probe `status` read-only dengan principal/session nyata dan UUID permintaan baru. Respons `not_found` sah berarti RPC terpasang; error/timeout/denied/format lain menonaktifkan tombol impor. Sumber input lama tetap tersedia. Tidak memakai fake login, akun dummy produksi, feature flag berbayar atau metadata user sebagai izin.

Perubahan yang menunggu persetujuan konkret: `supabase/migrations/20261024153547_bulk_input_p08.sql` pada proyek `sim-muridv2` (`qpzoukkhdxpmbtkcqemj`). Berisi dua RPC `SECURITY INVOKER`, pembatasan EXECUTE service_role, search_path kosong dan indeks unik parsial pada audit import existing. Tidak membuat tabel baru, menghapus data, mengimpor siswa produksi atau mengubah autentikasi. Setelah diterapkan, muat ulang halaman agar fitur tersedia sesuai izin. P08 belum dinyatakan aktif penuh sebelum gerbang ini selesai.

## Analisis dan pilihan implementasi

Dibaca AGENTS, roadmap/backlog B07/B08, keputusan D01/D02/D03/ACADEMIC-1.0/D10, formulir/mutasi P04, Kelas, Jadwal, Nilai, RPC sumber, audit import_batches/import_rows, schema/grant dan tes migrasi existing. Satu impor lintas banyak request HTTP tidak atomik; karena itu tidak melakukan loop fetch tulis per baris dari browser.

Pilot memakai CSV UTF-8 dengan header persis, pemisah koma, BOM opsional, quoting RFC4180, maksimal 64 KiB dan 100 baris data. JSON envelope dibatasi 256 KiB; SQL juga membatasi 100 baris/256 KiB JSON. Tidak mengandalkan ekstensi/MIME atau tipe sel spreadsheet untuk otorisasi. Nilai file dibaca sebagai teks; username persis (nol awal, minus dan kapitalisasi) tidak dinormalisasi menjadi angka, tidak digabung otomatis. Akun baru tetap dibuat melalui provisioning existing; impor ini menempatkan **siswa yang akunnya sudah ada**, tidak mencoba menyatukan transaksi Supabase Auth dengan transaksi PostgreSQL. XLSX/impor akun baru bukan bagian pilot ini.

## Alur dan cakupan

1. Tombol kontekstual membuka modal reusable pada Kelas dan Siswa, Jadwal KBM, serta Nilai dengan kelas/mapel/semester yang berlaku. Tombol hanya tampil bila RPC tersedia dan sumber memberi kewenangan relevan.
2. Unduh template, pilih konteks, unggah/tempel CSV. Referensi akun aktif/kode mapel dapat diperiksa di modal sesuai izin tulis; hingga 500 akun/100 mapel, pencarian menampilkan 20 akun. Batas katalog tidak membatasi validasi sumber.
3. Parser bersama client/server menolak header/kolom, quoting, duplikasi, karakter kontrol, nilai/waktu atau ukuran salah. Semua masalah lokal ditampilkan, tidak ada pemanggilan tulis bila salah. Nilai kosong adalah null; nol tetap nol; maksimal dua desimal.
4. Validasi sumber memakai RPC existing di subtransaction lalu rollback. Preview tidak menyimpan siswa/jadwal/nilai, request, audit import, log aktivitas, nomor PH maupun perubahan revision.
5. Seluruh baris harus valid, pengguna memeriksa tabel dan menyetujui checkbox sebelum konfirmasi. Mengganti CSV atau konteks membatalkan preview/konfirmasi lama. File pengganti yang tidak valid juga membatalkan preview lama. Modal menampilkan kelas, tahun ajaran, mapel, semester dan tanggal; tanggal wajib sesuai semester yang dipilih dan tahun ajaran kelas di SQL.
6. Commit memvalidasi ulang izin/referensi/revision dan seluruh batch. Penolakan/exception membatalkan seluruh child writes; tidak menyimpan sebagian baris. Hasil per baris membedakan saved dari valid/not_saved; close sukses menyegarkan parent, termasuk tombol X.

- **Penempatan siswa:** Admin, akun siswa aktif, kelas aktif, tanggal dalam tahun ajaran. Penempatan yang sudah ada pada tahun tersebut ditolak, termasuk pada kelas lain. Tidak memindahkan siswa; aturan referensi/piket milik writer sumber tetap berlaku.
- **Jadwal KBM:** kelas dalam izin jadwal existing; teacher_username, subject_code, hari/jam/durasi/JTM/istirahat divalidasi. Benturan kelas/guru antarbaris maupun terhadap jadwal lama ditolak oleh writer yang sama. Hanya jadwal baru, tidak mengubah/menghapus jadwal atau piket.
- **Nilai:** izin mengajar kelas-mapel existing, siswa aktif di kelas dan sudah terdaftar pada tanggal penilaian, tanggal/semester/tahun sesuai. Batch penilaian baru, PH/ATS/ASAS/Praktik tetap mengikuti mesin existing. ATS/ASAS/Praktik yang sudah ada ditolak agar tidak menjadi upsert/koreksi tanpa alasan. KKM, perhitungan PH20/ATS30/ASAS50, Praktik terpisah dan arsip rapor tidak diubah; D10 tetap terbuka.

Laporan kualitas adalah hasil validasi berkas dalam scope tersebut: baris, alasan, konteks, referensi/relasi, duplikasi, overlap dan nilai. Ini bukan klaim pemindaian/rekonsiliasi otomatis seluruh database; tidak menggabungkan akun, mengubah saldo, mengoreksi arsip atau memperbaiki hasil tanpa persetujuan pengguna.

## Integritas dan akses

- Actor/session dari verifikasi server; Origin, JSON schema strict, gate survei boolean dan RPC onboarding tetap diperiksa. Gate survei dengan payload tidak jelas kini fail closed sebelum mutasi.
- RPC baru hanya service_role, SECURITY INVOKER, tanpa grant tabel/izin pengguna baru. Kewenangan setiap domain diperiksa lagi dalam transaksi, termasuk role/penugasan/sesi saat memeriksa hasil tersimpan.
- Impor mengunci domain state dalam urutan tetap operations → education serta referensi actor/kelas agar writer kelas/jadwal/nilai/kenaikan yang dipakai sumber tidak membaur saat commit. Child writer lama tetap otoritas aturan, bukan validator frontend.
- Revision preview harus cocok saat commit; perubahan data memerlukan pratinjau baru. Idempotency per request dengan advisory transaction lock; cache hanya untuk actor/isi yang sama. Hash isi/domain/konteks dan indeks unik mencegah batch identik dengan request ID baru; status disimpan di import_batches/import_rows existing.
- Audit impor hanya metadata konteks/hash/acknowledgement dan nomor baris; raw_data kosong, tidak menyimpan CSV mentah di staging baru. Data domain memang tersimpan sesuai permintaan; audit domain existing tetap mengikuti mekanisme sumber.
- Lock submit sinkron, timeout/abort, perlindungan navigasi/dirty dan unmount; tidak ada retry mutasi otomatis. Jika ack hilang/ambigu, CSV dan UUID dipertahankan di memori, input dikunci. GET status mengantre pada lock request yang sama; hasil saved dikonfirmasi tanpa resend. Bila belum ada hasil, retry hanya lewat tindakan eksplisit dengan UUID/isi/revision yang sama. 401/403 menghapus draf privat; snapshot/CSV/nilai tidak disimpan di localStorage.

## Verifikasi dan batas bukti

Lihat [bukti P08](../verification/bulk/README.md) dan `stage-08-files.json` untuk file/alasan. Tes unit parser/API/availability, actual RPC/migrasi di PGlite, browser wizard dan regresi tiga halaman; bukan impor produksi, UAT pengguna, uji beban/concurrency multi-worker produksi atau pembuktian aktivasi cloud.

Migrasi pertama dibuat dengan Supabase CLI `migration new bulk_input_p08`; kontrak RPC dicocokkan dengan hasil replay migrasi terisolasi. Tabel public tidak berubah. Changelog dan dokumentasi Supabase diperiksa. Advisory cloud sebelum perubahan: INFO RLS tanpa policy pada tabel private yang direct grant-nya ditolak; INFO indeks belum dipakai; WARN leaked-password protection existing, tidak diubah pada P08. Referensi: https://supabase.com/docs/guides/database/database-linter?lint=0008_rls_enabled_no_policy ; https://supabase.com/docs/guides/database/database-linter?lint=0005_unused_index ; https://supabase.com/docs/guides/auth/password-security#password-strength-and-leaked-password-protection . Tidak mengubah kebijakan autentikasi sebagai efek samping impor.

Rollback aplikasi: revert PR dan pertahankan input lama. Bila migrasi kemudian disetujui, fungsi/indeks additive dapat tetap inert; jangan menghapus audit/domain hasil impor untuk rollback UI. Perubahan DDL balik memerlukan migrasi terpisah dan pemeriksaan pemakaian. P09 belum dijalankan.

## Hasil QA akhir

`npm ci` exit 0; dependency/lockfile runtime tetap. Pipeline rilis `npm run check` exit 0: 636 tes/68 kelompok, typecheck, lint, database types check dan production build bersih. Kasus service_role baru ditambahkan setelah pipeline; suite SQL 15 kasus kemudian diulang pada implementasi akhir dan lulus, sehingga 637 kasus unik telah terverifikasi. Browser empat suite: 815 checks/52 axe (wizard 173/12, Kelas 411/17, Jadwal 169/16, Nilai 62/7). Hasil JSON pada bukti P08.

Percobaan awal memperbaiki tiga masalah nyata: hasil backend malformed tidak boleh menjadi error isian 400 (kini 503/uncertain); label textarea perlu nama aksesibel stabil setelah berisi CSV; semester terpilih dan awal relasi siswa harus diperiksa saat impor nilai. Uji chain awal juga memperbarui count migrasi 43→44. Percobaan browser dengan CSS cache kosong dibatalkan; hasil yang dilaporkan menggunakan CSS dari build aplikasi sebenarnya. Tidak mengklaim hasil percobaan gagal sebagai lulus.
