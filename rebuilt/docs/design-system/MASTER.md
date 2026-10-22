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


## Pembaruan plass-ui dan navigasi sidebar — 21 Oktober 2026

Referensi terbaru: [jooy2/plass-ui](https://github.com/jooy2/plass-ui/tree/7f7a86c39931ca7b58d55c8c0f70897ea9359c7e), khususnya README, docs/en/design/design-language.md, color.md, dashboard demo, PlSidebar, PlButton, PlCard, internal/styles.ts dan styles.css. Lisensi MIT disertakan. Implementasi mengadaptasi bahasanya melalui komponen existing, tanpa memasang pustaka kedua atau menyalin contoh data toko.

Keputusan yang berlaku menggantikan pola navigasi dashboard sebelumnya: **sidebar adalah satu-satunya tempat navigasi modul** pada area akun. Dashboard menjadi ringkasan akun dan daftar layanan noninteraktif. Hilangkan kartu pintasan, topbar avatar-link, tautan breadcrumb, bar navigasi panel dan tombol/tautan Kembali yang mengarah ke tujuan sidebar. Tombol tindakan tetap ada. Pagination, detail rekaman spesifik dan unduhan bukan navigasi modul dan tetap tersedia. Login/pemulihan publik tetap mempunyai tautan karena belum memiliki sidebar.

Adaptasi material: permukaan konten kaca netral, gradasi135° teal-ke-biru pada kontrol yang ditekan, bayangan ringan, ikon Lucide per menu dan sidebar mengambang pada desktop. Teks pada kedua ujung gradasi harus memenuhi4,5:1. Input tetap44px dan kontras batas3:1. Kontrol tidak dipindah/diskalakan ketika ditekan. Backdrop blur dibatasi pada sidebar/topbar; tidak menambahkan pointer-bloom, drag sidebar atau animasi baru yang membebani aplikasi data. Fallback opaque untuk reduced transparency/tanpa backdrop-filter, forced-colors dan reduced motion dipertahankan.

Token tetap satu sumber di globals.css:primary-to,page-from/page-to,surface-glass/surface-shadow melengkapi token sebelumnya. Light mode saja. Brand teal tetap#125e64; endpoint baru#28597d. Bukan klaim pixel-identical Plass atau kepatuhan WCAG keseluruhan. Hasil verifikasi terbaru ada di docs/verification/plass-ui.md.


## Audit Dashboard — 21 Oktober 2026

Dashboard tetap berupa ringkasan akun dan inventaris layanan noninteraktif. Ikon tiap layanan memakai `NavigationIcon` yang sama dengan sidebar; tidak menambahkan KPI, chart, tautan modul, atau kontrak API baru. Tanggal menggunakan id-ID dan Asia/Jakarta; nilai tanggal yang tidak valid diganti teks tanpa elemen `time` yang menyesatkan. Tidak ada otorisasi berdasarkan jam browser.

Keadaan layanan dibedakan: daftar kosong yang sah, context tidak tersedia, dan context akses gagal dimuat sebagian. Kegagalan akses tidak menambah capability; halaman operasional tetap memeriksa akses server. Identitas lengkap boleh wrap di konten; nama pada sidebar yang ruangnya terbatas memakai ellipsis dan title, sementara nilai lengkap tetap tersedia pada ringkasan akun.

Drawer seluler menempel sisi kiri, mengisi tinggi viewport dinamis, memiliki menu yang menggulir sendiri, dan memakai header ringkas pada landscape pendek. Aturan geometrinya sengaja berada di luar layer CSS agar mengalahkan utility posisi tengah Dialog reusable. Saat viewport mencapai 1024px, drawer ditutup dan fokus kembali ke brand sidebar yang terlihat. Penutupan normal melalui Escape/tombol tutup mengembalikan fokus ke tombol menu. Listener breakpoint hanya hidup selama drawer terbuka dan selalu dibersihkan.

Dokumen hasil: `docs/verification/dashboard-audit.md`. Halaman panjang tetap menggunakan gulir vertikal normal; keberhasilan responsif berarti tidak ada horizontal overflow halaman atau konten/kontrol yang terpotong, bukan menghilangkan gulir vertikal yang diperlukan.

Untuk viewport sangat pendek (tinggi ≤300px, misalnya saat keyboard layar terbuka), body drawer bergulir sebagai satu wilayah sehingga pencarian dan logout tetap dapat dijangkau. Heading utama tetap tersedia bagi pembaca layar selama loading.


## Audit Notifikasi — 21 Oktober 2026

Notifikasi memakai panel khusus dalam router layanan existing. Satu pesan/satu kartu, dengan heading, isi yang mempertahankan baris baru, waktu id-ID/Asia-Jakarta dan badge tekstual dibaca/belum dibaca. Tanggal invalid tidak dirender sebagai `time`. Input tetap memakai `controlClass`, Button dan Status existing; warna identitas tidak diganti.

Kotak masuk merender 20 pesan per halaman secara lokal dari maksimum 200 pesan terbaru yang disediakan backend. Pencarian judul/isi dan filter status hanya berlaku pada daftar yang dimuat. Jumlah belum dibaca serta tindakan tandai semua tetap mencakup seluruh inbox milik pengguna, sebagaimana perilaku backend existing. Tidak menambahkan penghapusan, penandaan belum dibaca, atau navigasi modul dari kartu.

Satu request lock mencakup POST dan GET rekonsiliasi. Hanya respons `saved` disusul snapshot valid yang mengubah data layar. Jika POST berhasil namun GET gagal, feedback membedakan perubahan tersimpan dari daftar yang belum diperbarui; aksi tulis dikunci sampai GET berhasil. Hasil tulis ambigu juga wajib direkonsiliasi melalui GET; tidak ada retry POST otomatis. Request dibatalkan saat unmount. Pergantian user/revisi server mengganti instance panel agar state akun lama tidak dipertahankan.

Filter menyesuaikan lebar container, bukan hanya viewport; tombol dapat wrap pada pembesaran teks. CSS dibatasi pada `.notifications-panel` dan class inbox. Pagination/pencarian tidak membuat request server baru. Fokus kembali ke heading hasil ketika aksi menghilangkan tombol pesan dalam filter belum dibaca.

Rincian audit dan bukti: `docs/verification/notifications-audit.md` dan `docs/verification/notifications/`.


## Audit Direktori Pengguna — 22 Oktober 2026

Direktori tetap berupa halaman baca dengan filter GET dan pagination server 50 baris. Tindakan detail/biodata/relasi memakai URL rekaman spesifik, bukan pintasan modul. Tidak menambah CRUD, modal, atau request fetch client. Filter menggunakan TextField/SelectField/Button existing; tabel menggunakan TableRegion existing. Kontrol disusun menurut lebar container agar tetap usable saat sidebar aktif atau teks diperbesar.

Di area sempit, daftar memakai kartu; pada container ≥55rem, tabel ditampilkan. Keduanya membaca objek data server yang sama dan memakai komponen presentasi status/penugasan/detail yang sama. Hanya satu presentasi terlihat/focusable pada satu waktu. Progress native mempunyai label dan tetap menampilkan nilai 0%. Warna bar mengikuti teal identitas. Nama, username, kelas, kontak dan tombol panjang dapat wrap; tidak mengunci gulir vertikal halaman.

Filter invalid ditampilkan sebagai error, tanpa diam-diam membaca filter default. Pagination di luar rentang diarahkan ke halaman valid dengan filter tetap utuh; batas 2000 halaman existing tetap dipertahankan. UI non-admin dinormalisasi ke status aktif, sedangkan otorisasi data tetap sepenuhnya di backend. Link detail tidak diprefetch otomatis. Error layanan memakai boundary/reset existing; loading direktori memiliki heading dan status aksesibel.

Detail menampilkan nama peran dan tugas yang mudah dibaca, tanggal lokal, riwayat kelas, relasi, kontak/biodata yang memang dikembalikan server, serta JTM/istirahat tanpa mengubah nilainya. Kontak/student yang null tidak dibuat-buat. Schema detail dipusatkan untuk view dan validasi; metadata internal tahapan pengembangan tidak ditampilkan.

Bukti dan batas validasi: `docs/verification/directory-audit.md`, `docs/verification/directory/`.

## Audit Beranda publik — 22 Oktober 2026

Beranda `/` berbeda dari Dashboard `/account`. Halaman publik tetap statis, memakai Button/Card dan token warna/permukaan existing. Akses akun tetap melalui `/login`; verifikasi sesi, onboarding, survei dan RBAC berada pada alur server yang sama. Tidak menambahkan metrik, fetch pengguna, dependency aplikasi, maupun komponen interaktif tanpa kebutuhan.

Struktur heading adalah H1 pengantar → H2 layanan → H3 setiap prinsip. Tiga prinsip merupakan daftar semantik. Target skip link mempunyai tabindex=-1 agar fokus keyboard benar-benar berpindah ke main. Judul dokumen membedakan Beranda dari halaman akun.

CSS Module hanya mengatur Beranda: gutter mengikuti viewport, track grid minmax(0,...), anak flex/grid boleh menyusut, teks panjang membungkus, CTA boleh multiline. Ikon brand mempunyai ukuran tetap agar pembesaran teks tidak mengambil seluruh lebar. Header/kartu/footer tetap memakai token existing. Shell flex minimum 100dvh menempatkan footer di bawah pada layar tinggi; halaman panjang tetap menggunakan gulir dokumen biasa tanpa kontainer tinggi tetap atau overflow yang menyembunyikan konten.

### Login — audit 22 Oktober 2026

- Gunakan shell Login yang sama pada halaman dan loading; token warna, Card, Button, Status tetap mengikuti sistem existing.
- Lebar minimum kolom 0, wrapping teks, gutter responsif, kontrol sentuh minimal 44 px, serta scroll vertikal normal untuk viewport pendek/pembesaran teks. Jangan menyembunyikan konten untuk mengatasi overflow.
- Satu notice dengan prioritas password pending, password changed, expired, logout. Target skip link dapat difokuskan.
- Username peka huruf besar/kecil: nonaktifkan auto-capitalization, jangan trim/ubah case atau hapus minus.
- Fase form idle, submitting, success, uncertain harus jelas. Gunakan pengunci sinkron, fokus error/sukses, pemeriksaan sesi untuk hasil tak pasti, serta tautan native setelah sukses.
- Form memiliki method POST eksplisit. Tanpa JavaScript tampilkan bantuan dan sembunyikan form; password tidak boleh dikirim sebagai query URL.
- Bukti dan batas pengujian: `docs/verification/login-audit.md`.

### Bantuan akun — audit 22 Oktober 2026

- Kedua jalur `/recovery` dan `/recovery/email` memakai RecoveryShell, token dan komponen existing; tidak membuat sistem warna/komponen dasar baru.
- Form hanya satu mutasi aktif. Bedakan pending, diterima/sukses, error isian, dan hasil tidak pasti; jangan retry otomatis pada timeout/gangguan layanan.
- Reset berhasil membutuhkan kontrak destination yang terverifikasi dan fallback tautan native. Tahap kode mendapat fokus; error/sukses dapat difokuskan.
- Pertanyaan keamanan panjang memiliki teks lengkap di bawah dropdown. Kolom minimum 0, wrapping dan kontrol sentuh menjaga konten tetap dapat dijangkau pada mobile/teks besar.
- Form sensitif memiliki method POST eksplisit; tanpa JavaScript tampilkan bantuan petugas dan sembunyikan form. Jangan menaruh password/jawaban/OTP pada URL atau browser storage.
- Status pengiriman email tetap generik; UI tidak mengklaim kode terkirim kepada akun tertentu. TTL/cooldown/kuota/percobaan tetap ditentukan server.
- Bukti dan batas pengujian: `docs/verification/recovery-audit.md`.

### Detail pengguna — audit 22 Oktober 2026

- Detail merupakan tampilan baca. Scope kontak/biodata/relasi mengikuti RPC server; null tidak ditafsirkan sebagai izin baru.
- Grid dua kolom hanya ketika konten cukup lebar; seluruh section, record link dan footer tetap dapat dijangkau pada data panjang/teks besar.
- Status tugas harus membedakan aktif, belum berlaku, berakhir dan dicabut, menggunakan tanggal WIB. Tanggal kalender invalid memakai fallback, tanpa normalisasi diam-diam.
- Loading/error/unavailable memakai konteks detail, main yang focusable, serta breadcrumb dengan satu aria-current page. Error tidak menampilkan detail internal.
- Track sidebar serta ikon/gutter dekoratif tidak membesar tanpa batas ketika teks diperbesar. Pertahankan wrapping dan scroll vertikal normal; jangan menutupi overflow dengan pemotongan konten.
- Schema/page/API memakai satu loader tervalidasi. Bentuk respons sukses dan tujuan link record existing tetap kompatibel.
- Bukti dan batas pengujian: `docs/verification/user-detail-audit.md`.
