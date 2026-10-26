# Audit Halaman Kesehatan Aplikasi dan favicon

27 Oktober 2026, Asia/Jakarta. Baseline main `8b890a603e0eb8bce1b532e5b6a46ae82218ce17` (PR85). Branch `fix/health-audit-favicon`.

## Analisis sebelum perubahan

Dibaca page/loading, AdminHealth, model/server health, securityState, servicesData, schema Jobs/Reconciliation, account error boundary, proxy/page-policy, sumber SQL jobs, metadata/icon/PWA, audit L07/L10, spesifikasi/keputusan bisnis dan pengujian existing.

Alur: SSR force-dynamic → principal/admin/ready → dua servicesData paralel → validasi sumber → whitelist agregat → tampilan. Native form GET `/account/health` membaca ulang, tanpa CRUD, POST, modal, tabel, state client, listener atau retry pekerjaan. Partial read gagal menjadi unknown; AccessDenied pada sumber membatalkan seluruh dashboard. `/api/health` publik tidak diubah menjadi readiness admin.

## Temuan dan perbaikan

| Temuan | Penyebab | Perubahan |
|---|---|---|
| Halaman dapat menunggu lama sebelum membaca sumber | Gate keamanan belum punya deadline walaupun dua sumber sudah dibatasi8detik | securityState menerima AbortSignal opsional; Health memberi8detik, caller lama dua argumen tetap sama |
| Kontrak agregat menerima availability/null/total yang bertentangan | Validasi hanya bentuk dasar | Validasi lintas field, jumlah status sama dengan sampled, maksimum200 outbox/100 runs; unknown tidak dapat menyamar sebagai nol |
| Kegagalan rekonsiliasi mudah terlewat saat jobs terbaca | Summary berfokus kegagalan jobs saja | Prioritas unavailable/partial di summary; kegagalan sumber tidak disimpulkan sehat |
| Sampel kosong dan unknown kurang berbeda | Angka0 tanpa empty state khusus | Pesan kosong eksplisit, unknown tetap tanpa angka, jumlah besar ditampilkan utuh |
| Halaman sulit dipindai dan terlalu padat paragraf | Cakupan/arah tindakan bercampur dengan metrik | Empat kartu konsisten, grid angka berdasarkan ruang konten, cakupan memakai details/summary native, tindakan berikutnya terlihat |
| Error operasional memakai judul generik | Hanya boundary akun | Boundary Health memakai AccountError existing dengan judul spesifik; error internal tetap disunting, reset bekerja |
| Favicon belum punya fallback dan SVG belum dideklarasikan lengkap pada HTML hasil audit | `/favicon.ico` belum ada; metadata hanya mengatur Apple icon | ICO16/32/48 dari SVG sekolah existing, konvensi App Router, deklarasi SVG eksplisit; PWA/Apple icon dipertahankan |

Tidak membuat ukuran antrean global, usia antrean "macet", skor kesehatan, bukti inbox, metadata backup/restore atau kecocokan rekonsiliasi yang tidak tersedia. "Berakhir terakhir" mencakup gagal, bukan hanya pekerjaan berhasil. Konfigurasi provider tidak berarti koneksi/delivery terbukti. OTP verifikasi/pemulihan langsung tidak termasuk outbox. Tidak menambah tombol navigasi duplikat sidebar.

## Kode dan dampak

- `src/lib/health/model.ts`: shape kompatibel, invariant agregat lebih ketat; whitelist tetap tanpa payload, penerima, OTP, error internal, kunci pekerjaan atau saldo.
- `src/lib/health/server.ts`, `src/lib/auth/security.ts`: batas waktu gate melalui SDK `.abortSignal`; actor/session, admin/ready, fail-closed dan signature dua argumen existing dipertahankan. Baca sumber tetap paralel dengan batas8detik masing-masing. Gate dan sumber adalah fase terpisah, bukan janji total8detik.
- `src/components/admin-health.tsx`: server component tanpa state/listener client; nativeGET, layout konten, status/empty dan disclosure aksesibel. Nilai nullable direkonsiliasi sebelum render.
- `src/app/account/health/error.tsx`: memakai boundary akun reusable; page/loading dan mekanisme autentikasi existing tetap.
- `src/app/favicon.ico`, `src/app/layout.tsx`, `scripts/generate-favicon.mjs`: ikon browser kompatibel, identitas SVG sama; regenerasi `node scripts/generate-favicon.mjs` memakai Sharp existing, bukan dependency baru.
- `tests/health*.test.mjs`, `tests/favicon.test.mjs`: model/server/page/SDK aktual dengan batas sintetis, privasi, kompatibilitas signal, ICO frames.
- `tests/ui/health-fixture.tsx`, `scripts/verify-health.mjs`, `scripts/verify-favicon.mjs`, package scripts: QA khusus dan integrasi check. Penantian GET membandingkan pathname/search sehingga tanda `?` kosong native browser tidak dianggap kegagalan navigasi.
- MASTER dan laporan verifikasi: standar, hasil dan batas. Tidak ada perubahan SQL/schema, grants, kontrak API, logika finansial/akademik, provider atau environment. Tidak perlu migrasi.

## Verifikasi dijalankan

- npm ci; npm run check:786 tes, TypeScript, lint, replay tipe database dan production build lulus sebelum deklarasi SVG eksplisit terakhir.
- Setelah metadata: build/TypeScript, health19, PWA3, UI7 dan lint lulus. CI rilis mengulang seluruh check pada exact head.
- Browser Health:218 checks/12 axe, tanpa JS error. Normal, kosong, seluruh sumber gagal, masing-masing sumber gagal, provider tidak tersedia, sumber pembanding tersedia, MAX_SAFE_INTEGER, offset zona waktu, loading dan error. Viewport320/390/768/1440, teks200/400%, text spacing, keyboard accordion/skip, GET refresh menerima timestamp baru, resize/orientation dan layar pendek. Tidak ada overflow horizontal pada skenario yang diuji; gulir vertikal konten tetap normal.
- Regresi sidebar:91 checks/6 axe, tanpa JS error.
- Favicon:24 checks HTTP production build. GET ICO/SVG200 dengan MIME yang tepat, tiga frame ICO valid; root/Login/Recovery/404 memiliki deklarasi ICO dan SVG, seluruh URL yang diiklankan termuat. Favicon diperiksa sebelum merge, bukan hanya file dibuat.
- Screenshot desktop/mobile ditinjau lokal. JSON sintetis disimpan pada `docs/verification/health-audit/`; screenshot/HTML debug tidak dimasukkan ke Git.

Alat QA eksternal existing: Playwright1.58.2, esbuild0.25.12, axe-core4.11.0, Chrome145.0.7632.6. Set UI_TEST_TOOLS ke direktori alat, UI_CHROMIUM_EXECUTABLE ke executable. Jalankan `HEALTH_QA_OUTPUT=/tmp/health-browser npm run test:health:browser` dan `FAVICON_QA_OUTPUT=/tmp/health-favicon npm run test:favicon:browser` sesudah build. Tidak menambahkan dependency/lockfile.

## Batas, rilis dan rollback

Data/browser dan batas SDK/sesi memakai fixture sintetis, bukan UAT akun admin produksi. Tidak mengirim OTP/email, menjalankan pekerjaan, mengubah database atau melakukan restore/load produksi. Backup/restore tetap belum dapat diverifikasi; sumber pembanding bukan bukti data cocok. Uji AT/perangkat fisik tidak diklaim. CI/PR/merge/exact Production SHA dicatat pada PR rilis. Revert PR untuk rollback; tidak ada rollback data/schema.

Referensi primer: https://nextjs.org/docs/app/api-reference/file-conventions/metadata/app-icons ; https://supabase.com/docs/reference/javascript/using-modifiers-abortsignal . Changelog Supabase diperiksa; tidak ada perubahan SDK untuk scope ini selain menggunakan signal yang didukung versi existing.
