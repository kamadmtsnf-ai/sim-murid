# Audit Halaman Direktori Pengguna — 22 Oktober 2026

Baseline main: `1baf73a701929872a92ef1fd0787744f45cea714`. Branch: `fix/directory-audit`. Lingkup: daftar dan detail Direktori pada `rebuilt/`; tidak memasukkan pekerjaan release/D10 pada PR #4. Pengguna secara eksplisit meminta PR langsung digabung setelah perbaikan dan verifikasi.

## Analisis sebelum perubahan

Daftar: halaman server → `readServerPrincipal` (sesi terverifikasi + gate existing) → parsing query → RPC `app_directory_read` menggunakan actor/session server → `directorySnapshot` → filter GET + daftar + pagination. Detail: UUID URL → principal server → `app_directory_detail` → schema → bagian kontak, biodata, riwayat kelas, anak, saudara, penugasan, serta jadwal. API GET daftar/detail memiliki auth context dan pemeriksaan scope tersendiri.

Ditelaah: kedua halaman, panel daftar, kedua API, validasi pendidikan, reader server/auth context, SQL `app_directory_allowed/read/detail`, navigasi, Button/controls/TableRegion, loading/error boundary, stylesheet, serta tes pendidikan/database. Tautan biodata/dokumen dan relasi ditelusuri sebagai tujuan rekaman spesifik; fungsi pengeditan biodata/dokumen bukan bagian Direktori dan tidak diubah.

Direktori bersifat baca: tidak memiliki CRUD pengguna, modal, listener client, state async client, atau integrasi Google Apps Script. Filter memakai GET; pagination server 50 baris dan batas halaman 1–2000. Data berasal dari RPC terotorisasi; UI tidak menghitung atau memperluas scope akses. Kontak/biodata null tetap tidak ditampilkan. JTM, jeda, dan waktu selesai dibaca dari backend tanpa mengganti perhitungan.

## A. Temuan

| Temuan | Penyebab dan dampak | Perbaikan |
|---|---|---|
| Filter invalid diam-diam berubah menjadi default | Catch/safeParse fallback membaca daftar siswa default; pengguna tidak diberi penjelasan | Error filter eksplisit, form pemulihan; tidak menjalankan RPC untuk input invalid |
| Halaman di luar hasil menampilkan “2000 dari 1” | Page URL tidak dibandingkan dengan total scoped result | Redirect ke halaman valid, termasuk halaman 1 untuk hasil kosong; filter tetap dipertahankan |
| Next link dapat menuju halaman 2001 | UI hanya memeriksa total baris, sementara kontrak membatasi 2000 | Satu helper jumlah halaman/URL dengan batas existing dan petunjuk mempersempit hasil |
| Pagination metadata terlalu longgar | `page_size:0`, page/total negatif atau pecahan diterima schema | Validasi positif/integer/nonnegatif; progress 0–100; hindari Infinity dan status progress invalid |
| Gangguan layanan disamakan dengan langkah keamanan | Catch halaman mengembalikan pesan statis tanpa retry | Pisahkan null/denied dari kegagalan RPC/schema; gangguan memakai boundary/reset existing |
| Form non-admin dapat berbeda dengan URL status | Form tersembunyi selalu active tetapi URL inactive/all diproses | Kanonisasi UI ke active sambil menjaga role/query; API dan SQL tidak diubah |
| Detail di mobile tersembunyi di kolom jauh | Semua viewport memakai tabel minimum 40rem | Kartu untuk container sempit; tabel semantik untuk area lebar, satu presentasi terlihat/focusable |
| Akses detail dapat diprefetch untuk banyak baris | Link record memakai default prefetch | Nonaktifkan prefetch otomatis pada link direktori/detail/relasi |
| Detail memakai role/task/tanggal mentah dan teks pengembangan | Presentasi belum dilokalkan/dikelompokkan | Label Indonesia, tanggal lokal/fallback, section/kartu, hapus keterangan pengembangan tanpa menghapus data/fungsi |
| Potensi `undefined` pada hari/jam atau link biodata dari data malformed | Detail schema sebelumnya menerima angka bebas dan student unknown | Schema detail terpusat, batas jadwal sesuai constraint database dan student berupa object/null |

Halaman 2000 dari 1 dan kebutuhan geser horizontal menuju detail pada mobile direproduksi sebelum perubahan. Validasi data malformed adalah penguatan defensif, bukan klaim insiden produksi. Tabel lama memang mempunyai scroll region terlokalisir; itu bukan bukti horizontal overflow seluruh dokumen.

## B. Implementasi dan file

| File | Alasan |
|---|---|
| `src/app/account/directory/page.tsx` | Filter invalid, kanonisasi status/page, gangguan terpisah dari null/denied, heading dan deskripsi |
| `src/app/account/directory/directory-panel.tsx` | Reuse form controls/Button/TableRegion, kartu/tabel, status/progress, helper presentasi, pagination/filter reset, prefetch false |
| `src/app/account/directory/[id]/page.tsx` | Validasi UUID/schema dan retry yang aman; akses null tetap tidak membedakan keberadaan record |
| `src/app/account/directory/directory-detail.tsx` | View detail reusable: nama/peran, kontak, biodata, riwayat kelas, relasi, tugas dan jadwal |
| `src/app/account/directory/loading.tsx` | Loading spesifik dengan heading/status dan skeleton tanpa data palsu |
| `src/app/account/directory/error.tsx` | Reuse error boundary akun existing; tidak menduplikasi handler reset |
| `src/lib/education/directory.ts` | Satu schema detail; helper halaman, URL, tanggal dan label |
| `src/lib/education/validation.ts` | Batas numerik snapshot daftar; bentuk field/API tetap sama |
| `src/app/globals.css` | Styling khusus direktori, container layout, wrapping, progress teal, tabel fixed-layout dan detail |
| `tests/directory.test.ts`, `tests/directory-server.test.mjs` | URL encoding, metadata, schema detail, caller/session, invalid query, redirect, null/error, API |
| `tests/database/education.test.mjs` | Pagination stabil 56 record, status admin/non-admin, no-contact list; scope existing tetap diuji |
| `tests/ui/directory-fixture.tsx`, `directory-navigation-shim.ts` | Skenario sintetis daftar/detail/loading/error tanpa route atau login aplikasi |
| `scripts/verify-directory.mjs` | Browser regressions khusus daftar dan detail |
| `scripts/verify-ui.mjs` | Tambahan pemeriksaan anonim API/page daftar dan detail aktual |
| `package.json` | Integrasi test Direktori ke `check`; tanpa dependency baru |
| `docs/design-system/MASTER.md` | Pola direktori dan batas responsif/pemulihan |
| `docs/verification/directory/` | Hasil baseline, browser, regresi dan ringkasan check |

Kartu/tabel membaca data yang sama dan memakai `PersonStatus`, `PersonAssignments`, `DetailLink` yang sama. Representasi yang disembunyikan CSS tidak dapat difokus atau dibaca melalui accessibility tree. Tidak ada duplikasi state atau event bisnis. Filter tetap server GET; menerapkan filter mereset page, pagination mempertahankan role/query/status, dan full reset kembali ke filter default. Nilai username termasuk nol di depan tidak dikonversi menjadi angka.

Kontak dan student yang tidak dikembalikan server tetap null. Tidak membuat link ke data privat berdasarkan relasi yang belum diverifikasi. Null/UUID invalid pada detail memakai pesan umum; error RPC/schema memakai reset. API, SQL, RLS, gate survei/onboarding existing, perhitungan dan struktur backend tidak dimodifikasi.

## C. Kode final dan pengujian ulang

Kode aktual berada pada file implementasi di atas. Tautan detail/biodata/anak tetap merupakan tujuan record spesifik; tidak menambah shortcut modul yang menduplikasi sidebar. Metadata teknis backend tidak dibuat menjadi fitur atau statistik palsu.

```bash
npm ci
npm run check
npm run audit:deadcode
UI_TEST_TOOLS=/path/to/qa/node_modules UI_CHROMIUM_EXECUTABLE=/path/to/chromium npm run test:directory:browser
UI_TEST_TOOLS=/path/to/qa/node_modules UI_CHROMIUM_EXECUTABLE=/path/to/chromium npm run test:ui:browser
```

Tool QA terpisah menyediakan esbuild/axe-core; Playwright berasal dari runtime atau instalasi QA lokal sesuai suite existing. `UI_QA_ENV_FILE` opsional untuk suite lintas modul hanya memuat environment publishable untuk endpoint anonim. Fixture bukan route aplikasi, bukan validator identitas dan tidak menyimpan data produksi.

## D. Verifikasi akhir

- `npm ci` berhasil; dependency dan lockfile tidak diganti.
- `npm run check`: 188 tes lulus, typecheck/lint, 14 tipe tabel dari replay migrasi, production build. Build/lint akhir dijalankan lagi setelah penyempurnaan CSS/copy.
- Audit dead code `unreachable: []`.
- 71 pemeriksaan browser Direktori dan 67 pemeriksaan browser regresi lintas modul lulus. Total 21 kondisi axe tanpa pelanggaran teridentifikasi.
- Lebar 320/360/375/390/768/1024/1280/1440px; landscape 812×375, orientasi kembali 390×844, perpindahan drawer ke desktop, teks 200% pada mobile dan breakpoint desktop.
- Data kosong, 50 baris, nama/username/kelas panjang, nilai kelengkapan 0%, filter GET karakter khusus, admin/non-admin, reset dan pagination yang menjaga filter.
- Detail guru/siswa/orang tua, relasi anak/saudara, kontak/biodata null, tanggal invalid, jadwal 07:00–08:35 beserta 2 JTM + 15 menit istirahat, loading dan reset error.
- Keyboard/fokus/touch detail terjangkau; tidak ditemukan horizontal overflow halaman atau JavaScript/console error pada pengujian akhir. Gulir vertikal halaman panjang tetap tersedia dan footer dapat dijangkau.
- SQL lokal mempertahankan teacher/head/own/verified guardian scope; list tidak mengirim kontak atau isi biodata penuh. Test tambahan memastikan urutan stabil, tidak ada ID ganda/lompatan antarhalaman, status inactive hanya untuk admin, serta halaman 2001 ditolak.
- Endpoint aplikasi lokal aktual: API daftar/detail tanpa sesi tetap 401; browser daftar/detail anonim dialihkan ke login. Tidak ada write produksi.

Bukti mesin: `directory/baseline-results.json`, `browser-results.json`, `cross-module-results.json`, `automated-results.json`.

Batas bukti: Chromium headless dengan fixture komponen; alur server/API diuji dengan mock pada batas dependency, dan SQL dengan database lokal terisolasi. Bukan UAT seluruh role pada akun produksi, bukan uji Safari/Firefox perangkat fisik atau pengguna teknologi bantu. Audit ini tidak menjadi jaminan aplikasi 100% bebas bug.
