# Web Push PWA — status kesinambungan

Acuan: [Tahapan Implementasi Web Push SiM-Murid](https://chatgpt.com/library?file_id=libfile_0f59e77d035c81919c72680ed06ed7ec&account_id=personal).
Baseline sumber: `52d42c9d11de38a5dc7eda15ec5424a10b71e0f1`.

- WP-00: audit baseline selesai; [laporan](https://chatgpt.com/library?file_id=libfile_5da0b0cc7c7481919a67aa8f24364172&account_id=personal).
- WP-01 selesai: kontrak ditetapkan dalam laporan persisten bernama `WP01_Kontrak_Web_Push_SiM_Murid.md`; baca sebelum WP-02. Library `web-push` dipatok 4.0.0 beserta lockfile; v4 memakai named ESM exports.
- Kunci production, preview dan development dibuat independen pada konfigurasi server Vercel; semua flag push nonaktif. Provisioning produksi diselesaikan setelah pengguna memberi izin eksplisit “ya boleh”; 17 entri production dibaca ulang metadatanya dan sembilan flag diverifikasi false. Tidak redeploy.
- Origin dan database staging terisolasi belum terverifikasi. Tidak ada subscription, migrasi push, service worker, sender runtime atau scheduler baru yang aktif.
- WP-02: migrasi `20261107162929_web_push_private_foundation.sql` menambahkan lima tabel privat, sembilan RPC server-only, helper eligibility/quiet hours/rollup dan trigger pencabutan. Kode dan QA lokal selesai; migrasi cloud `20261107171317` (web_push_private_foundation_wp02) telah diterapkan pada sim-muridv2 setelah izin eksplisit pengguna. Lima tabel privat/RLS, sembilan RPC service-only dan fingerprint source/cloud 9/9 terverifikasi; seluruh flag database tetap mati. Uji lock multi-koneksi PostgreSQL managed belum dilakukan. Laporan persisten: `WP02_Database_RPC_Privat_SiM_Murid.md`.
- Berikutnya: WP-03 API perangkat/lifecycle, memakai RPC WP-02 dan memverifikasi kesiapan migrasi target. Aktivasi produksi tetap menunggu implementasi dan UAT; tidak menguji pada pengguna produksi.
- Batas satu sesi aktif existing tetap berlaku; expiry berbeda dari logout/revoke; payload generik; push claim dilindungi token dan binding_version; worker email/WA tidak dinaikkan konkurensinya. Cron database saat baseline hanya tick per jam tanpa dispatch.

Validasi WP-01: script `node scripts/verify-web-push-library.mjs` hanya membentuk request terenkripsi offline, tidak mengirim HTTP dan tidak mencetak key. Typecheck, lint, test:jobs dan build lulus. Semua key hanya server; template `.env.example` kosong untuk secret.

WP-01 tidak merilis runtime push. Pengguna kemudian mengizinkan push ke main dan migrasi WP-02; perubahan disiapkan untuk rilis tersebut. Jangan menganggap kesiapan database sebagai fitur push telah berjalan. Periksa main dan laporan terbaru sebelum melanjutkan.

## Pemeriksaan rilis 8 November 2026 WIB

Seluruh suite rangkaian check selesai melalui pemeriksaan awal dan lanjutan setelah assertion restore diperbarui dari 84 tabel/49 migrasi menjadi 89/50. Build produksi bersih lulus setelah cache Turbopack lama dibersihkan. Security Advisors cloud: tidak ada peringatan baru selain INFO RLS tanpa policy pada lima tabel privat service-only; peringatan leaked-password Auth sudah ada sebelum migrasi. Tidak mengaktifkan push/scheduler atau mengirim pesan.
