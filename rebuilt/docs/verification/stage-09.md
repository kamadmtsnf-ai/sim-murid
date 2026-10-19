# Tahap 9 — Pemulihan akun dan profil dasar; OTP tertunda koneksi email

Status: implementasi pemulihan melalui Admin dan profil dasar tersedia; pengujian produksi sedang dilakukan. Tahap 9 belum selesai penuh karena belum ada penyedia pengiriman email pada proyek SiM-Murid.

## Sumber dan perilaku

Acuan: kontrak D04, M01-F05/F06/F08 dan M17-F04; requestUserReset/requestUserResetSesi, selfResetPassword/selfResetSesi dan updateProfil pada GAS lama. Jalur reset lama yang mempercayai username/jawaban saja diganti alur aman yang disyaratkan D04. Keputusan rapor, fee dan survei tidak berubah.

- `/recovery` dan POST `/api/auth/recovery`: permintaan password atau sesi dengan jawaban keamanan sebagai bukti tambahan, atau permintaan pemeriksaan langsung bagi pengguna yang belum mengatur/lupa jawaban. Respons generik identik bagi akun tidak ditemukan, jawaban salah, permintaan valid dan limit akun; tidak menampilkan pertanyaan pengguna, email, status akun, hash atau ID permintaan. Jawaban salah tidak membuat permintaan pada jalur pertanyaan. Pemilihan pemeriksaan langsung tetap memerlukan verifikasi petugas dan tidak memberikan hak reset.
- Rate server: maksimal 5 pemeriksaan username/15 menit dan 30 permintaan IP/15 menit, menggunakan header edge tepercaya. Permintaan aktif untuk pengguna/jenis yang sama dideduplikasi di bawah lock profil. TTL permintaan 24 jam; bukan TTL OTP.
- `/account/recovery` dan API sejajar: Admin dengan sesi/gate ready, hak accounts.manage terkini, password Admin benar, konfirmasi identitas dan referensi pemeriksaan dapat menyetujui/menolak. Antrean maksimal 100 aktif tertua; muat ulang setelah memproses. Admin tidak dapat memulihkan akunnya sendiri; perlu Admin lain atau operator tepercaya.
- Pemulihan sesi hanya mencabut registry aplikasi target dengan audit. JWT bertanda tangan atau refresh Auth tidak menghidupkan kembali akses; login baru dapat mengambil slot baru. Tidak menghapus identitas Auth atau audit.
- Pemulihan password membuat password acak unik, mencabut registry, menandai wajib ganti, memperbarui Supabase Auth, lalu finalisasi dengan nonce server. Password ditampilkan sekali pada respons Admin tanpa cache; tidak disimpan dalam DB aplikasi/log/browser storage. Admin menyerahkan secara langsung setelah memverifikasi identitas. Tidak ada password default bersama.
- Jika Auth/finalisasi gagal, target tetap tertahan dan sesi sudah dicabut. Permintaan berstatus verified dapat diproses ulang setelah dua menit dengan nonce baru. Tidak mengklaim transaksi lintas Auth/PostgreSQL atomik.
- `/account/profile` dan API sejajar: pemilik akun pada gate ready/email_pending dapat memperbarui nama, HP, email kontak dan bio. Username dan privilege tidak dapat diubah. Versi updated_at mencegah edit stale menimpa perubahan. Perubahan email menghapus bukti private, flag verifikasi dan OTP pending secara atomik; alamat teknis Auth tidak diterima sebagai email kontak. Biodata wajib Siswa/Calon Tahap 11 tetap terpisah dan tidak ditandai selesai oleh formulir dasar.

## Database dan verifikasi

Migrasi cloud `20261019115417_account_recovery_profile`; delapan migrasi, 27 tabel semuanya RLS. Delapan RPC baru service-only, SECURITY INVOKER, search_path tetap kosong; grant PUBLIC/anon/authenticated=0. Satu pengecualian private snapshot SECURITY DEFINER dari Tahap 7 tetap tidak diubah.

Pengujian baru: 3 validasi DTO dan 8 transaksi database; total 55 pengujian lokal termasuk regresi. Pemeriksaan meliputi lock/dedup, nonce/replay, role berubah, batas akses, penolakan tidak mencabut sesi, kedaluwarsa, audit dan invalidasi verifikasi email. Lihat stage-09-check.log dan stage-09-smoke.log. Pengujian HTTP/Auth/PostgREST aktual dan cleanup dilaporkan setelah deployment.

Advisor: 13 INFO schema private sengaja tanpa policy client; WARN lama perlindungan password bocor belum aktif. Tidak mengubah paket/biaya. Remediasi: https://supabase.com/docs/guides/auth/password-security#password-strength-and-leaked-password-protection .

## Penghambat email yang nyata

Daftar variabel proyek hanya memuat konfigurasi Supabase/Postgres; tidak ada API key/SMTP untuk email. Integrasi Vercel team yang terlihat hanya Supabase. CLI Vercel 64.5.0 meminta autentikasi akun saat discovery; proses tersebut dihentikan tanpa menghubungkan akun. Katalog resmi menunjukkan Resend sebagai integrasi Messaging native: https://vercel.com/marketplace/resend . Tidak mengambil secret dari proyek LMS, tidak mengirim OTP ke email teknis, dan tidak mengklaim email terkirim.

Panduan yang diterapkan: [Vercel Marketplace SKILL.md](skill://plugin_connector_690a90ec05c881918afb6a55dc9bbaa1/marketplace/SKILL.md), instruksi: “If it needs the user's account or a dashboard/browser step → STOP and ask them to complete it, then continue”. Karena koneksi nyata belum tersedia, adapter/template/form OTP tidak dibuat sebagai stand-in. Pekerjaan independen pemulihan/profil diselesaikan terlebih dahulu sesuai instruksi pengguna/developer.

Untuk melanjutkan: hubungkan penyedia email ke proyek Vercel `sim-muridv2`, misalnya integrasi Resend pada link di atas, dan siapkan identitas/domain pengirim yang berhak dipakai. Masukkan credential hanya melalui pengaturan environment server, bukan chat atau git. Jika ingin memakai SMTP sekolah yang sudah tersedia, tentukan penyedianya terlebih dahulu.

Yang belum diimplementasikan/diterima: pengiriman/ulang/validasi OTP Guru (TTL600s, cooldown60s,5 kirim/hari WIB,5 percobaan, single-use), template email produksi dan pemulihan mandiri berbasis email. Gate Guru tetap tertahan sampai bukti verifikasi nyata tersedia; pemulihan melalui petugas berfungsi tanpa email. Uji visual browser/hidrasi belum dilakukan.
