# L05 — Penyempurnaan sidebar dan orientasi menu

Tanggal 26 Oktober 2026 (WIB). Baseline main `7bcb57351849e074b012c383752204c3644b5737` (PR79/L04). Branch `feat/l05-sidebar-wayfinding`.

## Analisis dan temuan

Dibaca WorkspaceShell/navState, accordion PR74, account-navigation/matching/scoping, CSS shell, Dialog, navigation fixture/shim, regresi shell/form, roadmap dan kebijakan existing. Sidebar sudah menjadi jalur utama, default accordion collapsed, pencarian scoped, focus/resize dan dirty/pending guard tersedia. Tidak mengganti arsitektur shell, izin server atau menambah tombol navigasi konten.

Gap: kelompok tertutup tidak menunjukkan halaman aktif. State search accordion disimpan dengan key query permanen; menutup kelompok hasil, membersihkan lalu mengetik pencarian identik dapat mengembalikan hasil tetap tertutup. Informasi hasil kosong belum menjelaskan cakupan menu atau lokasi halaman saat ini. Deteksi current item memakai katalog global walaupun caller hanya membawa menu berizin.

## Implementasi

- Header kelompok aktif mendapat marker teks “Halaman aktif”, warna semantik, dan deskripsi aksesibel berisi nama halaman. Nama aksesibel tombol tetap label kelompok; badge dekoratif tidak menggandakan pengumuman. aria-expanded dan aria-controls tetap menunjuk panel unik desktop/mobile. Penanda tidak bergantung warna saja.
- Kelompok aktif tetap default tertutup, termasuk sesudah berpindah route ke kelompok yang belum dibuka pengguna. Tidak ada auto-expand atau persistence baru.
- State browse dan search dipisahkan. Search override hanya milik query saat ini dan direset saat query berubah/dibersihkan; browse expansion tetap utuh. Query diulang membuka hasil secara default, bukan memulihkan collapse lama. Menghapus pencarian tetap memfokuskan textbox.
- Hasil menjelaskan bahwa pencarian hanya mencakup menu yang diizinkan. Bila halaman aktif tidak ada dalam hasil, tampilkan lokasi/group yang diizinkan serta petunjuk hapus pencarian. Empty state menyarankan nama/istilah lain atau hapus pencarian.
- currentNavItem menerima navigation scoped opsional (default katalog tetap kompatibel untuk caller lama). Shell memberikan daftar yang sudah difilter server; fungsi tidak memberikan izin baru. Deep link memilih parent terpanjang yang tersedia. Route yang tidak ada di daftar tidak memperoleh marker menu asing.
- Label menu/alias yang sudah konsisten dipertahankan. Tidak merombak istilah bisnis atau menyimpan query/role/grants pada storage.

## Verifikasi

- npm run check exit0: 748 tes/79 kelompok, TypeScript/lint/replay tipe database/production build lulus.
- Build akhir dan lint diulang setelah style/skrip final: lulus.
- Unit baru: scoped currentNavItem tidak menampilkan menu yang tidak diizinkan, mempertahankan deep link Direktori dan exact boundary route.
- Browser accordion/wayfinding: 91 checks, 6 axe, tanpa JS error. Initial mobile/desktop collapsed; marker/deskripsi; Enter/Space; independent expansion; repeat search setelah manual collapse; empty/recovery; fokus clear; route/Back marker tanpa force-open; enam role non-admin plus admin.
- Browser shell penuh: 66 checks, 14 axe, tanpa JS error. Suite lama yang mengasumsikan menu expanded kini menyiapkan user-opened groups secara eksplisit sebelum skenario legacy. Default mobile-first collapsed diuji terpisah di suite accordion; tidak mengubah produk untuk menyesuaikan tes lama.
- Browser forms: 87 checks, 7 axe, tanpa JS error; regresi pending/uncertain/draft/sidebar/logout dipertahankan.
- Total browser: 244 checks, 27 axe. Viewport/resize/landscape/short-height dan no-page-overflow sesuai suite. Screenshot 320px diperiksa internal untuk marker/current group dan wrapping.
- Selector awal mencocokkan teks duplikat pada sidebar desktop tersembunyi dan drawer mobile. Diperbaiki dengan scoping ke surface yang diuji; suite diulang lulus. Bukan bug duplikasi tampilan pengguna.

Semua browser memakai komponen aktual/CSS production dengan fixture sintetis, tanpa akun/data produksi atau perubahan role. Axe nol bukan sertifikasi WCAG penuh. Pengguna manusia/perangkat fisik/pembaca layar dan waktu menemukan menu belum diukur (L02 tetap terbuka).

## File dan alasan

- `workspace-shell.tsx`: marker/deskripsi, scoped current item, search state dan feedback lokasi/empty.
- `account-navigation.ts`: parameter navigation scoped additive.
- `globals.css`: marker header memakai token semantic existing, wrapping dan ukuran kontrol dipertahankan.
- `tests/ui.test.ts`: scoped current-route regression.
- `scripts/verify-navigation.mjs`: regresi accordion/location/search dan pembaruan setup suite legacy.
- MASTER/roadmap/laporan accordion: kontrak dan status terbaru.
- `docs/verification/l05-sidebar-wayfinding/`: bukti otomatis tersunting, tanpa screenshot/data pribadi.

## Rilis dan batas

User mengizinkan PR/merge setelah CI lulus dan migrasi bila perlu. Tidak ada perubahan API/Auth/RPC/database, dependency atau migrasi yang diperlukan. L06/PWA belum dijalankan. Rollback cukup revert shell/helper/styles.

Laporan ini snapshot pre-release. PR, CI, commit merge dan Production READY dicatat pada PR setelah tersedia. Penerimaan manusia serta metrik navigasi tetap pekerjaan L02, bukan disimpulkan dari jumlah checks.
