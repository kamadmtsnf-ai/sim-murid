# Beranda SiM-Murid — landing page

Tanggal: 7 November 2026 (WIB). Baseline main: `a92ccf90088ce30ca7edd02dfb97efc7b92eef3d`.
Branch: `ui/modern-home-20261107`.

## Perubahan

Beranda publik `/` memakai hero dua kolom, ilustrasi layanan dari ikon Lucide dan CSS, navigasi anchor, tiga ringkasan layanan, informasi peran, FAQ native `details/summary`, dan CTA masuk. Warna teal identitas produk serta komponen tombol DaisyUI dipertahankan. Tidak memakai angka pengguna, testimoni, aktivitas atau data murid rekaan. Ilustrasi merupakan gambaran kategori layanan, bukan dashboard data langsung.

Konten utama tetap memiliki target skip link yang dapat difokuskan. Semua tautan masuk menuju `/login`; tombol instalasi PWA existing tetap di footer. Layout memakai grid adaptif, header dapat membungkus saat ruang sempit, dan FAQ mendukung keyboard tanpa JavaScript tambahan. Gerakan ikon FAQ mengikuti reduced-motion. Tidak ada dependensi baru, panggilan API/data, atau perubahan auth/izin/database.

## Validasi

- `npm ci`: lulus; lockfile tidak berubah.
- `npm run typecheck`: lulus.
- `npm run lint`: lulus.
- `npm run test:ui`: 8 lulus.
- `npm run test:pwa`: 5 lulus.
- `npm run test:accessibility`: 1 lulus (pemeriksaan sumber, bukan audit browser).
- `git diff --check`: lulus.
- `npm run build`: build produksi final lulus setelah perubahan CSS terakhir. Cache build sementara dibersihkan setelah satu percobaan ulang gagal membaca cache Turbopack; build bersih berhasil.

Pratinjau browser belum terverifikasi: `sites-preview` menambahkan `--host` dan `--strictPort` yang tidak didukung Next.js; proses berhenti sebelum URL preview tersedia. Tidak mengubah script dev aplikasi untuk menutupi keterbatasan preview. Pemeriksaan visual desktop/mobile, axe di browser, dan interaksi sentuh untuk tampilan baru masih perlu dilakukan di preview Next.js yang kompatibel. Pemeriksaan sumber tidak menggantikan bukti visual tersebut.

## Batas pengiriman

Perubahan berada pada worktree terpisah agar perubahan audit yang belum disimpan pada checkout sebelumnya tetap utuh. Tidak push, merge, deploy, atau mengubah database. Pengembalian cukup membatalkan commit landing page ini.
