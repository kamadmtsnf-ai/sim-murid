# Rencana pengembangan profesional SiM-Murid — 12 tahap

Versi 1.0 • 24 Oktober 2026 • Zona bisnis Asia/Jakarta.

## Tujuan dan otoritas

Rencana ini menyimpan persetujuan pengguna atas saran pengembangan fitur, UI/UX, keandalan dan operasional setelah audit Hak akses saya (PR #44). Ini **siklus pengembangan baru**, berbeda dari Tahap 1–30 pembangunan ulang sebelumnya. Gunakan kode `P01`–`P12` untuk menghindari kekeliruan nomor.

Repositori: `kamadmtsnf-ai/sim-murid`, aplikasi `rebuilt/`. Identitas produk SiM-Murid/MTs Nurul Falah dipertahankan. Stack tetap Next.js App Router, TypeScript strict, Tailwind, shadcn/Radix, Lucide, Zod, Supabase dan Vercel.

Instruksi terbaru pengguna → keputusan bisnis disepakati → spesifikasi existing → rencana ini. Rencana bukan bukti fitur sudah selesai dan bukan izin mengubah kebijakan bisnis yang belum diputus. D10 tentang koreksi KKM/arsip tetap terbuka. Persetujuan arah pengembangan tidak menentukan tarif, kewenangan persetujuan baru, atau penggunaan layanan berbayar.

## Cara melanjutkan pada sesi berikutnya

1. Baca `AGENTS.md`, dokumen ini, [hasil P01](STAGE-01-AUDIT.md), dan [snapshot sumber](stage-01-baseline.json).
2. Periksa commit `main` terkini dan perubahan sejak baseline. Jangan menganggap snapshot lama sebagai kondisi produksi terbaru.
3. Baca keputusan pada `../decisions/approved-business-policy.md`, spesifikasi modul dan audit terdahulu sebelum mengubah perilaku.
4. Pilih pekerjaan tahap aktif dari backlog P01. Tandai sedang dikerjakan; jangan menjalankan seluruh tahap sekaligus tanpa instruksi.
5. Catat implementasi, file, alasan, hasil tes aktual, batas bukti, PR dan kendala pada laporan tahap. Perbarui status tabel ini.
6. Tahap hanya selesai bila kriteria penerimaan dipenuhi. Keberhasilan merge atau halaman tampil tidak menggantikan pembuktian alur bisnis.

## Tahap, hasil dan gerbang penerimaan

| ID | Tahap | Ruang lingkup dan hasil wajib | Gerbang selesai | Status |
|---|---|---|---|---|
| P01 | Audit kondisi awal dan rencana kerja | Inventaris fitur existing; dependency UI/API/data; skenario peran; gap dan prioritas; ukuran keberhasilan; batas perubahan | Bukti sumber, backlog berurutan, kriteria penerimaan, risiko dan batas verifikasi terdokumentasi | Selesai; lihat laporan P01 |
| P02 | Penyatuan design system | Evaluasi MASTER existing; satukan token, tombol, tabel, filter, formulir, dialog, pagination, loading/error/empty; pilot halaman read-only dan mutasi | Pilot konsisten pada 320/390/768/1440 px; keyboard/fokus/axe; error/loading/empty; tidak mengubah hasil bisnis | Selesai; lihat [laporan P02](STAGE-02-DESIGN-SYSTEM.md) |
| P03 | Konteks akademik global | Tahun ajaran/semester/kelas konsisten dan dapat dipertahankan lintas modul relevan; validasi scope dan fallback eksplisit | Periode lintas halaman benar; pilihan usang/kelas dicabut ditangani; tanggal WIB dan server tetap otoritas | Selesai; lihat [laporan P03](STAGE-03-ACADEMIC-CONTEXT.md) |
| P04 | Keandalan formulir dan penyimpanan | Standar pending/saved/error/uncertain, readback aman, lock submit, perlindungan isian dan draf selektif | Timeout/offline/konflik/submit ganda tidak menyebabkan duplikasi atau kehilangan draf; tidak retry mutasi ambigu otomatis | Selesai; lihat [laporan P04](STAGE-04-RELIABLE-FORMS.md) |
| P05 | Navigasi dan UI/UX antarmodul | Terapkan standar per kelompok modul; sidebar, istilah, hierarki, tabel dan mobile | Peran/scope tetap; navigasi sidebar; kontrol sentuh/fokus; tidak ada overflow halaman atau elemen terpotong pada skenario uji | Selesai; lihat [laporan P05](STAGE-05-NAVIGATION-UX.md) |
| P06 | Beranda sesuai peran | Ringkasan pekerjaan harian yang relevan berdasarkan peran, penugasan aktif dan relasi; prioritas tugas | Angka dapat ditelusuri ke sumber; empty/error/loading jelas; tidak ada kebocoran antarperan; bukan angka dummy | Selesai; lihat [laporan P06](STAGE-06-ROLE-DASHBOARD.md) |
| P07 | Pusat tindak lanjut dan notifikasi | Pekerjaan tertunda, pemilik, tenggat, status; urgensi/modul; deduplikasi dan preferensi notifikasi | Perubahan status mengikuti sumber; akses scoped; satu kejadian tidak menimbulkan kiriman ganda; preferensi tidak menonaktifkan pengamanan wajib | Selesai; lihat [laporan P07](STAGE-07-FOLLOW-UP.md) |
| P08 | Input massal dan kualitas data | Unggah → validasi → pratinjau → konfirmasi → hasil per baris; pemeriksaan duplikasi/relasi/jadwal/nilai | Batch salah ditolak sebelum commit; retry aman; batas ukuran/baris; username tetap teks; hasil deterministik dan berizin | Kode/QA selesai dan migrasi cloud diterapkan setelah izin eksplisit; UAT impor produksi belum dijalankan. Lihat [laporan P08](STAGE-08-BULK-INPUT.md) |
| P09 | Finalisasi dan jejak perubahan | Matriks state per domain, draf/pemeriksaan/final/pembukaan kembali sesuai aturan; riwayat siapa/kapan/alasan/perubahan | Kewenangan eksplisit, final lock dan konflik teruji; arsip/ledger tidak ditimpa; field sensitif disunting dari log | Kode/QA dan aktivasi migrasi cloud selesai setelah izin eksplisit; UAT produksi belum dilakukan. Lihat [P09](STAGE-09-FINALIZATION-AUDIT.md) |
| P10 | Ketahanan operasional dan performa | Pemantauan error/ID, pengujian lintas peran, performa terukur, backup dan simulasi restore | Bukti restore staging, UAT, rekonsiliasi dan load terautentikasi; runbook rollback; tidak menyimpulkan kapasitas dari health | Kode/QA terisolasi P10 selesai; gerbang staging/Auth/Storage/UAT/load nyata dan penerimaan pemilik masih terbuka. Lihat [P10](STAGE-10-OPERATIONS.md) |
| P11 | Bantuan dan evaluasi pengguna | Panduan kontekstual, pelaporan kendala, sesi tugas bersama pengguna, perbaikan berdasarkan temuan | Tugas utama dapat diselesaikan; baseline dan hasil bandingan tercatat; bantuan tidak meminta password/OTP | Kode bantuan/protokol evaluasi selesai; baseline dan UAT manusia belum tersedia. Lihat [P11](STAGE-11-USER-HELP.md) |
| P12 | AI terkontrol | Perluas adapter existing untuk ringkasan/draf/tren agregat sesuai kebutuhan; privasi, human review dan kendali biaya | Output dapat ditinjau; sumber/periode/label AI jelas; refusal/error aman; tanpa keputusan otomatis akademik/keuangan/akses | Kode/QA dan migrasi kuota cloud selesai; aktivasi provider, evaluasi kualitas dan penerimaan manusia belum dilakukan. Lihat [P12](STAGE-12-CONTROLLED-AI.md) |

## Urutan dan dependensi

- P01 → P02 → P03 → P04 → P05 merupakan fondasi utama. P02–P05 dirilis per kelompok modul, bukan satu PR besar.
- P06 memakai komponen dan konteks P02–P05. P07 memakai definisi pekerjaan P06 dan outbox existing.
- P08 memakai kontrak penyimpanan P04. P09 memakai P04 dan pemetaan aturan domain; impor P08 tidak boleh melewati final lock existing.
- P10 mengonsolidasikan bukti operasional; pengujian dan keamanan tetap wajib sejak P01. Kekurangan kritis yang ditemukan lebih awal ditangani sebelum merilis fitur yang bergantung padanya.
- P11 memanfaatkan uji tugas awal P01 dan fitur stabil; masukan pengguna dapat mengoreksi prioritas tahap lain.
- P12 setelah fondasi stabil; keberadaan adapter AI sekarang tidak berarti P12 sudah selesai.

## Batas yang berlaku pada semua tahap

- Pertahankan autentikasi internal, API contract yang digunakan, validasi server, RLS, scope own/class/all, serta database existing. Perubahan additive untuk fitur baru harus dianalisis, dimigrasikan dan diuji pada tahap terkait; jangan mengubah backend hanya demi visual.
- Peran dasar berbeda dari penugasan: Kepala, Wali kelas, Piket, Pembimbing, Bendahara dan Pengelola tabungan bukan alasan menambah role baru tanpa kebutuhan.
- Tahun ajaran `2026/2027` atau input `2026-2027`; Ganjil Juli–Desember 2026, Genap Januari–Juni 2027. Kalender transaksi, tahun terbit buku dan tahun lulus tidak disamakan dengan tahun ajaran.
- D01 nilai PH20/ATS30/ASAS50, Praktik terpisah; D02 fee half-up ribuan dan saldo/slip existing; D03 instrumen/esai wajib existing. Jangan mengubah arsip terbit berdasarkan D10 yang belum diputus.
- Sidebar tetap jalur utama perpindahan halaman; tombol konten berfokus pada tindakan. Modal untuk pekerjaan singkat, halaman untuk alur panjang.
- Gulir vertikal normal diperbolehkan. Hindari overflow halaman/elemen terpotong; tabel lebar memakai region gulir lokal yang dapat diakses keyboard.
- Jangan simpan password, OTP, dokumen pribadi, kunci API atau ekspor produksi dalam git, telemetry atau draf browser generik. Draf sensitif memerlukan rancangan terpisah.
- Tidak mengaktifkan pengiriman email/WA, AI berbayar, scheduler atau perpindahan data produksi sebagai efek samping pengujian.

## Protokol setiap tahap

Analisis → kriteria penerimaan → branch terpisah → implementasi minimum → tes fungsi/izin/regresi → dokumentasi → PR → pemeriksaan wajib → merge sesuai instruksi → verifikasi hasil rilis yang relevan. Catat tes yang belum dijalankan dan blocker dengan jujur. Jangan menyebut 100% bebas bug.

Setiap laporan menyimpan baseline SHA, daftar file, sumber bukti, hasil perintah/exit code, skenario browser jika relevan, batas mock/staging/produksi, risiko dan pekerjaan berikutnya. Untuk perubahan dokumen, validasi tautan, struktur dan diff; tes aplikasi dicatat sebagai baseline, bukan bukti fitur baru.

## Ukuran keberhasilan

Lihat rancangan pengukuran pada P01. Ukur waktu tugas, keberhasilan tugas, kesalahan/ulang input, ketidakpastian penyimpanan, penyelesaian tindak lanjut, dukungan pengguna, aksesibilitas dan performa. Nilai awal yang belum diukur ditulis **belum tersedia**, bukan nol. Target numerik produk dikalibrasi setelah pengukuran awal; integritas data dan penolakan akses terlarang wajib lulus.

## Riwayat

- 24 Oktober 2026: rencana 12 tahap disimpan berdasarkan persetujuan pengguna; P01 dilaksanakan sebagai audit sumber dan rencana kerja. Tidak mengimplementasikan P02–P12 dalam tahap ini.

- 24 Oktober 2026: P02 selesai pada pilot Hak akses saya dan Profil pribadi; standar dan bukti pada laporan P02. P03–P12 belum dimulai.

- 24 Oktober 2026: P03 menambahkan preferensi akademik per akun dan transfer eksplisit pada Kelas/Jadwal/Nilai/Rapor. Kalender transaksi, periode Survei ber-ID dan dua sisi kenaikan tetap eksplisit sesuai semantik modul. P04–P12 belum dimulai.

- 24 Oktober 2026: P04 selesai: acknowledgement/revisi, lock submit, timeout/unmount, perlindungan sidebar/logout dan draf selektif; controller domain dipertahankan. Bukti dan batas pada laporan P04. P05–P12 belum dimulai. PR implementasi P04: [#48](https://github.com/kamadmtsnf-ai/sim-murid/pull/48).

- 24 Oktober 2026: P05 selesai melalui tiga kelompok: [PR #49](https://github.com/kamadmtsnf-ai/sim-murid/pull/49) navigasi/kontrol, [PR #50](https://github.com/kamadmtsnf-ai/sim-murid/pull/50) kelas/jadwal/operasional, dan [PR #51](https://github.com/kamadmtsnf-ai/sim-murid/pull/51) akademik/evaluasi/state. Validasi, manifest dan batas pada laporan P05. P06–P12 belum dimulai.

- 24 Oktober 2026: P06 beranda sesuai peran selesai. Bukti dan batas verifikasi pada laporan P06; P07–P12 belum dimulai.

PR implementasi: [#52](https://github.com/kamadmtsnf-ai/sim-murid/pull/52).

- 24 Oktober 2026: P07 selesai: pusat tindak lanjut pada Notifikasi, status/owner/target dari sumber, filter urgensi/modul, preferensi tampilan aman dan dedup existing teruji. Laporan dan batas bukti pada P07. P08–P12 belum dimulai.

PR implementasi P07: [#53](https://github.com/kamadmtsnf-ai/sim-murid/pull/53).

- 24 Oktober 2026: Kode P08 dan QA diselesaikan untuk rilis aman. Migrasi additive Supabase ditolak auto-review karena izin mutasi database bersama belum eksplisit. Aktivasi P08 tetap tertunda; input lama aktif, tombol impor dilindungi readiness gate. P09–P12 belum dijalankan.

PR kode P08: [#54](https://github.com/kamadmtsnf-ai/sim-murid/pull/54). Izin aktivasi database telah diberikan; migrasi cloud `20261024165437` berhasil diterapkan dan metadata/privilege diverifikasi.

- Aktivasi P08: setelah pengguna menjawab “ya boleh” atas permintaan migrasi konkret, apply_migration berhasil pada sim-muridv2. Dua RPC/indeks dan pembatasan EXECUTE terverifikasi; probe tanpa sesi ditolak. Advisory tetap baseline. Muat ulang halaman untuk pemeriksaan ketersediaan sesuai sesi/izin. UAT impor produksi belum dijalankan.

- 25 Oktober 2026: P09 kode/QA selesai dan dipulihkan setelah reset lingkungan. 655 tes/70 kelompok dan browser 475 checks/52 axe diulang dan lulus. Database belum berubah: migrasi diblokir auto-review sampai izin konkret; UI readiness gate menjaga fungsi lama. D10 tetap terbuka. P10–P12 belum dijalankan.

PR implementasi P09: [#56](https://github.com/kamadmtsnf-ai/sim-murid/pull/56). Aktivasi database telah disetujui dan diterapkan, cloud version `20261025014918`; UAT akun produksi belum dilakukan.

- 25 Oktober 2026: pengguna menyetujui migrasi P09 konkret. apply_migration berhasil pada sim-muridv2; reader, dua indeks, tujuh trigger enabled dan service_role-only EXECUTE terverifikasi. Probe sesi tidak sah ditolak, proyeksi field sensitif/zero benar, fingerprint writer cocok. Advisory private RLS/leaked-password existing tetap; dua indeks baru belum memiliki statistik penggunaan. P10–P12 belum dijalankan.

- 25 Oktober 2026: P10 kode keandalan/observability, gate fail-closed, CI dan tooling restore/benchmark/release gate selesai; PR #58. Pipeline669 tes/72 kelompok, satu kasus operasional tambahan (670 kasus unik), HTTPsmoke6 dan browser334checks/32axe lulus. P10 tetap parsial sampai managed staging/Auth/Storage, UAT manusia, beban nyata dan penerimaan target/pemilik. Tidak mengubah produksi atau menjalankan P11/P12.

- 25 Oktober 2026: P11 bantuan kontekstual dan templat laporan aman di ruang kerja, protokol evaluasi 14 tugas. Baseline/setelah dan penerimaan manusia belum tersedia; P11 parsial, P10 tetap parsial, P12 belum dijalankan.

- 25 Oktober 2026: P12 ([PR60](https://github.com/kamadmtsnf-ai/sim-murid/pull/60)) kontrol AI, redaksi, consent, batas request/input/output, reservasi atomik dan human review draf diimplementasikan. Migrasi cloud `20261025032055` diterapkan dan privilege/fingerprint diverifikasi. Aktivasi provider berbayar dan evaluasi manusia belum dilakukan; P10/P11 tetap parsial, D10 tetap terbuka.

## Siklus lanjutan L01–L11

Lihat [rencana profesional dan PWA](ROADMAP-PROFESSIONAL-PWA.md). L01 menambahkan pusat penyelesaian akun pada Keamanan akun dan Verifikasi email; bukti serta batas ada di [laporan L01](L01-ACCOUNT-COMPLETION.md). Tidak menggantikan gerbang UAT P10/P11/P12.

L02 menambahkan katalog tugas dan pemeriksa bukti UAT ke protokol P11; lihat [laporan L02](L02-ROLE-JOURNEYS.md). Kelulusan regresi otomatis tidak menutup sesi manusia/baseline/restore/load P10 yang belum tersedia. L01 telah dirilis PR76; L02 tetap parsial sampai bukti manusia ditinjau.

L03 menyatukan kontrol pagination/filter dan memperbaiki reset Buku Digital; lihat [laporan L03](L03-TABLE-FILTERS.md). Scope/otorisasi domain tetap, UAT manusia L02 masih terbuka.

L04 memperjelas advice per kode/fase dan mengunci tone dari evidence penyimpanan; lihat [laporan L04](L04-SAVE-FEEDBACK.md). UAT manusia L02 tetap terbuka; tidak ada migrasi database.

L05 memperjelas lokasi halaman aktif dan hasil pencarian sidebar tanpa mengubah default collapsed; lihat [laporan L05](L05-SIDEBAR-WAYFINDING.md). Tidak ada migrasi; L02 UAT manusia tetap terbuka.

L06 menambahkan PWA online dengan manifest/ikon dan kontrol instalasi progresif, tanpa worker/cache privat/migrasi. Lihat [laporan L06](L06-INSTALLABLE-PWA.md); penerimaan perangkat fisik belum selesai.

L07 menambahkan menu Kesehatan aplikasi khusus admin, agregat outbox/pekerjaan/rekonsiliasi dari sumber existing dan status backup/restore yang jujur belum dapat diverifikasi. Tanpa migrasi; lihat [laporan L07](L07-ADMIN-HEALTH.md). Instalasi PWA fisik L06 dikonfirmasi pengguna.

L08 memperbaiki kualitas impor Excel existing: template berversi dengan kompatibilitas lama, petunjuk per kolom, persentase valid dan laporan hasil/kesalahan tanpa password. Konfirmasi semua batch pengguna; kuota dan transaksi domain dipertahankan. Tanpa migrasi; lihat [laporan L08](L08-IMPORT-QUALITY.md).
