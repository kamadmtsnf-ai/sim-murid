# Pemicu instalasi PWA — 28 Oktober 2026

Tombol **Pasang aplikasi** tetap di footer. Klik membuka dialog panduan dan langsung menjalankan `beforeinstallprompt.prompt()` bila event tersedia dan perangkat online, dalam interaksi pengguna yang sama. Tanpa event atau saat offline, panduan tetap tersedia. Tidak menjanjikan prompt native di browser yang tidak mendukung.

Tombol footer dinonaktifkan selama permintaan berjalan. Controller existing tetap mengonsumsi event satu kali, menjaga lock duplikasi, menangani pembatalan/error, serta membedakan pemasangan dari peluncuran standalone. Kebijakan non-admin, RBAC, autentikasi, manifest dan database tidak berubah.

Perubahan: `src/components/pwa-install.tsx` (pemicu langsung dan busy state), `scripts/verify-pwa.mjs` (verifikasi pemicu footer tanpa klik instalasi kedua serta disabled state selama pending).

Validasi: TypeScript, lint dan 5 tes PWA lulus. Production build lulus; 61 pemeriksaan browser dan 6 pemindaian axe lulus, tanpa JavaScript error teridentifikasi. Prompt native diuji dengan event sintetis; tidak memicu pemasangan OS aktual. Instalasi pada perangkat fisik tidak diuji ulang.
