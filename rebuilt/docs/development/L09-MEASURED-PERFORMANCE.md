# L09 — Performa terukur

Tanggal 26 Oktober 2026, Asia/Jakarta. Baseline main e74f6281de2453def7fbbea80a3a4365d59c3313 (PR83).

Status: optimasi dan verifikasi lab; penerimaan field CWV dan beban staging terautentikasi tetap terbuka. PR/CI/merge/deployment dicatat pada PR rilis. Tidak memerlukan migrasi, environment baru, dependency aplikasi, provider berbayar atau perubahan kebijakan.

## Audit dan keputusan

Tiga selector client mengimpor seluruh panel domain secara statis sehingga build menyertakan dependensi panel lain. Pemisahan memakai next/dynamic pada level modul, named exports, ssr:true, dan fallback status bersama. Seluruh cabang, key revisi/periode/userId, parsing Zod, prop bulkAvailable, komposisi FollowUpCenter/inbox dan guard server tetap dipertahankan. Guru Piket dengan halaman khusus/direct import tetap berjalan. Tidak menambahkan cache respons privat, service worker, retry mutasi atau indeks spekulatif.

Durasi respons educationContext.reply ditambahkan sebagai Server-Timing sim_app. Pengukuran mencakup masuk context sampai respons disiapkan termasuk pemeriksaan akses, bukan waktu jaringan, DB-only atau total HTTP lifecycle. Respons di luar context/ekspor langsung tidak otomatis terukur. Tidak ada identitas, SQL, parameter atau rincian internal dalam header. Body/status/private cache dan cookie yang diperbarui dipertahankan; kegagalan pengukuran tidak memutus respons. Tidak menambahkan Timing-Allow-Origin atau collector telemetry.

## Sebelum/sesudah bundle

Perintah: node scripts/performance/bundles.mjs docs/verification/l09-performance/bundles-before.json, lalu sesudah build perubahan ke bundles-after.json. Dua build production nyata dengan compiler/dependency yang sama. SHA commit laporan menunjukkan parent karena perubahan belum dikomit ketika diukur; build ID dan hash selector membedakan kode sebelum/sesudah.

Angka byte gzip adalah estimasi himpunan dependensi per boundary, bukan seluruh halaman, transfer jaringan atau angka field. Chunk bersama dihitung satu kali per profil; jangan jumlahkan antarprofil. Manifest compiler-specific; group deferred yang tidak dikenali dimasukkan secara konservatif ke semua profil domain. Duty memiliki satu group seperti itu. Tidak menjanjikan persentase CWV yang sama.

| Profil | Gzip sebelum (byte) | Sesudah (byte) | Penurunan |
|---|---:|---:|---:|
| operations/duty | 115325 | 102794 | 10.9% |
| operations/attendance | 115325 | 109072 | 5.4% |
| operations/mentoring | 115325 | 108350 | 6.0% |
| operations/committee | 115325 | 109534 | 5.0% |
| operations/savings | 115325 | 110081 | 4.5% |
| learning/grades | 186574 | 105955 | 43.2% |
| learning/reports | 186574 | 98036 | 47.5% |
| learning/promotions | 186574 | 101115 | 45.8% |
| learning/books | 186574 | 166910 | 10.5% |
| services/jobs | 130413 | 99601 | 23.6% |
| services/reconciliation | 130413 | 98335 | 24.6% |
| services/discipline | 130413 | 102626 | 21.3% |
| services/surveys | 130413 | 103838 | 20.4% |
| services/notifications | 130413 | 108882 | 16.5% |
| services/insights-workspace | 130413 | 101494 | 22.2% |

## Metode lab dan batas

scripts/performance/public-lab.mjs menjalankan Next production build pada loopback 127.0.0.1:3139; tidak menerima target produksi. Google web-vitals5.1.0 dan Playwright1.58.2 hanya dependency QA eksternal. Persiapan: npm install --prefix /tmp/l09-tools --no-save playwright@1.58.2 esbuild@0.25.12 axe-core@4.11.0 web-vitals@5.1.0. Pasang Chrome Headless145.0.7632.6 lewat Playwright atau arsip Chrome for Testing. Set UI_TEST_TOOLS dan CODEX_PRIMARY_RUNTIME_NODE_MODULES=/tmp/l09-tools/node_modules, UI_CHROMIUM_EXECUTABLE ke executable Chrome. Jalankan node scripts/performance/public-lab.mjs output.json dan suite scripts/verify-{grades,notifications,committee}.mjs dengan variabel output QA ke direktori sementara. Lima fresh context tiap halaman/perangkat, cache HTTP disabled, server lokal dipanaskan. Desktop1366×900 CPU1 tanpa throttle; mobile emulasi390×844 CPU4 RTT40ms down200000Bps/up100000Bps. Halaman publik /, /login, /recovery adalah kontrol, bukan panel akun yang dioptimalkan. reCAPTCHA dimatikan hanya pada proses lokal; request eksternal dan mutasi diblokir. Tidak submit/login, mengirim OTP atau menulis data produksi.

LCP/INP/CLS memakai callback web-vitals, visibility flush pada akhir observasi; TTFB/DOMContentLoaded memakai NavigationTiming. p75 nearest-rank; sampel/missing selalu disertakan. Home dan recovery tidak menghasilkan interaksi Event Timing pada skenario ini: INP null/missing, bukan nol atau lulus. Sampel kecil dan proses berbagi resource tidak mewakili populasi pengguna. Tidak menganggap halaman kontrol lebih cepat karena optimasi panel akun.

Benchmark query existing P10 dijalankan ulang lewat npm run verify:benchmark -- docs/verification/l09-performance/query-baseline.json. PGlite terisolasi dengan data/sesi sintetis dan satu koneksi, bukan performa cloud Postgres/HTTP atau kapasitas serentak. Pengukuran 60/132 sesi staging tetap gerbang terpisah. Tidak menjalankan load produksi atau mengubah SQL hanya berdasarkan dugaan.

## Validasi

npm ci berhasil. npm run check lulus dengan 779 tes, typecheck, lint, replay tipe database dan production build. Setelah penambahan satu kasus statistik: test:performance4/4 dan test:attendance8/8 diulang; lint akhir diperiksa. CI rilis memverifikasi seluruh780 tes bersama.

Browser Nilai62 pemeriksaan/7 axe, Notifikasi59/7 axe, menggunakan selector dan lazy component nyata dengan fixture data sintetis serta request yang diintersep; bukan sesi autentikasi produksi. Unit Node memakai resolver extension next/dynamic yang sebenarnya, bukan mock komponen. Komite92 pemeriksaan/6 axe lulus setelah adaptasi assertion warning/status. Total213 pemeriksaan browser/20 axe, tanpa JavaScript error terdeteksi. Lab60 kunjungan selesai, hasil pada tabel di bawah.

## Hasil lab kontrol

60 kunjungan total,30 tiap build. LCP/INP dalam ms, CLS tanpa unit. Tiap kelompok5 observasi; INP home/recovery0 valid,5 missing; selain itu5 valid. Tidak ada uncaught JavaScript error atau mutasi yang dicoba pada60 kunjungan. Variasi naik/turun pada kontrol publik tidak disimpulkan sebagai manfaat optimasi panel.

| Perangkat/rute | LCP p75 sebelum → sesudah | INP p75 | CLS p75 |
|---|---:|---:|---:|
| desktop / | 128 → 140 | missing → missing | 0 → 0 |
| desktop /login | 172 → 148 | 16 → 24 | 0 → 0 |
| desktop /recovery | 100 → 140 | missing → missing | 0 → 0 |
| mobile-emulated / | 716 → 720 | missing → missing | 0 → 0 |
| mobile-emulated /login | 668 → 720 | 48 → 40 | 0 → 0 |
| mobile-emulated /recovery | 664 → 644 | missing → missing | 0 → 0 |

## File dan rollback

- src/app/account/{operations,learning,services}/[module]/panel.tsx: pemisahan16 panel; tidak mengubah logika domain.
- src/components/feedback/panel-loading.tsx: status aksesibel saat kode panel dimuat.
- src/lib/{education/server,observability/server-timing}.ts: durasi aman tanpa logging data pengguna.
- scripts/performance/*, tests/performance.test.mjs: pengukuran reproducible dan regresi header/statistik.
- tests/support/next-dynamic.mjs dan11 route tests: resolver Node ESM explicit extension, assertion existing tetap.
- tests/ui/{grades,committee}-fixture.tsx: menguji melalui selector, bukan direct child.
- scripts/verify-committee.mjs: menunggu hasil warning/status existing untuk stale/denied/uncertain; tidak menganggap seluruh hasil sebagai role alert atau pending sebagai selesai.
- package.json: perintah performance/measurement dan integrasi check; lockfile/dependency aplikasi tetap.
- docs/development dan docs/design-system serta docs/verification/l09-performance: status, metode, bukti dan batas.

Rollback lewat revert commit PR; tidak ada perubahan schema atau data yang perlu dibalik. Pertahankan guard, private cache dan PWA online-only existing.

## Pekerjaan penerimaan terbuka

1. Peroleh dataset field yang memadai per halaman/perangkat dengan cakupan dan retensi yang ditentukan. Target awal p75 LCP≤2,5s, INP≤200ms, CLS≤0,1 belum dinyatakan tercapai.
2. Ukur API dan alur akun dengan sesi staging aman serta rencana beban yang sudah tersedia pada P10. Tidak memalsukan akun nyata atau membebani produksi.
3. Hubungkan temuan query lambat dengan execution plan yang aman sebelum menambah indeks/menulis ulang query.
4. UAT manusia L02, restore staging dan evaluasi AI tetap terbuka; L09 bukan sertifikasi100% produksi.

Referensi primer: https://nextjs.org/docs/app/guides/lazy-loading ; https://github.com/GoogleChrome/web-vitals .
