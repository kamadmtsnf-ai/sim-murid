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

## Kelas dan siswa — audit 22 Oktober 2026

- Kartu kelas memakai judul semantik, tahun ajaran, tingkat, wali, dan jumlah siswa sesuai scope server. Grid mengikuti lebar konten (satu kolom; dua mulai 40rem), bukan hanya lebar viewport.
- Form tahun memakai basis label 240px agar tombol membungkus ke baris berikutnya pada ponsel. Kontrol dan tindakan minimal 44px, teks panjang boleh membungkus.
- Modal kelas memakai Dialog yang sama; seluruh konten dapat digulir pada layar pendek dan pembesaran teks. Fokus kembali ke pemicu, Escape menghormati konfirmasi draft, dan feedback kesalahan berada di dalam modal.
- Daftar siswa memakai baris/kartu yang membungkus. Pemilih siswa memiliki gulir lokal maksimal 50dvh, pencarian mempertahankan pilihan, dan penempatan baru memerlukan tanggal serta konfirmasi perpindahan.
- Keberhasilan hanya ditampilkan setelah snapshot tervalidasi. Kegagalan tak pasti mengunci penyimpanan dan menawarkan muat ulang; tidak mengulang mutasi secara otomatis. Mode ini diaktifkan oleh Kelas serta Jadwal dan piket siswa.

## Tahun ajaran dan semester — 22 Oktober 2026

Seluruh label periode akademik menggunakan formatter bersama `src/lib/academic/period.ts`: `2026/2027`, `Ganjil` dan `Genap`. Input tahun ajaran berupa teks pasangan tahun (`2026/2027` atau `2026-2027`); dropdown relasional tetap memakai UUID. Kelas menampilkan kedua rentang semester, sedangkan penilaian dan survei menampilkan rentang semester terpilih dengan tahun kalender yang tepat. Tanggal formulir dibatasi oleh rentang itu dan direset saat periode berubah. Ekspor PDF/CSV/XLSX memakai label yang sama, termasuk ketika membaca snapshot lama yang menyimpan tahun awal numerik. Tahun kalender finansial/penerbitan bukan tahun ajaran.

## Jadwal dan piket siswa — tab dan modal, 22 Oktober 2026

- Radix Tabs dari dependency existing memisahkan Jadwal KBM dan Jadwal Piket. Heading, Card/Button/SelectField/TableRegion dan token tetap satu sistem. Tab mendukung panah/Home/End, aria-selected dan panel terkait.
- Setiap tab mempunyai tombol Input Jadwal KBM/Input Jadwal Piket sesuai izin. Input dan Edit KBM memakai LessonForm yang sama dalam Dialog existing; input piket memakai DutyForm existing. Form di-unmount saat ditutup dan hanya satu editor terbuka.
- Pilihan hapus dikosongkan ketika tab berubah; command hapus hanya memuat ID jenis jadwal pada tab aktif. Filter GET mempertahankan tab via view=kbm/piket. Tahun berpasangan, kelas mengikuti tahun, waktu mengikuti WIB.
- Tutup/Escape/Batal menghormati draf. Saat pending, modal tetap terbuka dan kontrol simpan terkunci. Sukses memerlukan snapshot tervalidasi sebelum menutup modal. Konflik/hasil tak pasti mempertahankan isian; feedback dan reload tersedia di dalam focus trap.
- Dialog mengembalikan fokus ke pemicu input atau Edit. Lebar modal mengikuti viewport dan tinggi maksimal 100dvh-32px; gulir vertikal modal membuat header, form dan tombol akhir tetap dapat dijangkau pada layar pendek.
- Sebelum render, revision kelas dan jadwal dari dua RPC harus sama. Snapshot campuran masuk retry boundary agar editor tidak menghapus penugasan dari roster/anggota yang tidak sinkron.
- Piket memuat seluruh tujuh hari dari duty_roster meskipun filter daftar satu hari. Penggantian/pengosongan dikonfirmasi; cleanup penugasan siswa nonaktif dijelaskan. Istirahat, deteksi benturan dan larangan melewati tengah malam dipertahankan.
- Tabel menggulir lokal, teks panjang membungkus, kontrol sentuh minimal 44px. Tidak menggunakan overflow hidden untuk menyembunyikan konten halaman.
- Bukti terbaru: docs/verification/schedules-tabs-audit.md; audit sebelum tab/modal tetap tercatat pada schedules-audit.md.

## Guru Piket — audit 22 Oktober 2026

- Gunakan DutyPanel khusus; panel operasi umum tetap menangani absensi, bimbingan, iuran dan tabungan. Hapus cabang formulir Duty lama agar tidak ada dua implementasi.
- Radix Tabs memisahkan jadwal mingguan dan riwayat. Jadwal dikelompokkan Senin–Sabtu; riwayat menampilkan tanggal, guru, jenis, status serta tindakan yang relevan, tanpa kolom keuangan.
- Dialog existing memuat konfirmasi utama, penunjukan pengganti, jadwal mingguan dan koreksi status. Hari lama diprefill ketika guru dipilih. Ganti guru/tutup modal menghormati draf; pending mengunci tutup/simpan; error dan reload berada dalam focus trap.
- Pilihan tindakan mengikuti status, tanggal WIB dan can_edit dari server. Catatan dibatalkan/historis tidak ditawarkan koreksi. Guru pengganti tidak boleh sama dengan guru yang digantikan; konfirmasi pengganti tetap terpisah.
- Simpan memakai mode confirmed bersama. Duty POST tetap memiliki result/message dan menambah data snapshot serta code untuk kompatibilitas hook. Hasil tak pasti/stale tetap terkunci sampai reload. Respons modul lain tetap sama.
- Filter riwayat hanya tahun kalender dan rentang tanggal yang benar-benar dipakai server, maksimum 366 hari. Input tanggal kosong dinormalisasi; view=history, pagination dan ekspor mempertahankan filter. Filter riwayat tidak mengubah roster mingguan.
- Nama panjang membungkus, kontrol sentuh minimal 44px, tabel menggulir lokal dan modal dibatasi viewport dengan gulir vertikal normal. Tidak menyembunyikan overflow halaman.
- Bukti: docs/verification/teacher-duty-audit.md; keterbatasan role UAT dan emulasi browser dijelaskan di sana.

## Absensi Siswa — 22 Oktober 2026

- Pisahkan konteks input batch, filter riwayat dan kalender. Katalog input tidak ikut menyempit ketika riwayat difilter; kalender harus menerima seluruh catatan satu siswa/bulan, bukan halaman tabel aktif.
- Kontrol status/catatan batch mempertahankan draf. Aksi massal hanya mengubah status. Tampilkan jumlah siswa dipilih; status kosong tidak dianggap Alpha. Simpan koreksi tidak menghapus draf input lain.
- Ringkasan memberi label dua denominator kehadiran, tahun kalender, hari efektif dan hari kosong. Gunakan tokens semantik existing, teks status eksplisit, responsive metric grid dan tabel dengan scroll lokal.
- Koreksi/void memakai Dialog existing, alasan wajib, konfirmasi pembatalan, focus trap/return focus, feedback dalam dialog dan pending dismissal guard. Lebar dibatasi viewport, tinggi maksimum 100dvh-32px dengan scroll yang dapat dijangkau; kontrol 44px.
- Penyimpanan confirmed: snapshot baru sebelum sukses, timeout 30 detik, konflik/hasil tak pasti meminta reload. Read/calendar error tidak ditafsirkan sebagai data kosong atau Alpha.

## Guru Wali dan bimbingan — 22 Oktober 2026

- Pisahkan penugasan replacement dari filter riwayat. Selected student IDs harus memuat seluruh penugasan awal, termasuk yang tersembunyi oleh search/katalog; pencarian tidak mengubah pilihan. Konflik mentor lain dilabeli dan tidak selectable; empty replacement meminta konfirmasi.
- Form hafalan dan perkembangan menampilkan field wajib sesuai jenis, tanpa menyisakan referensi hafalan pada payload perkembangan. Koreksi/void memerlukan alasan; void meminta konfirmasi dan tidak memerlukan field laporan lain yang sedang tidak valid.
- Gunakan Dialog dan semantic tokens existing; focus trap/return focus, feedback error di dalam modal, dirty/pending dismissal guard, kontrol 44px dan tinggi maksimum dalam viewport dengan scroll yang dapat dijangkau.
- Riwayat memakai kolom siswa/Guru Wali/jenis/aspek/predikat/catatan, filter tahun kalender/tanggal/siswa, empty state dan export sesuai scope. Penyimpanan confirmed dengan timeout, snapshot tervalidasi dan reload untuk konflik/hasil tak pasti.

## Iuran Komite — 22 Oktober 2026

- Pisahkan tahun bulan iuran, tanggal pembayaran dan filter riwayat. Alokasi controlled lintas tahun tetap terlihat beserta nominal/total, dan hanya dihapus melalui tindakan eksplisit. Koreksi tidak boleh menyusutkan alokasi mengikuti tahun filter.
- Status bulan harus berasal dari konteks lengkap siswa/tahun dengan revision yang sama, bukan halaman riwayat. Paid/waived terkunci kecuali alokasi milik transaksi yang dikoreksi. Context gagal/parsial tidak ditafsirkan unpaid.
- Bedakan kas, pembebasan Rp0, tarif nol, tarif belum ditetapkan dan tunggakan yang belum dapat dihitung. Uang masuk mengikuti tanggal pembayaran; rekap mengikuti bulan alokasi. Selalu tampilkan nilai rupiah integer tanpa membulatkan data yang tidak valid.
- Gunakan Dialog existing, konfirmasi tarif/void, alasan koreksi, dirty/pending guard, feedback dan fallback focus ketika baris hilang. Kontrol 44px, wrap, tabel scroll lokal, rekap paginated, modal maksimum viewport dengan footer terjangkau.
- Penyimpanan confirmed dan timeout/reload untuk hasil tak pasti. Ekspor mencantumkan alokasi lintas tahun; jangan memotong rekap diam-diam ketika batas ekspor terlampaui.

## Tabungan — 22 Oktober 2026

- Pisahkan katalog rekening input dari filter riwayat. Setelah pembukaan rekening, segarkan katalog pada revision yang sama sebelum sukses. Kategori S/G/N terpisah dari role; jangan menampilkan saldo katalog awal sebagai saldo terkini.
- Form transaksi/koreksi mempertahankan rekening asal, gross, jenis, tanggal dan flag biaya immutable. Fee nol tidak sama dengan biaya nonaktif. Quote server hanya berlaku pada nominal dan flag yang sama; perubahan input menyembunyikan quote lama.
- Bedakan saldo keseluruhan, mutasi bersih signed, setoran/penarikan aktif periode serta transaksi pembalik. Tampilkan gross/biaya/tunai dengan rupiah integer; biaya tidak didebit dua kali.
- Tarif punya minimum/maksimum inclusive, persentase presisi empat desimal, status aktif dan alasan koreksi. Jangan mengaktifkan tarif nonaktif ketika dibuka untuk koreksi.
- Gunakan Dialog dan kontrol existing, dirty/pending guard, focus return/fallback, feedback lokal, controls 44px dan scroll dalam viewport. Rekening searchable/paginated; ledger scroll lokal tanpa page overflow.
- Semua penyimpanan confirmed; stale/uncertain meminta reload. Slip memiliki aksi baca/unduh/cek status/kirim terpisah. Sending/ambiguous tidak diulang otomatis; status SMTP accepted tidak menjamin penerimaan inbox atau pencatatan database berhasil.

## Poin Siswa — 23 Oktober 2026

- Pisahkan bulan laporan, filter kelas, pencarian tampilan dan katalog siswa pencatatan. Katalog mengikuti enrollment bulan yang dipilih serta cakupan akses, tetapi tidak menyempit mengikuti filter kelas/siswa laporan. Konteks ganda wajib bulan/revision sama.
- Saldo/level/pengali berasal dari replay server. Tampilkan sebelum/sesudah/delta, status arsip dan R02/R03 secara eksplisit; R03 bukan pengeluaran siswa otomatis. Riwayat memakai deskripsi/konsekuensi snapshot saat kejadian dicatat.
- Modal khusus kejadian/katalog/pengaturan/arsip/cancel menggunakan Dialog existing, controls 44px, dirty/pending guard, return/fallback focus dan scroll dalam viewport. Riwayat scroll lokal, siswa searchable/paginated.
- Katalog mendukung poin negatif dan status nonaktif. Kode asal terkunci ketika edit. Mapel afektif tersimpan yang tidak lagi aktif harus tetap terlihat dan tidak boleh dihapus diam-diam saat pengaturan lain disimpan.
- Pembatalan mengikuti admin atau pembuat yang masih dapat mencatat dan belum diarsipkan; alasan dan konfirmasi wajib. Arsip/sinkronisasi menyebut bulan/tindakan, added 0 tetap ditampilkan. Pencarian lokal tidak mengubah cakupan ekspor tanpa pemberitahuan.
- Write confirmed, timeout dan reload untuk hasil tak pasti. Read gagal mempertahankan snapshot, konteks bertentangan ditolak. Sertifikat kosong memberi pesan yang jelas; PDF membungkus token panjang tanpa keluar halaman.

## Penilaian dan KKM — 23 Oktober 2026

- Konteks koreksi selalu mengikuti assessment asal: kelas/mapel/tahun/semester/jenis, bukan filter laporan. Muat konteks tervalidasi pada revision sama; gagal/mismatch tidak boleh membuka koreksi kosong yang bisa disimpan.
- Bedakan 0, null/belum diisi, KKM 0 dan default75. Nilai/draf controlled per UUID; search/pagination formulir tidak menghapus nilai tersembunyi atau score asal di luar katalog.
- ATS/ASAS/Praktik existing diperlakukan sebagai koreksi dengan prefill, ID asli dan alasan, bukan form baru kosong. PH memakai nomor server dan tidak dipakai ulang setelah void.
- KKM periode digunakan untuk penilaian baru dan rapor draf; snapshot penilaian lama dan rapor terbit tetap. Jangan mengubah bobot PH20/ATS30/ASAS50, Praktik terpisah, atau menetapkan kebijakan D10 lewat perubahan visual.
- Gunakan Dialog existing dengan scope terlihat, konfirmasi overwrite/void, dirty/pending guard, focus return/fallback, controls 44px dan footer terjangkau. Tabel scroll lokal, teks wrap, riwayat/input memiliki pagination terpisah.
- Siswa filter membatasi laporan; katalog input lengkap per kelas/periode tetap. Read gagal mempertahankan data; write confirmed dengan timeout dan reload untuk hasil tak pasti.

- Pada formulir penilaian berhalaman, validasi rentang/desimal harus meliputi seluruh draf, bukan hanya input yang sedang terpasang di DOM. Kolom pencarian tampilan tidak menandai draf berubah atau mengirim formulir saat Enter.

## Rapor dan favicon — 23 Oktober 2026

Rapor memakai panel khusus dengan kelas/tahun ajaran + semester sebagai scope yang baru diterapkan setelah read berhasil. Ringkasan status, pencarian/status, pagination 10 siswa dan pilihan eksplisit menghindari penerbitan seluruh kelas tanpa sengaja. Bedakan Terbit, Draf siap terbit, Draf belum lengkap dan Tidak tersedia. Jenis Gabungan/PH/ATS/ASAS/Praktik memengaruhi tabel dan PDF; nilai 0 tetap tampil. Tabel memakai scroll lokal berlabel, nama panjang wrapping. Modal penerbitan memuat daftar target dan acknowledgement; pending/uncertain mencegah penutupan/retry sampai hasil diperiksa. `.reports-dialog` scroll penuh dalam batas viewport. Favicon `app/icon.svg` memakai glyph sekolah putih di teal, selaras WorkspaceShell dan otomatis disajikan oleh metadata Next.

## Kenaikan dan ijazah — 23 Oktober 2026

PromotionsPanel memisahkan pemetaan siswa, alumni/dokumen, dan policy akses. Kenaikan memakai tahun ajaran berpasangan, tujuan eksplisit dan kelas aktif yang sesuai tahun/jenjang; placeholder tidak boleh berarti kelulusan. Pertahankan seluruh pilihan lintas pencarian/pagination20, validasi seluruh batch sebelum konfirmasi. Kartu menampilkan ringkasan nomor/tahun/nilai; rincian10 field lain tersedia melalui details native yang dapat dibuka dengan keyboard. Metadata13 field dibuka dari alumni tertentu, tidak memakai dropdown target dengan defaultValues lama. Scope akses global/individual ditampilkan terpisah; view/download independen, allow/deny/inherit eksplisit. Upload/replace/delete memakai modal konfirmasi/status dan readback, dengan recovery reload untuk hasil tak pasti. `.promotions-dialog` scroll penuh di dalam viewport, teks panjang wrapping dan kontrol44px. Read-only hanya dokumen sesuai capability. Jangan menimpa arsip atau mengubah rule kenaikan, default deny alumni baru, signed upload/content inspection dan authorization server.

## Audit Buku Digital — 23 Oktober 2026

Katalog buku memakai kartu metadata dan badge tekstual Umum/Premium, PDF/Sumber eksternal/Belum ada berkas. Form tambah/edit dan unggah berada pada Dialog Radix existing, dengan draft guard dan feedback pending/error/saved/uncertain. Judul panjang memiliki ringkasan dengan disclosure judul lengkap; tidak memotong akses ke metadata. Tahun terbit tetap tahun kalender. Filter dan pagination tetap di server (50 buku/halaman) serta tunduk pada izin premium.

Reader mempertahankan mode halaman/gulir/native, zoom, navigasi dan fallback URL lama. Canvas menyesuaikan lebar container melalui ResizeObserver dan gulir hanya terjadi di area dokumen yang dapat difokus keyboard. PDF.js dimuat saat buku dibuka; halaman mode gulir dirender mendekati viewport dengan batas resolusi canvas. Rule CSS hanya `.books-*`/`.book-*`; identitas teal, token semantik, kontrol 44px, shell dan navigasi sidebar tetap sama.

Rincian audit dan batas bukti: `docs/verification/books-audit.md` serta `docs/verification/books/`.

## Audit Survei — 23 Oktober 2026

Survei panjang tetap di halaman, dengan kartu periode, indikator wajib, progress dan 10 pertanyaan per halaman. Formulir periode mempertahankan kontrol tahun ajaran/semester dan menampilkan pertanyaan mikro hanya untuk tipe mikro. Pengisian peer memakai disclosure per rekan; enam dimensi wajib, TT sah, PTS-7 opsional. Final dan periode tertutup tersedia untuk review read-only. Tombol tutup jawaban mempunyai draft guard.

Status membedakan perubahan menunggu sinkronisasi, storage tidak tersedia, draft tersimpan, final, konflik dan hasil ambigu. Canonical draft utama/peer tidak dibersihkan oleh acknowledgement request lama. Timer/listener dibersihkan dan logout dari shell menghapus cache Survei tanpa menyentuh preferensi lain. Styling dibatasi pada Survei; padding nested form dikurangi pada ponsel, kontrol 44px, teks wrap dan progress memakai token existing. Instrumen/rotasi/revisi server tetap menjadi sumber kebenaran.

Bukti dan batas verifikasi: `docs/verification/surveys-audit.md`, `docs/verification/surveys/`.

## Audit Hasil Survei — 23 Oktober 2026

Hasil Survei memisahkan pilihan filter dari scope yang sudah terkonfirmasi. Perubahan scope dan hasil ambigu mengunci tindakan sampai reload; loading/error/empty memiliki pesan yang berbeda. Responden berada pada disclosure dengan pagination 20; tabel tetap memakai region scroll lokal. Catatan dan status memakai key periode/isi, rencana aksi memuat isian tersimpan dan mengikuti tanggal server. Kontrol tetap minimal 44px dan layout form bertumpuk di ponsel.

Hasil AI menggunakan judul tema, daftar rekomendasi dan blockquote, bukan JSON mentah. OpenAI (ChatGPT), Anthropic dan Gemini memakai konfigurasi admin yang sama; API key tidak ditampilkan ulang. Analisis seluruh periode diberi keterangan agar tidak disalahartikan sebagai hasil filter. Bukti dan batas verifikasi: `docs/verification/insights-audit.md` dan `docs/verification/insights/results.json`.

## Audit Pengaturan Madrasah — 23 Oktober 2026

Pengaturan mempertahankan empat bagian: profil/logo, mata pelajaran, hafalan dan hari libur. Navigasi berupa tombol aria-pressed dan mendukung keyboard native. Form panjang tetap di halaman; input dan aksi memiliki target sentuh 44px, layout file bertumpuk di ponsel, teks panjang wrap, dan tabel memakai TableRegion existing. Master dan hari libur dapat dicari serta dipaginasi 20 baris.

Status membedakan sedang memuat/menyimpan, hasil terkonfirmasi, validasi gagal dan hasil ambigu yang memerlukan reload. Reset hanya terjadi pada formulir yang tersimpan; draft profil tetap utuh saat logo diunggah. Pergantian bagian/edit/reload memiliki guard isian. Hasil simpan memerlukan acknowledgement dan pembacaan balik yang sesuai, bukan sekadar HTTP 200. Bukti dan batas verifikasi: `docs/verification/settings-audit.md` serta `docs/verification/settings/results.json`.

## Audit Relasi Keluarga — 23 Oktober 2026

Relasi orang tua dan grup saudara kandung tetap dua bagian terpisah. Identitas ditampilkan dengan nama serta username, hubungan memakai label Ayah/Ibu/Wali. Referensi di luar katalog aktif diberi keterangan dan tidak dihapus otomatis. Selection anggota terpisah dari pencarian, dengan ringkasan terpilih serta batas 30 anggota. Daftar relasi/grup dibuka saat dibutuhkan, dengan jumlah data tetap terlihat, pencarian dan pagination 20 baris; teks panjang wrap, kontrol 44px, roster scroll lokal, Card dan Status menggunakan komponen existing.

Feedback membedakan pending, hasil terkonfirmasi dan hasil ambigu yang memerlukan GET ulang. Reset formulir terarah menjaga draft bagian lain. Konfirmasi pemindahan/pengeluaran anggota menjelaskan dampak iuran. Bukti dan batas verifikasi: `docs/verification/families-audit.md`, `docs/verification/families/results.json`.

## Pemulihan Akun

Antrean Admin memisahkan daftar permintaan dari verifikasi/tindak lanjut. Gunakan search/filter/pagination, identitas nama+username, label jenis Password/Sesi dan timestamp WIB. Akun sendiri dan permintaan kedaluwarsa tidak dapat diproses. Konfirmasi menyebut target dan dampak pencabutan sesi. Secret sementara memiliki panel penerima tersendiri; mutasi/refresh terkunci sampai penyerahan dikonfirmasi. Hasil ambigu membutuhkan refresh GET tervalidasi, tanpa retry mutasi otomatis. Kontrol min44px, teks/action wrapping dan padding responsif memakai token existing.

## Pekerjaan

Pisahkan kesiapan konfigurasi, tindakan, antrean pengiriman dan riwayat job_runs. Status memakai label Indonesia, waktu WIB, saluran dan jumlah percobaan; daftar 200 outbox/100 riwayat harus dinyatakan sebagai subset terbaru. Search/filter/pagination10 hanya pada antrean, riwayat disclosure native dengan scroll keyboard. Semua tindakan berbagi lock, feedback/focus dan konfirmasi side effect. Status sent berarti penerimaan penyedia; ambiguous/unconfirmed memerlukan pemeriksaan tanpa retry otomatis. Konfigurasi hanya boolean dan tidak mengklaim konektivitas. Token/Card/Button/Status existing, kontrol44px, wrapping dan padding responsif.

## Rekonsiliasi

Pisahkan ringkasan global dari filter paket ekspor. Gunakan label metrik Indonesia, rupiah untuk saldo, nilai nol yang eksplisit, dan status ketersediaan sumber yang tidak mengklaim pencocokan selesai. Form inline berisi rentang operasional, bulan SPK dan kelas dengan label tahun ajaran; bulan SPK dinormalisasi ke tanggal1. Unduhan di halaman sama memiliki lock/loading/error/focus, pemeriksaan MIME/signature dan cleanup Blob URL. Refresh mempertahankan draft; kelas yang hilang tidak boleh memperlebar cakupan diam-diam. Card/Status/Button/token existing, h2/dl/fieldset/legend semantik, kontrol44px dan wrapping mobile.

## Biodata dan dokumen — 23 Oktober 2026

Gunakan navigasi bagian 2/3/6 kolom sesuai lebar, label eksplisit, input 44 px, dan grid form 1/2 kolom. Kelengkapan adalah snapshot tersimpan; draf ditandai terpisah dan tidak dipaksa lengkap. Error lintas bagian membuka bagian input terkait dan mengarahkan fokus. Dokumen memakai kartu dengan status ready/pending/deleting, nama berkas wrapping, pratinjau terbatas viewport dan area gulir gambar yang dapat difokuskan. Refresh dan retry mempertahankan isian ketika gagal. Lihat `../verification/biodata-audit.md` dan hasil pengujian terkait.

## Profil pribadi — 23 Oktober 2026

Editor profil sendiri memakai kartu satu kolom dengan header grid minmax(0,1fr), username wrapping, form 1/2 kolom dan input 44 px. Field opsional dijelaskan; bio mempunyai hitungan karakter. Error menunjuk field dan fokus pertama. Tampilkan dirty state; refresh meminta konfirmasi sebelum membuang isian. Hasil simpan belum pasti harus diperiksa melalui GET dan tidak boleh otomatis mengirim ulang penulisan. Pesan pembatalan verifikasi email hanya muncul ketika email benar berubah. Lihat `../verification/personal-profile-audit.md`.

## Verifikasi email — 23 Oktober 2026

Kartu kontak memakai header grid minmax(0,1fr) dan email wrapping. Bedakan status verified, belum ada kode, queued, accepted, failed, expired dan locked. Kode memakai input teks 6 digit (nol awal tetap ada), numeric keyboard, one-time-code, label, error/fokus dan paste terkontrol. Jangan menghapus kode ketika permintaan gagal. Countdown tidak memakai live region per detik. Kirim/verify dikunci sampai state terbaru diperiksa ketika hasil belum pasti; tidak boleh otomatis mengirim ulang OTP. CTA sentuh 44–48 px dan tombol countdown wrapping. Lihat `../verification/email-verification-audit.md`.

## Akses Verifikasi email — 24 Oktober 2026

Menu Verifikasi email tersedia untuk seluruh pemilik akun. Akun yang sudah menyelesaikan password, biodata wajib dan pertanyaan keamanan dapat memverifikasi email kontaknya; kewajiban verifikasi tetap khusus Guru. Jika syarat belum terpenuhi, tampilkan penjelasan di halaman yang sama tanpa redirect otomatis ke Keamanan akun. Status verified selalu berasal dari bukti email aktual, bukan gate ready. Rincian: `../verification/email-verification-access-fix.md`.

## Keamanan akun — 24 Oktober 2026

Form password dan pertanyaan tetap terpisah dengan lock bersama. Gunakan ringkasan gate yang menjelaskan langkah berikutnya melalui sidebar, Card existing, heading h1/h2, input44px, padding responsif dan wrapping identitas. Pesan validasi terhubung ke field; error summary mendapat fokus setelah proses selesai. Bedakan label penyimpanan tiapform. Respons401 diarahkan ke login sebelum JSON diproses; hasil ambigu menonaktifkan mutasi sampai status GET tervalidasi, tanpa retry otomatis atau membuang draft. Secret dibersihkan hanya setelah acknowledgement sukses atau logout. Error halaman mempunyai retry dan loading memakai live status. Bukti/batas: `../verification/account-security-audit.md`.

## Sesi dan perangkat — 24 Oktober 2026

Riwayat memakai Card responsif dan metadata WIB, label Aktif/Berakhir/Dicabut, penanda sesi saat ini, serta keterangan subset20 terbaru. Pencarian Admin exact mempertahankan nol awal/minus; akun yang ditampilkan harus berbeda jelas dari draft username. Konfirmasi memakai Dialog existing dengan target akun/perangkat dan dampak keluar; seluruh sesi berarti seluruh akun, bukan hanya subset layar. Fokus kembali saat cancel dan close/cancel dinonaktifkan selama mutasi. Polling tidak berjalan selama konfirmasi/pencabutan. Hasil ambigu memerlukan list tervalidasi tanpa retry mutasi otomatis. Gunakan input44px, wrapping identitas/device, min-w-0 dan scroll dialog terbatas viewport. Lihat `../verification/sessions-audit.md`.

## Hak akses saya — 24 Oktober 2026

Inventori izin bersifat read-only. Pisahkan peran, penugasan aktif dan daftar jenis izin; scope all/own/class harus eksplisit dan kelas berbeda harus tetap dapat dibedakan. Nama/tingkat/tahun ajaran kelas dibaca melalui RLS pengguna; jika tidak tersedia pertahankan rujukan kelas, tanpa mengasumsikan akses global. Kelompokkan capability sambil mempertahankan semua scope, gunakan search/filter lokal, pagination10, counter serta empty state terpisah. Label native select menggunakan htmlFor yang terpisah dari kontrol. Kontrol44px, wrapping, min-w-0 dan disclosure penugasan mendukung mobile/keyboard. Refresh mengganti snapshot dan mengabaikan respons setelah unmount; error memberi label data terakhir. Tidak ada editor izin atau tautan navigasi tambahan. Bukti/batas: `../verification/access-audit.md`.

## P02 — Kontrak komponen bersama, 24 Oktober 2026

Bagian ini memperinci standar reusable terbaru di atas token dan primitive existing; tidak membentuk design system kedua. Laporan: [P02](../development/STAGE-02-DESIGN-SYSTEM.md).

- `Field` menyusun label terlihat, kontrol caller, hint dan error. Caller memberi ID unik, required, aria-invalid serta `fieldDescriptionIds` yang sesuai konten. Jangan membungkus select di label atau menghubungkan describedby ke elemen yang tidak dirender. `fieldControlClass` berasal dari CSS semantik tunggal, ukuran minimal 44px.
- `FilterBar` adalah fieldset bernama. `Pagination` memakai nilai one-based dan tombol native type=button; data/fetch/slicing/fokus tetap domain. Jangan mengasumsikan jumlah subset yang dimuat sebagai total server.
- `Status` tetap satu komponen feedback; tone info/success/error/warning/pending selalu disertai teks. Warning untuk hasil yang perlu diperiksa; pending bukan konfirmasi berhasil. Ref/tabIndex dipakai bila alur existing perlu fokus; tidak menambahkan retry write otomatis.
- `EmptyState` memakai judul h3 di bawah section dan alasan sesuai data/filter. `LoadingState` mempunyai status teks dan skeleton aria-hidden; tanpa metrik palsu.
- `.ds-actions` menata tombol wrap yang minimal 44px pada area adopsi. Button/Card existing tetap dipakai; tidak mengganti style global semua tombol pada tahap pilot.
- TableRegion dan Dialog Radix tetap satu implementasi. Tabel memakai caption/scope dan scroll lokal bernama; dialog menangani fokus/viewport serta wrapping judul di portal. Jangan mengubah form panjang menjadi modal hanya demi konsistensi visual.
- Pilot: Hak akses saya (read-only) dan Profil pribadi (mutasi). `domain-controls.tsx` adalah adapter legacy; migrasi lain dilakukan per modul pada P05. Validasi, state dan kontrak API tidak dipindahkan ke komponen presentasi.

Token warna, font, border/input dan reduced motion existing dipertahankan. Token ukuran kontrol, gap field dan gap koleksi berada hanya di `globals.css`. Penerimaan memerlukan 320/390/768/1440 px, keyboard, touch, landscape, empty/loading/error, field validation, dan regresi bisnis; hasil aktual ada pada laporan P02.

## P03 — Pilihan akademik dan konteks diterapkan

Topbar menyebut **pilihan tersimpan**, bukan menyatakan semua modul disaring. Disclosure pada Kelas/Jadwal/Nilai/Rapor menyebut konteks halaman yang benar-benar diterapkan. Ingat/Terapkan/Hapus adalah tindakan pada halaman sama, bukan navigasi modul tambahan.

Penerapan lintas halaman eksplisit agar reload, Back atau tab lain tidak mengganti draf. Nilai tersimpan dicek dengan katalog berizin; kelas hilang tidak diganti semua kelas. Error read mempertahankan scope lama. Kontrol dependen reset hanya setelah GET sukses. Modal aktif memblokir transfer; penempatan/pilihan rapor memakai konfirmasi existing.

Ganjil/Genap dan tahun berpasangan tetap helper tunggal. Tanggal kalender transaksi, periode Survei ber-ID, dua sisi kenaikan, tahun lulus/terbit tidak dipaksa mengikuti preferensi. Penyimpanan lokal yang tidak tersedia diberi penjelasan. Lihat [laporan P03](../development/STAGE-03-ACADEMIC-CONTEXT.md).


## P04 — Feedback penyimpanan dan perlindungan isian

`useDomainMutation` membedakan pending, success, error yang dapat dikoreksi, blocked dan uncertain. Success memerlukan acknowledgement yang konsisten dan snapshot revisi meningkat. Jangan mengubah uncertain menjadi error biasa atau membuka submit melalui clear pesan. Timeout/aborted fetch bukan bukti rollback.

Shell memakai `FormNavigationGuard`: proses aktif memblokir link akun/logout; isian belum disimpan meminta konfirmasi. Pemberitahuan warning dapat difokuskan dan ditutup tanpa membuka lock proses. Existing dialog tetap memegang focus trap/validasi/domain readback. Listener unload beradaptasi lewat `listenForUnsavedChanges`; controller khusus mengekspos boolean pending/dirty melalui `useWriteGuard`. Tidak menyalin password/OTP/dokumen/transaksi ke draf generik. Batas browser Back SPA dan pemulihan crash dicatat di [laporan P04](../development/STAGE-04-RELIABLE-FORMS.md).


## P05A — Navigasi dan kontrol domain

Sidebar menerima menu berizin dari server, lalu filterNavigation hanya menyaring array tersebut. Pencarian memahami kelompok/alias tugas dan semua kata. Label search terpisah dari tombol clear; Escape pertama menghapus query, berikutnya menutup drawer. Menu aktif digulirkan dalam sidebar/drawer sendiri.

TextField/SelectField legacy menjadi adapter Field P02 dengan ID useId dan token ds-field-control; name/defaultValue/validasi native tetap. Halaman lain tidak membuat design system paralel. Laporan rollout: [P05](../development/STAGE-05-NAVIGATION-UX.md).


## P05B/C — Koleksi dan state antarmodul

FilterBar dipakai Kelas/Jadwal serta form filter riwayat operasional; caller tetap memegang handler/disabled/filter/payload. Pagination one-based dipakai pada koleksi operasional, akademik, evaluasi, notifikasi dan jobs. Prop previousLabel/nextLabel/summary opsional mempertahankan konteks domain. Gunakan “Halaman x dari y”; jumlah data adalah total dari scope caller. Link GET guru piket tetap link, tidak diganti mutasi atau fetch client.

LoadingState dan error boundary memakai komponen existing, retry Next dan pesan aman. EmptyState tidak menyamakan “belum ada data” dengan “tidak berizin”; penjelasan scope domain dipertahankan. Tabel memakai TableRegion existing dan tidak menyembunyikan kolom bisnis. Pager pertanyaan Survei, batch siswa dan PDF tetap khusus untuk menjaga autosave/dirty/final/reader. Laporan dan matriks rollout ada pada P05.

## P06 — ringkasan beranda sesuai peran

Beranda `/account` memakai Card, Status, Button dan token existing. Ringkasan selalu menyertakan periode dan sumber; kegagalan sumber menghasilkan nilai tidak tersedia, bukan nol. Prioritas bersifat informasi dan mengarahkan melalui sidebar. Snapshot lama diberi waktu pembaruan; akses kedaluwarsa/pergantian akun menghapus data operasional. Grid satu kolom mobile dan agenda dapat wrapping. Lihat laporan P06 dan bukti `docs/verification/overview`.

## P07 — pusat tindak lanjut

Notifikasi memakai tab Radix Kotak masuk/Tindak lanjut, filter dan pagination existing. Kedua panel dipertahankan saat berganti tab; panel tidak aktif disembunyikan. Card menampilkan modul, urgensi, status, penanggung jawab dan target sumber. Target tidak diketahui ditulis eksplisit; status tidak tersedia berbeda dari selesai. Fokus hasil setelah refresh/pagination hanya diarahkan ke panel terlihat. Preferensi tampilan per akun/perangkat tidak mengubah kanal kiriman atau pengamanan wajib. Komponen mengikuti grid satu kolom mobile/dua kolom desktop dan wrapping konten panjang.

## P08 — wizard input massal

Modal reusable mengikuti unggah/validasi/pratinjau/konfirmasi/hasil, dengan template CSV, referensi berizin dan tabel dalam region gulir lokal. Konfirmasi eksplisit dibatalkan saat konteks/berkas berubah; field dikunci pada pending/uncertain dan pemulihan memakai ID yang sama. Label textarea stabil; CSV/nilai tidak masuk localStorage. Modal dibatasi viewport dengan body gulir; operasi lama dipertahankan. UI baru hanya tersedia setelah RPC siap.

## P09 — Riwayat Admin

Bagian Rekonsiliasi memakai filter modul, cursor pagination 25, shared Dialog baca-saja dan TableRegion lokal; skor 10 baris per tampilan. Waktu WIB/nama pelaku saat ini/UUID stabil; data historis yang tidak tersedia disebut eksplisit. Jangan mencetak payload JSON atau teks alasan bebas pada audit. Loading/error/denial membersihkan hasil lama; tanpa penyimpanan browser. Tidak menampilkan status approval/reopen fiktif atau tombol navigasi konten baru.

## Modal dan feedback — 25 Oktober 2026

Gunakan Dialog bersama untuk formulir/detail dan confirmAction untuk keputusan. Header dan close tetap terjangkau; gulirkan body, bukan seluruh panel. CloseDisabled berlaku untuk X dan Escape selama proses. Pertahankan native validation, dirty guard dan restorasi fokus. Jangan menutup modal atau menghapus isian hanya untuk menampilkan sukses.

Feedback menampilkan judul status, pesan domain, lalu langkah berikutnya bila perlu. Status/tone ditentukan hasil eksplisit, tidak ditebak dari teks. Gunakan MutationFeedback dengan phase existing untuk alur mutasi; unknown/uncertain bukan gagal definitif, sehingga tidak boleh menyarankan kirim ulang tanpa pemeriksaan hasil. Jangan otomatis menghilangkan pesan penting. Konfirmasi berisiko memakai label aksi spesifik; default lama tetap kompatibel. Lihat `../development/MODAL-FEEDBACK-UPGRADE.md` untuk lingkup dan bukti pengujian.

## Shell navigasi — 25 Oktober 2026

Navbar menyatakan lokasi aktif; sidebar menyaring menu dari izin server dan pencarian tidak menambah cakupan. Drawer/search mengikuti pathname termasuk Back/Forward. Header/footer mengikuti alur konten; jangan menghitung tinggi konten dari asumsi header tetap. Pada jendela pendek, seluruh sidebar dapat digulir supaya identitas dan Logout tetap terjangkau. Jaga fokus pencarian saat active-item auto-scroll. Menu kosong, tidak ada hasil pencarian dan status izin belum terverifikasi harus dibedakan. Lihat `../development/WORKSPACE-SHELL-AUDIT.md`.

## L03 — Kontrak koleksi dan filter

- `collection-summary.tsx`: tampilkan rentang hasil dan filter **yang sudah diterapkan**, bukan isian draft. Caller tetap menentukan cakupan data; komponen tidak fetch, mengubah izin atau menyaring ulang.
- `collections/presentation.ts`: proyeksi halaman one-based dibatasi ke range valid, hasil kosong 0–0, hitungan invalid tidak diklaim sebagai data tersedia.
- `Pagination` dan `LinkPagination` memakai proyeksi yang sama: callback untuk koleksi client, URL GET kanonis untuk koleksi server. Fetch/slice tetap milik domain. Anchor/button memakai aturan responsive yang sama.
- Urutan tampilan dapat disimpan per akun sebagai enum. Jangan simpan query/nama, class_id, relasi atau grants dalam preferensi. Hanya urutkan hasil yang sudah scoped saat ini.
- Reset filter server tidak boleh mengosongkan field lalu meninggalkan hasil lama saat request gagal. Sinkronkan form/ringkasan setelah readback berhasil; paging tidak menghapus draft pencarian.
- Ekspor harus menjelaskan apakah seluruh hasil atau hanya halaman saat ini. Direktori menyediakan admin-only “Ekspor halaman ini”; tidak fetch baris tambahan atau menambah cakupan data. Username tetap teks pada XLSX.
- Sticky header/kolom tetap sesuai kebutuhan tabel existing; jangan menerapkan global sticky pada card/mobile atau mengubah kontrak pagination domain.

## L04 — Feedback penyimpanan berbasis bukti

MutationFeedback menentukan tone hanya dari MutationPhase; caller tidak boleh menimpa tone. Pesan domain dan hint tindakan berikutnya dipisahkan. Hook transition memperbarui keduanya dari kode/status eksplisit melalui mutationGuidance, bukan regex pesan terjemahan. Error korektif berbeda dengan stale/permission dan uncertain. HTTP408, jaringan/timeout/5xx atau acknowledgement tidak valid bukan bukti rollback: jangan auto-retry atau membuka lock. Hindari meminta pengguna menyalin isian sensitif; pertahankan halaman dan jelaskan risiko kehilangan draft saat reload. Success hanya untuk hasil terkonfirmasi sesuai kontrak domain.

## L05 — Orientasi sidebar

Kelompok halaman aktif diberi teks penanda dan deskripsi aksesibel pada header accordion, tanpa membuka kelompok otomatis. Label tombol stabil, expanded/controls akurat, ID panel unik per surface. Browse expansion dipertahankan; search expansion hanya milik query saat ini. Hasil pencarian menyatakan cakupan izin; empty state menawarkan tindakan jelas. Deteksi current item di shell menggunakan navigation scoped yang sudah disediakan server. Tidak mempersist query atau hak akses dan tidak menciptakan link dari hasil pencarian di luar daftar yang diizinkan.

## L07 — Kesehatan aplikasi admin

Pusat kesehatan read-only memakai kartu/metrik dan timestamp WIB. Unknown dibedakan dari nol; tidak memakai warna sehat untuk sumber gagal atau belum tersedia. Konfigurasi provider, penerimaan provider dan kotak masuk adalah bukti berbeda. Sampel terbaru diberi batas200/100; angka bukan seluruh backlog. Backup/restore tanpa bukti tetap belum dapat diverifikasi. Refresh GET, tanpa retry otomatis atau navigasi konten yang menduplikasi sidebar. Loading/error/partial memakai pola existing dan whitelist server menjaga data sensitif.

## L08 — Kualitas impor Excel

Pisahkan validasi format, validasi sumber, konfirmasi dan hasil tersimpan. Persentase valid menyertakan pembilang/penyebut dan cakupan pemeriksaan. Error menyebut kolom dan langkah koreksi, tanpa menggemakan data pribadi. Laporan hasil/kesalahan bebas password terpisah dari kredensial sementara; unknown/pending tidak diklaim tersimpan. Konfirmasi semua batch pengguna tetap menonjolkan kewenangan Admin. Ekspor gagal dapat dicoba lagi tanpa menghapus draft atau mengirim ulang mutasi.

### L09 — Pemuatan panel dan klaim performa

Panel opsional memakai fallback PanelLoading role=status/aria-live=polite dan tetap dirender server. Pertahankan key revisi/periode/akun dan guard existing. Ukuran bundle, lab dan field wajib dibedakan; missing metrik bukan nol. Lihat ../development/L09-MEASURED-PERFORMANCE.md.

### L10 — Fokus dan pembesaran

Target main-content menerima tabIndex=-1 untuk skip link. Gunakan outline focus-visible yang tetap terlihat tanpa shadow; jangan menambah positive tabindex. Varian kompak menargetkan44×44CSSpx sebagai standar produk, bukan minimum AA universal. Label dapat wrapping, gutter/ikon nonteks tidak menghabiskan ruang ketika teks diperbesar; tabel tetap gulir lokal berlabel. Laporan dan batas penerimaan: ../development/L10-ACCESSIBILITY.md.

### Kesehatan aplikasi — audit27 Oktober2026

Metrik menggunakan lebar konten; unknown tidak ditampilkan sebagai0. Utamakan status sumber gagal/parsial sebelum metrik, tampilkan empty state sampel, dan bedakan konfigurasi provider dari bukti pengiriman. Detail cakupan boleh memakai accordion native, tindakan penting tetap terlihat. Refresh nativeGET tidak memicu pekerjaan. Ikon tab memiliki SVG eksplisit dan ICO multiukuran, memakai identitas sekolah existing. Lihat ../development/HEALTH-APP-AUDIT.md.


## Tampilan ringkas — 28 Oktober 2026

Instruksi terbaru pengguna memprioritaskan kenyamanan membaca: data dan tindakan utama dahulu, petunjuk tambahan saat dibutuhkan. Ini memperbarui presentasi Plass sebelumnya: kartu konten opaque dengan bayangan lebih ringan, menu aktif memakai teal semantik tanpa gradasi, padding kartu 16px pada mobile/24px pada desktop. Ukuran teks, kontras, target sentuh dan focus tetap dipertahankan; jangan mengatasi kepadatan dengan mengecilkan teks atau line-clamp.

`components/ui/guidance.tsx` adalah disclosure native bersama untuk penjelasan **opsional**. Ringkasan menyebut topik dengan jelas; isi lengkap tetap tersedia melalui keyboard/sentuhan. Hindari accordion bersarang untuk satu tugas. Tidak ada penyimpanan preferensi atau fetch baru.

Jangan masukkan pesan error/loading/success, hasil ambigu, label/batas isian wajib, konsekuensi penghapusan, biaya transaksi, kode kredensial, atau peringatan AI ke disclosure tertutup. Data yang hilang tetap unknown, bukan nol atau sukses. Dashboard menempatkan ringkasan akun dan inventaris layanan pada disclosure; keadaan akses gagal/kosong tetap terlihat. Detail layanan tetap dibuka melalui sidebar sesuai kontrak navigasi existing.

Lihat `docs/development/UI-READABILITY-AUDIT.md` untuk cakupan, pengukuran terbatas, dan hasil QA aktual. Pengurangan kata pada petunjuk terpilih bukan pengukuran kenyamanan pengguna atau persentase seluruh aplikasi.

## Pemasangan PWA tanpa gangguan — 28 Oktober 2026

Ajakan pemasangan adalah utilitas sekunder di akhir dokumen, berupa tombol ghost “Pasang aplikasi”; bukan accordion besar/floating banner di area kerja. Panduan menggunakan Dialog bersama dan hanya terbuka atas klik/keyboard pengguna. Offline bukan promosi instalasi dan tetap tersedia di luar dialog. Fokus kembali ke pemicu atau main jika pemasangan menghapus pemicu. Jangan membuka modal otomatis dari event browser atau melakukan reload/cache transaksi. Lihat `docs/development/PWA-INSTALL-PLACEMENT.md`.
