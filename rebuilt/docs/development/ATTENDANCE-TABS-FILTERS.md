# Tab dan filter Absensi Siswa

Perubahan UI pada branch `feat/attendance-tabs-filters`, berbasis main 033c9f1.

- Filter riwayat memakai accordion native details/summary, tertutup awal dan bisa dibuka dengan keyboard.
- Tab Input absensi terpisah dari Riwayat absensi (filter, ringkasan, tren, kalender, tabel, pagination, ekspor).
- Radix Tabs menyediakan navigasi panah, Home/End serta relasi ARIA. Panel tetap mounted dan hidden saat tidak aktif agar draft, pilihan kalender, dan isian filter tidak terhapus.
- Petugas membuka tab input secara default; pembaca membuka riwayat. Tab input pembaca menjelaskan keterbatasan akses tanpa menampilkan kontrol tulis.
- Tidak ada perubahan API, validasi, perhitungan, database, RBAC, atau kontrak penyimpanan.

## File

- `src/app/account/operations/[module]/attendance-panel.tsx`: tata letak tab, accordion, petunjuk sesuai tab.
- `scripts/verify-attendance-tabs.mjs`: pemeriksaan interaksi tab/accordion dan kompatibilitas batch/filter.
- `docs/verification/attendance-tabs/browser-results.json`: bukti browser.

## Verifikasi

TypeScript, lint, delapan tes absensi, production build, git diff --check berhasil.
Browser: 40 pemeriksaan, 9 axe, lebar 320/375/768/1440 termasuk landscape 768×375; tidak ada horizontal overflow atau uncaught JavaScript error pada skenario tersebut. Draft bertahan setelah tab dan filter, payload batch tetap benar, ekspor mengikuti filter, pembaca tidak mendapat kontrol tulis.

Batas: fixture sintetis dan request diintersep; bukan UAT akun produksi/perangkat fisik. Suite lama verify-attendance.mjs mengasumsikan semua bagian terlihat bersamaan; gunakan verify-attendance-tabs.mjs untuk verifikasi layout ini. Suite koreksi lengkap lama belum disesuaikan dan dijalankan ulang pada perubahan ini. Belum dipublikasikan atau di-merge.
