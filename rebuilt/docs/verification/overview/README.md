# Verifikasi P06 — Beranda sesuai peran

`npm ci` dan `npm run check` selesai dengan exit 0: TypeScript, lint, unit/integrasi database, dan production build. Sebanyak 576 tes dalam 65 kelompok lulus.

Tujuh suite browser lulus: overview 120/20 axe, dashboard 75/11, access 104/8, navigation 49/12, forms 49/4, academic-context 45/8, personal-profile 87/8. Total 529 pemeriksaan dan 71 pemindaian axe; tanpa error teridentifikasi. Chromium 145, viewport 320, 390, 768, 1440 dan landscape sesuai suite.

P06 menguji tujuh peran, assignment aktif/dicabut, holiday/Minggu, angka total melampaui page limit, isolasi relasi/kelas, error parsial, refresh ganda, timeout, pergantian akun, unmount dan pembersihan snapshot pada 401/403. SQL memakai PGlite dan RPC existing; browser memakai fixture sintetis dengan komponen/proyeksi aktual. Ini bukan UAT produksi atau uji beban.
