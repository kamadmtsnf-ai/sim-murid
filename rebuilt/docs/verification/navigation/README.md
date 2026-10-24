# P05 — Bukti rollout navigasi dan UI/UX

Baseline `a0b8ec07b9d7bbb8af5ddd6acc59161dbfb997cc`; 24 Oktober 2026 WIB. Tiga kelompok dirilis terpisah sesuai roadmap. Bukti source/HTTP sintetis/SQL terisolasi; tidak melakukan mutasi produksi, pengiriman email atau AI berbayar.

| Kelompok | Cek browser | Axe | Suite |
|---|---:|---:|---:|
| A | 2310 | 234 | 29 |
| B | 1174 | 92 | 9 |
| C | 1165 | 176 | 17 |

Jumlah adalah eksekusi per kelompok dan mencakup regresi ulang. Bukan skenario unik yang dijumlahkan. Kelompok A dan C masing-masing menjalankan check lengkap 549 tes/63 kelompok; B menjalankan 77 tes terkait/7 kelompok. npm ci, TypeScript/lint/drift tipe/build produksi dan lint release berhasil. JSON group-a/b/c mencatat hasil per suite; navigation-results mencatat skenario search/fokus/role/responsif.

Viewport mencakup 320/390/768/1440, landscape dan drawer saat keyboard pendek; tujuh konteks menu peran; dialog, label/FormData, pagination, empty/error/loading/retry, dirty/pending/uncertain, PDF, konteks akademik, Direktori/Detail/Dashboard. Screenshot mobile/desktop dan drawer diperiksa. Tidak ditemukan overflow horizontal dokumen atau pageerror pada skenario final. Tabel dan modal tetap memiliki gulir lokal; gulir vertikal normal diperbolehkan.

Perbaikan harness: mock stale GET pada Komite/Nilai tidak lagi membaca body POST; viewport390 ditambahkan; dua selector katalog disesuaikan ke istilah pagination bersama. Percobaan B dengan path CSS belum tersedia diulang setelah build; angka final hanya dari suite yang berhasil. PDF diuji Chromium145 yang mendukung API PDF.js. Tidak menyimpulkan UAT/performansi pengguna atau kapasitas produksi dari fixture. Batas browser Back SPA/crash P04 tetap berlaku.

Lihat [laporan dan manifest](../../development/STAGE-05-NAVIGATION-UX.md). P06 Beranda sesuai peran belum dikerjakan.

PR kelompok: [#49](https://github.com/kamadmtsnf-ai/sim-murid/pull/49), [#50](https://github.com/kamadmtsnf-ai/sim-murid/pull/50), [#51](https://github.com/kamadmtsnf-ai/sim-murid/pull/51).
