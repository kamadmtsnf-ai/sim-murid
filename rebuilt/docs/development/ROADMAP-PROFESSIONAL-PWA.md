# Rencana Pengembangan Lanjutan SiM-Murid: Profesional, Modern, dan PWA

Versi: 1.0
Tanggal: 26 Oktober 2026 (Asia/Jakarta)
Status: L01 dirilis melalui PR #76. L02 tooling dan regresi otomatis dikerjakan; UAT manusia belum tersedia. L03 standardisasi koleksi dikerjakan; L04–L11 belum dijalankan.
Repositori: https://github.com/kamadmtsnf-ai/sim-murid
Aplikasi: rebuilt/
Nama berkas rekomendasi di repositori: rebuilt/docs/development/ROADMAP-PROFESSIONAL-PWA.md

## 1. Tujuan dan otoritas

Dokumen ini menyimpan seluruh saran pengembangan lanjutan yang disampaikan setelah PR #75, ditambah kebutuhan PWA agar pengguna dapat memasang aplikasi pada perangkat yang mendukung.

Ini adalah siklus lanjutan berkode L01–L11, bukan pengulangan Tahap 1–30 maupun P01–P12. Roadmap sebelumnya tetap berlaku: https://github.com/kamadmtsnf-ai/sim-murid/blob/main/rebuilt/docs/development/ROADMAP.md

Urutan otoritas: instruksi terbaru pengguna → keputusan bisnis yang disepakati → spesifikasi aplikasi → roadmap. Persetujuan dokumen tidak menetapkan tarif, aturan nilai, kewenangan baru, layanan berbayar, atau keputusan D10 yang masih terbuka.

Target: pekerjaan utama lebih mudah diselesaikan, konsistensi UI meningkat, kesalahan berkurang, aplikasi dapat dipasang sebagai PWA, dan hasilnya dapat diukur.

## 2. Konteks yang wajib dipertahankan

- Stack existing: Next.js App Router, TypeScript strict, Tailwind CSS, shadcn/Radix, Lucide, Zod, Supabase dan Vercel.
- Identitas SiM-Murid/MTs Nurul Falah; tidak melakukan redesign total tanpa temuan terukur.
- Autentikasi internal, validasi server, RBAC, scope own/class/all, tugas tambahan aktif dan keterkaitan keluarga.
- Sidebar sebagai navigasi utama; tombol konten berfokus pada tindakan, bukan duplikasi navigasi.
- Accordion sidebar default tertutup; pencarian dapat menampilkan kelompok hasil sementara.
- Tahun ajaran pasangan 2026/2027; Ganjil Juli–Desember tahun pertama, Genap Januari–Juni tahun kedua. Kalender transaksi tidak disamakan dengan tahun ajaran.
- Nilai rapor PH20% + ATS30% + ASAS50%; Praktik terpisah.
- Fee sesuai kebijakan pembulatan ribuan half-up dan snapshot transaksi existing.
- Ketentuan esai survei existing; D10 KKM/arsip belum diputus dan tidak boleh diterapkan diam-diam.
- Jangan membuat ulang fitur yang sudah tersedia: audit gap dan perluas komponen/RPC existing terlebih dahulu.

### Snapshot kontinuitas terakhir

Riwayat percakapan mencatat:
- PR #71: reCAPTCHA v2 Login.
- PR #72: tombol password di dalam field dan panel reCAPTCHA.
- PR #73: audit callback reCAPTCHA, respons streaming, hostname.
- PR #74: accordion kelompok sidebar, default tertutup.
- PR #75: perbaikan input email setelah penggantian password sementara; migrasi onboarding_email_contact diterapkan.
- Commit merge PR #75: 277c495f514b6295e052d58ab4e1d5c3d50a186a.
- Migrasi PR #75: nama onboarding_email_contact; versi cloud 20261026013340, filename lokal 20261026011522; perbedaan timestamp bukan alasan mengulang migrasi.
- Snapshot ini bukan bukti kondisi main/produksi pada sesi berikutnya. Periksa ulang sumber dan status rilis.

Roadmap P01–P12 menyatakan sebagian bukti UAT manusia, beban nyata terautentikasi, restore staging dan evaluasi AI belum lengkap. Tutup bukti tersebut, jangan menganggap merge sebagai sertifikasi selesai.

## 3. Cara melanjutkan tanpa kehilangan konteks

1. Baca AGENTS.md, dokumen ini, roadmap P01–P12, keputusan bisnis dan laporan tahap terakhir.
2. Periksa main terbaru, PR terkait dan migrasi cloud yang sudah diterapkan.
3. Pilih satu tahap Lxx; audit implementasi existing sebelum menentukan perubahan.
4. Catat baseline, gap, scope, kriteria penerimaan, dependensi dan risiko.
5. Kerjakan di branch terpisah dengan perubahan sekecil yang memenuhi tujuan.
6. Jalankan pengujian yang relevan dan dokumentasikan hasil sebenarnya.
7. Buat PR; merge/deploy mengikuti instruksi yang berlaku pada sesi tersebut.
8. Jika ada migrasi, tentukan urutan rilis agar API tidak memanggil fungsi yang belum tersedia.
9. Perbarui status dan tautan bukti setelah verifikasi rilis.
10. Tahap berikutnya dimulai dari pekerjaan belum selesai, bukan mengulang audit yang masih valid.

## 4. Daftar tahap dan urutan

| ID | Tahap | Prioritas | Dependensi | Status awal |
|---|---|---|---|---|
| L01 | Pusat penyelesaian akun | P0 | Audit gate onboarding existing | Dirilis PR #76, commit 493971f5f001dc6c556bb46b5262b2b910c5b31a; UAT manusia pada L02. Lihat L01-ACCOUNT-COMPLETION.md |
| L02 | Pengujian alur nyata lintas role | P0 | Skenario L01; lanjut pada setiap tahap | Tooling/bukti otomatis dalam L02-ROLE-JOURNEYS.md; penerimaan manusia tetap terbuka |
| L03 | Standardisasi tabel dan filter | P1 | Inventaris komponen existing | Implementasi/QA pada L03-TABLE-FILTERS.md; status rilis pada PR terkait |
| L04 | Feedback dan kepastian penyimpanan | P1 | P04 existing dan temuan L02 | Belum dimulai |
| L05 | Penyempurnaan sidebar | P1 | Accordion PR #74 | Belum dimulai |
| L06 | PWA yang dapat dipasang | P1 | L01, L04, audit cache/session | Belum dimulai |
| L07 | Pusat kesehatan aplikasi admin | P1 | Observability dan izin existing | Belum dimulai |
| L08 | Pekerjaan massal dan kualitas data | P1 | L03, L04, impor Excel existing | Belum dimulai |
| L09 | Performa berbasis penggunaan nyata | P1 | Baseline L02; evaluasi ulang setelah PWA | Belum dimulai |
| L10 | Aksesibilitas menyeluruh | P1 | Berlaku sejak L01; konsolidasi setelah L09 | Belum dimulai |
| L11 | AI untuk pekerjaan konkret | P2 | Fondasi stabil, P12 existing, evaluasi manusia | Belum dimulai |

Urutan kerja utama: L01 → L02 baseline → L03/L04 → L05 → L06 → L07/L08 → L09/L10 → L11. Pengujian, aksesibilitas dan keamanan berjalan sejak awal, bukan menunggu tahap akhir.

## 5. Rincian tahap dan kriteria penerimaan

### L01 — Pusat penyelesaian akun

**Masalah:** langkah onboarding tersebar dan alasan fitur belum tersedia tidak selalu jelas.

**Hasil:**
- Ringkasan langkah per role: password wajib, biodata bila diperlukan, pertanyaan keamanan, email.
- Status selesai/belum selesai, langkah yang tersedia berikutnya, dan penjelasan pembatasan.
- Satu sumber status server; gunakan gate existing.
- Urutan visual membimbing tanpa memblokir email yang telah diizinkan PR #75 sebelum pertanyaan keamanan/biodata selesai.
- Bedakan email wajib pada role yang diwajibkan kebijakan dan email opsional role lain.

**Penerimaan:** akun baru dapat menyelesaikan langkah yang diizinkan; sesi lama ditolak setelah penggantian password; refresh/back/login ulang menampilkan status aktual; email terverifikasi tidak melewati kewajiban lain.

**Ukuran:** keberhasilan onboarding, waktu penyelesaian, jumlah pengguna berhenti per langkah, laporan kendala. Baseline belum tersedia.

### L02 — Pengujian alur nyata lintas role

**Hasil:** matriks tugas admin, guru, siswa, wali dan role lain yang didukung; tugas tambahan diuji terpisah dari role dasar.

**Skenario minimum:** akun baru, email/OTP, impor pengguna, penugasan tambahan, absensi, nilai/rapor, iuran/tabungan sesuai izin, logout dan sesi berakhir. Sertakan tugas kedaluwarsa, perubahan relasi, timeout dan koneksi putus.

**Penerimaan:** ada hasil tugas bersama pengguna nyata, temuan berprioritas, retest perbaikan; akses terlarang dan transaksi ganda wajib ditolak.

**Ukuran:** keberhasilan tugas, median waktu, salah input, bantuan yang diperlukan. Target awal usulan keberhasilan tugas utama ≥95%; bukan hasil yang sudah tercapai dan harus dikalibrasi setelah baseline.

### L03 — Standardisasi tabel dan filter

**Hasil:** komponen/pola bersama untuk pencarian, filter aktif, reset, sorting, pagination, jumlah hasil dan ekspor sesuai cakupan.

**Penerimaan:** filter konsisten antara layar dan ekspor; filter yang berubah mereset halaman secara aman; izin/kelas yang dicabut tidak dipulihkan dari preferensi; sticky header/kolom hanya pada tabel yang memerlukan; gulir lebar lokal, bukan seluruh halaman.

**Ukuran:** waktu menemukan data, langkah interaksi, jumlah overflow dan ketidaksesuaian ekspor pada skenario uji. Preferensi tanpa data sensitif dan dipisahkan per akun.

### L04 — Feedback dan kepastian penyimpanan

**Hasil:** pesan menjelaskan kejadian dan tindakan berikutnya. Pertahankan perbedaan loading, berhasil, ditolak, gagal pasti, dan hasil belum pasti.

**Penerimaan:** submit ganda dicegah; timeout tidak dianggap otomatis gagal/berhasil; tersedia pemeriksaan status; tidak retry mutasi ambigu otomatis; draft nonsensitif dipertahankan sesuai kebijakan; pesan tidak membocorkan informasi internal.

**Ukuran:** laporan kebingungan, pengiriman ulang tidak perlu, duplikasi transaksi dan kehilangan isian pada uji gangguan. Integritas transaksi wajib lulus.

### L05 — Penyempurnaan sidebar

**Hasil:** penanda kelompok yang berisi halaman aktif saat accordion tertutup; label konsisten; hasil pencarian dan empty state jelas.

**Penerimaan:** default tetap collapsed; tidak membuka kelompok aktif otomatis bertentangan dengan preferensi pengguna; akses keyboard dan touch bekerja; tidak mengubah role filtering; pencarian dibersihkan tanpa kehilangan orientasi.

**Ukuran:** keberhasilan menemukan menu, waktu navigasi, overflow, fokus yang hilang.

### L06 — PWA yang dapat dipasang

**Tujuan:** pengguna dapat memasang SiM-Murid pada perangkat/browser yang mendukung dan membuka aplikasi melalui ikon perangkat.

#### L06A — Instalasi dan identitas aplikasi

- Audit manifest, ikon dan service worker existing sebelum menambah file/dependency.
- Gunakan dukungan manifest App Router sesuai versi Next.js proyek.
- Tetapkan name, short_name, id, start_url, scope, display standalone, theme_color dan background_color.
- Sediakan ikon 192×192, 512×512, maskable serta Apple touch icon yang sesuai identitas existing.
- Pilih start_url pada rute existing yang menghormati sesi dan mengarahkan ke Login/onboarding jika diperlukan.
- HTTPS, manifest dan aset ikon harus dapat dimuat tanpa login; jangan mengendurkan akses halaman akun.
- Tombol “Instal aplikasi” muncul saat browser benar-benar menawarkan instalasi.
- Tangani penerimaan/penolakan prompt dan appinstalled; sembunyikan ajakan bila sudah standalone.
- Bila prompt tidak didukung, tampilkan panduan pemasangan yang sesuai perangkat; jangan membuat tombol yang tidak bereaksi.
- Jangan memaksa pemasangan dan jangan memunculkan prompt berulang setiap halaman.

#### L06B — Offline terbatas dan pembaruan aman

- Instalasi PWA tidak berarti seluruh transaksi berjalan offline.
- Tahap pertama tetap online untuk autentikasi, reCAPTCHA, OTP dan seluruh operasi bisnis.
- Bila service worker diperlukan, gunakan cache allowlist hanya untuk aset publik statis serta fallback offline generik tanpa identitas pengguna.
- Jangan cache halaman /account, API, payload RSC/Flight, respons bersesi, token, OTP, data pengguna, ekspor, nilai, dokumen maupun transaksi.
- Jangan gunakan fallback cache-first global pada semua request.
- Jangan antrekan POST/PUT/PATCH/DELETE atau background retry transaksi pada tahap ini.
- Saat offline, jelaskan bahwa data belum dapat diperiksa/disimpan; status koneksi tidak boleh dianggap bukti server dapat dijangkau.
- Pembaruan worker menampilkan pemberitahuan; hindari reload otomatis saat formulir kotor atau penyimpanan sedang berjalan.
- Bersihkan cache publik versi lama milik aplikasi; jangan menghapus cache aplikasi lain.
- Uji logout, pergantian akun, pencabutan sesi, upgrade versi dan rollback tanpa menampilkan data akun sebelumnya.
- Siapkan prosedur menonaktifkan/mengganti worker bermasalah; rollback kode saja belum tentu mengganti worker yang sudah terpasang.
- Web push, penyimpanan data privat offline dan sinkronisasi background tidak termasuk tahap awal; perlu desain/izin terpisah.

**Penerimaan:** manifest/ikon valid; instalasi dan peluncuran diuji pada Chrome/Edge desktop serta Android; panduan dan peluncuran iOS diuji pada perangkat yang tersedia; ketidakterdukungannya didokumentasikan. Form/login/reCAPTCHA bekerja dalam standalone. Offline fallback tidak membocorkan data; mutasi tidak terkirim ulang; update tidak menghilangkan isian.

**Ukuran:** keberhasilan pemasangan pada matriks perangkat, pembukaan standalone, kegagalan start, cache privat yang ditemukan (wajib nol pada pengujian), kegagalan update. Instalasi saja bukan bukti offline atau kelulusan keamanan.

**Batas bukti:** simulasi browser bukan pengganti uji pemasangan perangkat fisik. Jika belum diuji, tulis belum diuji.

### L07 — Pusat kesehatan aplikasi untuk admin

**Hasil:** konsolidasi status email, pekerjaan/outbox, kegagalan pengiriman, backup terakhir dan rekonsiliasi dari sumber yang tersedia. Sertakan timestamp dan tindakan penanganan.

**Penerimaan:** admin-only di server; tidak ada secret/OTP; status “diterima provider” dibedakan dari “diterima kotak masuk”; kegagalan metrik tidak ditampilkan sebagai sehat; retry memakai kontrak idempotensi domain.

**Ukuran:** waktu mendeteksi/menangani insiden, pekerjaan tertunda, hasil restore. Status backup tidak dinilai sehat hanya karena berkas ada.

### L08 — Pekerjaan massal dan kualitas data

**Hasil:** sempurnakan impor Excel existing: templat berversi, contoh, validasi, preview, konfirmasi, hasil per baris dan unduhan kesalahan.

**Penerimaan:** username tetap teks termasuk nol awal/minus; duplikasi/relasi/izin divalidasi; retry tidak menggandakan akun/transaksi; hasil parsial/atomik mengikuti kontrak domain; batas file/baris dan kuota existing dipertahankan kecuali perubahan disetujui.

**Ukuran:** persentase baris valid, waktu koreksi, duplikasi dan keberhasilan retry pada tes.

### L09 — Performa berbasis penggunaan nyata

**Hasil:** baseline per halaman/perangkat; pengukuran LCP, INP, CLS, API dan query; optimasi setelah bottleneck terbukti.

**Target awal:** p75 LCP ≤2,5 detik; INP ≤200 ms; CLS ≤0,1. Kalibrasi cakupan dan waktu pengukuran; ini target, bukan hasil aplikasi saat ini.

**Penerimaan:** bukti sebelum/sesudah; ukuran sampel dicatat; label field/lab dibedakan; tidak menyimpulkan kapasitas dari endpoint health atau cache hangat semata.

**Ukuran:** Core Web Vitals, waktu tugas, error rate, query lambat. Beban terautentikasi memakai staging dan rencana aman; jangan membebani produksi tanpa lingkup eksplisit.

### L10 — Aksesibilitas menyeluruh

**Hasil:** target WCAG 2.2 AA; keyboard, pembaca layar, pembesaran teks, fokus, kontras, label dan dialog.

**Penerimaan:** jalur penting dapat diselesaikan tanpa mouse; fokus terlihat/tidak tertutup; modal mengembalikan fokus; pesan status terbaca; tidak bergantung warna; tidak ada overflow halaman pada viewport uji. Kontrol utama ditargetkan 44×44 CSS px sebagai standar produk; jangan menyebutnya batas minimum AA untuk semua kasus.

**Ukuran:** pelanggaran otomatis dan hasil tugas manual. Hasil axe nol tidak otomatis membuktikan kepatuhan WCAG penuh.

### L11 — AI untuk pekerjaan konkret

**Hasil:** evaluasi adapter existing untuk ringkasan survei, draf tindak lanjut dan tren agregat. Sumber/periode, label AI, peninjauan manusia dan batas biaya jelas.

**Penerimaan:** uji dataset evaluasi yang aman; output dapat dikoreksi/ditolak; tidak menetapkan nilai, keputusan keuangan, disiplin atau hak akses otomatis; tidak mengirim data pribadi mentah tanpa dasar/izin; kualitas diukur sebelum perluasan.

**Ukuran:** ketepatan terhadap sumber, klaim tanpa dukungan, waktu penyuntingan, penerimaan reviewer dan biaya per penggunaan. Aktivasi provider berbayar bukan efek samping persetujuan roadmap.

## 6. Standar UI/UX lintas tahap

- Konsisten pada hierarki judul, spacing, tipografi, warna semantik, format tanggal/WIB dan rupiah.
- Satu aksi utama yang jelas; aksi destruktif memakai konfirmasi yang menyebut dampaknya.
- Loading/empty/error/success menggunakan komponen bersama existing.
- Modal untuk pekerjaan singkat; alur panjang memakai halaman, tanpa memaksakan modal.
- Tidak mengecilkan seluruh elemen untuk mobile; gunakan wrapping, stacking dan region gulir lokal.
- Hindari animasi dekoratif berlebihan; hormati reduced motion.
- Tidak menambah tombol navigasi duplikat sidebar atau teks teknis pengembangan di UI produksi.
- Ukur perbaikan, jangan mengklaim profesional hanya dari perubahan warna/bayangan.

## 7. Definisi selesai per tahap

- [ ] Scope, baseline dan dampak terdokumentasi.
- [ ] Komponen/layanan existing dipakai ulang.
- [ ] Aturan bisnis dan akses server tetap benar.
- [ ] Skenario normal, kosong, loading, error, timeout dan konflik diuji sesuai scope.
- [ ] Desktop/tablet/mobile, keyboard dan resize diuji.
- [ ] TypeScript/lint/tests/build yang relevan dijalankan; hasil dan keterbatasan dicatat.
- [ ] Migrasi, jika ada, direplay dan diperiksa privilege/RLS; urutan rilis ditetapkan.
- [ ] PR, CI, commit merge dan deployment yang tepat dicatat.
- [ ] Kriteria penerimaan dibuktikan; item belum diuji tetap terbuka.
- [ ] Dokumentasi status diperbarui.

## 8. Register pengukuran

| Metrik | Baseline | Target/penerimaan | Bukti |
|---|---|---|---|
| Keberhasilan onboarding | Belum diukur | Usulan ≥95% tugas utama setelah kalibrasi | UAT L01/L02 |
| Waktu menyelesaikan tugas | Belum diukur | Lebih baik dari baseline tanpa penurunan akurasi | UAT sebelum/sesudah |
| Akses lintas role tanpa izin | Belum dievaluasi ulang dalam siklus ini | Seluruh skenario negatif ditolak | Tes server/database |
| Mutasi ganda saat timeout/retry | Belum dievaluasi ulang dalam siklus ini | Nol pada skenario yang diuji | Regresi L04/L08 |
| Instalasi PWA | Belum diuji | Lulus pada matriks perangkat yang dinyatakan didukung | L06 perangkat nyata |
| Data privat dalam cache PWA | Belum diuji | Nol pada audit skenario | L06 inspeksi cache |
| Performa field | Belum tersedia | Target L09 pada p75, sampel memadai | Laporan metrik |
| Aksesibilitas tugas utama | Belum dievaluasi ulang dalam siklus ini | Lulus otomatis dan manual sesuai cakupan | L10 |
| Restore/operasional nyata | Bukti staging belum ditutup di roadmap sebelumnya | Restore dan rekonsiliasi terbukti | P10/L07 |
| Kualitas AI | Belum dievaluasi manusia | Ambang disepakati sebelum aktivasi luas | L11 |

## 9. Template laporan tahap

Untuk setiap tahap simpan: ID/status; tanggal; baseline SHA; temuan; scope; file berubah dan alasan; perubahan kontrak/migrasi; hasil tes beserta perintah/exit code; skenario pengguna; angka baseline/setelah; keterbatasan mock/staging/produksi; PR/CI/merge/deployment; rollback; risiko tersisa; langkah berikutnya.

Status yang digunakan: Belum dimulai → Analisis → Implementasi → Verifikasi → Menunggu penerimaan/rilis → Selesai. “Terblokir” harus menyebut penyebab dan tindak lanjut. Pisahkan “kode selesai” dari “UAT/aktivasi selesai”.

## 10. Referensi dan status dokumen

- Roadmap existing: https://github.com/kamadmtsnf-ai/sim-murid/blob/main/rebuilt/docs/development/ROADMAP.md
- Next.js PWA: https://nextjs.org/docs/app/guides/progressive-web-apps
- MDN installability: https://developer.mozilla.org/en-US/docs/Web/Progressive_web_apps/Guides/Making_PWAs_installable
- MDN offline: https://developer.mozilla.org/en-US/docs/Web/Progressive_web_apps/Guides/Offline_and_background_operation
- WCAG 2.2: https://www.w3.org/TR/WCAG22/
- Core Web Vitals: https://web.dev/articles/vitals

Dokumen dibuat untuk menyimpan konteks dan mengarahkan pekerjaan. Tidak menyatakan PWA sudah diimplementasikan, tidak mengaktifkan provider/scheduler, dan tidak mengubah database maupun deployment. Setelah dokumen ini dimasukkan ke repositori, tautkan dari roadmap utama; gunakan satu dokumen kanonis dan perbarui versinya agar salinan tidak menyimpang.
