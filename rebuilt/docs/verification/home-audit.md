# Audit dan refactoring Beranda publik

Baseline main: `7df05584ef38210109e88cb620dbcde640d973b5`. Branch: `fix/public-home-audit`. Lingkup utama: `rebuilt/src/app/page.tsx` (`/`), terpisah dari Dashboard akun `/account`.

## Analisis sebelum perubahan

Alur: RootLayout memuat token/CSS dan skip link → HomePage server statis merender header, pengantar, CTA dan tiga prinsip → Link ke `/login` → LoginPage memakai autentikasi server yang sudah ada untuk sesi aktif, atau LoginForm untuk sesi anonim. Tautan kembali dari login menuju `/`. Beranda tidak membaca cookie, menjalankan CRUD, request API, Google Apps Script, pagination, filter, modal, atau state/effect browser sendiri. Tidak ada race/listener/async form Beranda yang perlu diganti.

Kode terkait yang diperiksa: `src/app/page.tsx`, `layout.tsx`, `globals.css`, root error/not-found, login page/form, proxy, konfigurasi aplikasi, Button/Card, shell akun untuk membedakan cakupan, smoke/production/UI tests, audit Dashboard sebelumnya, dan Master Design System. Perubahan tidak menyentuh autentikasi, API, database, RBAC, maupun formula bisnis.

## A. Temuan

Baseline browser: `home/baseline-results.json` (64 pemeriksaan, 8 temuan layout/semantik; 6 tampilan axe tanpa pelanggaran otomatis).

| Masalah | Penyebab dan bukti |
| --- | --- |
| Horizontal overflow pada pembesaran teks | Grid min-content dan CTA nowrap tidak dibatasi oleh container. Pada viewport 320px, document menjadi 579px saat teks 200% dan 1158px saat 400%. |
| Teks panjang dapat keluar viewport | Tidak ada wrapping/min-width yang konsisten; heading sintetis tanpa spasi membuat lebar document 7337px. Ini stress test, bukan data pengguna produksi. |
| Skip link belum memindahkan fokus | Target main tidak focusable; sesudah Enter, fokus keyboard belum berada pada konten utama. |
| Judul kartu bukan heading | CardTitle memakai div, sedangkan tiga subjudul langsung H2; struktur bagian kurang jelas bagi pembaca layar. |
| Footer meninggalkan ruang kosong besar | Wrapper min-height tanpa flex; pada viewport 1440×1200, footer berakhir sekitar y=836, jauh sebelum dasar layar. Ini masalah komposisi visual, bukan kehilangan data. |
| Hierarki dan spacing kartu kurang seimbang | Card gap/padding dan content padding bertumpuk; heading memakai pemutusan baris paksa; gutter rem membesar bersama teks. |

Tidak ditemukan CRUD, menu, modal, loading provider, atau dataset kosong/banyak pada Beranda statis. Kondisi itu tidak dipalsukan sebagai fitur yang diuji. Root error boundary telah menyediakan reset dan pesan aman; tidak ada perubahan padanya.

## B. Perbaikan dan file

| File | Perubahan dan alasan |
| --- | --- |
| `src/app/page.tsx` | Metadata Beranda; main focusable; H1/H2/H3; daftar prinsip; memakai ulang Button/Card; menjaga seluruh copy dan URL login. |
| `src/app/home.module.css` | Layout halaman khusus Beranda, footer dalam flow flex, grid aman, gutter responsif, ukuran ikon, wrap CTA/teks panjang; tanpa perubahan CSS global. |
| `scripts/verify-home.mjs` | QA browser terhadap production server sebenarnya, bukan mock halaman; baseline/final, zoom, orientasi, keyboard, touch dan JavaScript disabled. |
| `package.json` | Menambahkan `test:home:browser`; tooling browser tetap terpisah dari dependency aplikasi. |
| `docs/design-system/MASTER.md` | Mendokumentasikan pola Beranda dengan token/sistem desain yang sama. |
| `docs/verification/home/*` | Bukti sebelum/sesudah dan ringkasan pemeriksaan aktual. |

## C. Kode final dan reproduksi

Kode implementasi aktual berada di `src/app/page.tsx` dan `src/app/home.module.css`. Tidak ada pseudocode atau setup database tambahan.

```bash
npm ci --ignore-scripts
npm run check
npm run test:smoke
UI_TEST_TOOLS=/path/to/qa/node_modules UI_CHROMIUM_EXECUTABLE=/path/to/chromium npm run test:home:browser
```

Tooling QA menggunakan Playwright runtime dan axe-core 4.10.3 terpisah. Chromium headless 153 diperoleh dari paket QA terpisah @sparticuz/chromium 153.0.0 setelah unduhan browser bawaan Playwright tidak menghasilkan arsip yang valid. Tidak mengubah versi/dependency aplikasi. Untuk baseline, pakai source baseline dan jalankan script dengan `--baseline`.

## D. Hasil dan batas

- `npm run check`: **201 tes lulus**, TypeScript/lint lulus, snapshot **14 tabel publik** cocok, production build lulus.
- `npm run test:smoke`: **6 pemeriksaan HTTP lulus**, termasuk halaman publik, CSS build, 404, kegagalan konfigurasi yang aman, dan health liveness.
- Browser production lokal: **64 pemeriksaan lulus**, **6 tampilan axe**, nol pelanggaran otomatis dan nol uncaught JavaScript/console error.
- Viewport: 320×700, 360×800, 375×812, 390×844, 768×1024, 1024×768, 1280×900, 1440×900, 1920×1080, 812×375 dan 812×240; juga desktop tinggi 1440×1200.
- Pembesaran teks 200% dan 400% pada 320px, heading panjang sintetis, tiga siklus orientasi, forced colors, skip link/urutan Tab, touch target, navigasi login/kembali, dan JavaScript disabled lulus.
- Footer/kontrol terjangkau melalui gulir vertikal normal; tidak ada overflow horizontal atau clipping pada skenario teruji. Tidak menghilangkan gulir yang diperlukan untuk konten panjang.
- Audit deadcode: 151 file sumber, 87 entry points, `unreachable: []`.
- Screenshot desktop/mobile/landscape diperiksa selama QA, bukan aset/dependency aplikasi. Bukti teks berada pada `home/baseline-results.json`, `home/browser-results.json`, dan `home/automated-results.json`.

Pengujian memakai Chromium headless dan production build lokal. Tidak mengklaim UAT semua role, browser Safari/Firefox, perangkat fisik, teknologi bantu oleh pengguna, atau jaminan 100% bebas bug. Beranda statis tidak mempunyai dataset kosong/banyak maupun loading/error provider; alur tersebut tidak ditambahkan hanya untuk pengujian. Tidak ada mutasi atau akun uji produksi.
