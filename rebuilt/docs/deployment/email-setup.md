# Konfigurasi email SiM-Murid — Brevo Free

Penyedia dipilih pengguna: Brevo Free. Resend tidak digunakan.
Proyek: https://vercel.com/kamadmtsnf-8533/sim-muridv2 .

## Variabel server produksi

- BREVO_API_KEY: API key Brevo, bukan SMTP key, tanpa tanda kutip tambahan. Sensitive, Production.
- BREVO_SENDER_EMAIL: alamat pengirim yang terdaftar/aktif di Brevo.
- BREVO_SENDER_NAME: nama pengirim madrasah.
- EMAIL_OTP_SECRET: secret HMAC acak untuk OTP, sudah ditambahkan oleh implementasi. Jangan dirotasi rutin karena kode yang sedang pending menjadi tidak berlaku.

Tiga variabel Brevo telah ditambahkan pengguna dan diverifikasi tersedia. API key tidak dibaca/dikirim ke chat atau disimpan pada repo.

## Penghambat produksi saat uji

Aplikasi telah membaca konfigurasi dan memanggil endpoint resmi Brevo /v3/senders dengan header api-key. Brevo mengembalikan HTTP401 Unauthorized. Pengiriman dan aktivasi pengirim belum dapat dibuktikan. Ini berbeda dengan variabel belum ditambahkan.

Periksa pada Brevo:

1. SMTP & API → API Keys: gunakan API key aktif untuk API v3, bukan SMTP key atau password akun. Jika key tidak ditemukan/tidak aktif, buat key baru lalu ganti BREVO_API_KEY pada Vercel Production dan redeploy.
2. Bila diagnostik menunjukkan ip_restricted, periksa daftar IP/API security atau email notifikasi Brevo untuk permintaan dari aplikasi Vercel. Konfirmasi hanya aktivitas yang dikenali; jangan membagikan API key. Tidak ada pengaturan keamanan Brevo yang diubah otomatis.
3. Pastikan alamat pengirim sudah diverifikasi dan aktif. Pemeriksaan ini baru dapat dibuktikan setelah autentikasi API diterima.

GET /api/account/email-provider memerlukan Admin yang ready serta accounts.manage. Respons hanya menampilkan identitas pengirim/status atau klasifikasi error aman (BREVO_HTTP_401 dan reason), tidak ada credential atau OTP.

## Setelah autentikasi diterima

Uji kirim OTP ke alamat uji yang diizinkan, buktikan provider201/messageId, verifikasi kode, pelepasan gate, cooldown/kuota, single-use, serta pemulihan password dan pencabutan sesi. Jangan menyamakan201provider dengan pesan pasti masuk inbox. Bila pengguna mengoreksi key/izin, cukup verifikasi ulang dan lanjutkan uji integrasi; jangan menghapus database/mengulang migrasi.

Referensi: https://help.brevo.com/hc/en-us/articles/209467485-Create-and-manage-your-API-keys dan https://developers.brevo.com/docs/ip-security . Laporan: ../verification/stage-09-email.md.
