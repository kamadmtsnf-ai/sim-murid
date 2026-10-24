# P04 — Bukti keandalan formulir

Tanggal 24 Oktober 2026 WIB; baseline `b863285991bb811a6b4b4257343bcb168085c93c`.

`npm ci` lulus. `npm run check` selesai exit 0: **548 tes dalam 63 kelompok**, termasuk SQL terisolasi, TypeScript, lint, drift tipe database dan production build. Setelah koreksi terakhir, tes kontrak formulir/Profil, TypeScript/lint dan clean production build dijalankan ulang.

Browser: **2048 pemeriksaan, 198 pemeriksaan axe pada 25 suite**, seluruhnya lulus. Semua memakai komponen nyata, HTTP sintetis dan CSS produksi.

| Suite | Pemeriksaan | Axe | Chromium |
|---|---:|---:|---:|
| account-recovery | 46 | 5 | 141 |
| account-security | 80 | 7 | 141 |
| attendance | 84 | 6 | 141 |
| biodata | 66 | 11 | 141 |
| books | 48 | 7 | 145 |
| classes | 393 | 16 | 141 |
| committee | 86 | 6 | 141 |
| duty | 131 | 9 | 141 |
| email-verification | 84 | 10 | 141 |
| families | 32 | 7 | 141 |
| forms | 49 | 4 | 145 |
| grades | 61 | 7 | 141 |
| insights | 30 | 3 | 141 |
| jobs | 45 | 7 | 141 |
| mentoring | 87 | 7 | 141 |
| personal-profile | 87 | 8 | 141 |
| points | 66 | 8 | 141 |
| promotions | 104 | 13 | 141 |
| reports | 62 | 7 | 141 |
| savings | 47 | 6 | 141 |
| schedules | 146 | 14 | 141 |
| sessions | 105 | 13 | 141 |
| settings | 39 | 5 | 141 |
| surveys | 59 | 6 | 141 |
| users | 11 | 6 | 141 |

## Skenario baru

Validasi sebelum HTTP; dua pengiriman pada tick sama; UUID/revisi; acknowledgement hilang/bertentangan; snapshot revisi tidak meningkat; respons malformed/non-JSON; 401/403; stale/penolakan bisnis; offline; server commit lalu koneksi putus; timeout; unmount; tidak ada retry otomatis atau sukses palsu. `fail/clear` tidak membuka uncertain. Pemeriksaan GET tidak mengulang mutasi. Sidebar/logout pending diblokir; cancelled dirty navigation menjaga isian; explicit discard diizinkan; Profil nyata memakai guard; pemberitahuan dapat ditutup tanpa membuka lock.

Survei menguji cancelled dirty logout dan autosave tetap berjalan. Hasil Survei menguji penyimpanan catatan tetap mempertahankan nilai serta dirty guard rencana lain. Viewport formulir 320/390/768/1440; screenshot desktop/mobile/status pending diperiksa. Tidak ada horizontal overflow atau pageerror pada skenario formulir; gulir vertikal normal diperbolehkan.

## Kendala yang diselesaikan dan batas

- Lingkungan sementara ter-reset sebelum push. Perubahan dipulihkan dan semua bukti di sini dijalankan ulang; log lama tidak dipakai sebagai klaim rilis.
- Build awal yang bersamaan dengan generator tipe gagal karena `.next/package.json` kosong. Build incremental berikutnya mengalami persistence cache Turbopack `invalid digit found in string`. Generated cache dipindahkan; build bersih final berhasil. Ini cache compiler, bukan error PostgreSQL.
- Mock beberapa modul mengulang revisi awal pada setiap saved. Diperbaiki agar snapshot sukses menggunakan request revision + 1. Tes timeout Jadwal menunggu request benar-benar diterima sebelum memajukan jam virtual. Tidak melonggarkan kontrak aplikasi.
- Chromium 141 tidak mendukung `Map.getOrInsertComputed` yang digunakan PDF.js existing. Buku diuji ulang pada Chromium 145 dan lulus 48 cek, termasuk reader PDF. CDN unduhan browser sempat mengembalikan HTML; binary diambil dari Chrome for Testing resmi. Tidak menambahkan polyfill atau perubahan reader aplikasi untuk meloloskan tes.
- Pengujian boundary auth/HTTP memakai mock; SQL berjalan terisolasi. Tidak mengklaim UAT peran produksi, pemulihan crash seluruh form, kontrol browser Back SPA, pengiriman email nyata, performa pengguna nyata atau AI berbayar.

Lihat `verification.json`, detail skenario baru `browser-results.json`, dan [laporan implementasi](../../development/STAGE-04-RELIABLE-FORMS.md).
