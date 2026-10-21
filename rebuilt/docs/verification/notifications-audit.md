# Audit dan refactoring Halaman Notifikasi

Baseline main: `56915ad23c5ba08dda569b0b5c2216c9fced8a44`. Branch: `fix/notifications-audit`. Lingkup implementasi: `rebuilt/`; pekerjaan release/D10 pada PR #4 tidak dimasukkan.

## Analisis sebelum perubahan

Alur: `/account/services/notifications` → Proxy/cookie → `readServerPrincipal` → `servicesData` → RPC `app_services_read` → snapshot → ServicesPanel. POST existing memakai `educationContext`, pemeriksaan origin, envelope `requestId/revision/command`, Zod, lalu RPC `app_services_write` dengan actor/session dari server. Inbox disaring `recipient_id=p_actor`; user tidak menentukan actor melalui body. Akses Notifikasi tetap dikecualikan dari pemaksaan survei sebagaimana sebelumnya.

Kode yang ditelusuri meliputi page/panel layanan, validasi, API GET/POST, reader server, auth context, navigasi, reusable controls/Button/Status, styling shell, migrasi definisi inbox/read/write terkini, serta tes unit/database/produksi existing. Tidak ada integrasi Google Apps Script, penghapusan, composer/form pengiriman pesan, modal, tab atau ekspor khusus Notifikasi. Fitur bisnisnya adalah membaca daftar dan menandai satu/semua pesan dibaca.

Backend mengembalikan maksimal 200 pesan terbaru, sementara `extra.unread` menghitung seluruh inbox. `id:null` pada command berarti menandai SEMUA pesan milik pengguna, bukan hanya pesan pada layar. Kedua perilaku dipertahankan; tidak ada migrasi, perubahan SQL/API, atau perubahan otorisasi.

## A. Temuan

| Temuan | Penyebab / dampak | Penanganan |
|---|---|---|
| Data layar tetap lama setelah POST sukses tetapi GET gagal | Shared mutate menampilkan pesan koneksi generik, kemudian membuka kembali aksi tulis | Bedakan hasil tersimpan dari daftar belum diperbarui; kunci write sampai GET rekonsiliasi berhasil |
| Hasil request ambigu bisa langsung dikirim ulang | Tidak ada keadaan “perlu muat ulang”; setiap retry membuat requestId baru | Tidak mengulang POST otomatis; hasil ambigu wajib dipastikan melalui GET |
| Refresh tidak tersedia dan semua 200 kartu dirender sekaligus | UI hanya memiliki read-one/read-all | Tambah refresh, pencarian/filter lokal dan pagination 20 kartu; semua 200 pesan tetap dapat dijangkau |
| Jumlah unread dapat disalahartikan sebagai jumlah pada layar | Batas 200 tidak dijelaskan, tetapi total unread/read-all tidak dibatasi 200 | Jelaskan cakupan daftar, pencarian, total unread, dan aksi semua |
| Tombol tandai semua aktif pada inbox kosong | Disabled hanya mengikuti busy | Nonaktifkan ketika unread nol atau rekonsiliasi belum selesai |
| Tanggal mentah dan status kurang jelas | Timestamp dicetak langsung; pesan sudah dibaca hanya dibedakan oleh hilangnya tombol | Format id-ID/Asia-Jakarta, badge tekstual, fallback tanggal invalid |
| Hasil API terlalu longgar untuk UI Notifikasi | Snapshot bersama hanya memastikan rows adalah record, tanpa ID/status/unread spesifik | Schema khusus Notifikasi; ID valid/unik, unread nonnegatif, validasi hasil GET sebelum mengganti state |
| Error awal tidak mempunyai aksi retry | Catch page mengembalikan pesan statis | Khusus Notifikasi, gunakan account error boundary/reset existing |
| Potensi request selesai setelah komponen/akun berganti | Tidak ada abort lifecycle; state awal disimpan lokal | Abort saat unmount; key panel berdasarkan user dan revisi server |
| Teks panjang dan pembesaran teks perlu penanganan khusus | Button default nowrap; layout input tidak mengikuti lebar konten | Wrapping khusus inbox, container query, input memakai `controlClass` existing |

Tiga keadaan awal (POST tersimpan + GET gagal, read-all aktif pada inbox kosong, dan 200 kartu sekaligus tanpa penjelasan cakupan) direproduksi sebelum mengganti cabang Notifikasi. Penguatan schema/abort adalah pencegahan; tidak diklaim sebagai insiden produksi yang sudah terjadi.

## B. Perbaikan dan file

| File | Alasan |
|---|---|
| `src/app/account/services/[module]/notifications-panel.tsx` | Panel khusus: lifecycle request, rekonsiliasi, schema respons, status/loading/error, filter/search/pagination, fokus, tanggal dan kartu |
| `src/app/account/services/[module]/panel.tsx` | Delegasi Notifikasi ke panel khusus; hapus implementasi lama agar tidak ada dua handler; modul lain memakai fungsi existing |
| `src/app/account/services/[module]/page.tsx` | Kegagalan awal Notifikasi masuk boundary retry; fallback modul lain dipertahankan |
| `src/lib/services/validation.ts` | Tambahkan schema spesifik respons Notifikasi; command/envelope existing tidak diubah |
| `src/app/globals.css` | Styling inbox terisolasi, wrapping tombol, tata letak filter sesuai container |
| `tests/services.test.ts` | Schema, ID/null-ID, unread, duplicate ID dan forged actor |
| `tests/database/services.test.mjs` | Read-one, read-all, penerima lain, timestamp tidak berubah saat dibaca ulang, batas 200 dan unread global |
| `tests/production.test.mjs` | Status API, actor/session/revision/requestId, validasi command serta penolakan akses/origin |
| `tests/notifications-page.test.mjs` | Data server, login/not-found, boundary retry dan fallback modul lain |
| `tests/ui/notifications-fixture.tsx`, `notifications-navigation-shim.ts` | Fixture sintetis; tidak menjadi route atau identitas aplikasi |
| `scripts/verify-notifications.mjs` | Browser QA khusus inbox dan simulasi kegagalan request |
| `scripts/verify-ui.mjs` | Tambahkan pengecekan akses anonim/origin pada endpoint dan halaman Notifikasi aktual |
| `package.json` | Daftarkan tes Notifikasi dan browser suite; tanpa dependency baru |
| `docs/design-system/MASTER.md` | Dokumentasi pola inbox dan rekonsiliasi |
| `docs/verification/notifications/` | Bukti baseline, hasil browser dan ringkasan verifikasi |

State hanya diganti setelah snapshot GET tervalidasi. Lock ref mencakup POST + GET dan mencegah klik ganda sebelum render state. Kontrol tulis dinonaktifkan selama request/rekonsiliasi. Filter dan pagination tidak membuat request API; mengubah filter mengembalikan halaman ke awal, dan halaman aktif dijepit ke rentang valid setelah data berubah. Fokus menuju heading hasil ketika tombol pesan hilang setelah dibaca.

## C. Kode final dan pengujian ulang

Kode final adalah file implementasi di atas pada branch pengembangan. Endpoint/payload tetap `/api/services/notifications`, `{requestId, revision, command:{type:'read', id:UUID|null}}`. Tidak menambahkan navigasi modul yang menduplikasi sidebar. Data/konten pesan dirender sebagai teks React, bukan HTML.

```bash
npm ci
npm run check
npm run audit:deadcode
UI_TEST_TOOLS=/path/to/qa/node_modules UI_CHROMIUM_EXECUTABLE=/path/to/chromium npm run test:notifications:browser
UI_TEST_TOOLS=/path/to/qa/node_modules UI_CHROMIUM_EXECUTABLE=/path/to/chromium npm run test:ui:browser
```

Tool QA terpisah menyediakan esbuild dan axe-core; Playwright tersedia dari runtime atau instalasi QA lokal, sesuai pola suite existing. `UI_QA_ENV_FILE` opsional untuk suite lintas modul hanya berisi URL/key publishable agar endpoint anonim bisa dijalankan. Jangan memasukkan secret. Untuk reproduksi baseline gunakan source main sebelum perubahan; baseline direkam terpisah dari suite akhir.

## D. Validasi akhir

- `npm ci` berhasil dengan lockfile existing; tidak mengubah versi/dependency.
- `npm run check` final berhasil: 178 tes, typecheck, lint, 14 tipe tabel dari replay migrasi dan production build.
- Audit dead code: `unreachable: []`.
- Browser Notifikasi: 55 pemeriksaan lulus, 7 layar axe tanpa pelanggaran teridentifikasi.
- Browser regresi lintas modul: 63 pemeriksaan lulus, 8 layar axe tanpa pelanggaran teridentifikasi.
- Viewport 320, 360, 375, 390, 768, 1024, 1280 dan 1440px; perubahan orientasi/resize 812×375 → 1280×900 → 390×844; teks 200% pada mobile dan breakpoint desktop.
- Normal, kosong, 200 pesan, judul 500 karakter, isi 1.500+ karakter, tanggal invalid, hasil filter kosong, pagination sampai pesan ke-200, filter status dan reset.
- Read-one/read-all, klik ganda, busy, fokus setelah pesan hilang, refresh, kegagalan GET sesudah POST tersimpan, respons malformed/non-JSON, network error, 403/409, dan abort saat unmount.
- Request write tidak diulang saat pemulihan GET; semua payload tetap memakai kontrak existing.
- HTTP aplikasi lokal tanpa sesi: API Notifikasi 401, origin asing pada POST 403; browser halaman Notifikasi beralih ke login. Redirect App Router dapat terjadi setelah streaming dimulai, sehingga verifikasi halaman memeriksa URL browser, bukan memaksakan status HTTP tertentu.
- Tidak ditemukan horizontal overflow halaman, kontrol terpotong, atau JavaScript exception dalam skenario akhir. Gulir vertikal normal tetap diperlukan untuk halaman panjang; footer dapat dijangkau. Input/action memenuhi target sentuh minimal 44px.

Hasil mesin: `notifications/baseline-results.json`, `browser-results.json`, `cross-module-results.json`, `automated-results.json`. Respons gagal yang sengaja disimulasikan menghasilkan network/resource errors yang dicatat terpisah; tidak disamakan dengan JavaScript exception aplikasi.

Batas bukti: browser memakai Chromium headless dan fixture sintetis dengan API yang diintersep untuk aksi positif. Tes SQL memakai database lokal terisolasi; tes server memakai mock pada batas dependency. Tidak ada write produksi, login akun produksi, pengiriman notifikasi nyata, UAT seluruh role live, perangkat fisik Safari/Firefox, ataupun uji pengguna teknologi bantu. Audit satu halaman tidak menjadi klaim seluruh aplikasi 100% bebas bug.
