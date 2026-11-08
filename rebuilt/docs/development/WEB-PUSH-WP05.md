# WP-05 — Sender dan worker pengiriman

Tanggal: 8 November 2026. Baseline main: `c5260e5d7e2dca77a07df271233a80c484b09e1c` (WP-04/PR #102). Cabang implementasi: `feat/web-push-wp05`.

## Hasil dan batas penerimaan

Kode sender, worker, RPC, wake transaksional dan installer scheduler selesai. Pemeriksaan otomatis memakai database terisolasi dan transport pengganti; **belum membuktikan pengiriman provider ke OS/perangkat nyata**. Implementasi tidak melakukan push GitHub, migrasi cloud, pemasangan scheduler, perubahan flag atau pengiriman provider. Semua aktivasi tetap opt-in.

Staging Supabase terpisah dan origin staging yang sesuai belum tersedia/terverifikasi. Koneksi saat pemeriksaan hanya menyediakan proyek aplikasi produksi dan proyek LMS lain; proyek LMS bukan lingkungan uji SiM-Murid. Jangan mengganti staging dengan produksi. Preview juga belum mempunyai konfigurasi Auth/database yang diperlukan. APK/IPA dan integrasi OS khusus di luar lingkup.

## Perubahan

| Bagian | Implementasi |
| --- | --- |
| Sender | `src/lib/push/sender.ts`, AES-256-GCM dengan AAD WP-03, validasi generasi key dan subscription, enkripsi aes128gcm/VAPID per request melalui named export `web-push@4.0.0` |
| Transport | `src/lib/push/transport.ts`, allowlist dan DNS publik, koneksi IP dipatok, Host/SNI/sertifikat mengikuti hostname provider asli; tanpa redirect, proxy, reuse koneksi, atau pembacaan body respons |
| Worker | `src/lib/push/worker.ts`, maksimal 20 delivery dan 4 pengiriman paralel; anggaran kerja 42 detik + simpan metrik 2 detik; HTTP 10 detik; RPC 4 detik |
| Endpoint | `POST /api/push/worker`, Node, `maxDuration=60`, autentikasi constant-time dedicated secret; query selector ditolak, body tidak menentukan penerima atau URL |
| Database | Migrasi `20261108020135_web_push_sender_worker.sql`: satu tabel singleton privat ber-RLS, lima RPC service-only, trigger wake transaksional |
| Scheduler | `supabase/operations/web-push-scheduler.sql`: installer managed terpisah dari migrasi inti; pg_net + Vault + cron satu menit; job dibuat tidak aktif secara atomik |
| Operasional | Halaman Antrean dan pekerjaan menampilkan konfigurasi server, status delivery push, alarm internal dan status scheduler tanpa endpoint, token, key atau isi payload |

Worker email/WhatsApp dan jadwal legacy tidak berubah. Tidak ada pengiriman browser, timer browser, pengiriman di transaksi SQL atau pekerjaan yang dibiarkan berjalan sesudah respons API.

## Alur dan kontrol

1. Enqueue privat membuat delivery dan `wake_requested=true` dalam transaksi yang sama. Rollback tidak menyisakan wake atau pengiriman.
2. Cron privileged memeriksa wake **dan** baris yang siap/lease kedaluwarsa. Dengan demikian kegagalan HTTP setelah wake dibersihkan tetap dapat dipulihkan oleh sweep berikutnya. Tidak menjanjikan pengiriman seketika: tick satu menit ditambah latensi jaringan, antrean dan jam tenang.
3. pg_net mengantrekan request worker dalam transaksi scheduler dan memulai HTTP sesudah commit. Bearer dibaca dari Vault, bukan disimpan dalam perintah cron. Perlindungan deployment opsional memakai bypass secret tersendiri dari Vault.
4. Worker memperoleh lease global 70 detik; pemanggilan lain saat lease aktif mendapat `busy`. Jarak minimum awal worker 10 detik. Claim delivery tetap memakai token, binding version dan lease 120 detik.
5. Setelah dekripsi dan resolusi DNS, preflight database memeriksa ulang recipient, source, preferensi/kategori, kepemilikan perangkat, generasi binding, flag dan TTL. Perubahan jam tenang sesudah claim menunda tanpa HTTP dan mengembalikan jatah attempt tersebut. Uji perangkat yang eksplisit tetap melewati jam tenang sesuai kontrak WP-03.
6. HTTPS menghubungi IP hasil validasi, mempertahankan pemeriksaan sertifikat untuk hostname asal. Payload generik v1 berisi UUID `deliveryRef`/`eventRef`, judul SiM-Murid dan ajakan membuka aplikasi; tanpa identitas siswa, isi poin atau tautan mentah. Maksimal 2 KiB sebelum enkripsi; TTL provider dibatasi sisa TTL event dan 24 jam.
7. Hasil disimpan melalui RPC token/version-fenced. Metrik memakai **status yang benar-benar tersimpan**, termasuk bila pencabutan atau batas retry mengubah hasil transport. Jika provider menerima tetapi penyimpanan tidak terkonfirmasi, worker berhenti mengambil pekerjaan baru; tidak mengirim ulang otomatis. Lease kedaluwarsa menjadi `ambiguous`.

Perubahan/revoke yang terjadi **setelah** preflight tidak dapat menarik paket yang sudah terkirim ke provider. Payload generik dan resolver klik berotorisasi tetap melindungi detail. Tidak ada jaminan exactly-once pada jaringan eksternal.

## Pemetaan hasil

| Hasil | Tindakan |
| --- | --- |
| HTTP 2xx | `accepted`: diterima provider; tidak menandai tampil atau dibaca |
| 404/410 | `failed_permanent`, invalidasi subscription generasi yang sesuai dan batalkan delivery terkait |
| 429 | `retry_wait`, hormati Retry-After detik/tanggal, batas 24 jam, backoff dan jitter database |
| 5xx | Retry terbatas; maksimum lima attempt, dibatasi TTL/jam tenang |
| 401/403 atau kegagalan VAPID | Gagal permanen, alarm konfigurasi, hentikan claim berikutnya; tidak menginvalidasi semua perangkat |
| 400/413 | Gagal permanen payload; redirect 3xx tidak diikuti |
| Gangguan sebelum kemungkinan penulisan | Retry terbatas; sertifikat tidak sah gagal permanen |
| Timeout/error sesudah kemungkinan penulisan | `ambiguous`; jangan retry otomatis |
| HTTP selesai, penyimpanan gagal | `unconfirmed`, API 503; reaper lease mengubah processing menjadi ambiguous |

`providerAccepted` adalah observasi HTTP; `accepted` adalah jumlah status accepted yang tersimpan. Keduanya bukan bukti OS tampil. Resolver GET tidak menandai dibaca; read hanya setelah tindakan eksplisit pengguna.

## Konfigurasi

Gunakan kontrak WP-01/WP-03. Key VAPID/enkripsi harus independen antara production, preview dan development. Environment/origin harus cocok; staging tidak boleh memakai ref Supabase produksi. `WEB_PUSH_WORKER_SECRET` harus 43–128 karakter URL-safe, dedicated untuk endpoint ini; jangan gunakan `CRON_SECRET`, service role key, atau key VAPID sebagai bearer.

Flag Vercel `WEB_PUSH_ENABLED`, `WEB_PUSH_DISPATCH_ENABLED`, `WEB_PUSH_TEST_ENABLED` dan enam kategori tetap false. DB `push_settings.enabled`, `dispatch_enabled`, `test_enabled` tetap false, categories kosong. `push_worker_state.scheduler_enabled` default false. Key/origin belum lengkap membuat endpoint gagal tertutup 503 tanpa claim.

## Runbook staging — belum dijalankan

1. Siapkan staging SiM-Murid terisolasi: Supabase Auth/database sendiri, origin HTTPS stabil, kunci nonproduksi, data uji sintetis dan akun/perangkat tester yang secara eksplisit dipilih. Jangan salin endpoint/key pengguna produksi. Konfigurasikan Auth redirect yang sesuai.
2. Terapkan migrasi inti WP-05 setelah seluruh migrasi WP-02/03/04. Regenerasi/cek tipe, verifikasi RLS dan grant lima RPC hanya `service_role`. Pastikan singleton worker ada satu baris. Rilis kode staging dengan flag tetap false; cocokkan versi source/schema.
3. Verifikasi pg_cron, Vault dan pg_net tersedia di staging managed. Sebelum installer, pastikan tidak ada consumer pg_net lain yang bergantung pada grant browser/service role: installer mencabut akses schema/tabel/fungsi net dari PUBLIC/anon/authenticated/service_role. Jalankan sebagai operator database privileged, bukan service role aplikasi. Installer tidak otomatis diikutkan migrasi inti karena perlu ekstensi managed.
4. Buat Vault secret bernama `sim_murid_push_worker_secret` melalui pengelolaan secret; nilainya sama dengan environment worker. Jika deployment memakai Vercel Protection, buat `sim_murid_push_deployment_bypass` dengan token scoped staging. Jangan menaruh nilainya di SQL tersimpan, riwayat perintah, screenshot, log atau laporan. Batasi akses net request queue dan Vault pada operator privileged.
5. Jalankan installer `supabase/operations/web-push-scheduler.sql`. Verifikasi job `sim-murid-web-push-sweep` **inactive**, `scheduler_enabled=false`, command hanya `select sim_murid_private.push_schedule_tick()`. Set `worker_url` ke URL staging yang telah diverifikasi berakhiran tepat `/api/push/worker`, tanpa query; tetap false. URL ini hanya boleh diubah operator terpercaya, bukan input browser.
6. Setelah memilih tester, aktifkan **hanya staging**: env global/dispatch/test true, DB global/dispatch/test true, categories tetap kosong; redeploy staging sesuai kebutuhan. Daftarkan perangkat uji melalui izin eksplisit dan tombol Uji perangkat ini. Tidak ada broadcast atau kategori bisnis pada langkah ini.
7. Aktivasi scheduler staging harus mengaktifkan dua lapis: `scheduler_enabled=true` dan `cron.alter_job(..., active:=true)` untuk job khusus tersebut. Job cron legacy jangan diubah. Tick membawa wake antrean; API tidak membutuhkan penerima dari body.
8. Catat tiga bukti terpisah: accepted provider tersimpan, notifikasi benar-benar terlihat pada perangkat, klik menuju inbox yang benar setelah sesi divalidasi. GET klik tidak mengubah read_at; aksi baca eksplisit mengubah read_at. Uji keadaan foreground/background/tertutup sesuai dukungan browser dan perangkat yang dipakai.
9. Verifikasi lewat managed PostgreSQL multi-koneksi: dua worker serentak hanya satu lease global; rollback enqueue tidak mengirim HTTP; wake HTTP gagal dipulihkan sweep; revoke saat pengiriman tidak memulihkan binding lama; kill worker meninggalkan ambiguous dan tidak resend; 410/429/5xx/401 terkontrol tanpa mengirim ke pengguna lain. PGlite/double bukan bukti lock jaringan managed.
10. Periksa `cron.job_run_details`, metadata status pg_net dan endpoint worker tanpa menampilkan header/body rahasia. Batasi retensi pg_net/cron sesuai operasi; jangan menyalin antrean HTTP yang memuat bearer. Jika ada timeout setelah IO, jangan mengulang manual delivery ambiguous sebelum rekonsiliasi.
11. Setelah hasil diterima, matikan kembali staging atau dokumentasikan persetujuan operasional. Aktivasi kategori poin dan producer bisnis merupakan WP-06; aktivasi produksi memerlukan keputusan terpisah.

## Alarm dan rollback

Halaman Antrean dan pekerjaan hanya dapat dibaca pengelola yang lolos otorisasi server/RPC. Alarm internal muncul untuk antrean siap lebih dari lima menit atau error VAPID/key version/provider auth 24 jam terakhir. Tidak ada paging/alert eksternal otomatis di WP-05. Diagnosis agregat tidak memuat token, ciphertext, endpoint atau identitas pengguna.

Jika hasil tidak sesuai: nonaktifkan cron khusus push, `scheduler_enabled=false`, semua flag push env dan DB; deploy konfigurasi off. Jalankan maintenance untuk membatalkan antrean yang belum terkirim. Jangan mengubah accepted/read menjadi gagal, mengirim ulang ambiguous, menghapus inbox, atau menurunkan schema saat kode masih memanggil RPC baru. Installer mengubah grant net; pemulihan grant hanya setelah meninjau consumer dan kebutuhan nyata, bukan grant luas default.

## Bukti dan kelanjutan

Bukti mesin: `docs/verification/web-push/wp05-checks.json`, `wp05-advisory.json` dan hasil UI terkait. Tes terfokus: `npm run test:push:sender`, `npm run test:push:database`. Pemeriksaan lengkap: `npm ci`, `npm run check`.

Gate terbuka: isolated authenticated staging, ekstensi pg_cron/pg_net/Vault managed, lock multi-koneksi dan provider → tampilan perangkat → klik/read nyata. Jangan menandai WP-05 diterima penuh hanya dari HTTP 2xx atau simulasi lokal. Tidak ada migrasi cloud/rilis/aktivasi dari tahap implementasi ini. Baca dokumen ini dan `WEB-PUSH-STATUS.md` sebelum kelanjutan atau permintaan rilis.

Validasi akhir lokal: `npm ci` dan `npm run check` lulus, **849 test / 87 proses**, typecheck, lint, drift types dan build produksi. Suite push terfokus 35 test lulus; UI 53 pemeriksaan dan 9 audit axe tanpa temuan, tanpa error JavaScript. Katalog 89 tabel aplikasi ber-RLS, 53 migrasi, tidak ada issue pada advisory lokal (bukan Supabase Platform Advisors).
