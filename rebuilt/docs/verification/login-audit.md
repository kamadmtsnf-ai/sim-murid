# Audit dan refactoring Login

Tanggal: 22 Oktober 2026. Baseline main: `965fd9afd53bcb8ddb5d952c145029627d83c577`. Lingkup: `/login`, POST `/api/auth/login`, komponen loading, dan pengujian terkait. Tidak ada perubahan database, RBAC, kontrak API, recovery, atau aturan onboarding.

## A. Temuan

- Form tanpa method/action eksplisit dapat mengirim password melalui query GET sebelum JavaScript aktif. Reproduksi browser baseline memakai kredensial sintetis dan intersepsi navigasi; tidak menyentuh Auth produksi.
- Pengunci berbasis state saja masih menerima dua submit sinkron. Respons 2xx yang tidak mengikuti kontrak juga dianggap sukses; respons terlambat setelah unmount dapat mengambil alih navigasi.
- Gangguan Auth/identity dan pembatasan provider disamakan dengan password salah. Kegagalan penyimpanan cookie atau transport setelah klaim dapat meninggalkan sesi aktif.
- Pembacaan body belum dibatasi saat streaming dan batas karakter tidak sama dengan batas byte UTF-8.
- Target skip link tidak fokus; flag URL bersamaan menampilkan pesan bertentangan; mobile dapat mengapitalisasi username yang peka huruf besar/kecil.
- Pada lebar 320 px dengan pembesaran teks, baseline melebar sampai 351 px (200%) dan 701 px (400%).

## B. Perbaikan dan alur

Server memvalidasi Origin, membaca maksimal 8192 byte melalui helper existing, memvalidasi schema, memeriksa limiter, mengambil profil/identitas, memverifikasi password, mengklaim satu sesi, dan menyimpan cookie. Hanya setelah seluruh tahap wajib berhasil respons `/account` diberikan. Probe identitas dummy menjaga pesan gangguan seragam untuk username tidak dikenal/nonaktif. Tidak ada normalisasi username/password baru; minus, kapitalisasi, dan nol awal dipertahankan.

Sesi Auth yang baru diterbitkan dibersihkan saat proses gagal. Jika klaim mungkin sudah terjadi, revocation hanya menyasar pasangan user/session tersebut; sign-out provider menggunakan scope local. Kedua pembersihan dicoba independen. Metadata perangkat tetap opsional. Cookie parsial tidak dikirim pada kegagalan. Kebijakan satu sesi serta TTL 1 jam/7 hari tidak berubah.

Form memakai pengunci sinkron, validasi schema bersama, fase loading/sukses/hasil tidak pasti, timeout 30 detik, fokus pesan, dan pemeriksaan kontrak respons. Hasil jaringan tidak pasti mengarahkan pengguna melakukan pemeriksaan sesi baru sebelum mencoba lagi. Unmount tidak memicu redirect terlambat. Tautan native tersedia jika navigasi setelah sukses gagal. Form menggunakan POST eksplisit; tanpa JavaScript formulir disembunyikan dan bantuan ditampilkan agar kredensial tidak terkirim melalui URL.

Shell dan CSS hanya untuk Login menggunakan token existing, kolom minmax(0, …), wrapping, kontrol sentuh, loading skeleton, dan satu pemberitahuan dengan prioritas jelas. Scroll vertikal normal tetap tersedia pada layar pendek; konten tidak dipotong demi memaksakan satu layar.

## C. Kode final

- `src/app/api/auth/login/route.ts`: batas body, klasifikasi error, kompensasi sesi, disconnect.
- `src/app/login/login-form.tsx`: state, submit, validasi, timeout, aksesibilitas, POST aman.
- `src/app/login/page.tsx`: session reader existing, notice, fallback tanpa JavaScript.
- `src/app/login/login-shell.tsx`, `login.module.css`, `loading.tsx`: layout reusable khusus Login dan responsive/loading.
- `tests/login-route.test.mjs`, `tests/login-page.test.mjs`: regresi server aktual dengan SDK boundary sintetis.
- `tests/ui/login-fixture.tsx`, `login-navigation-shim.ts`, `scripts/verify-login.mjs`: interaksi aktual komponen dan browser produksi lokal.
- `package.json`: memasukkan tes Login ke check; tidak menambah dependency.
- `docs/design-system/MASTER.md` dan bukti JSON di `docs/verification/login/`: aturan dan hasil verifikasi.

## D. Validasi dan batas bukti

Baseline route: 9 tes, 3 lulus/6 gagal. Baseline browser: 141 pemeriksaan, 13 temuan, 8 viewport axe. Reproduksi native GET tersimpan terpisah di `nojs-baseline.json`.

Final Login: 17 tes server lulus; browser 173 pemeriksaan lulus, 12 pemeriksaan axe tanpa pelanggaran, tanpa JavaScript exception teridentifikasi. Mencakup 320–1440 px, tablet, landscape pendek 812×240, resize/orientasi, teks 200%/400%, keyboard/skip focus, forced colors, loading, error, timeout, success, hasil tidak valid, double submit, unmount, tanpa JavaScript, dan tidak ada horizontal overflow. Screenshot desktop dan mobile ditinjau visual. Pesan console jaringan dari HTTP gagal yang sengaja disimulasikan tidak dihitung sebagai JavaScript exception.

Hasil keseluruhan typecheck/lint/test/build serta smoke/regresi Beranda dicatat di `automated-results.json`. Tes provider sukses/gagal menggunakan batas SDK sintetis; loading diuji dengan komponen aktual di fixture. Tidak dilakukan login memakai akun/password nyata atau mutasi produksi. Tidak mengklaim semua kondisi jaringan/provider nyata sudah diuji. Pembersihan sesi saat provider sendiri gagal bersifat best effort; gangguan setelah respons sukses terkirim ditangani melalui pemeriksaan sesi, bukan jaminan transaksi lintas layanan.
