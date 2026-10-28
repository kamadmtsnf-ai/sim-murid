# Footer dan penggunaan PWA wajib — 28 Oktober 2026 (WIB)

Baseline main: `bda1db2140f8cfb3e259042b27951d3be743075b`. Branch: `feat/pwa-required-non-admin`. Keputusan pengguna: `docs/decisions/PWA-USAGE-20261028.md`.

## Audit dan dampak

PR88 menempatkan tombol setelah footer, bukan di dalamnya. Controller lama menyamakan `appinstalled` dengan standalone; itu dapat meloloskan pengguna yang baru memasang tetapi masih berada di tab browser. Aplikasi telah mempunyai root controller, manifest dan ikon yang valid; tidak perlu mengganti autentikasi atau database.

Root PwaInstall sekarang menjadi provider tunggal untuk state browser, panduan, modal dan status offline. PwaInstallButton ditempatkan di footer WorkspaceShell/Beranda/Login/Recovery/404, tanpa strip utilitas terpisah setelah halaman. Seluruh subhalaman account berbagi footer workspace dan seluruh jalur pemulihan berbagi RecoveryShell.

AccountLayout membaca identitas server existing dan memberi `pwaRequired={!is_admin}` pada WorkspaceShell. PwaRequirement ditempatkan dalam FormNavigationGuard, sehingga logout tetap melewati modal konfirmasi/draft guard. Pada kesalahan autentikasi layout tidak mengarang pengecualian admin; fallback memakai requirement konservatif tanpa memalsukan WorkspaceContext. Anonymous tetap mengikuti redirect halaman/proxy existing.

Browser non-admin: pemeriksaan awal → panduan pemasangan wajib → buka ikon → mode standalone → layanan. Admin terverifikasi: layanan langsung dari browser. Screen loading/noscript tidak mem-flash konten layanan. Konten client belum dipasang sebelum admission; setelah pernah dibuka, kehilangan mode menyembunyikan dan menonaktifkan konten yang sama agar draf tidak hilang. RBAC dan API tidak diubah; RSC tetap diperiksa server. Gate bukan lapisan kerahasiaan atau attestation OS.

## Peningkatan

- Footer asli, satu controller/listener, tanpa modal promosi otomatis.
- Panduan tiga langkah dan pilihan Android/iPhone-iPad/Komputer; deteksi desktop-style iPad hanya untuk pilihan panduan, bukan otorisasi.
- Native prompt bila tersedia; manual bila tidak. Pending/klik ganda/error/dismiss/accepted ditangani. Status terpasang dan mode standalone dipisah.
- Tombol periksa mode tanpa reload, instruksi membuka ikon/login kembali, jalan keluar akun dan arahan browser yang mendukung. Tidak ada bypass localStorage/fullscreen/query/role browser.
- Manifest menambah kategori education/productivity dan orientation any; warna theme/background sesuai token aplikasi. id/start_url/scope/display/ikon dipertahankan.

## Verifikasi

`npm run check` lulus:789 tes tanpa kegagalan, TypeScript, lint, replay tipe database dan build. Source final dibangun ulang setelah perbaikan fokus/skip link. Empat suite browser lulus:60 pemeriksaan PWA,65 halaman publik,66 navigasi dan215 Login (total406),37 pemindaian axe tanpa pelanggaran dan tanpa JavaScript error teridentifikasi pada skenario uji. Screenshot layar wajib PWA desktop/mobile ditinjau.

Temuan yang diperbaiki sebelum rilis: judul modal pada400% perlu region yang dapat difokuskan; target skip link/ID main perlu mengikuti layar wajib dan konten draf yang disembunyikan. Penyesuaian header dialog bersifat opt-in, tidak mengubah dialog lain.

Hasil final aktual disimpan pada `docs/verification/pwa-required-usage/`. Pengujian browser memakai komponen nyata/event dan identitas fixture; halaman publik juga diuji melalui server production lokal. UAT role produksi, screen-reader manusia dan instalasi fisik belum diuji ulang. Keberhasilan instalasi fisik L06 sebelumnya tidak dianggap bukti pengujian perubahan ini.

Suite server membuktikan pengecualian hanya dari principal server; suite browser membuktikan gate non-admin, standalone/iOS, appinstalled/accepted tidak meloloskan browser, localStorage/fullscreen tidak melewati gate, admin/public bebas requirement, panduan, logout, draf, offline, resize dan pembesaran teks. Tetap tidak mengklaim tamper-proof atau 100% instalasi dapat dipaksa browser.

File produksi: root layout/provider, account layout/workspace, footer publik, manifest, CSS scoped dan helper panduan. File QA: tes principal/layout/manifest/platform, fixture, verifier PWA dan halaman publik. Dokumentasi/master mencatat perubahan. Tidak ada migrasi/dependency/API/DB/auth contract baru.

CI exact-head, PR/merge dan deployment dicatat pada deskripsi PR sesudah verifikasi.
