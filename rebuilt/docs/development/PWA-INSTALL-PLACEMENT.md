# Penempatan pemasangan PWA — 28 Oktober 2026 (WIB)

Baseline main: `17b298cc6a8bcbe624923a81a527f134c30e948d`. Branch: `ui/pwa-install-footer`. Pengguna meminta panel “Pasang SiM-Murid di perangkat” tidak mengganggu UI/fokus dan langsung merge PR.

## Temuan dan perubahan

Panel lama berupa accordion lebar yang dipasang global setelah isi halaman. Saat terbuka, panduannya menambah panjang halaman dan bersaing dengan pekerjaan pengguna. RootLayout tetap memasang **satu** PwaInstall setelah children; tidak menambah instance di setiap halaman atau listener baru per modul.

- Accordion diganti tombol ghost ringkas “Pasang aplikasi” di akhir dokumen, setelah konten/footer halaman. Posisi mengikuti alur dokumen, bukan fixed/sticky/floating; tidak menutupi tombol atau data.
- Panduan lengkap hanya dibuka dalam `Dialog` reusable atas tindakan pengguna. `beforeinstallprompt`, pergantian koneksi atau pesan hasil tidak membuka modal otomatis.
- Close/Escape mengembalikan fokus ke tombol. Bila `appinstalled` menghapus tombol, modal ditutup dan fokus dikembalikan ke main. Event pemasangan saat modal sudah tertutup tidak memindahkan fokus pengguna.
- Panduan manual Chrome/Edge/Android/Safari tetap tersedia jika browser tidak menawarkan prompt; tombol native “Instal aplikasi” hanya tampil dengan event valid. Penolakan/kegagalan tetap dijelaskan; event tidak digunakan ulang, submit ganda dikunci, modal stabil saat browser menunggu pilihan.
- Informasi offline tetap berada di luar dialog, dengan status aksesibel. Standalone menyembunyikan ajakan pemasangan.
- Padding/close control modal memakai ukuran px yang dibatasi hanya `.pwa-install-dialog`, untuk menjaga ruang pada mobile dan pembesaran teks. Dialog modul lain tidak diubah.

Tidak mengubah manifest, start_url/scope, ikon, auth/RBAC, API, database, logika bisnis, dependency atau perilaku offline. Tidak menambah service worker, cache privat, antrean transaksi atau reload otomatis. Tidak perlu migrasi.

## Berkas

`src/components/pwa-install.tsx`: tombol footer/modal/fokus; `src/app/globals.css`: CSS scoped; `tests/ui/pwa-fixture.tsx` dan `scripts/verify-pwa.mjs`: regresi posisi/fokus/instalasi/responsif; `scripts/verify-pwa-pages.mjs` dan script npm: pemeriksaan halaman produksi lokal. Laporan ini, MASTER dan JSON verifikasi menyimpan keputusan dan bukti aktual. RootLayout tidak diubah.

## Verifikasi

`npm run check` lulus:786 tes tanpa kegagalan, TypeScript, lint, replay tipe database dan production build. Pengujian PWA:52 pemeriksaan komponen dan57 pemeriksaan halaman publik aktual (Beranda/Login/Bantuan Akun/404), dua pemindaian axe tanpa pelanggaran, tanpa JavaScript error teridentifikasi. Posisi footer, modal eksplisit, focus trap/return, draft, pending/double prompt, offline/standalone dan teks200%/400% diperiksa.

Hasil aktual ada di `docs/verification/pwa-install-placement/verification.json` dan `browser.json`. Browser memakai komponen aktual dengan event sintetis, bukan pemasangan nyata ke perangkat pengguna. Instalasi fisik L06 yang sebelumnya dikonfirmasi pengguna tidak dianggap diuji ulang pada perubahan ini. UAT manusia/perangkat fisik belum dijalankan.

CI exact-head, PR, merge SHA dan deployment produksi dicatat pada deskripsi PR setelah rilis.
