# L03 — Standardisasi tabel dan filter

Tanggal 26 Oktober 2026 (WIB). Baseline main `ae8ac9fd4576e346c27b0c78d0014e1fa5e43ff9` (PR77). Branch `feat/l03-table-filters`. L02 UAT manusia tetap terbuka.

## Analisis dan scope

Dibaca komponen TableRegion, FilterBar/Pagination, kontrak P02/MASTER, DirectoryPanel/query/URL helper, AccessPanel/filterPermissions, BooksPanel/read/reload/filter, XLSX writer dan suite regression. Infrastruktur tabel sudah baik; tidak membuat design system kedua, generic data grid baru atau mengganti pagination domain.

Pagination callback sudah digunakan lintas modul. Direktori masih memakai markup pagination terpisah. Ringkasan filter/rentang hasil belum konsisten pada Direktori/Hak akses saya/Buku Digital. Books menggunakan native reset: browser mengosongkan input sebelum hasil reset dikonfirmasi, sehingga request gagal dapat menampilkan field kosong tetapi hasil/filter lama. Setelah mengganti native reset, ditemukan kasus batas draft pencarian berubah saat committed filter tetap kosong; reset terkonfirmasi juga harus meremount form pada kondisi ini.

## Implementasi

- `collections/presentation.ts`: proyeksi halaman/range murni dan whitelist sort. Tidak mengubah query API, total domain, slicing atau otorisasi.
- `collection-controls.tsx`: Pagination callback memakai halaman valid, mempertahankan label/callback/disabled. Semua konsumen existing memperoleh proteksi presentasi dan batas next/previous yang sama.
- `link-pagination.tsx`: adapter server GET untuk Direktori, memakai model yang sama dan URL helper existing. Filter role/query/status tetap di URL; menerapkan filter tetap ke halaman pertama.
- `collection-summary.tsx`: rentang hasil, status teks dan chip filter committed; wrapping pada mobile. Dipakai di Direktori, Hak akses saya dan Buku Digital.
- `use-sort-preference.ts`: hanya enum label-asc/label-desc untuk Hak akses saya, key per user_id. Tidak menyimpan kelas, scope, query atau grants. Sorting hanya terhadap hasil terfilter yang sudah scoped. Storage gagal tetap memakai fallback memori; storage event memperbarui tab lain; SSR memakai default stabil.
- AccessPanel: urutan A–Z/Z–A, halaman kembali awal saat urutan diganti; filter/count tetap milik domain.
- BooksPanel: form defaultValue/key mengikuti filter terkonfirmasi. Reset adalah button biasa; perubahan field baru dilakukan setelah read berhasil. Version counter menangani reset saat filter committed sama tetapi draft berbeda. Paging tidak memaksa reset field.
- Direktori: admin-only XLSX “Ekspor halaman ini”, enam kolom dari rows yang sudah tampil. Bukan seluruh hasil pencarian; tidak ada fetch/UUID/kontak tambahan. Spreadsheet writer existing mempertahankan username sebagai string dan tidak membuat formula dari teks.
- globals.css: tombol pagination dan link GET memiliki perilaku responsive konsisten.

Tidak mengubah API/RPC, schema, role, kuota, transaksi, rumus, arsip, kelas/penugasan atau dependensi. Tidak membutuhkan migrasi. Tidak membuat fitur ekspor baru untuk non-admin. Tabel lebar, caption, scope, card mobile dan sticky yang sudah tepat dipertahankan. Ekspor PDF/ledger/rapor domain lain tidak diubah tanpa kebutuhan; kontrak scope mereka tetap diuji oleh regresi existing.

## Pengujian

- Regresi lengkap npm run check: seluruh 744 tes/79 kelompok lulus; build lokal dijalankan terpisah setelah proses sempat terputus oleh pembatasan koneksi runtime. Tidak menyebut exit0 seluruh command lokal tanpa bukti proses final.
- TypeScript/lint diulang setelah perubahan akhir; tests books (12) dan collections (3) lulus.
- Browser final: 235 checks/29 axe, tanpa JavaScript error (Access108/8, Directory73/13, Books54/8). CI dicatat pada PR setelah selesai. Regresi khusus: failed reset mempertahankan input/ringkasan, reset draft kosong, sortir lintas akun/storage ditolak, URL paging preserve query, ekspor current-page Excel dan larangan tombol ekspor non-admin.
- Uji browser memakai fixture sintetis dengan komponen aktual/CSS production build. Bukan UAT manusia atau akun produksi. Waktu menemukan data dan baseline UX belum diukur.

Lint/typecheck awal mendeteksi tuple test belum readonly dan lookup scope label terlalu luas; dikoreksi, lalu pemeriksaan diulang. Tidak mengendurkan strict TypeScript.

## Status dan risiko

Fondasi komponen bersama dan adopsi tiga koleksi dilaksanakan tanpa memaksakan satu kontrak filter/sort ke seluruh domain. Standardisasi lanjutan dapat memakai komponen ini; fitur filter server, page size dan otorisasi tiap domain tetap otoritatif. UI preferensi tidak dapat mengembalikan akses yang dicabut karena tidak menyimpan scope/data.

Hasil ekspor adalah snapshot halaman saat dimuat; tidak diklaim sebagai transaksi/audit real-time. Draft pencarian filter tidak disimpan di browser. UAT manusia L02/perangkat fisik tetap belum dilakukan.

User mengizinkan pembuatan PR, merge setelah CI lulus, dan migrasi bila diperlukan. Migrasi tidak diperlukan. Riwayat PR/SHA/Production dicatat setelah rilis. Rollback cukup revert komponen/UI; tidak ada data untuk dipulihkan.
