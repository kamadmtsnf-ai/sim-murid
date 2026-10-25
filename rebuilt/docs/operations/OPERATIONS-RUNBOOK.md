# Runbook operasional P10

Baseline aplikasi sebelum P10: `9bf56ff2aab4ec1b7ce46e15509b94d7ab7f355b`. Runbook ini melengkapi [cutover](../release/cutover-runbook.md), bukan izin cutover data, perubahan D10, retensi baru atau layanan berbayar.

## Insiden dan pelacakan

1. Minta kode laporan/waktu WIB/modul/tindakan yang dilakukan, tanpa password, OTP, cookie, dokumen atau isi formulir. `X-Request-ID` pada respons privateJson adalah UUID baru server, bukan ID actor. Status5xx menghasilkan satu event `sim.http_error` dengan reference/status. Shared mutation hook menampilkan kode saat respons5xx tersedia; timeout/offline tanpa respons tidak punya kode buatan.
2. Cari reference pada log deployment yang benar. Error render memakai digest Next.js, terlihat pada error boundary akun/root dan event `sim.request_error`. Log tambahan hanya digest tervalidasi, method dan jenis route. Tidak mencetak error.message/stack/request URL/headers/body. Log platform/framework lain di luar helper ini bukan jaminan bebas PII; jangan menyalin log mentah ke git/tiket publik.
3. Bedakan 401/403 (sesi/izin),409 (revisi/idempotency) dan5xx (layanan). Error log tidak menandakan transaksi gagal: bila hasil tulis tak pasti, periksa readback/audit/native request sebelum mencoba lagi. Jangan mengulang mutasi secara otomatis.
4. Tinjau deployment/konfigurasi/layanan yang benar. `/api/health` hanya liveness. `/api/release/readiness` memerlukan Admin+sesi+gate existing, hanya memberi metadata configuration-only/environment/project ref; bukan bukti backup, kapasitas, SMTP atau kesiapan keseluruhan.
5. Jika rollback kode diperlukan, pilih deployment tervalidasi dengan schema contract kompatibel. Jangan menonaktifkan immutable triggers, menghapus ledger/snapshot/log, atau mengubah data agar laporan cocok. Hentikan penulisan hanya melalui prosedur maintenance yang disetujui; belum ada maintenance toggle universal baru di P10.

Log dikirim ke sink console platform existing; tidak memasang Observability Plus, penyedia telemetry eksternal, log-drain, pengingat email/WA atau paid metrics. Pemilik perlu menetapkan retensi, akses log dan ambang alert sesuai volume/budget. Tidak ada target p95/RPO/RTO bisnis baru yang diasumsikan telah disepakati.

## Latihan restore yang tersedia

```bash
npm ci
npm run verify:restore -- /tmp/p10-restore.json
npm run verify:benchmark -- /tmp/p10-benchmark.json
```

Keduanya membuat PGlite terisolasi dari seluruh45 migrasi dengan data sintetis; **bukan** backup database produksi. Restore membuat snapshot gzip dalam memori, memverifikasi checksum, memuat instans baru, mencocokkan data seluruh82 tabel (80 aplikasi+2 Auth fixture) dan fingerprint kolom/constraint/indeks/RLS/policy/trigger/routine/grant; memeriksa sesi registry, saldo200000, rapor82, grants/immutable/denial. Backup rusak ditolak sebelum dimuat. Satu perubahan sintetis sesudah backup sengaja tidak pulih: menunjukkan perlunya keputusan RPO, bukan memperbaikinya diam-diam. Archive sementara tidak dipersistenkan; ini tidak memasang jadwal/retensi/enkripsi backup produksi.

Benchmark membaca8 persona (7 base roles ditambah penugasan Kepala),12 sampel perpersona, membuat batch60/132 request tulis pada revisi sama dan5 ekspor PDF. Hanya satu penulisan perbatch diterima, sisanya stale expected; replay tidak menggandakan audit. PGlite satu koneksi menserialisasi antrean: latency ini **tidak** mengukur132 worker Postgres/cloud atau132 pengguna nyata.

## Gerbang staging nyata (belum terpenuhi)

1. Sediakan proyek staging terpisah dengan izin dan biaya yang disepakati. Jangan memakai project produksi `qpzoukkhdxpmbtkcqemj` atau proyek LMS lain. Koneksi saat P10 melaporkan nol branch staging. Tidak membuat branch/proyek berbayar otomatis.
2. Pilih metode backup yang benar untuk paket yang tersedia, media privat/terenkripsi, retensi/operator dan target RPO/RTO yang diterima pemilik. Restore hanya ke target terpisah; jangan `reset --linked`, men-truncate produksi atau mematikan pengaman final sebagai jalan pintas. Jangan mempublikasikan dump/kunci/personal data.
3. Backup/clone database tidak sama dengan pemulihan Storage: inventaris berkas privat, checksum, bucket/izin, Auth settings/API keys, extensions, cron dan konektor perlu penanganan tersendiri. Cegah pekerjaan/email/WA/AI terjadwal dari salinan sebelum menguji; jangan mengaktifkan provider produksi sebagai efek samping fixture.
4. Rekonsiliasi source/restore: jumlah dan digest kanonis, FK, saldo dan reversal, fee/slip, alokasi komite, PH/KKM/rapor immutable, poin, survei final, relasi keluarga, file/checksum/akses, Auth login sesungguhnya, revoked session dan RBAC. Gunakan [reconcile existing](../../scripts/release/reconcile.mjs); missing evidence harus blocked.
5. UAT orang nyata memakai fixture sanitasi: Admin, Kepala, guru mapel, wali kelas, pembimbing, piket, BK, bendahara komite, pengelola tabungan, siswa, orangtua multi-anak, alumni, nasabah, calon. Catat tugas, keberhasilan, waktu, error ID, temuan dan penerimaan; bukan sekadar halaman200. Jangan menganggap role dasar baru untuk penugasan ini.
6. Jalankan workload campuran baca/tulis/ekspor dengan sesi nyata di staging; ukur p50/p95/error/konflik/retry/lock dan rekonsiliasi hasil. Mulai kecil, lalu60/132 sesuai kesepakatan; berhenti bila terjadi kesalahan integritas, salah lingkungan atau penolakan yang tidak diharapkan. Target latency/capacity dan toleransi error perlu disepakati, bukan diambil dari health.

### Driver staging

`node --experimental-strip-types scripts/operations/staging-load.mjs /path/private/staging-plan.json /path/private/report.json`

Plan privat: origin, environment=`staging`, projectRef yang berbeda dari produksi,132–200 sesi cookie berbeda, scenarios dengan method GET/POST, path API whitelist, expectedStatuses; POST memerlukan allowWrites=true dan body terbatas. Cookie/isi tidak boleh ditempel pada git/chat/log. Jangan memakai credential pengguna asli di fixture. Driver meminta `/api/release/readiness` sebagai Admin; deployEnvironment harus preview/development dan projectRef harus sama dengan plan. Alias preview yang masih memakai DB produksi ditolak. External target perlu `SIM_LOAD_EXTERNAL_APPROVED=true` setelah target disetujui. Tidak ada retry otomatis. Respons redirect ditolak agar cookie tidak diteruskan ke origin lain.

Driver hanya satu request persesi perbatch60/132, bukan soak/simulasi manusia lengkap. Status200/403/409 expected dilaporkan berbeda; konflik/denial bukan bukti bisnis berhasil. Skenario dan idempotency/revisi/fixture harus disusun operator sesuai task; hasil driver perlu rekonsiliasi database dan UAT terpisah. Unit HTTP transport dengan cookie sintetis bukan Supabase Auth integration.

### GO/NO-GO

`npm run verify:release-gates -- /path/private/accepted-evidence.json /tmp/release-gates.json`

Tanpa evidence, exit1/ready=false memang diharapkan. Validator mensyaratkan restore managed staging (termasuk Storage/Auth/RLS/ledger/arsip), RPO/RTO terukur dan target diterima, matriks UAT, beban60/132 sesi asli campuran/reconciled, dan penerimaan pemilik beserta SHA256 bukti. Fixture PGlite/health tidak dapat menggantikan bukti ini. Validator memeriksa struktur klaim operator, bukan mengautentikasi tanda tangan atau membuktikan bahwa manusia benar-benar sudah menerima hasil. Tidak melakukan deploy, cutover atau mutasi data.

## CI dan sumber

Workflow `.github/workflows/rebuilt-checks.yml`: pull_request/push main, Node24, npmci/check, standard ubuntu-24.04, timeout20menit, concurrency cancel, token contents:read dan actions SHA-pinned; tanpa secrets produksi/deployment/provider/upload artifact. Wajibkan check `Rebuilt check` melalui pengaturan branch protection oleh Admin repository setelah check muncul; konfigurasi required checks tidak diubah oleh kode workflow.

Referensi primer yang diperiksa:
- [Next.js instrumentation](https://nextjs.org/docs/app/api-reference/file-conventions/instrumentation); kontrak juga dicocokkan dengan tipe Next16.4.2 terpasang.
- [Supabase restore ke proyek baru dan batas Storage/settings](https://supabase.com/docs/guides/platform/clone-project).
- [GitHub Actions billing](https://docs.github.com/en/actions/concepts/billing-and-usage); repositori target terverifikasi public, memakai standard runner, bukan larger runner.
