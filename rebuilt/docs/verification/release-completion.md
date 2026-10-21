# Penyelesaian lanjutan Tahap 1–30

21 Oktober 2026 WIB. Baseline main `4155373866a4c0550242e9012585fc4288224eb1`. Branch `feat/complete-release-readiness`.

**Status: pekerjaan independen diselesaikan dan diuji; cutover belum boleh dianggap selesai.** Tidak ada impor data historis, penonaktifan GAS/trigger lama, pengiriman provider, atau perubahan schema produksi pada pekerjaan ini. Pengguna telah memilih kebijakan D10 revisi berversi.

## Hasil nyata dan pekerjaan tersisa

| Pekerjaan | Hasil sekarang | Yang belum selesai |
|---|---|---|
| D10 KKM/rapor | Keputusan RAPOR-REVISION-1.0 dicatat. Migrasi append-only dan UI koreksi tersedia, dengan alasan, penerbit/waktu, expectedVersion, idempotency, audit dan arsip lama. Pratinjau draft dan PDF per versi tersedia. | Migrasi cloud dan rilis fitur masih menunggu persetujuan terperinci setelah penolakan review. |
| Verifikasi aplikasi | 169 tes lulus; typecheck, lint, drift tipe, production build, 6 smoke checks dan 66 browser checks lulus. 9 layar axe tanpa pelanggaran. | Browser memakai fixture sintetis dan intercept untuk mutasi; bukan login Auth/UAT produksi seluruh peran atau uji dengan teknologi bantu. |
| Ekspor PDF | Font DejaVu berlisensi disertakan dengan subset. Karakter yang didukung dipertahankan; teks panjang dibungkus berdasarkan lebar font dan ukuran sebenarnya. Nama Unicode pada sampel diekstrak utuh. | Karakter di luar cakupan font ditolak secara eksplisit; belum seluruh dokumen/nama sumber atau tata letak RTL diuji. |
| Restore | Snapshot direktori database PGlite benar-benar dipulihkan ke instance baru; arsip, versi koreksi, data dan pembatasan akses diperiksa. | Bukan restore Supabase managed, Auth produksi atau bytes Storage. Staging terpisah belum tersedia. |
| Sumber migrasi | Spreadsheet operasional ditemukan. Inventaris ID 29 tab dibaca; field akun aman dan 7 domain data diperiksa. 128 username berupa teks, tanpa duplikat. | Belum ekspor lengkap yang dibekukan, belum import/rekonsiliasi source-target. |
| Pemetaan sumber | Preflight menemukan 112 nilai terkait 4 username yang tidak lagi ada di Users, serta 13 pembayaran iuran berbasis nama yang membutuhkan pemetaan identitas dan alokasi bulan. | Keputusan kasus tersedia pada workbook privat peninjauan. Tidak mengarang akun/role atau membagi pembayaran ke bulan yang tidak terbukti. |
| Dokumen | 233 referensi URL dokumen siswa, 228 URL unik terinventarisasi. | Bytes, checksum, izin dan penyalinan dokumen belum diverifikasi. |
| Pengujian cloud | Dua skrip akademik dasar dan operasional selesai tanpa error lalu rollback. Pemeriksaan ulang: 4 profil, 0 kelas, 0 arsip rapor, 0 objek Storage; 33 migrasi, schema report_revisions belum ada. | Skrip layanan/survei/job ditolak peninjauan otomatis. Tidak diklaim lulus atau dijalankan kembali melalui cara lain. |
| Provider | Metadata menunjukkan konfigurasi Gmail hanya Production. AI configs di DB berjumlah 0; variabel WhatsApp tidak tersedia. | Penerima uji belum ditentukan; tidak ada bukti OTP/inbox, WhatsApp, analisis AI aktual. Secret dipasang lewat pengaturan aplikasi/provider, bukan chat/Git. |
| Staging dan beban | Skrip D10 terisolasi untuk cloud disiapkan dan diuji lokal hingga seluruh fixture rollback. | Dua percobaan pembuatan branch Supabase gagal `Invalid or expired requestState`; tidak ada branch terbentuk. Native Postgres juga tidak tersedia di lingkungan ini. Concurrency dua koneksi dan 60/132 pengguna bisnis terautentikasi belum dijalankan. |
| Keamanan tambahan | Audit dependency produksi 0 kerentanan. 143 file sumber, graph tanpa orphan di luar metadata kebijakan. | Leaked-password protection Supabase tetap nonaktif; pengaturan/paket pemilik perlu dituntaskan. |

## D10: perilaku dan integritas

Migrasi `20261021152554_report_versioned_corrections.sql` menambah tabel private `report_revisions`, RLS deny-by-default dan trigger immutable. Versi pertama tetap berada di `report_snapshots`; tidak diubah/dihapus. Versi koreksi menyimpan snapshot baru yang lengkap. Penulisan memakai otorisasi Admin/wali kelas yang berlaku, registry sesi dan onboarding. Guru mapel/Siswa tidak memperoleh hak menerbitkan koreksi.

RPC yang ada tetap memakai kontrak envelope request/revision. Implementasi sebelumnya diberi nama `_v30` dan tetap dibatasi service_role; wrapper menangani revisi dan delegasi modul lain. Kunci revisi global menserialkan penulisan, unique(report_id,version) menjadi pertahanan tambahan. Retry request yang sama mengembalikan hasil semula; expectedVersion atau revisi data yang sudah berubah ditolak. Snapshot tanpa perubahan tidak menghasilkan versi baru.

Pembacaan default memilih versi terbaru. `reportVersion` memilih arsip tertentu untuk unduhan; versi yang tidak ada tidak jatuh ke draft secara diam-diam. Seluruh snapshot riwayat tetap difilter per mata pelajaran sesuai izin. Fitur koreksi UI membutuhkan kapabilitas `extra.reportRevisions` dari RPC baru, sehingga schema lama tidak menampilkan aksi koreksi yang belum didukung.

Keputusan ada di `docs/decisions/approved-business-policy.md` dan `src/config/business-policy.ts`. Aturan PH20/ATS30/ASAS50, Praktik terpisah dan fee tidak berubah.

## Bukti pengujian

- `npm ci` dengan lockfile final: lulus, 576 package. Peringatan deprecation upstream tetap tercatat.
- `npm run check` final: **169 tes, 0 gagal**, termasuk 34 migrasi lokal/80 tabel RLS, drift tipe dan production build.
- Run sebelumnya gagal karena ekspektasi migrasi/tabel masih 33/79; ekspektasi diperbarui ke schema baru. Build sebelumnya gagal membaca cache Turbopack. Cache hasil build dipindahkan dan build bersih lulus; tidak mengubah konfigurasi build untuk menyamarkan kegagalan.
- `test:learning`: revisi immutable, akses per mapel, replay, stale, unchanged, pemilihan versi dan pemulihan snapshot.
- `tests/database/report-cloud-script.test.mjs`: skrip D10 scoped valid, seluruh fixture kembali 0 setelah rollback. Skrip ini **belum dijalankan di cloud**.
- `tests/release.test.mjs`: username berupa string, duplikat/case collision, orphan, nilai invalid, dan laporan tanpa bocoran isi sel.
- `npm run test:smoke`: 6 pemeriksaan lulus.
- Browser Chromium: **66 pemeriksaan, 9 layar axe tanpa pelanggaran**, viewport 360/375/768/1024/1440; revisi tanpa alasan/konfirmasi tidak dikirim, draft ditinjau, expectedVersion dikirim, konflik ditampilkan, siswa tidak mendapat tombol revisi. Respons mutasi diintercept; bukan UAT sesi produksi.
- Sampel PDF sintetis 4 halaman: halaman pertama/terakhir ditinjau visual, seluruh batas teks diperiksa dengan pdfplumber, nama `Muḥammad José Âminah` diekstrak utuh dengan pdftotext. Aset TTF terkonfirmasi di trace bundle API. File sampel tidak berisi data murid nyata.
- Bukti publik: `release-completion/browser-results.json`, `source-inventory.json`, `source-preflight.json`, `dependencies.json`, `deadcode.json`. Data pribadi, snapshot sumber, pemetaan per orang dan file review privat tidak masuk Git.

## Lingkup perubahan file

| File/kelompok | Alasan |
|---|---|
| `AGENTS.md`, `docs/decisions/approved-business-policy.md`, `src/config/business-policy.ts`, `README.md` | Catat keputusan D10 terbaru dan status lanjutan. |
| `supabase/migrations/20261021152554_report_versioned_corrections.sql` | Migrasi append-only revisi rapor; belum diterapkan cloud. |
| `src/lib/learning/validation.ts`, `src/lib/supabase/runtime.types.ts` | DTO revise, filter reportVersion, pesan pengguna dan kontrak RPC lokal. |
| `src/app/account/learning/[module]/panel.tsx` | Pratinjau, alasan/konfirmasi, riwayat dan unduhan versi; tabel reusable. |
| `src/lib/pdf/font.ts`, `assets/fonts/*`, `src/lib/learning/print.ts`, `src/lib/operations/export.ts`, `next.config.ts` | Font Unicode, pembungkusan teks, lisensi dan trace aset server. |
| `package.json`, `package-lock.json` | Pin fontkit 1.1.1, tes release dan perintah preflight. |
| `scripts/release/source-preflight.mjs`, `tests/release.test.mjs` | Pemeriksaan JSON/XLSX read-only, ringkasan tanpa data pribadi. |
| `scripts/database/verify-report-revisions.sql`, `tests/database/report-cloud-script.test.mjs` | Paket verifikasi D10 cloud dengan lingkup tiga akun/kelas sementara dan rollback. |
| `scripts/database/verify-learning.sql`, `tests/database/learning.test.mjs`, `tests/learning.test.ts`, `tests/database/foundation.test.mjs` | Regresi D10/restore/PDF dan hitungan schema baru. |
| Snapshot schema internal (lokal saja) | Introspeksi 34 migrasi dihasilkan untuk pemeriksaan lokal; unggahan lengkap ke GitHub ditolak auto-review, sehingga file tersebut tidak termasuk PR. Migrasi dan kontrak RPC yang diperlukan tetap disertakan. |
| `scripts/verify-ui.mjs`, `tests/ui/fixture.tsx` | Uji browser D10 menggunakan fixture terpisah dari route aplikasi. |
| `docs/verification/release-completion*` | Laporan dan bukti terbaru. |

## Persetujuan dan data yang masih dibutuhkan

Paket yang dapat ditinjau sudah konkret:

1. Migrasi D10: `rebuilt/supabase/migrations/20261021152554_report_versioned_corrections.sql` pada branch ini. Target produksi khusus `qpzoukkhdxpmbtkcqemj`; menambah tabel/versioned RPC, tidak menulis ulang arsip atau akun nyata.
2. Pengujian cloud D10 scoped: `rebuilt/scripts/database/verify-report-revisions.sql`, tiga identitas sintetis dan satu kelas sintetis, deadline 30 detik, satu transaksi diakhiri ROLLBACK. Tidak memanggil provider, job atau transaksi keuangan. Lebih baik dijalankan di staging terlebih dahulu.
3. Pengujian luas layanan/survei/job dan browser Auth memerlukan staging/fixture yang disetujui, penerima email/WA uji yang jelas, serta konfigurasi provider. Tidak menyalin secret produksi ke Preview sebagai jalan pintas.
4. Lengkapi workbook privat peninjauan 4 akun dan 13 pembayaran. Setelah pemetaan diterima, lanjutkan ekspor beku, import staging, rekonsiliasi seluruh domain/berkas, restore, beban bisnis dan UAT. GO/cutover tetap mengikuti `docs/release/cutover-runbook.md`.

### Penolakan peninjauan otomatis

Percobaan apply_migration produksi ditolak: pembacaan file dari working directory yang keliru menghasilkan pesan `cat`, bukan SQL; reviewer juga menilai persetujuan DDL produksi belum eksplisit. Tidak ada DDL diterapkan dan tidak ada retry melalui execute_sql. SQL yang benar kini tersedia di branch, divalidasi oleh replay migrasi dan 169 tes final.

Percobaan menjalankan `verify-services.sql` ditolak karena operasi service_role produksi terlalu luas, termasuk fixture Auth, survei dan job; rollback dianggap belum cukup membuktikan risiko dapat diterima. Tidak diulang lewat jalur lain. Pekerjaan independen tetap diselesaikan. Langkah cloud yang masih tertahan memerlukan persetujuan spesifik atas paket di atas; ini berasal dari auto-review, bukan syarat buatan skill.

Unggahan snapshot schema internal lengkap ke GitHub juga ditolak auto-review karena dinilai belum ada persetujuan pengungkapan yang eksplisit. Snapshot tidak diunggah melalui API lain atau disisipkan ke artefak pengganti. File snapshot historis yang sudah ada di main tidak diubah.
