# Bukti P10

**Batas utama:** hasil lokal terisolasi, bukan managed Supabase restore, UAT manusia, atau bukti kapasitas produksi. Gerbang operationalGo tetap false pada gates.json.

`npm ci` baseline exit0; `npm run check` akhir exit0: 669 tes/72 kelompok, typecheck/lint/db-types/production build. Satu kasus CLI privacy/stale artifact ditambahkan sesudah pipeline; suite operasional7 kasus diulang dan lulus, sehingga670 kasus unik terverifikasi. Ini bukan klaim satu pipeline lokal berisi670 tes. Lint akhir lulus. CI final harus lulus sebelum merge.

HTTP smoke pada production server lokal:6 checks, termasuk503 configuration failure dengan UUID header yang sama pada log server; tidak memakai credential layanan.

| Browser | Checks | axe |
|---|---:|---:|
| Error boundary/digest | 61 | 12 |
| Formulir/uncertain reference | 50 | 4 |
| Impor | 173 | 12 |
| Profil pribadi | 50 | 4 |
| Total | 334 | 32 |

Chromium145; CSS build, actual components dan boundary HTTP terisolasi. Error diuji320/390/768/1440, digest valid/invalid, privacy dan keyboard retry. Formulir menampilkan reference5xx tanpa blind retry; uncertain/offline/timeout/draf/navigation guard tetap teruji. Tidak ada pageerror JavaScript teridentifikasi.

## Restore terisolasi

82 tabel:80 aplikasi+2 Auth fixture;45 migrasi. SHA256 backup `6de7032b9825a4ab85b7646b87a2bb599b5d1f2556424ffbc8ce623238a7e49f`; ukuran5750779byte. Backup606.68ms; restore+seluruh pemeriksaan674.34ms. Ini satu latihan kecil, bukan SLA/RTO cloud.

Fingerprint mencakup574 kolom,892 constraint,247 indeks,14policy,26trigger,126routine dan900grant. Semua count/digest cocok, checksum rusak ditolak, registry session/saldo200000/rapor82/denial/immutable terverifikasi. Satu perubahan post-backup sengaja hilang; target RPO/RTO produksi belum disepakati.

Archive hanya dalam memori; tidak menerapkan jadwal, retensi, enkripsi atau backup produksi. Auth provider, Storage bytes, konfigurasi konektor dan cron bukan bagian latihan ini.

## Benchmark bisnis terisolasi

| Persona | Sampel | p50 ms | p95 ms | Error |
|---|---:|---:|---:|---:|
| admin | 12 | 13.14 | 24.06 | 0 |
| head | 12 | 13.01 | 17.19 | 0 |
| teacher | 12 | 12.16 | 17.10 | 0 |
| student | 12 | 5.70 | 7.25 | 0 |
| parent | 12 | 12.08 | 12.58 | 0 |
| alumni | 12 | 2.56 | 3.10 | 0 |
| customer | 12 | 2.30 | 2.58 | 0 |
| applicant | 12 | 2.53 | 2.99 | 0 |

PGlite satu koneksi; setiap sampel memeriksa registry principal, read rapor scoped dan audit Admin/denial. Ini bukan login via Supabase Auth provider atau satu klik UI. P95 dari12 sampel merupakan karakterisasi kecil, bukan SLO.

| Request antrean | Saved | Stale expected | p95 ms | Error tak diharapkan |
|---|---:|---:|---:|---:|
| 60 | 1 | 59 | 46.42 | 0 |
| 132 | 1 | 131 | 97.57 | 0 |

PDF5 sampel: p502.40ms, p9523.37ms; output%PDF valid. Antrean60/132 hanya menunjukkan konflik/replay native pada satu koneksi; bukan60/132 pengguna atau worker paralel cloud.

Driver staging diuji pada HTTP server sintetis:192 request dari132 nilai cookie berbeda; metadata production/mismatch dicegah sebelumload. Cookie berbeda bukan bukti identitas pengguna unik atau real Auth. Kasus CLI invalid plan memastikan credential sentinel tidak tercetak dan report sukses lama diganti report gagal.

## Gerbang terbuka

Tidak ada branch staging terhubung; tidak membuat layanan berbayar otomatis. Belum dilakukan managed restore Auth+Storage, UAT nyata, load campuran terautentikasi Supabase nyata, penerimaan operator/pemilik atau kesepakatan target RPO/RTO/p95. release-gates tanpa evidence **exit1** merupakan perilaku benar, bukan tes gagal. Required branch protection tidak dikonfigurasi; workflow/test lokal tidak menggantikan gerbang ini.

Tidak ada schema/data produksi, akun pengguna, provider, Vercel env atau jadwal diubah. Lihat [runbook](../../operations/OPERATIONS-RUNBOOK.md) dan [laporan tahap](../../development/STAGE-10-OPERATIONS.md).
