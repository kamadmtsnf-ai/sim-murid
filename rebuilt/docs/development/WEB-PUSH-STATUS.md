# Web Push PWA — status kesinambungan

Acuan: [Tahapan Implementasi Web Push SiM-Murid](https://chatgpt.com/library?file_id=libfile_0f59e77d035c81919c72680ed06ed7ec&account_id=personal).
Baseline sumber: `52d42c9d11de38a5dc7eda15ec5424a10b71e0f1`.

- WP-00: audit baseline selesai; [laporan](https://chatgpt.com/library?file_id=libfile_5da0b0cc7c7481919a67aa8f24364172&account_id=personal).
- WP-01 selesai: kontrak ditetapkan dalam laporan persisten bernama `WP01_Kontrak_Web_Push_SiM_Murid.md`; baca sebelum WP-02. Library `web-push` dipatok 4.0.0 beserta lockfile; v4 memakai named ESM exports.
- Kunci production, preview dan development dibuat independen pada konfigurasi server Vercel; semua flag push nonaktif. Provisioning produksi diselesaikan setelah pengguna memberi izin eksplisit “ya boleh”; 17 entri production dibaca ulang metadatanya dan sembilan flag diverifikasi false. Tidak redeploy.
- Origin dan database staging terisolasi belum terverifikasi. Migrasi WP-02/WP-03 sudah diterapkan; sender, scheduler dan aktivasi push produksi tetap nonaktif. Rilis worker/UI WP-04 telah diotorisasi pengguna; migrasi resolver diterapkan sebelum rilis kode, sementara flag push tetap off.
- WP-02: migrasi `20261107162929_web_push_private_foundation.sql` menambahkan lima tabel privat, sembilan RPC server-only, helper eligibility/quiet hours/rollup dan trigger pencabutan. Kode dan QA lokal selesai; migrasi cloud `20261107171317` (web_push_private_foundation_wp02) telah diterapkan pada sim-muridv2 setelah izin eksplisit pengguna. Lima tabel privat/RLS, sembilan RPC service-only dan fingerprint source/cloud 9/9 terverifikasi; seluruh flag database tetap mati. Uji lock multi-koneksi PostgreSQL managed belum dilakukan. Laporan persisten: `WP02_Database_RPC_Privat_SiM_Murid.md`.
- WP-03: kode API perangkat/lifecycle selesai dan dirilis ke main; lihat `WEB-PUSH-WP03.md`. Enkripsi AES-256-GCM, validasi endpoint/DNS, handshake cookie HttpOnly dengan rotasi secret saat handoff, rate limit privat dan kuota test atomik. Migrasi lokal `20261107173727_web_push_device_api.sql` menambah satu tabel/3 RPC serta AAD context claim. Rilis melalui PR #101 setelah izin eksplisit pengguna. Migrasi cloud `20261107175620` telah diterapkan; tabel RLS/service-only, fingerprint RPC 4/4 dan penolakan identitas tidak sah terverifikasi. Semua flag tetap nonaktif.
- WP-04: implementasi worker first-party, panel izin/lifecycle dan resolver klik selesai; pengguna mengotorisasi push ke main dan migrasi. Baca `WEB-PUSH-WP04.md`; laporan persisten bernama `WP04_Service_Worker_UI_Izin_SiM_Murid.md`. Migrasi lokal `20261108011007_web_push_click_resolver.sql` diterapkan ke cloud sebagai `20261108013820` (`web_push_click_resolver_wp04`); fingerprint dan hak service-only terverifikasi. Flag tetap off; tidak mengirim provider.
- Berikutnya WP-05: sender, worker dan pengiriman uji. Pertahankan kontrak payload v1 UUID, AAD WP-03 dan transport DNS-pinning; staging terisolasi/UAT perangkat nyata masih terbuka. Migrasi resolver WP-04 telah diterapkan sebelum rilis kode setelah otorisasi.
- Batas satu sesi aktif existing tetap berlaku; expiry berbeda dari logout/revoke; payload generik; push claim dilindungi token dan binding_version; worker email/WA tidak dinaikkan konkurensinya. Cron database saat baseline hanya tick per jam tanpa dispatch.

Validasi WP-01: script `node scripts/verify-web-push-library.mjs` hanya membentuk request terenkripsi offline, tidak mengirim HTTP dan tidak mencetak key. Typecheck, lint, test:jobs dan build lulus. Semua key hanya server; template `.env.example` kosong untuk secret.

WP-01 tidak merilis runtime push. Pengguna kemudian mengizinkan push ke main dan migrasi WP-02; perubahan disiapkan untuk rilis tersebut. Jangan menganggap kesiapan database sebagai fitur push telah berjalan. Periksa main dan laporan terbaru sebelum melanjutkan.

## Pemeriksaan rilis 8 November 2026 WIB

Seluruh suite rangkaian check selesai melalui pemeriksaan awal dan lanjutan setelah assertion restore diperbarui dari 84 tabel/49 migrasi menjadi 89/50. Build produksi bersih lulus setelah cache Turbopack lama dibersihkan. Security Advisors cloud: tidak ada peringatan baru selain INFO RLS tanpa policy pada lima tabel privat service-only; peringatan leaked-password Auth sudah ada sebelum migrasi. Tidak mengaktifkan push/scheduler atau mengirim pesan.

## WP-03 — bukti lokal

`npm run check`: 819 test/85 proses, typecheck, lint, drift types dan build lulus. Sesudah `npm ci`, 47 test terfokus serta typecheck/lint/build bersih lulus. Katalog lokal 88 tabel aplikasi ber-RLS tanpa issue. Bukti: `docs/verification/web-push/wp03-checks.json` dan `wp03-advisory.json`. Build inkremental sempat gagal karena cache persistence Turbopack; hanya `.next` dibersihkan dan clean build berhasil. Migrasi managed WP-03 telah diterapkan setelah izin eksplisit pengguna; UAT browser dan lock multi-koneksi managed belum dilakukan.

Laporan WP-03 persisten: [WP03_API_Perangkat_Lifecycle_SiM_Murid.md](https://chatgpt.com/library?file_id=libfile_64b9c473f7bc8191b70d04a0d81f1df7&account_id=personal).

Rilis WP-03: [PR #101](https://github.com/kamadmtsnf-ai/sim-murid/pull/101). Tree implementasi remote identik dengan commit lokal `2bebf02`; catatan penerapan ini tidak mengaktifkan sender atau UI izin.

## WP-04 — bukti lokal

`npm ci` dan `npm run check` lulus: 832 test/86 proses, typecheck/lint/drift types/build produksi. Final 71 test terfokus; 12 pemeriksaan browser Chromium 131 dengan doubles + worker install/update nyata lulus, axe nol temuan dan tanpa overflow 320/390/768/1440. HTTP `/sw.js` JavaScript/no-store/scope root/nosniff terverifikasi. Lihat `docs/verification/web-push/wp04-checks.json`. Setelah QA, pengguna mengotorisasi rilis; migrasi managed WP-04 telah diterapkan dan diverifikasi sebelum rilis kode. Aktivasi dan UAT perangkat fisik/provider/staging tetap terbuka.

## WP-05 — sender dan worker

Implementasi lokal sender/worker selesai; baca `WEB-PUSH-WP05.md`. Migrasi baru `20261108020135_web_push_sender_worker.sql` menambah singleton lease/wake privat dan lima RPC service-only. Installer managed opsional `supabase/operations/web-push-scheduler.sql` membuat cron inactive, memakai Vault/pg_net setelah commit; tidak dipasang atau diaktifkan. Endpoint POST memakai dedicated bearer, batch 20/konkurensi 4, IP pinning, final preflight dan completion fencing. Accepted bukan tampil/dibaca; hasil ambigu tidak diulang otomatis. Kode belum push ke main, migrasi belum cloud, semua flag tetap nonaktif. Penerimaan WP-05 nyata masih menunggu staging terisolasi dan perangkat tester yang dipilih. WP-06 producer bisnis belum dijalankan.

Bukti WP-05: `npm ci` + `npm run check` lulus 849 test/87 proses; 35 test push terfokus, 53 pemeriksaan browser/9 audit axe; 89 tabel aplikasi ber-RLS dan 53 migrasi lokal tanpa issue katalog. Rincian `docs/verification/web-push/wp05-checks.json`. Laporan persisten bernama `WP05_Sender_Worker_Pengiriman_SiM_Murid.md`. Ini tidak menutup gate staging/provider/perangkat/managed scheduler.

## Persiapan rilis WP-05 — 8 November 2026

Pengguna telah mengotorisasi push ke main dan migrasi. Migrasi managed `20261108023237` (`web_push_sender_worker_wp05`) diterapkan sebelum rilis kode. Lima fingerprint body RPC source/cloud cocok; invoker/service-only, RLS tabel worker dan penolakan identitas tidak sah terverifikasi. Database mempunyai 53 migrasi. Flag enabled/dispatch/test false, categories kosong, scheduler false dan worker URL null; delivery produksi nol. Installer scheduler managed tidak dijalankan. Hasil UI JSON disertakan; screenshot QA tetap artefak lokal. Penerimaan provider/perangkat/staging tetap terbuka.

## WP-06 — pilot poin: implementasi lokal

Baseline main `d3c82b3a8f4cf9204a3d03e96b1b938b34b7e7a4` (PR #103/WP-05). Baca `WEB-PUSH-WP06.md`. Migrasi additive `20261108030400_web_push_points_pilot.sql` menambah flag pilot default false dan tabel anggota privat/RLS, menghubungkan notify existing secara atomik, menjaga dedup/TTL serta membatalkan pending saat scope berubah. Dispatch pilot dipisah dari otorisasi klik sumber; tidak ada backfill event lama. Installer scheduler diperbaiki urutan lock-nya, tetap tidak dipasang/diaktifkan. Rumus poin, threshold dan resolver existing dipertahankan.

`npm ci` + `npm run check` lulus **864 test/88 proses**, termasuk 15 skenario pilot dan actual API→SQL terisolasi; UI 57 pemeriksaan/9 axe tanpa temuan. Katalog lokal 90 tabel aplikasi ber-RLS/54 migrasi tanpa issue. Bukti `docs/verification/web-push/wp06-checks.json`. Kode belum push; migrasi belum cloud; tidak memilih anggota atau mengirim provider. Pilot nyata masih menunggu gate WP-05 staging/scheduler/perangkat dan penerimaan operasional. Laporan persisten bernama `WP06_Pilot_Poin_Kedisiplinan_SiM_Murid.md`. WP-07 belum dijalankan.

## Rilis WP-06 yang diotorisasi — 8 November 2026

Pengguna mengotorisasi push ke main dan migrasi. Migrasi managed `20261108032003` (`web_push_points_pilot_wp06`) diterapkan sebelum kode; total 54 migrasi. Sembilan body fingerprint RPC/helper source/cloud cocok, semuanya invoker/service-only; tabel anggota ber-RLS dan tidak dapat dibaca anon/authenticated. Pemeriksaan service_role terhadap anggota/event/actor tidak sah menolak akses. Pilot/global/dispatch/test tetap false, categories kosong, anggota nol. Installer scheduler tidak dijalankan dan tidak ada provider send. Gate staging/managed scheduler/multi-koneksi/perangkat nyata tetap terbuka.

## WP-07 — perluasan kategori: kode dan QA lokal

Baseline main `147e24a0b550a97c6a50c17c8b1111ab1dffec2f` (WP-06/PR #104), diverifikasi kembali melalui GitHub. Baca `WEB-PUSH-WP07.md`. Empat kategori diimplementasikan: jadwal/piket siswa dengan debounce, publikasi snapshot rapor, pengingat survei wajib harian dan dokumen biodata byte-verified ready. Tindak lanjut **ditahan**: owner teks/proyeksi read-only belum mempunyai hubungan akun dan event state yang sah; kategori itu disembunyikan dan tidak dapat masuk expanded rollout. Tidak menebak penerima dari nama/role.

Migrasi `20261108044043_web_push_extended_categories.sql` menambah ledger sumber/cohort privat ber-RLS dan RPC reminder service-only. Gerbang expanded default kosong, cohort per kategori eksplisit/berjangka/terbatas; eligibility/cancel/klik dan navigasi scope diperluas. Layanan rapor mengonsumsi konteks kelas/anak/semester dari URL secara tervalidasi, dan dokumen menuju owner yang telah diotorisasi. Tidak mengubah D10/arsip, rumus poin/rapor atau email/WA.

`npm ci` + `npm run check` lulus **888 test/89 proses**, 21 skenario kategori, browser 128 pemeriksaan/17 axe tanpa temuan, 92 tabel aplikasi ber-RLS dan 55 migrasi lokal tanpa issue. Bukti `docs/verification/web-push/wp07-checks.json`. Kode belum push, migrasi belum cloud, flag/scheduler tidak diaktifkan, tidak memilih cohort atau mengirim provider. Empat kategori menunggu validasi staging/perangkat dan penerimaan operasional; follow_up menunggu kontrak owner/source. WP-08 belum dijalankan. Laporan persisten: `WP07_Perluasan_Kategori_SiM_Murid.md`.

## Rilis WP-07 yang diotorisasi — 8 November 2026

Pengguna mengotorisasi push ke main dan migrasi. Migrasi managed `20261108081602` (`web_push_extended_categories_wp07`) diterapkan sebelum kode. Total 55 migrasi; 19 fingerprint fungsi source/cloud cocok, invoker/service-only; dua tabel baru RLS dan tidak dapat dibaca anon/authenticated. Uji service_role menolak source tidak sah dan mengembalikan nol kandidat saat gerbang reminder mati; empty update trigger berjalan dalam rollback. Global/dispatch/test/points pilot false, categories/expanded kosong, cohort nol, scheduler false. Installer tidak dijalankan dan tidak mengirim provider. follow_up tetap ditahan; penerimaan operasional staging/perangkat tetap terbuka.

## WP-08 — otomatisasi dan pemantauan

Implementasi dan validasi lokal selesai pada cabang `feat/web-push-wp08`. Lihat [runbook WP-08](WEB-PUSH-WP08.md) dan [bukti pemeriksaan](../verification/web-push/wp08-checks.json). 906 tes lulus dalam 90 proses. Typecheck, lint, tipe database dan build produksi bersih lulus. Uji browser tertahan saat Chromium gagal membuka socket sandbox. Render server panel Admin lulus.

Migrasi inti `20261108090000_web_push_operations.sql` diperlukan sebelum rilis worker. Retensi nonaktif secara default. Installer managed terpisah dan mendaftarkan job dalam keadaan nonaktif. Pada pemeriksaan 11 November 2026 WIB, produksi masih memakai WP-07 dengan 55 migrasi, tidak mempunyai job Web Push, dan dispatch nonaktif. Staging terisolasi belum ditemukan pada koneksi yang tersedia. Penerimaan cron managed, SLO staging dan perangkat nyata masih terbuka. Laporan persisten `WP08_Otomatisasi_Pemantauan_SiM_Murid.md`.
