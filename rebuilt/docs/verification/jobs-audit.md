# Audit Pekerjaan — 23 Oktober 2026

Baseline main `04d6dd4b7ed26e7f1d5f6a0ec12f410f36738a16`; branch `fix/jobs-audit`.

## Analisis sebelum perubahan

Dibaca seluruh service page/panel, reader/validator, API services/jobs dan dispatch/cron, dispatchOne, emailEnvironment/gmail transport, educationContext, transaksi app_services_write dan override singleton, app_services_read, app_jobs_admin/tick, app_delivery_worker, outbox/job_runs, tes services/production/notifications serta spesifikasi M17/U27–29 dan keputusan bisnis. Tidak ada CRUD/form/modal kompleks pada halaman ini; operasi aktual adalah preview tick, tick non-dry-run, retry dan dispatch satu item, dengan riwayat baca.

Alur: sesi server + gate survei → RPC pembaca khusus Admin/onboarding → snapshot. Tick/retry memakai request UUID, shared operations revision, transaksi/dedup/audit. Dispatch memeriksa Admin/onboarding sebelum worker claim; worker mengecek penerima, lease, jumlah percobaan, available_at, dan SKIP LOCKED. Penyedia eksternal dipanggil setelah claim; complete mencatat sent/failed/ambiguous. Cron tetap memakai dispatchOne dengan kontrak pesan string. Snapshot jobs menampilkan maksimal 200 outbox terbaru tanpa payload dan 100 job_runs terbaru; jumlah di UI adalah subset tersebut, bukan total historis.

## Temuan dan perbaikan

| Temuan / penyebab | Perbaikan |
| --- | --- |
| Dispatch UI tanpa lock, catch, timeout atau konfirmasi | Satu pengunci sinkron untuk semua tindakan, konfirmasi, timeout55 detik, AbortController/cleanup, mounted guard |
| Label satu email padahal worker juga memproses WhatsApp | Label Proses satu pengiriman dengan penjelasan saluran dan efek nyata |
| Hasil POST/HTTP200 belum membuktikan mutasi | Enum ack, tick dryRun/kandidat/tanggal/jam, retry ID/status dan revision+1 readback |
| Unknown ack/5xx/network dapat diulang dengan UUID baru | Lock sampai GET tervalidasi, tanpa replay otomatis |
| Retry SQL mengakui sukses tanpa perubahan dan pada attempts>=5 | UPDATE failed+attempts<5; hanya saved bila baris berubah; return ID target; attempt counter tidak direset |
| Worker complete mengakui sukses bila baris sudah bukan processing | Return not_found bila UPDATE tidak mengubah baris |
| Worker client hanya memeriksa complete.error dan menerima claim code bebas | Claim code diketahui; malformed upstream jadi service error; complete harus code saved sebelum status sent diakui |
| Dispatch API hanya memeriksa boolean Admin sebelum service-role claim | Reader pekerjaan memverifikasi gate Admin/onboarding SQL terlebih dahulu; gate survei existing tetap berlaku |
| Provider ready hanya berdasarkan dua env, tidak sesuai validator sebenarnya | Konfigurasi Gmail divalidasi parser existing; URL WhatsApp HTTPS tanpa credentials dan key; hanya boolean dikirim, bukan secret |
| Antrean tanpa filter, pagination, timestamp dan riwayat job_runs | Pencarian peristiwa/ID, filter status/saluran, pagination10, waktu WIB, status lokal dan riwayat terpisah |
| Overflow action/nama/kode pada ponsel | Scoped CSS min-width0, wrap, kontrol44px, padding responsif; riwayat scroll lokal dapat difokuskan keyboard |
| Outage page menyatu dengan penolakan akses | Jobs outage ke error boundary existing; AccessDenied mendapat keterangan Admin yang jelas |
| Generic panel masih menyimpan helper mutasi yang tidak lagi dipakai | JobsPanel terpisah; hapus handler/load/state/text helper mati, pertahankan ekspor/fungsi Rekonsiliasi |

## Lingkup dan kompatibilitas

Tidak mengganti framework, auth, role, database, schema/table/grant/RLS, scheduler, business date/tahun ajaran, penerima, payload, tarif, pengingat, reset poin bulanan atau slip tabungan. Migrasi `20261023143117_jobs_delivery_consistency.sql` hanya mengganti dua fungsi existing dengan SECURITY INVOKER/search_path kosong dan mempertahankan grant. Ambiguous tidak diretry. Backoff otomatis, batas lima attempts, recipient check, dedup key, operation replay, audit dan singleton predicate tetap dipertahankan. Manual retry eligible tetap dapat mengantrekan segera seperti perilaku lama, tanpa mereset attempts. Tidak menjanjikan exactly-once lintas penyedia.

`dispatchDelivery` mengembalikan code/message terstruktur untuk API; `dispatchOne` tetap wrapper pesan untuk cron. Field message/result existing tetap tersedia, API jobs menambah code/data readback. UI tidak menganggap kandidat pengingat sama dengan jumlah pesan yang benar-benar diinsert/dikirim. Konfigurasi aktif bukan uji konektivitas/provider delivery. Status sent berarti diterima penyedia, bukan inbox/perangkat penerima.

## File yang berubah

- Service page/panel dan JobsPanel baru: pemisahan UI/lifecycle serta error state.
- API services/[module] dan dispatch: ack/readback dan preflight akses.
- lib/services/jobs.ts: satu kontrak typed snapshot/ack/status/result.
- lib/services/server.ts dan dispatch.ts: validasi data, readiness dan hasil worker.
- globals.css: selector scoped jobs-panel.
- Migrasi dua fungsi; tes database/foundation count dan services regression.
- tests/jobs.test.mjs: handler/page/reader/worker asli dengan Auth/SDK/SMTP sintetis.
- tests/notifications-page.test.mjs: mock otorisasi baru dan harapan error jobs; fallback Rekonsiliasi tetap diuji.
- Browser fixture/verifier, scripts package.json dan dokumentasi design system/verifikasi.

## Keamanan produksi dan batas bukti

Migrasi diterapkan melalui apply_migration. Query read-only setelah migrasi membuktikan patch aktif pada app_jobs_admin/app_delivery_worker, SECURITY INVOKER, EXECUTE anon/authenticated=false, service_role=true. Tidak mengirim email/WhatsApp atau memodifikasi baris antrean produksi untuk QA. Advisor baseline tetap INFO66 private RLS tanpa policy dan WARN1 leaked-password protection; tidak mengubah arsitektur auth dalam audit ini.

Browser memakai komponen asli dengan data/HTTP sintetis; API/SMTP/Auth boundary sintetis, database PGlite menjalankan migrasi nyata terisolasi. Ekstensi C safeupdate tidak dijalankan PGlite; predicate existing dipertahankan dan suite singleton tetap dijalankan. Perangkat fisik, screen reader manual, dan penerimaan email/WhatsApp produksi belum diuji. Scroll vertikal halaman normal agar semua konten dapat diakses; sasaran layout tanpa overflow horizontal/konten terpotong. beforeunload melindungi proses pending, bukan interceptor seluruh navigasi Next.js. Satu lock UI tidak menjamin satu operator/global dispatch; worker database tetap mengatur klaim antaroperator/cron.

Changelog Supabase dan dokumentasi fungsi diperiksa: https://supabase.com/docs/guides/database/functions . Tidak ada penggantian API SDK atau dependensi runtime.

## Hasil verifikasi

- `npm ci` berhasil tanpa perubahan versi dependency/lockfile.
- `npm run check` selesai dengan exit0: 470 tes/54 kelompok runner, tanpa kegagalan; TypeScript, lint nol warning, database migration/grant/RLS, API/domain, db types14 tabel public dan production build lulus.
- Services/database: 24 tes lulus, termasuk retry limit, status ambigu, completion hilang/replay dan penolakan non-Admin.
- Jobs API/worker/page: 7 tes lulus, mencakup acknowledgement/readback, revision, preflight role/gate, email/WhatsApp adapter sintetis, idempotency header, HTTPS dan jaringan ambigu.
- Browser final menggunakan CSS build produksi: 45 pemeriksaan/7 axe lulus, pageerror kosong. Viewport320/768/1440 dan landscape; data panjang, 25 pengiriman/100 riwayat, empty state, search/filter/pagination, batas attempts, konfirmasi batal, double click, shared dispatch lock, sent/empty/ambiguous/unconfirmed, unknown200, 503/409/network, GET tanpa replay, kegagalan reload, touch/keyboard, tanpa horizontal overflow.
- Heading order diperbaiki dengan h2 section dan h3 item; daftar riwayat scroll lokal dapat difokuskan. Visual mobile ditinjau dari screenshot.
- Deadcode: 135 entry, 195 source files; unreachable kosong.
- Migrasi dan hak server-only produksi diverifikasi kembali melalui query read-only; tidak mengirim pesan produksi untuk QA.
