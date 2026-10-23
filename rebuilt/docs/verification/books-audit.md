# Audit Buku Digital — 23 Oktober 2026

Baseline `4aa611455afaf744a8303bd7a4db33cab6066255`; branch `fix/digital-books-audit`.

## Analisis sebelum perubahan

Dibaca: spesifikasi M14 dan matriks kesetaraan, kebijakan akademik/keputusan bisnis, MASTER design system, page/dispatcher/panel/reader pembelajaran, validasi dan server reader, API katalog dan aset, Supabase client, pemeriksaan isi PDF/gambar, worker preparation, migrasi katalog/aset dan override singleton terakhir, tes learning serta fixture browser modul akademik. Tahun terbit tetap tahun kalender; tidak diubah menjadi tahun ajaran.

Alur: sesi server + survei wajib → RPC `app_learning_read` → katalog maksimum 50 buku/halaman. Admin → command UUID/revisi → `app_learning_write` → audit/soft-deactivation. PDF → prepare metadata pending → signed upload bucket privat → finalize dengan inspeksi isi/checksum → ready. PDF lama diganti hanya sesudah finalisasi valid. Semua permintaan berkas melewati `app_asset_get`, termasuk pemeriksaan premium di server. URL eksternal mengikuti izin penyedia; tidak dipindahkan ke penyimpanan publik.

## Temuan dan perbaikan

| Temuan / penyebab | Perbaikan |
| --- | --- |
| Form URL membaca `url`, sedangkan snapshot memakai `external_url`; edit dapat menghapus locator lama | Isian edit mengambil `external_url`, termasuk payload simpan tanpa perubahan |
| Judul UI dibatasi 200 meski server mengizinkan 300; tahun tidak memiliki batas native | Judul 300; tahun terbit integer 1800–2200; validasi command sebelum request |
| Mata pelajaran nonaktif tidak terdapat pada opsi sehingga relasi lama dapat berubah menjadi Umum | Opsi relasi lama dipertahankan ketika mengedit |
| Pagination tanpa catch/loading/lock; request baca dan tulis dapat bertabrakan | Satu lock sinkron, timeout, abort saat unmount, data lama dipertahankan pada kegagalan baca |
| Halaman melewati jumlah hasil dapat kosong dengan nomor halaman tidak masuk akal | Baca ulang halaman terakhir yang sah setelah total berubah |
| Respons tulis hanya HTTP/message; kegagalan setelah commit dapat mendorong retry buta | Validasi kode + UUID target; feedback terpisah untuk ack berhasil namun refresh gagal; tulis ambigu diblokir sampai reload eksplisit |
| Unggah tanpa validasi client/timeout dan feedback hasil yang jelas | Validasi PDF/ukuran/nama, signed path terikat target, batas waktu upload, verifikasi ack finalisasi, satu upload untuk klik ganda |
| PDF sebelumnya/error dapat tertinggal ketika sumber berubah; import/render cleanup berpotensi berlomba | Instance reader berdasarkan identitas sumber; task dan canvas dimiliki per render, cancel/destroy aman, timeout loading |
| Canvas berukuran PDF tetap/zoom melebar melewati halaman | ResizeObserver fit width, scroll region lokal bernama dan fokusable, kontrol wrap dan target sentuh 44px |
| Mode gulir merender semua halaman dalam chunk sekaligus | IntersectionObserver merender halaman mendekati viewport; chunk tetap maksimal 20; resolusi canvas dibatasi |
| URL Drive lama dipasang langsung sebagai iframe view | HTTPS locator tervalidasi, normalisasi Drive file/open/uc ke preview, label sumber eksternal dan fallback tab baru |
| Form selalu tampil memenuhi katalog, tanpa fokus/draft handling | Dialog Radix existing, Escape/trap/restore focus, konfirmasi pembuangan draft, beforeunload untuk draft |
| Kartu judul panjang menambah kepadatan dan whitespace berlebih | Ringkasan 100 karakter dengan disclosure judul lengkap yang dapat disentuh |
| Error awal buku menghasilkan halaman buntu | Memakai account error boundary existing dengan retry |
| Dispatcher masih menyimpan cabang non-buku yang tidak dipakai | BooksPanel khusus; dispatch grades/reports/promotions dipertahankan |

## Berkas yang berubah

- `src/app/account/learning/[module]/books-panel.tsx`: katalog, filter/pagination, modal metadata/PDF, koordinasi request dan feedback.
- `reader.tsx` dalam direktori yang sama: lifecycle PDF.js, mode halaman/gulir/native, resize, zoom, navigasi dan fallback.
- `panel.tsx`, `page.tsx`: dispatcher khusus dan retry boundary buku; perilaku modul lain dipertahankan.
- `src/lib/learning/books.ts`: schema snapshot/filter buku dan normalisasi locator eksternal.
- `src/lib/learning/server.ts`: validasi snapshot buku; query lama yang dikenali tetap diterima dan upstream rusak menjadi 503.
- `src/app/api/learning/[module]/route.ts`: kode ack buku yang dikenal dan ID tersimpan harus valid/sesuai target. Response `result`/`message` tetap tersedia; `code` ditambahkan.
- `src/app/globals.css`: aturan terbatas pada `.books-*`/`.book-*`, tanpa mengubah layout modul lain.
- `tests/books.test.mjs`: actual route/page/server/validator dengan boundary Auth/SDK sintetis.
- `tests/ui/books-fixture.tsx`, `books-navigation-shim.ts`, `scripts/verify-books.mjs`: actual UI/shell/PDF.js dan worker asli dengan PDF sintetis 25 halaman; service boundaries diisolasi.
- `package.json`: perintah tes buku dalam check dan perintah browser; tanpa dependency/lockfile baru.
- Dokumentasi ini, MASTER, serta hasil JSON browser/regresi: keputusan dan bukti verifikasi.

Tidak ada perubahan schema/database, migration, auth, RBAC, penyedia storage, API command, status aktif/premium, atau fungsi bisnis. Backend tetap mengotorisasi setiap akses; menyembunyikan kontrol UI bukan pengganti otorisasi.

## Verifikasi

- `npm run check`: lulus, 418 tes / 48 runner groups, termasuk 12 tes baru Buku Digital, tes migrasi/database, TypeScript, ESLint, sinkronisasi tipe 14 tabel dan production build.
- Sesudah penyesuaian disclosure judul dan pemeriksaan kompatibilitas query lama, 12 tes buku, 16 tes grades, 19 tes reports, 18 tes promotions, `npm run typecheck`, `npm run lint`, dan `npm run build` diulang dan lulus.
- `npm run test:books:browser`: 48 pemeriksaan lulus, 7 axe runs tanpa violation pada skenario yang diuji. Viewport 320/768/1440, resize landscape 740×360, judul 300 karakter tanpa spasi, disclosure sentuh, modal keyboard/draft/fokus, create/edit/archive, klik ganda, signed upload dan finalisasi, actual PDF.js 25 halaman, navigasi/zoom/gulir/native/Drive, filter/empty/50 rows/pagination failure, peran baca, stale/malformed/timeout, serta saved+readback failure. Tidak ada `pageerror`.
- `npm run test:academic:browser`: 41 pemeriksaan / 6 axe runs lulus untuk regresi modul akademik.
- `npm run audit:deadcode`: 127 entry, 186 source files, `unreachable: []` (metadata kebijakan tetap dipertahankan).
- Snapshot desktop dan mobile diperiksa secara visual; screenshot merupakan artefak lokal QA. JSON bukti: `books/browser-results.json` dan `books/academic-regression/browser-results.json`.
- Uji browser memakai Playwright runtime, esbuild/axe/Chromium pada direktori QA terpisah lewat `UI_TEST_TOOLS` dan `UI_CHROMIUM_EXECUTABLE`; tidak menambah dependency aplikasi.

## Batas bukti dan risiko tersisa

Browser menjalankan komponen asli, PDF.js/worker asli, dan PDF sintetis dengan Auth/HTTP/Storage diisolasi; tes database menjalankan migrasi nyata di PGlite. Tidak memakai akun/data pribadi produksi, tidak melakukan CRUD/unggah terautentikasi produksi, tidak mengklaim pengujian perangkat fisik atau pembaca layar manual. Axe dan browser headless bukan sertifikasi aksesibilitas menyeluruh. URL eksternal tetap dapat menolak embedding/memerlukan login, atau berubah di luar aplikasi; fallback tersedia. Gulir vertikal normal dan gulir lokal saat zoom adalah perilaku yang diperlukan, bukan overflow halaman.
