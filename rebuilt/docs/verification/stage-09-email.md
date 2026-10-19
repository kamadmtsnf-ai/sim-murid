# Penyelesaian email Tahap 9 — Brevo

Status: implementasi dan pengujian lokal; verifikasi produksi dilengkapi setelah deployment.

Penyedia dipilih pengguna: Brevo Free; Resend tidak digunakan. Variabel BREVO_API_KEY, BREVO_SENDER_EMAIL dan BREVO_SENDER_NAME tersedia sebagai sensitive production. EMAIL_OTP_SECRET ditambahkan sebagai secret HMAC acak tersendiri. Nilai secret tidak masuk kode, manifest atau respons client.

## Perilaku

- Guru pada gate email_pending/ready membuka /account/email. Kode hanya dikirim ke contact_email database miliknya, bukan input penerima bebas atau alamat teknis Auth. Perbarui alamat di /account/profile bila diperlukan. Status verifikasi diikat ke alamat yang persis sama.
- Kode acak enam digit, berlaku 600 detik sejak reservasi, jeda minimal 60 detik, 5 permintaan per hari Asia/Jakarta, maksimal 5 percobaan per challenge, single-use. Pengiriman ulang membatalkan kode pending sebelumnya. Perubahan email membatalkan OTP dan bukti terverifikasi seperti implementasi profil sebelumnya.
- HMAC-SHA256 meliputi challenge UUID, user UUID, email, purpose dan kode. Database menyimpan digest saja; tidak ada plaintext OTP pada DB/outbox/log. Secret tidak memakai key publik. Rotasi secret menginvalidasi kode pending.
- Transaksi profil dan row rate privat menjaga reservasi/kuota atomik. Kuota harian pengguna dibagi antara verifikasi dan pemulihan; percobaan pengiriman yang gagal juga dihitung agar tidak membanjiri provider. Anggaran aplikasi 250 reservasi dalam rolling24jam, diserialisasi sebelum lock profil; tidak menaikkan paket atau mengaktifkan biaya berlebih.
- Provider Brevo HTTP API dengan timeout12detik dan tanpa retry otomatis. UI menyatakan diterima layanan pengiriman hanya setelah201+messageId dan pencatatan database. Respons201 bukan bukti pesan masuk kotak masuk. Kegagalan/hasil ambigu membuat kode tidak aktif kecuali pencatatan accepted sudah berhasil. Tidak mengirim ulang kode expired melalui antrean otomatis.
- /recovery/email memulihkan password menggunakan OTP ke kontak yang telah benar-benar diverifikasi. Respons permintaan generik (termasuk akun tidak ditemukan/tidak punya bukti/alamat berubah/kuota/delivery gagal); challengeId acak tetap diberikan tanpa mengungkap keberadaan akun. Saat ini verifikasi kontak tersedia bagi Guru; peran tanpa bukti tetap melalui bantuan Admin.
- Setelah OTP pemulihan benar, kode dikonsumsi dan seluruh registry sesi dicabut sebelum perubahan Supabase Auth. Finalisasi hanya dengan nonce privat. Password pilihan pengguna memakai validator kekuatan yang sama dengan ganti password, kemudian login ulang. Kegagalan lintas provider/DB tetap tertahan dan memerlukan kode baru atau bantuan Admin. Jawaban keamanan tidak cukup untuk reset.
- Perubahan password biasa maupun reset Admin membatalkan semua kode pemulihan email pending. Reset email tidak membuat akun Auth baru dan tidak mengganti identitas teknis/email login Auth.
- GET /api/account/email-provider: diagnostik read-only bagi Admin yang ready dan memiliki accounts.manage; memeriksa pengirim aktif melalui Brevo. Hanya identitas pengirim dan status, tanpa API key/secret/isi email/OTP. API ini tidak membaca isi inbox.

## Verifikasi

Sembilan migrasi, 27 tabel semuanya RLS. Enam RPC baru hanya service_role, invoker/fixed search_path; tidak ada grant anon/authenticated/PUBLIC. Dua helper finalisasi yang sudah ada diperbarui untuk menginvalidasi kode pemulihan. Snapshot tipe lokal/cloud diperbarui.

13 test tambahan (3 fungsi/DTO/template, 10 transaksi PostgreSQL), total68. Kasus meliputi binding HMAC, escape HTML, providerfailed/unaccepted, stale-email, cooldown, kuota gabungan, batas5percobaan, reuse, expiry, pelepasan gate, recoveryverified-contact, pencabutan sesi, nonce/replay, invalidasi kode ketika password berubah dan anggaran global. Lihat stage-09-email-check.log serta stage-09-email-smoke.log.

Tidak ada bypass OTP untuk pengguna produksi atau endpoint test khusus. Jika uji integrasi menggunakan digest fixture yang diketahui, pemisahan dari bukti pengiriman aktual dijelaskan secara eksplisit pada laporan live. Uji visual browser/hidrasi dan pembacaan inbox penerima bukan bagian pemeriksaan HTTP ini.

Advisor tetap13 INFO schema private tanpa policy client dan WARN lama leaked password protection disabled; tidak mengubah paket. Remediasi: https://supabase.com/docs/guides/auth/password-security#password-strength-and-leaked-password-protection .

Referensi: https://developers.brevo.com/reference/send-transac-email dan https://developers.brevo.com/reference/get-senders .
