# Tahap26–30 — SPK, survei dan kesiapan cutover

21 Oktober2026 WIB. Target: GitHub kamadmtsnf-ai/sim-murid main, aplikasi rebuilt/, Supabase sim-muridv2, Vercel sim-muridv2.

**Status:** implementasi aplikasi dan alat rilis diterbitkan setelah pemeriksaan teknis. **Tahap30 cutover belum diterima/selesai**: belum tersedia ekspor data operasional sumber, percobaan restore, UAT pengguna, dan beban bisnis terautentikasi. Tidak memindahkan data historis, tidak menghentikan GAS/trigger lama, dan tidak mengarang hasil penerimaan.

| Tahap | Implementasi | Bukti |
|---|---|---|
|26|25kode katalog asliA01–I04; snapshot poin dasar; event/tanggal/urutan stabil;50awal, clamp−50..100; residivis1/2/3/R03, positif sesudahR03; cancellation milik pencatat/Admin; replay, scope pribadi/anak/Guru/kelas/bimbingan|tests/database/services.test.mjs:26|
|27|Inbox per penerima, read/badge; resolusi siswa/ortu/wali/BK/Admin dari relasi; dedup outbox, ambang tingkat; arsip bulanan immutable dan idempotent; ranking saldo/pelanggaran/IDstabil, kelas2besar/global3besar; sertifikat scoped; afektif dari snapshot dan mapel eksplisit|tests:27,ranking,inbox;cloud|
|28|206butir bank kanonis perrole dan generator asli mapel/kegiatan; snapshot95butir siswa dengan rotasi8berdasarkan histori+seedstabil; peer selain diri sendiri maks12;1–5/TT, esaipeer opsional; draft revisi, lokal perakun/periode/versi, autosave/reconnect; requiredlist bersamaUI/server; final/peer lockDB; gate survei utama, mikro terpisah; peringatan14hariujian/override|tests:28,DTO,instrument;cloud|
|29|Agregat/aspek/mapel/kegiatan/peer; filter peran/keandalan dan jumlah dikecualikan; tren berlabel versi instrumen; monitoring/catatan; hasil personal min5penilai substantif,TTdikecualikan,max3kutipan; rencana3–7poin hanyaKepala setelahtutup–H+30; pembaruan ketercapaian setelahH+30 tetap olehKepala; mikro; konfigurasiAI terenkripsi/masked; cache/error/sample5/150/1500/JSONschema; outbox claim/retrybackoff/statusambigu; schedulerDB|tests:29;cloud;Cron catalog|
|30|Paket XLSX lintasabsensi/bimbingan/iuran/tabungan/SPK/rapor/agregatsurvei memakai queryscopeasal, batas hasil parsial; CSVinjection dan tipeExcel; PDF/sertifikat; alat manifestrekonsiliasi collision/orphan/digest/saldo/alokasi/nilai/SPK/survei/dokumen; runbookrestore/cutover; harnessbebanreadonly|tests:30/export/reconciliation;runbook;load-local.json|

Halaman: `/account/services/{discipline,notifications,surveys,insights,jobs,reconciliation}`; API `/api/services/[module]`, `/api/services/exports`, `/api/services/ai`, `/api/services/dispatch`, `/api/services/cron`. Menu akun diperbarui.

## Hasil pemeriksaan

- npm ci579packages; typecheck, lint,152pengujian lokal, drift tipe dan build produksi lulus.23pengujian baru terdiri4DTO/instrumen/ekspor/rekonsiliasi dan19skenarioDB, masing-masing dengan banyak assertion.
-21assertion Supabase cloud memakai hak service_role lulus dalam transaksi rollback; fixture tersisa0. Script scripts/database/verify-services.sql. Pengujian memverifikasi event/residivis/notifikasi/scope/survei/gate/final/agregat/privilege. Tidak mengirim email/WA atau memanggilAI aktual.
-32migrasi lokal/cloud,79tabel aplikasiRLS. Lima migrasi modul dan dua migrasi penyempurnaan menjaga riwayat append-only; file lama tidak dihapus atau diganti. Pemetaan timestampMCP/checksum pada supabase/migration-cloud-map.json; jangan linked db push mentah sebelum reconciliationhistory/dry-run.
-Advisory katalog lokal lulus. Supabase Advisor: INFO65tabel privateRLS tanpa policy sesuai deny-by-default; WARN lama [leaked-password protection belum aktif](https://supabase.com/docs/guides/auth/password-security#password-strength-and-leaked-password-protection).
-Baseline build lokal pada endpoint liveness:60permintaan bersamaan,p50≈88ms,p95≈119ms,error0;132permintaan,p50≈107ms,p95≈176ms,error0. **Bukan benchmark pengguna terautentikasi atau transaksi bisnis**, bukan kapasitas produksi. Percobaan harness awal tidak menjangkau server lintas proses; hasil akhir memakai server dan client dalam satu runtime. Tidak menyembunyikan kegagalan bisnis dengan mengganti endpoint.
-HTTP produksi dan identitas deployment ditambahkan pada bukti rilis setelah pemeriksaan selesai.

## Operasi penyedia dan jadwal

Cron Supabase `sim-services-hourly` aktif tiap jamUTC. Fungsi memeriksa15/17/19/21/23WIB untuk pengingat; skiplibur,0siswa,absensilengkap,emailsalah. Dedup per user/hari. Hari1mengarsipkan bulan sebelumnya; retry tidak menimpa snapshot. Pekerjaan juga menyiapkan antrean slip21; pengiriman tidak mendebit ledger.

Email/WA SPK **default nonaktif**. Pengaturan pada aplikasi mengaktifkan antrean, bukan menyatakan pesan terkirim. Worker yang dipicu Admin memproses satu item per request; claim kedaluwarsa menjadi ambigu dan tidak diulang otomatis. Failed memakai backoff maks5percobaan. Sebelum claim/sending, data penerima diperiksa ulang. APIcron ber-Bearer CRON_SECRET tersedia untuk scheduler HTTP terpisah; tidak dikonfigurasi dengan jadwal/secretHTTP pada rilis ini. SERVICES_DISPATCH_ENABLED defaultfalse; tidak ada pengiriman massal aktual saat pemasangan.

Gmail memakai konfigurasi server yang sudah ada. WhatsApp memakai adapter webhookHTTPS server-only (WHATSAPP_API_URL/KEY), payload{to,message}, Idempotency-Key; kontrak penyedia aktual perlu verifikasi sebelum diaktifkan, tidak memilih paket berbayar. Status2xx/SMTPaccepted bukan bukti sampai ke perangkat/inbox. Kegagalan/timeout disimpan terpisah dari transaksi.

Anthropic dan Gemini mempunyai konfigurasi berbeda, keyAES256GCM terenkripsi, model eksplisit, endpoint tetap, batas input dan JSONhasil tervalidasi. Key tidak ditampilkan ulang atau dicatat plaintext pada audit. Kunci enkripsi diturunkan dengan pemisahan domain dari EMAIL_OTP_SECRET; rotasi secret tersebut mensyaratkan rekonfigurasi keyAI atau migrasi ciphertext terencana. Tidak ada key/model aktual yang dipasang atau panggilan berbayar selama uji. Analisis mencakup esai periode yang dipilih; filter layar agregat tidak mengubah cakupan permintaanAI. Cache bertanda sumber/model/provider dan status.

Rujukan adapter: [Anthropic Messages](https://platform.claude.com/docs/en/api/messages/create), [Gemini API](https://ai.google.dev/api), [Supabase Cron](https://supabase.com/docs/guides/cron/install).

## Batas penerimaan yang belum terbukti

- Belum ada uji visual/login browser produksi seluruh peran, offline/reconnect nyata, PDFpanjang/font/identitassekolah semua kasus; PDF masih memakai fontLatin standar dan karakter yang tidak didukung diganti `?`. Sertifikat berupa dokumen laporan dengan ruang tanda tangan, bukan tanda tangan digital.
- DefaulttieSoTM memakai UUIDstabil. Data migrasi yang mempunyai legacyorder belum tersedia; perlu pemetaan tiehistoris sebelum menerbitkan sertifikat arsip sumber.
- AI/WhatsApp aktual, SMTPinbox, dua koneksiDBbersaing, UAT60–132pengguna bertoken, backup/restore staging dan cutover belum dijalankan. Tidak menganggap uji PGlite sebagai uji beban Postgres produksi.
- Data sumber dan inventaris trigger/berkas Drive belum ditemukan dalam berkas kerja yang tersedia. Pencarian berkas ekspor yang tersedia tidak menghasilkanCSV/XLSX; bukan bukti bahwa sumber operasional tidak ada. Perlu ekspor sebenarnya untuk rekonsiliasi.
- D10 tetapOPEN: rapor terbit dan snapshotKKM tidak ditimpa.

Runbook dan gerbangGO/NO-GO: docs/release/cutover-runbook.md. Alat rekonsiliasi hanya membaca manifest yang disuplai; hasil matched tidak membuktikan import atau restore.

## Catatan review

CLI pertama dihentikan peninjauan otomatis saat mencoba telemetriPostHog dengan payloadtidakjelas. Perintah selanjutnya memakai SUPABASE_TELEMETRY_DISABLED=1 dan DO_NOT_TRACK=1 sesuai dokumentasi resmi; alternatif lokal berhasil. Tidak meminta pengecualian atau mengulang panggilan telemetri.
