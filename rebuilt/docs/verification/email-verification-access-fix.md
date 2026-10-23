# Perbaikan redirect Verifikasi Email — 24 Oktober 2026

Penyebab: sidebar menyediakan `/account/email` untuk seluruh akun, tetapi RPC `app_email_state`, `app_email_reserve` dan `app_email_consume` hanya menerima role teacher. Page menganggap null dari state sebagai alasan redirect ke `/account/security`. Akun non-Guru yang sebenarnya sudah siap akhirnya selalu dialihkan.

Perbaikan:

- Ketiga RPC kini melayani pemilik akun dengan sesi valid pada gate ready/email_pending, konsisten dengan menu email pemulihan yang tersedia untuk semua peran.
- `verified` diperoleh dari bukti email aktual (alamat kontak cocok dengan verified_contact_email dan timestamp bukti), bukan sekadar gate ready. Admin/non-Guru yang sudah ready tidak otomatis dianggap memverifikasi email.
- Kewajiban email untuk Guru tetap pada `app_security_state`; role lain tidak diberi kewajiban baru. Password sementara, biodata wajib, pertanyaan keamanan, sesi dicabut, ownership, HMAC, TTL, jumlah percobaan dan kuota tidak dilewati.
- State null menampilkan penjelasan di halaman Verifikasi Email, bukan redirect otomatis. Tanpa sesi tetap diarahkan login, outage tetap error boundary.
- Tidak mengubah tabel atau data akun; migrasi hanya mengganti tiga fungsi SECURITY INVOKER dengan search_path kosong dan izin execute service_role saja. Kolom bukti existing dipertahankan untuk kompatibilitas pemulihan/profil.

Berkas: migrasi `20261023234842_email_verification_all_account_access.sql`; page email; pesan API; tes page; tes database lintas tujuh role; perintah tes dan hitungan migrasi foundation 43.

Validasi awal: 12 tes handler/page/service dan 5 tes database akses lulus. Database replay memakai seluruh migrasi aktual di PGlite. Seluruh tujuh role diuji dari status belum terverifikasi → reservasi/delivery sintetis → consume sekali pakai → proof benar; perubahan email, gate wajib, cooldown, lima kode salah, foreign owner, sesi salah/dicabut, dan penolakan anon/authenticated juga diuji.

Migrasi produksi berhasil diterapkan dengan versi 20261023234842; nama berkas diselaraskan dengan versi yang dicatat Supabase. Pemeriksaan metadata memastikan ketiga fungsi mendukung semua peran, tetap SECURITY INVOKER dan execute hanya service_role; sesi null ditolak. Security advisor tetap sama dengan baseline (informasi RLS tabel privat dan warning leaked-password protection). Hasil check lengkap, SHA merge dan deployment aplikasi dicatat pada PR setelah selesai. Tidak mengirim OTP nyata atau memakai sesi pengguna produksi untuk QA.

Validasi akhir: npm ci dan npm run check berhasil (exit 0): 516 tes dalam 59 kelompok runner, TypeScript, lint tanpa warning, kecocokan 14 tipe tabel publik dari replay migrasi, serta production build. Tidak melakukan login/OTP produksi atau uji perangkat fisik.
