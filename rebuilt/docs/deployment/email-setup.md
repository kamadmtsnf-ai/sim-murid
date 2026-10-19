# Konfigurasi email SiM-Murid — Gmail SMTP

Pengguna meminta mengganti Brevo dengan Gmail. Verifikasi email Guru dan pemulihan password memakai SMTP Gmail melalui Nodemailer pada runtime Node.js. Tidak memakai konektor Gmail pribadi atau kata sandi login Google.

## Vercel Production

| Variabel | Nilai |
|---|---|
| GMAIL_USER | Alamat Gmail/Google Workspace pengirim |
| GMAIL_APP_PASSWORD | App Password Google 16 karakter; simpan sebagai Secret/Sensitive |
| GMAIL_SENDER_NAME | MTs Nurul Falah |
| EMAIL_OTP_SECRET | Pertahankan secret server yang sudah ada; jangan diganti |

Aktifkan Verifikasi 2 Langkah, lalu buat App Password khusus SiM-Murid di https://myaccount.google.com/apppasswords . Sebagian akun organisasi/Advanced Protection tidak mengizinkan App Password. Jangan memasukkan password utama Google. Tambahkan variabel lewat dashboard Vercel, bukan chat/repository. Deploy ulang setelah pengaturan.

SMTP tetap smtp.gmail.com:465 dengan TLS dan validasi sertifikat. From memakai akun terautentikasi, bukan alamat arbitrer. Debug SMTP dimatikan; error disanitasi. Pengiriman tidak diulang otomatis ketika timeout agar tidak mengirim OTP ganda. Gmail memiliki pembatasan pengiriman; pembatas aplikasi 250 permintaan bergulir/hari tetap berlaku dan bukan jaminan kuota Google.

OTP tetap berlaku 10 menit, cooldown 60 detik, maksimal 5 permintaan per pengguna/hari WIB dan 5 percobaan. Template dan HMAC OTP tidak berubah. Tidak ada fallback Brevo. Variabel BREVO_* lama tidak dibaca dan dapat dihapus setelah Gmail dikonfigurasi.

## Verifikasi

GET /api/account/email-provider hanya untuk Admin ready dengan accounts.manage. Memeriksa koneksi/autentikasi SMTP tanpa mengirim pesan. active=true berarti SMTP terautentikasi; deliveryVerified=false menegaskan inbox belum diuji. GMAIL_SMTP_UNAVAILABLE mengembalikan reason authentication/connection/provider_rejected tanpa detail rahasia. EMAIL_CONFIG_UNAVAILABLE berarti konfigurasi belum valid.

Status saat perubahan: kode Gmail tersedia; uji pengiriman nyata menunggu GMAIL_USER dan GMAIL_APP_PASSWORD pada Vercel. Jangan mengklaim email diterima hanya karena SMTP verify atau build lulus. Setelah konfigurasi, uji verifikasi email dan pemulihan melalui akun uji yang disetujui, termasuk penerimaan OTP serta kedaluwarsa/pakai ulang.

Referensi: https://support.google.com/mail/answer/185833 dan https://nodemailer.com/guides/using-gmail .
