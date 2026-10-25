# P10 — Ketahanan operasional dan performa

25 Oktober 2026. Baseline main `9bf56ff2aab4ec1b7ce46e15509b94d7ab7f355b` (aktivasi P09/PR57). PR implementasi: [#58](https://github.com/kamadmtsnf-ai/sim-murid/pull/58).

## Status

Kode dan QA terisolasi selesai: pipeline669 tes/72 kelompok, satu kasus tambahan pada suite operasional akhir (670 kasus unik), build/types/lint dan334 browser checks/32axe lulus. **Gerbang operasional P10 belum selesai penuh**: belum ada managed staging restore Auth+Storage, UAT manusia, beban campuran Supabase Auth nyata, serta target RPO/RTO/p95 dan penerimaan pemilik. Koneksi Supabase melaporkan nol branch staging; tidak menyiapkan layanan berbayar atau menyalin produksi tanpa persetujuan konkret. Source merge tidak sama dengan GO cutover.

## Temuan dan perubahan

- privateJson5xx belum punya kode laporan yang dapat ditelusuri. Kini UUID server pada X-Request-ID cocok dengan event console allowlist; payload/error/user identity tidak dicetak. JSON contract, cache private/no-store, Vary Cookie dan cookie auth tetap. Shared mutation hook menampilkan reference hanya dari header sah pada respons5xx, mempertahankan uncertain/blocked/readback tanpa blind retry.
- Error boundary akun/root belum menampilkan digest aman. Komponen ErrorReference reusable hanya menerima digest/ID tervalidasi, bukan pesan error; keyboard retry dan responsive/axe diuji. Next onRequestError dipasang sesuai tipe existing; log hanya digest/method/kategori, bukan request/error mentah. Tidak menambah penyedia telemetry berbayar.
- Gate survei readServerPrincipal menerima null/malformed seolah tidak wajib. Diubah fail closed seperti educationContext; boolean dan jalur pengecualian existing tetap, diuji tanpa dummy login produksi.
- Readiness Admin configuration-only membantu driver menolak preview yang masih memakai DB produksi. Bukan pengganti liveness, backup atau ukuran kapasitas. Caller dari sesi server; non-Admin/unknown/outage ditolak, tidak mengirim key.
- Tooling restore/benchmark membuat database terisolasi dari45 migrasi. Snapshot checksum, seluruh data/schema/security, ledger/rapor/session/immutable direkonsiliasi; data sesudah backup tidak dipulihkan diam-diam. Benchmark memakai native domain writers/readers dengan registered synthetic sessions dan role service_role.
- Driver staging memerlukan metadata target terautentikasi, sesi berbeda, batas workload dan persetujuan external/write, memblokir target produksi dan redirect, tidak menulis token/body ke report. Pengujian transport sintetis tidak dinyatakan sebagai sesi Auth nyata.
- Release-gates CLI tetap blocked/exit1 jika bukti managed restore/Storage/Auth/UAT/load/penerimaan belum ada. Health dan fixture terisolasi tidak dapat membuka gerbang. Tidak mempromosikan deployment atau memodifikasi data.
- CI menambahkan pemeriksaan Node24/npmci/check di PR/main, actions SHA-pinned, token read-only, tanpa credential/provider/deploy. Required status branch settings perlu Admin repository, bukan otomatis dari workflow.

## Dampak dan batas

Tidak mengubah schema, data produksi, RBAC, business formulas, tarif, D10/arsip, auth provider atau API command contracts. Tidak memasang backup schedule/retensi, log-drain, paid metrics, SMTP/WA/AI jobs atau menghapus indeks tanpa bukti. Header/status log bersifat additive; error logging best effort tidak boleh mengubah hasil request.

Scope telemetry: respons helper privateJson dan error Next yang tertangkap; bukan jaminan semua controller/client/worker/platform logs punya reference atau bebas PII. Boundary UI memakai digest Next; error API tertangani memakai UUID berbeda. Timeout/offline yang tidak menerima respons tidak mengarang reference. Tidak ada alert/retensi baru yang diklaim aktif.

[Runbook](../operations/OPERATIONS-RUNBOOK.md) merinci insiden, rollback kompatibel, latihan lokal, matriks staging, pengamanan target, GO/NO-GO dan sumber primer. [Bukti](../verification/operations/README.md) mencatat hasil aktual dan keterbatasan. P11/P12 tidak dijalankan pada tahap ini.


## Verifikasi rilis

`npm run check` exit0; full pipeline669 tes/72kelompok. Setelah kasus CLI credential-redaction/stale-report ditambahkan, suite operasional7tes diulang/lulus;670 kasus unik terverifikasi, bukan satu pipeline lokal670. HTTPsmoke6checks menguji503/ref log pada productionserver lokal; browser334checks/32axe. Hasil pada docs/verification/operations. Workflow Rebuilt check dan Vercel diverifikasi pada head final sebelum merge; branch protection required status tidak diubah.

Target managed staging, akun UAT nyata dan penerimaan pemilik masih dibutuhkan. P10 berstatus parsial meskipun kode dapat dirilis; tidak mencentang gerbang berdasarkan fixture atau health. Tidak ada migrasi database P10.
