# Penguatan akses halaman akun

25 Oktober 2026 (WIB). Branch `fix/page-authorization`, baseline main `ab93e62`.

## Temuan dan perubahan

Navigasi sebelumnya menyaring menu melalui `navigationFor`, sedangkan proxy hanya menyegarkan sesi. Halaman dan RPC memiliki pemeriksaan domain, tetapi belum ada gerbang URL bersama sebelum rendering. Menu tersembunyi sendiri bukan pembatas akses.

- `src/lib/auth/page-policy.ts`: kebijakan penerimaan halaman memakai katalog navigasi yang sama, tanpa menyalin matriks role. Kemampuan berasal dari `app_access_context` dengan klien sesi pengguna. Admin berasal dari principal server, bukan parameter atau metadata browser.
- `src/proxy.ts`: verifikasi sesi terdaftar dan kecocokan user ID snapshot; URL di luar izin mendapat 403; sesi tidak valid diarahkan ke Login; null/error layanan izin mendapat 503. Header path selalu ditimpa dari URL aktual. Respons tetap private/no-store dan cookie refresh dipertahankan pada penolakan/redirect.
- URL tidak dikenal ditolak, termasuk descendant sembarang. Detail direktori/biodata hanya menerima UUID; izin kepemilikan/kelas/relasi tetap diperiksa oleh halaman dan RPC. RSC navigation tetap melewati proxy; tidak hanya layout yang dapat dipakai ulang oleh router.
- API bukan mengandalkan proxy: kontrak sesi server, validasi, same-origin untuk mutasi, RPC/RLS dan pemeriksaan cakupan existing tetap berlaku. Tidak mengubah database, peran, hak bisnis, kebijakan nilai atau autentikasi.
- `tests/page-authorization.test.mjs`, `package.json`: seluruh entri katalog, capability, admin, personal page, URL langsung, header palsu, sesi tidak valid, kegagalan layanan dan mismatch identitas masuk suite authorization.

## Batas

Ini pembatas halaman, bukan pengganti otorisasi per-record atau per-mutasi. Kebijakan sidebar existing dipertahankan: akses baca tidak memberi hak menulis. Halaman baru wajib ditambahkan ke katalog izin. Tidak ada perubahan produksi atau cloud pada pekerjaan ini; verifikasi menggunakan fixture sesi/RPC tanpa membaca data pribadi.

## Hasil verifikasi

- `npm run check`: TypeScript, lint, seluruh suite (696 tes saat dijalankan) dan pemeriksaan tipe database lulus. Build pertama gagal karena cache persistence Turbopack lokal (`invalid digit found in string`).
- Setelah menghapus cache `.next`, `npm run build` dijalankan ulang dan lulus.
- Tes pencabutan izin ditambahkan setelah suite authorization berjalan; suite khusus dijalankan ulang, 6/6 lulus (total 697 kasus setelah tambahan tersebut).
- `git diff --check` lulus. Tidak mengklaim uji sesi nyata semua peran atau pentest produksi sudah dilakukan.
