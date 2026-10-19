# Tahap 8 — Keamanan akun dan onboarding

Implementasi keamanan akun tersedia di `/account/security` dan `/api/auth/security`. Verifikasi produksi sedang dilakukan; laporan akan dilengkapi setelah pengujian dan cleanup.

## Perilaku

- Ganti password memerlukan sesi aplikasi sah dan konfirmasi password saat ini melalui Supabase Auth. Verifikasi menggunakan sesi Auth sementara tersendiri, tidak mengganti cookie browser.
- Aturan kekuatan mengikuti Index.html lama: minimal 8 karakter, huruf besar/kecil, angka, simbol, tanpa tiga karakter sama berurutan dan tanpa username. Konfirmasi wajib dan password harus berbeda. Maksimum 72 byte UTF-8 mencegah pemotongan bcrypt.
- Lima pertanyaan sama dengan bank lama. Jawaban dinormalisasi Unicode NFKC dan trim, tetap peka kapital, lalu dihash scrypt N=16384,r=8,p=1 dengan salt acak 16 byte. Jawaban/hash tidak dikirim kembali atau dimasukkan audit. Tidak ada endpoint reset dengan jawaban saja.
- Batas percobaan server: 5 operasi keamanan per 15 menit per pengguna; password dan pertanyaan berbagi penghitung. Mutasi same-origin dan Zod strict. Audit hanya metadata operasi aman.
- Satu fungsi database menentukan urutan: sesi sah → wajib password → profil Siswa/Calon → pertanyaan → email Guru terverifikasi → ready. Server page, API akses/sesi dan helper RLS mengikuti state tersebut. Logout serta perbaikan password tetap tersedia.
- Marker profil tidak dapat diisi client; validator profil kondisional Tahap 11 menjadi pemiliknya. Email kontak harus sama persis dengan bukti terverifikasi dan flag waktu; alamat teknis Auth tidak menjadi bukti kontak. OTP Tahap 9 belum dibuat. Gate survei disiapkan dalam kontrak state dan akan terhubung saat periode/target survei tersedia pada tahap survei.

## Konsistensi perubahan password

Tidak ada transaksi atomik lintas PostgreSQL dan Supabase Auth. Sebelum provider diubah, transaksi database mengunci profil, menetapkan nonce operasi privat dan flag wajib ganti, serta mencabut seluruh registry sesi. Sesudah provider berhasil, finalisasi hanya menerima nonce yang sama, menghapus flag dan mencatat audit. Caller harus masuk kembali. Jika provider/finalisasi gagal, akses tetap tertutup; pesan tidak mengklaim sukses. Operasi yang tertunda memiliki jeda retry dua menit dan harus diautentikasi ulang. Nonce tidak dikirim ke client. RPC hanya service_role; identitas berasal dari sesi terverifikasi, bukan input username/user ID.

## Bukti

Tujuh migrasi replayable; cloud migration `20261019113245_account_security_onboarding`. Tetap 27 tabel RLS, 14 SELECT policy public, dan nol grant RPC keamanan kepada anon/authenticated/PUBLIC. Snapshot tipe lokal dan tipe Supabase diperbarui.

44 test lokal mencakup 38 regresi dan 6 keamanan: kekuatan/konfirmasi, salt unik, verifikasi hash, gate prioritas, pembatasan, nonce/replay/finalisasi, pencabutan registry, penolakan read RLS dan service-only grants. Lihat stage-08-check.log dan stage-08-smoke.log. Build/ESLint/TypeScript dan HTTP smoke termasuk dalam verifikasi.

Advisor keamanan: 13 INFO tabel private sengaja tanpa policy client dan WARN lama perlindungan password bocor belum aktif. Tidak mengubah paket atau biaya. Remediasi: https://supabase.com/docs/guides/auth/password-security#password-strength-and-leaked-password-protection .

Batas: belum ada pengujian visual browser/hidrasi. Modul profil lengkap, OTP, pemulihan oleh petugas dan survei belum diimplementasikan pada tahap ini; akun dengan kewajiban tersebut tetap tertahan secara eksplisit.
