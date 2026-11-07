# Web Push PWA — status kesinambungan

Acuan: [Tahapan Implementasi Web Push SiM-Murid](https://chatgpt.com/library?file_id=libfile_0f59e77d035c81919c72680ed06ed7ec&account_id=personal).
Baseline sumber: `52d42c9d11de38a5dc7eda15ec5424a10b71e0f1`.

- WP-00: audit baseline selesai; [laporan](https://chatgpt.com/library?file_id=libfile_5da0b0cc7c7481919a67aa8f24364172&account_id=personal).
- WP-01 selesai: kontrak ditetapkan dalam laporan persisten bernama `WP01_Kontrak_Web_Push_SiM_Murid.md`; baca sebelum WP-02. Library `web-push` dipatok 4.0.0 beserta lockfile; v4 memakai named ESM exports.
- Kunci production, preview dan development dibuat independen pada konfigurasi server Vercel; semua flag push nonaktif. Provisioning produksi diselesaikan setelah pengguna memberi izin eksplisit “ya boleh”; 17 entri production dibaca ulang metadatanya dan sembilan flag diverifikasi false. Tidak redeploy.
- Origin dan database staging terisolasi belum terverifikasi. Tidak ada subscription, migrasi push, service worker, sender runtime atau scheduler baru yang aktif.
- WP-02: migrasi `20261107162929_web_push_private_foundation.sql` menambahkan lima tabel privat, sembilan RPC server-only, helper eligibility/quiet hours/rollup dan trigger pencabutan. Kode dan QA lokal selesai; migrasi cloud `20261107171317` (web_push_private_foundation_wp02) telah diterapkan pada sim-muridv2 setelah izin eksplisit pengguna. Lima tabel privat/RLS, sembilan RPC service-only dan fingerprint source/cloud 9/9 terverifikasi; seluruh flag database tetap mati. Uji lock multi-koneksi PostgreSQL managed belum dilakukan. Laporan persisten: `WP02_Database_RPC_Privat_SiM_Murid.md`.
- WP-03: kode API perangkat/lifecycle selesai secara lokal; lihat `WEB-PUSH-WP03.md`. Enkripsi AES-256-GCM, validasi endpoint/DNS, handshake cookie HttpOnly dengan rotasi secret saat handoff, rate limit privat dan kuota test atomik. Migrasi lokal `20261107173727_web_push_device_api.sql` menambah satu tabel/3 RPC serta AAD context claim. Rilis melalui PR #101 setelah izin eksplisit pengguna. Migrasi cloud `20261107175620` telah diterapkan; tabel RLS/service-only, fingerprint RPC 4/4 dan penolakan identitas tidak sah terverifikasi. Semua flag tetap nonaktif.
- Berikutnya WP-04: service worker dan UI izin; baca kontrak handshake 428, AAD, batas endpoint dan API pada `WEB-PUSH-WP03.md` terlebih dahulu. Migrasi WP-03 sudah diterapkan sebelum rilis API. Aktivasi produksi tetap menunggu sender, staging dan UAT; tidak menguji pada pengguna produksi.
- Batas satu sesi aktif existing tetap berlaku; expiry berbeda dari logout/revoke; payload generik; push claim dilindungi token dan binding_version; worker email/WA tidak dinaikkan konkurensinya. Cron database saat baseline hanya tick per jam tanpa dispatch.

Validasi WP-01: script `node scripts/verify-web-push-library.mjs` hanya membentuk request terenkripsi offline, tidak mengirim HTTP dan tidak mencetak key. Typecheck, lint, test:jobs dan build lulus. Semua key hanya server; template `.env.example` kosong untuk secret.

WP-01 tidak merilis runtime push. Pengguna kemudian mengizinkan push ke main dan migrasi WP-02; perubahan disiapkan untuk rilis tersebut. Jangan menganggap kesiapan database sebagai fitur push telah berjalan. Periksa main dan laporan terbaru sebelum melanjutkan.

## Pemeriksaan rilis 8 November 2026 WIB

Seluruh suite rangkaian check selesai melalui pemeriksaan awal dan lanjutan setelah assertion restore diperbarui dari 84 tabel/49 migrasi menjadi 89/50. Build produksi bersih lulus setelah cache Turbopack lama dibersihkan. Security Advisors cloud: tidak ada peringatan baru selain INFO RLS tanpa policy pada lima tabel privat service-only; peringatan leaked-password Auth sudah ada sebelum migrasi. Tidak mengaktifkan push/scheduler atau mengirim pesan.

## WP-03 — bukti lokal

`npm run check`: 819 test/85 proses, typecheck, lint, drift types dan build lulus. Sesudah `npm ci`, 47 test terfokus serta typecheck/lint/build bersih lulus. Katalog lokal 88 tabel aplikasi ber-RLS tanpa issue. Bukti: `docs/verification/web-push/wp03-checks.json` dan `wp03-advisory.json`. Build inkremental sempat gagal karena cache persistence Turbopack; hanya `.next` dibersihkan dan clean build berhasil. Migrasi managed WP-03 telah diterapkan setelah izin eksplisit pengguna; UAT browser dan lock multi-koneksi managed belum dilakukan.

Laporan WP-03 persisten: [WP03_API_Perangkat_Lifecycle_SiM_Murid.md](https://chatgpt.com/library?file_id=libfile_64b9c473f7bc8191b70d04a0d81f1df7&account_id=personal).

Rilis WP-03: [PR #101](https://github.com/kamadmtsnf-ai/sim-murid/pull/101). Tree implementasi remote identik dengan commit lokal `2bebf02`; catatan penerapan ini tidak mengaktifkan sender atau UI izin.
