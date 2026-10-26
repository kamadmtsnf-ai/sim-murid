# L06 — PWA yang dapat dipasang

Baseline main `0a551113d2a436af65d8a6e9d34d8e59a2ff6930` (PR80). Branch `feat/l06-installable-pwa`. 26 Oktober 2026.

## Audit dan keputusan

Existing hanya memiliki favicon SVG. Tidak ada manifest, worker atau mekanisme instalasi. Proxy tetap melindungi semua `/account` termasuk RSC dan memberi private/no-store. `/account` memeriksa sesi/onboarding/survei di server. Autentikasi internal, reCAPTCHA, OTP dan semua kontrak mutasi dipertahankan.

App Router manifest menghasilkan `/manifest.webmanifest`: id/scope `/`, start_url `/account`, display standalone, lang id, identitas dan warna teal existing. Aset publik hanya ikon tanpa informasi akun. Apple metadata dan theme viewport ditambahkan. PNG192/512/Apple180 diturunkan dari favicon existing; maskable512 memakai latar opaque dan artwork di dalam safe circle. Regenerasi: `node scripts/generate-pwa-icons.mjs` (sharp existing, tanpa dependency baru).

Dipilih **instalasi online tanpa service worker**. MDN menyatakan worker bukan prasyarat instalasi; Next mendukung manifest App Router. L06B berlaku kondisional bila worker diperlukan. Karena tidak menjanjikan offline, worker tidak diperlukan pada rilis ini. Tidak membuat cache API/account/RSC, antrean mutasi, background sync, push, pemantauan versi atau reload otomatis. HTTP/browser cache aset statis bawaan tetap ada; bukan cache privat PWA. Tidak mengubah header private/no-store akun. Tidak ada migrasi/schema/env baru.

Sumber: https://nextjs.org/docs/app/guides/progressive-web-apps dan https://developer.mozilla.org/en-US/docs/Web/Progressive_web_apps/Guides/Making_PWAs_installable (diakses 26 Oktober 2026).

## Interaksi

Komponen global ringan setelah konten menyediakan panduan pemasangan dalam details tertutup, tidak membuka popup sendiri. Tombol hanya muncul setelah beforeinstallprompt yang nyata diterima; klik memakai event sekali, lock sinkron mencegah prompt ganda, accepted/dismissed/error memberi penjelasan akurat. Accepted tidak diklaim sebagai instalasi selesai. appinstalled dan standalone menyembunyikan ajakan. iOS/Safari dan Chrome/Edge/Android memiliki petunjuk menu; jika browser tidak menawarkan pemasangan pengguna tetap memakai web.

Listener effect dibersihkan, tanpa storage user/query/token. Status offline hanya petunjuk navigator, bukan bukti server sehat; tidak mengirim ulang transaksi saat reconnect. Tidak menghalangi form atau menghapus draft. Tidak memuat resource pihak ketiga.

## Verifikasi

- npm run check lulus: 748 tes existing, TypeScript/lint, replay tipe database dan production build. Tiga tes PWA tambahan dijalankan sesudahnya dan lulus; check/CI sekarang memasukkannya (751 total).
- npm run lint final lulus setelah fixture, skrip dan tes ditambahkan.
- Browser setelah build final: 21 checks / 2 axe, tanpa JS error; accepted/dismissed/rejection, event sekali, draft tidak hilang, standalone, offline/reconnect, 320/390/768/1280 tanpa overflow horizontal. CacheStorage/registrasi worker kosong pada konteks sintetis.
- HTTP server production build: 19 checks, manifest dan empat PNG dapat diakses anonim dengan content type/dimensi benar, root memuat metadata manifest/Apple/theme.
- Tes maskable memeriksa opacity dan safe circle pixel demi pixel; toleransi RGB2 untuk compositing raster. Ikon/fav SVG tetap identitas existing.
- Startup lokal default gagal membaca interface jaringan sandbox; hostname loopback eksplisit dan server/check dalam proses induk yang sama berhasil. Tidak mengubah produk untuk keterbatasan runner. Browser fixture memakai komponen aktual, CSS build dan event instalasi sintetis, bukan pengganti pemasangan perangkat fisik. L02 UAT manusia tetap terbuka.

## Runbook / rollback

Revert manifest, metadata, komponen dan ikon untuk menonaktifkan ajakan; tidak ada worker yang perlu diganti/dihapus. Jangan unregister worker lain atau menghapus semua CacheStorage. Ikon OS yang sudah dipasang tidak otomatis dihapus oleh rollback; pengguna dapat mencopot dari OS/menu browser. Aplikasi terpasang tetap membuka URL existing melalui pemeriksaan sesi. Pembaruan diterima saat navigasi/relaunch biasa; jangan paksa reload saat dirty/pending. Jika kelak menambah worker, wajib desain allowlist publik, versi/kill-switch worker dan uji logout/switch/revocation/rollback terpisah sebelum rilis.

UAT manual tersisa: instal/peluncuran Chrome dan Edge desktop, Android, iOS/Safari; login/reCAPTCHA/OTP dan logout/switch/revoke pada perangkat terpasang. Tidak menjalankan CAPTCHA atau mengirim OTP nyata dalam otomasi. Jangan menandai penerimaan perangkat selesai hanya karena simulasi lulus.

## File

- app/manifest.ts: identitas instalasi dan start route existing.
- app/layout.tsx: Apple metadata, theme viewport dan satu mount PwaInstall.
- components/pwa-install.tsx: prompt satu kali, panduan dan status koneksi.
- public/pwa/*.png, scripts/generate-pwa-icons.mjs: ikon brand reproducible.
- tests/pwa.test.mjs, tests/ui/pwa-fixture.tsx, scripts/verify-pwa.mjs: manifest, PNG/safe zone dan boundary browser.
- package.json: perintah QA PWA dan unit pada check.
- roadmaps dan laporan ini: status serta batas bukti.

Status dokumen adalah snapshot sebelum publikasi. PR memuat hasil CI, merge dan deployment aktual.
