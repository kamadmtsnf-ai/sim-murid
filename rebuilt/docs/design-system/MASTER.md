# Master Design System — Rebuilt SiM-Murid

## Lingkup dan sumber

Target adalah `kamadmtsnf-ai/sim-murid/rebuilt` (nama SiM-Guru dalam judul permintaan tidak mengganti identitas produk). Baseline `55fa7add212437df33808dd8fa97926e740c72db`; branch `design/enterprise-ux-20261021`. Tidak mengubah API, autentikasi, database, rumus, atau RBAC.

UI UX Pro Max dibaca dari [SKILL.md](https://github.com/nextlevelbuilder/ui-ux-pro-max-skill/blob/56ea9cf174ed86786187daa9de0e6247cb0747e4/.claude/skills/ui-ux-pro-max/SKILL.md), bersama quick-reference/pro-rules, search.py/core.py/design_system.py/reasoning_contract.py dan dataset. SHA dipin agar rekomendasi dapat ditelusuri. [daisyUI colors](https://github.com/saadeghi/daisyui/blob/bf3bac3a397b543e55641ecb2d60a2ed961f09ec/skills/daisyui/colors/SKILL.md) dipakai untuk membandingkan pasangan warna semantik; tidak memasang framework kedua.

## Hasil generator dan keputusan

Perintah aktual: `python /tmp/uipro-reference/scripts/search.py 'education administration dashboard' --design-system -p 'Rebuilt SiM-Murid' -f markdown`. Style Minimalism & Swiss cocok; warna education teal mendukung identitas. Pattern Hero+Features dan heading Fira Code kurang cocok untuk administrasi sekolah. Retry terarah `internal analytics dashboard` menghasilkan Data-Dense Dashboard, tetapi pattern Enterprise Gateway/Contact Sales tetap tidak sesuai. Kedua pattern pemasaran ditolak; tidak dipersist sebagai master otomatis. Hasil mentah disimpan sebagai bukti terpisah, bukan sistem desain kedua.

Adopsi: layout data padat namun terbaca, grid adaptif, teks 16px, Lucide konsisten, tabel berangka tabular, focus terlihat, reduced motion. Pertahankan teal `#125e64`, teks `#15243a`, latar `#f7f9fc` dan sistem font lokal Arial/Helvetica (tanpa request font eksternal). Tidak memaksakan chart, KPI, atau hitungan yang tidak disediakan backend.

Pencarian tambahan aktual: `keyboard focus modal --domain ux`, `loading error forms --stack nextjs`, `form accessible label --stack react`, `responsive table overflow --stack html-tailwind`, `dialog focus --stack shadcn`. Hasil Next.js tentang mengganti API dengan Server Actions ditolak karena melanggar kontrak existing. Hasil Tailwind tentang gambar tidak diterapkan pada tabel. Focus, loading/error routes dan pengelolaan dialog Radix diterapkan sesuai konteks.

## Token dan hierarki

Satu sumber token runtime: `src/app/globals.css`. Primary/on-primary, muted, border dekoratif, input yang kontras, destructive, success, warning, info masing-masing berpasangan foreground/background. Warna status selalu bersama teks. Light mode saja; tidak mengklaim dark mode teruji.

Skala ruang 4/8px; gutter 16px ponsel,24px tablet,32px desktop. Sidebar 264px desktop mulai1024px; drawer modal pada layar kecil. Konten maksimum1440px. Header tidak menghalangi fokus. Tombol/input44px default; ring2px + offset2px. H1 24–30px, section20px, body16px, metadata14px; line-height minimal1.5. Angka tabel tabular. Pesan panjang dan ID boleh wrap, tanpa menyembunyikan nilai penting.

## Pola reusable

- Shell akun: sidebar, drawer Radix, topbar, breadcrumb, pencarian navigasi berlabel, active link `aria-current`. Menu berdasarkan capability dari context server; penyaringan UI bukan otorisasi.
- Dashboard: kelompok layanan nyata, pencarian modul, identitas dan waktu sesi; tanpa metrik buatan.
- Form: label terlihat, penanda wajib, hint/error terhubung; pertahankan type, name, defaultValue, validasi dan payload. Form pendek boleh dialog; survei, transaksi dan alur kompleks tetap halaman.
- Dialog: Radix untuk trap/restore focus, Escape dan tombol tutup. Jangan hilangkan data draft tanpa konfirmasi. Tidak memaksakan migrasi semua native confirmation sekaligus.
- Tabel: wrapper scroll bernama dan dapat difokus keyboard, caption, scope kolom, header/hover terbaca; semua kolom bisnis tetap ada. Scroll hanya pada wilayah tabel, bukan seluruh halaman.
- Feedback: status hidup yang tidak kosong, label loading, empty dengan alasan scope/filter; error dengan pemulihan. Loading route tidak memakai metrik palsu. Error route tidak mengekspos rincian internal.

## Audit dampak sebelum implementasi

Inventaris baseline:36 file TSX di account; hanya Button/Card/Badge reusable, tanpa account layout. Semua page/API existing dibaca dalam inventaris; panel pendidikan/operasi/pembelajaran/layanan memakai kontrol dan layout berulang. Dokumentasi UI sebelumnya hanya provenance shadcn; tidak ada master design system atau audit UI khusus yang ditemukan.

Prioritas: navigasi berulang dan dashboard deretan tombol (tinggi); kontrol36px dan border input kurang jelas (tinggi); tabel scroll tanpa region keyboard/caption konsisten (tinggi); label/status/loading berbeda antarmodul (sedang); login sempit tanpa pengelompokan visual (sedang). Yang dipertahankan: teal, native input, skip link, autosave survei, konfirmasi destruktif, validasi server, bentuk ekspor dan seluruh data.

Risiko: shell menambah pembacaan context akses, perubahan global CSS berdampak luas, tabel panjang di ponsel perlu scroll terlokalisir. Uji source boundary, kontrast, lint/TS/build, pengujian domain dan browser fixture terisolasi; UAT akun produksi tidak diasumsikan tersedia. Hasil aktual dan batas bukti dicatat di laporan verifikasi.

Pencarian ikon `navigation education` lalu retry `search` sama-sama0 hasil. Lucide existing dipakai sebagai fallback aturan umum (tidak mengklaim kecocokan dataset). Pencarian `monthly attendance trend --domain chart` mengembalikan Trend Over Time/Line Chart dan tabel fallback; chart baru tidak diperlukan untuk perbaikan ini.
