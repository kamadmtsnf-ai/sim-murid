# Pengiriman email untuk menuntaskan Tahap 9

Aplikasi produksi: https://sim-muridv2.vercel.app
Proyek Vercel: https://vercel.com/kamadmtsnf-8533/sim-muridv2
Supabase khusus SiM-Murid: qpzoukkhdxpmbtkcqemj. Jangan mengubah konfigurasi proyek LMS.

## Yang perlu disiapkan pemilik akun

1. Buka https://vercel.com/marketplace/resend dan hubungkan penyedia ke proyek **sim-muridv2** pada team kamadmtsnf-8533. Integrasi resmi menyediakan environment `RESEND_API_KEY` di server. Belum ada integrasi email terpasang yang dapat digunakan pada pemeriksaan Tahap 9.
2. Selesaikan otorisasi akun dan penyiapan domain pengirim di penyedia. Pengirim harus memakai domain/identitas yang benar-benar boleh digunakan oleh madrasah; jangan memakai domain contoh atau email teknis Auth.
3. Sampaikan bahwa koneksi selesai beserta alamat pengirim yang telah diverifikasi. Jangan kirim API key/password SMTP melalui chat; simpan melalui pengaturan secret environment.
4. Jika memilih SMTP sekolah yang sudah dimiliki, sampaikan nama penyedia dan konfigurasi nonrahasia (host, port, alamat pengirim); credential tetap ditempatkan pada secret environment. Ini merupakan pilihan penyedia oleh pengguna sebelum implementasi adapter.

## Pekerjaan lanjutan setelah koneksi siap

Implementasikan dan uji adapter pengiriman yang nyata, template email profesional, formulir verifikasi Guru, OTP hash/HMAC tanpa plaintext storage, TTL600 detik, cooldown60 detik, 5 kirim/hari WIB,5 percobaan, single-use, serta invalidasi ketika alamat berubah. Jangan mengklaim terkirim hanya karena permintaan dicatat di database. Buktikan pengiriman ke alamat uji yang berizin, kegagalan provider, batas pengiriman dan pelepasan gate hanya setelah kode benar. Pemulihan mandiri berbasis email harus memakai bukti kontak terverifikasi dan token sekali pakai, bukan alamat teknis Auth atau jawaban keamanan saja.

Panduan [Vercel Marketplace SKILL.md](skill://plugin_connector_690a90ec05c881918afb6a55dc9bbaa1/marketplace/SKILL.md) mengharuskan provisioning nyata sebelum adapter/UI email dibuat, dan menyatakan: “If it needs the user's account or a dashboard/browser step → STOP and ask them to complete it, then continue”. Koneksi akun tersebut belum tersedia; implementasi email tidak diganti mock.

Sumber primer: https://vercel.com/marketplace/resend dan https://supabase.com/docs/guides/auth/auth-smtp . Laporan implementasi/pengujian: ../verification/stage-09.md.
