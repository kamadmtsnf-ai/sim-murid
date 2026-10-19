# Penggantian Brevo dengan Gmail SMTP — 19 Oktober 2026

Permintaan pengguna: mengganti penyedia email dengan Gmail. Adapter Brevo dihapus, semua consumer OTP dan diagnostik memakai Gmail. SMTP TLS465, validasi sertifikat, timeout terbatas dan debug nonaktif; pengirim sama dengan akun SMTP. App Password hanya server, spasi grouping dinormalisasi. Konfigurasi invalid ditolak, raw error tidak dikirim ke browser. SMTP verify tidak mengirim email dan tidak membuktikan inbox.

Validasi: npm run check lulus (typecheck, lint, 70 test, replay migrasi/drift tipe, production build). Lima smoke HTTP build lulus. Dua test tambahan memeriksa konfigurasi TLS/App Password, penolakan header injection/konfigurasi invalid dan klasifikasi error. Pengujian OTP/database yang ada tetap lulus. Tidak ada perubahan database/RLS maupun akun pengguna.

Vercel Production: GMAIL_SENDER_NAME ditambahkan, EMAIL_OTP_SECRET dipertahankan. GMAIL_USER dan GMAIL_APP_PASSWORD belum tersedia pada pemeriksaan metadata; tidak dibaca dari konektor Gmail pribadi dan tidak diminta lewat chat. Pengiriman nyata, penerimaan OTP, dan recovery end-to-end Gmail masih pending credential pemilik. Tidak ada email uji dikirim dan tidak ada kontak ditandai verified secara manual. Dokumentasi: ../deployment/email-setup.md.
