# Audit Detail Pengguna — 22 Oktober 2026

Baseline main: `2fca552cc2a6d06487c9ad2f310540e5e877dd92`. Branch: `fix/user-detail-audit`. Lingkup: `/account/directory/[id]`, API detail, penyajian data dan komponen workspace yang membungkusnya. Tidak mengubah database, RBAC, autentikasi, dependency, atau fitur lain. Pekerjaan diagnosis OTP terpisah tidak dimasukkan.

## Analisis sebelum perubahan

Dibaca: halaman detail/daftar, view detail, loading/error, account layout, WorkspaceShell/breadcrumb/drawer, CSS, Button/Status, read-server/proxy/educationContext, API detail, schema dan formatter direktori, SQL `app_directory_allowed/read/detail`, tujuan link biodata/dokumen dan anak, spesifikasi D04/D05 serta audit direktori sebelumnya.

Detail bersifat baca. Tidak ada CRUD, form edit, pagination/filter, mutasi client, atau Google Apps Script di halaman ini. Interaksi yang tersedia adalah navigasi ke record biodata/anak, drawer workspace, dan retry error. Tidak ditambahkan formulir atau tombol navigasi modul yang menduplikasi sidebar.

Alur: sesi server terverifikasi + gate existing → UUID URL → RPC dengan actor/session server → pembatasan scope SQL → schema/pencocokan ID → tampilan. API memakai educationContext dan gate existing sebelum membaca record. Data kontak/student/documents yang null tetap dibatasi SQL. Perhitungan jadwal, relasi keluarga dan isi biodata tidak dipindahkan ke browser.

## A. Temuan

| Masalah | Penyebab/dampak |
| --- | --- |
| API mengembalikan payload rusak sebagai 200 | Halaman memvalidasi schema tetapi API langsung mengembalikan RPC mentah |
| ID payload belum dicocokkan dengan URL | Pertahanan terhadap rekaman upstream/cache yang keliru belum tersedia; tidak ada klaim insiden produksi |
| Tanggal kalender mustahil tampak valid | Date JavaScript menormalkan 31 Februari menjadi tanggal di Maret |
| Status/periode kurang jelas | Tugas masa depan/berakhir hanya menampilkan tanggal; role Admin/Nasabah memakai kode mentah |
| Schema metadata longgar | Status tidak dikenal dan tahun ajaran pecahan/di luar batas database diterima |
| Loading dan breadcrumb berkonteks daftar | Segment detail mewarisi loading Direktori dan breadcrumb belum membedakan detail |
| Fokus recovery tidak konsisten | Main pada data tidak tersedia/error/loading belum dapat difokuskan oleh skip link |
| Empty state minim | Riwayat kelas dan relasi kosong hilang tanpa penjelasan; kontak whitespace terlihat kosong |
| Overflow teks 400% | Track sidebar dan kontrol dekoratif ikut membesar dalam rem; topbar/breadcrumb dan min-content melampaui viewport |

Baseline: 14 tes server/presentasi, 4 lulus/10 gagal. Browser: 116 pemeriksaan, 14 temuan, 13 axe views. Jumlah temuan browser mencakup pemeriksaan berulang, bukan jumlah bug unik. Overflow direproduksi pada mobile/desktop dengan teks 400%. Axe baseline tidak menangkap semua masalah tata letak/interaksi.

## B. Perbaikan

- Satu `loadDirectoryDetail` untuk halaman dan API memvalidasi data serta ID target, menerima kapitalisasi UUID yang sah, mengembalikan null tanpa membedakan missing/denied, dan menyamarkan error transport. Payload API sukses tetap mempertahankan field existing; view hanya membaca schema yang sudah tervalidasi. Invalid UUID tetap 400, tanpa sesi tetap 401 (atau respons gate existing), null tetap 404, layanan/data upstream rusak 503.
- Formatter tanggal menolak non-ISO/tanggal kalender mustahil. Batas status dan tahun ajaran mengikuti database. Status tugas menggunakan tanggal WIB dengan batas akhir inklusif; tidak menyaring atau menghapus penugasan. Semua riwayat tetap tersedia.
- Grid berbasis lebar konten, heading/section terhubung semantik, label role Indonesia, kontak kosong, empty state scoped, dan fallback tanggal diperjelas. Kontak/student null tetap tidak ditampilkan dan raw NIK tidak dirender pada ringkasan detail.
- Loading/error spesifik detail, metadata generik tanpa PII, breadcrumb terakhir yang tepat, dan fokus skip link. Error detail memakai AccountError existing dengan judul opsional; default judul halaman lain tetap sama.
- Perbaikan workspace hanya pada presentasi: ikon/track/gutter tidak ikut membesar tanpa batas, sementara teks tetap dapat diperbesar dan wrapping. Tidak menyembunyikan konten atau menambahkan overflow-x hidden. Sidebar/drawer dan navigasi existing dipertahankan, kemudian diuji regresi.

Scroll vertikal normal tetap tersedia untuk data panjang, teks besar, serta viewport pendek. Tidak memaksakan semua informasi dalam satu layar dengan pemotongan konten.

## C. File kode final

| File | Alasan |
| --- | --- |
| `src/lib/education/directory-server.ts` | Satu read/validasi/pencocokan ID untuk page/API |
| `src/lib/education/directory.ts` | Tanggal, label, state periode, status/tahun sesuai constraint |
| `src/app/account/directory/[id]/page.tsx` | Loader bersama, metadata, state data tidak tersedia |
| `src/app/api/directory/[id]/route.ts` | Validasi hasil server tanpa mengubah payload sukses |
| `src/app/account/directory/directory-detail.tsx` | Ringkasan dan section read-only, status, empty/restricted data |
| `src/app/account/directory/[id]/loading.tsx`, `error.tsx` | Loading/error khusus detail, memakai komponen existing |
| `src/app/account/error.tsx` | Target skip focus dan heading opsional, default tetap |
| `src/components/workspace-shell.tsx` | Breadcrumb detail tanpa nama/PII atau link modul baru |
| `src/app/globals.css` | Grid detail dan perbaikan elemen workspace penyebab overflow |
| `tests/user-detail.test.mjs` | Server/page/API/presentasi/date/scope-boundary, data sintetis |
| `tests/directory-server.test.mjs` | Menyesuaikan mock presentasi ke komponen unavailable reusable |
| `tests/database/education.test.mjs` | Scope detail, redaksi, sesi dicabut, perubahan peran/relasi pada SQL lokal aktual |
| `tests/ui/user-detail-fixture.tsx`, `user-detail-navigation-shim.ts` | Komponen aktual dengan data sintetis; reuse router shim existing |
| `scripts/verify-user-detail.mjs`, `package.json` | Browser suite serta integrasi tes ke full check |
| `scripts/verify-dashboard.mjs` | Regresi fokus menunggu autofocus drawer selesai dalam timeout existing sebelum memeriksa target; tidak mengubah perilaku aplikasi |
| `docs/design-system/MASTER.md`, laporan/bukti JSON | Aturan dan hasil audit |

## D. Validasi dan batas bukti

Full check: 245 tes lulus, TypeScript/lint, snapshot 14 tabel publik dan production build. Setelah penyempurnaan wrapper error, 15 tes detail serta TypeScript/lint/build dijalankan ulang. Browser detail: 146 pemeriksaan, 18 axe views; Direktori: 71 pemeriksaan, 13 axe views; Dashboard: 75 pemeriksaan, 11 axe views. Enam smoke check lulus; audit 160 file sumber tidak menemukan unreachable file. Screenshot normal dan teks panjang di mobile/desktop ditinjau visual.

Regresi Dashboard pertama gagal pada assertion fokus segera setelah Escape, lalu lulus pada source yang sama. Pemeriksaan diperbaiki agar menunggu autofocus Radix dalam timeout existing, lalu memverifikasi elemen yang sama; tidak menghapus assertion atau mengubah dialog aplikasi. Suite dijalankan ulang setelah perubahan tes ini.

Hasil akhir disimpan di `user-detail/automated-results.json` dan `user-detail/browser-results.json`. Tes meliputi actor/session dari server, anonymous, UUID invalid/case, null/denied, data upstream rusak/ID salah, error transport, field kontrak existing, tanggal mustahil/batas WIB, tugas future/expired/revoked, redaksi kontak/student, role existing, data kosong dan 300 record, footer dapat dijangkau, keyboard/touch/drawer/reset, loading/error/unavailable, forced colors, viewport 320–1440 px, landscape 812×240, resize/orientasi, serta teks 200%/400%.

Full check mencakup replay SQL lokal termasuk pencabutan sesi, role dan guardian linkage. Browser memakai komponen aktual di fixture terisolasi; page/API memakai SDK boundary sintetis dan SQL memakai database lokal aktual. Tidak menggunakan akun/password nyata atau membaca detail pengguna produksi. Tidak mengklaim UAT semua role di produksi, Safari/Firefox atau perangkat fisik telah dijalankan. Bukti ini tidak menjamin semua bug dalam segala kondisi sudah hilang.
