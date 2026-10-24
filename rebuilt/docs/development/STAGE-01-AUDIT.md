# P01 — Audit kondisi awal dan rencana kerja

Tanggal: 24 Oktober 2026 (WIB). Baseline `main`: `9d05d4ba722474c4724b4a410b36d631ae43c7f8` (setelah PR #44). Branch: `docs/development-stage-1`.

Status: audit sumber dan perencanaan selesai. [Roadmap](ROADMAP.md) menjadi titik masuk sesi selanjutnya. Audit ini bukan sertifikasi keamanan menyeluruh, bukan UAT produksi dan bukan pernyataan cutover selesai.

## Metode dan batas

Diperiksa struktur route, navigasi, komponen shell/dashboard/kontrol, helper periode/mutasi, kontrak domain, API dispatchers, migration fondasi dan override terkait, suite pengujian, laporan audit existing, spesifikasi serta keputusan bisnis. Inventaris otomatis ada pada [snapshot](stage-01-baseline.json). Pencarian pola dipakai untuk menemukan kandidat, bukan membuktikan tidak ada implementasi lain.

Kesimpulan memakai tiga tingkat bukti: **sumber** (kode pada SHA baseline), **historis** (laporan tes terdahulu, tidak dianggap dijalankan ulang), dan **belum diukur** (perilaku pengguna/operasional nyata). Tidak mengakses data pribadi produksi, mengubah izin, menjalankan import, mengirim pesan atau memanggil AI berbayar.

## Inventaris fitur dan keputusan pengembangan

Semua path tabel relatif ke `rebuilt/`. Route modul dinamis dibatasi enum di validation; keberadaan file route bukan bukti seluruh kombinasi URL valid.

| Area | Bukti sumber utama | Kondisi awal dan keputusan |
|---|---|---|
| Identitas dan akses | `src/lib/auth/`, `src/app/account/{security,email,sessions,access}/`, `src/app/api/auth/`, `src/config/account-navigation.ts` | Sesi server, gate, recovery, perangkat dan akses read-only tersedia. Pertahankan batas server/RPC; gunakan sebagai dependensi seluruh fitur. |
| Pengguna dan keluarga | `src/app/account/{directory,profile,biodata,families}/`, `src/lib/{users,student,education,documents}/` | Provisioning, profil, dokumen dan relasi ada. Perluasan kualitas data/impor harus menjaga username teks, relasi dan private storage. |
| Tahun ajaran/kelas/jadwal | `src/lib/academic/period.ts`, `src/app/account/{classes,schedules}/`, `src/lib/education/validation.ts` | Format pasangan, semester dan jadwal sudah tersedia. P03 adalah sinkronisasi konteks lintas halaman, bukan mengganti format/ID penyimpanan. |
| Operasional siswa | `src/app/account/operations/[module]/`, `src/lib/operations/{attendance,duty,mentoring,committee,savings}.ts` | Absensi, piket, bimbingan, komite dan tabungan memiliki panel/kontrak khusus. Pertahankan audit, ledger/reversal, scope dan ekspor; perluas UX per alur. |
| Nilai/rapor/kelulusan | `src/app/account/learning/[module]/`, `src/lib/learning/validation.ts`, `supabase/migrations/20261021053613_report_snapshots.sql` | Batch nilai, penerbitan snapshot, kenaikan dan ijazah ada. Status final bukan fitur yang harus dibuat ulang. Koreksi arsip D10 tetap belum diputus. |
| Buku digital | `src/app/account/learning/[module]/{books-panel,reader}.tsx`, `src/lib/learning/books.ts` | Katalog, pembaca dan upload existing dipertahankan; evaluasi UX sesuai kebutuhan konten. |
| Poin/Survei/Hasil | `src/app/account/services/[module]/`, `src/lib/services/{discipline,surveys,survey-storage,providers}.ts` | Poin, draf/final Survei, analisis dan rencana aksi sudah ada. P07 pusat lintas modul; P12 perluasan AI, bukan penambahan provider dari nol. |
| Notifikasi/pekerjaan | `notifications-panel.tsx`, `jobs-panel.tsx`, `src/lib/services/{jobs,dispatch}.ts`, migration outbox/job | Inbox read/unread, job status dan antrean ada. Preferensi kategori/urgensi dan pusat tugas manusia belum ditemukan pada sumber yang diperiksa. Job pengiriman bukan tugas pengguna. |
| Rekonsiliasi dan impor | `src/lib/services/reconciliation.ts`, `scripts/release/reconcile.mjs`, migration `foundation_operations` | Rekonsiliasi manifest dan tabel import_batches/import_rows tersedia. Wizard impor pengguna umum belum ditemukan pada route/command yang diperiksa. Gunakan fondasi tersebut setelah analisis kontrak. |
| Design system | `docs/design-system/MASTER.md`, `src/app/globals.css`, `src/components/ui/`, `domain-controls.tsx` | Token, Card/Button/Dialog/Status/TableRegion sudah ada; banyak panel memiliki pola filter/status/pagination lokal. Perlu konsolidasi selektif dengan pilot, bukan redesign keseluruhan. |
| Operasional rilis | `package.json`, `scripts/verify-*.mjs`, `docs/release/cutover-runbook.md` | Suite lokal dan browser fixture luas. Bukti restore, UAT nyata, rekonsiliasi sumber dan load autentikasi tetap gerbang terbuka menurut runbook. Tidak ada GitHub Actions workflow pada tree baseline; otomatisasi CI perlu dievaluasi P10. |

## Temuan utama dan penyebab

| ID | Bukti dan temuan | Dampak / arah tindakan |
|---|---|---|
| F01 | `src/components/account-dashboard.tsx` berisi identitas, sesi, privasi dan daftar layanan; belum ringkasan pekerjaan domain. | P06 menambahkan informasi harian scoped dengan sumber nyata. Bukan bug bahwa dashboard saat ini berupa ringkasan akun. |
| F02 | WorkspaceContext berisi navigasi/identitas; tidak ada konteks periode global. Filter kelas/semester dikelola panel domain. | P03 menentukan kontrak konteks dan invalidasi. Jangan membawa filter ke modul yang berbeda semantik. |
| F03 | `useDomainMutation` memiliki mode confirmed, sementara panel lain memiliki lock/readback/dirty guard khusus. | P04 menyusun matriks perilaku dan menyatukan bagian aman. Tidak langsung mengganti seluruh mutasi dengan hook generik. |
| F04 | Komponen dasar shared tersedia, tetapi filter, paging dan feedback berulang di panel. | P02/P05 melakukan pilot dan evaluasi sebelum ekstraksi; kebutuhan pagination server dan client harus tetap berbeda. |
| F05 | Notifikasi berfokus pada read/unread; jobs berfokus pada outbox/job_runs. | P07 memisahkan konsep inbox, tugas manusia, dan job sistem; definisikan deduplikasi dan aturan prioritas. |
| F06 | Tabel activity_logs immutable berisi actor/action/entity/request_id/metadata. | P09 memetakan cakupan per command dan redaksi field; tabel existing tidak membuktikan semua perubahan punya diff sebelum/sesudah atau viewer berizin. |
| F07 | Import staging tersedia, batch nilai tersedia; route wizard impor umum belum ditemukan. | P08 pakai staging/validator existing setelah menentukan atomisitas, duplicate key, hak dan batas batch. |
| F08 | AI OpenAI/Anthropic/Gemini server sudah tersedia; laporan insights memakai HTTP mock. | P12 fokus review manusia, privasi dan anggaran; keberhasilan panggilan nyata/biaya belum dibuktikan audit ini. |
| F09 | `README.md` masih menyebut 159 tes/33 migrasi; `docs/architecture.md` menyatakan Auth runtime/cloud belum dikonfigurasi. README module M01/M02 masih placeholder. | Perbaiki titik masuk/arahan historis sekarang; jadwalkan sinkronisasi dokumentasi domain pada tahap terkait. Jangan memakai placeholder sebagai inventaris runtime. |
| F10 | Runbook masih meminta restore, UAT dan load autentikasi. Health hanya liveness. | P10 menyelesaikan bukti terpisah. Tanpa bukti baru, tidak menganggap cutover telah selesai meski deployment berjalan. |

## Peta dependency dan alur data

| Alur | Rantai dependency | Event dan titik rawan yang harus diuji |
|---|---|---|
| Halaman berizin | Cookie → verifiedPrincipal/security gate → capability/RPC/RLS → snapshot Zod → panel | Refresh sesi, penugasan dicabut, own/class/all, server outage; sidebar hanya presentasi. |
| Konteks akademik | Tahun ajaran → kelas/enrollment → semester → jadwal/absensi/nilai → rapor/ekspor | Pergantian periode harus menghapus pilihan yang tidak lagi sah setelah konfirmasi draf; GET dan POST sama scope. |
| Mutasi | Isian → validasi → requestId/revision → API sesi/origin → command RPC → acknowledgement/readback → UI | Double click, timeout setelah commit, stale revision, dua tab, unmount, readback gagal; jangan mengirim ulang write ambigu. |
| Finansial | Relasi/akun/tarif → pembayaran/ledger → alokasi/saldo → slip/ekspor/outbox | Family waiver, reversal, fee snapshot, repeat request; jangan mengubah saldo lewat edit tampilan. |
| Evaluasi | Periode/instrumen/target → draf → final → agregat berizin → analisis/rencana aksi | Draf lintas akun, final lock, batas privasi peer, sampling AI tidak sama dengan filter UI. |
| Pemberitahuan | Kejadian domain → outbox/dedupe → dispatcher → hasil penyedia → status UI | Accepted bukan bukti inbox penerima; ambiguous tidak boleh otomatis dikirim ulang. |
| Impor dan rilis | Sumber privat → staging/validasi → pemetaan UUID → commit domain → manifest/rekonsiliasi | Username nol awal/minus, duplikat, FK orphan, partial failure, arsip dan checksum dokumen. |

## Skenario penerimaan per peran/penugasan

Role dasar bersumber dari `src/lib/users/validation.ts`: admin, teacher, student, parent, alumni, customer, applicant. Penugasan dan scope bersumber dari directory/access dan SQL existing. Skenario berikut rencana penerimaan, bukan klaim sudah UAT.

| Pengguna | Tugas utama | Pembuktian wajib |
|---|---|---|
| Admin/TU | Pengguna, tahun ajaran, kelas, jadwal, konfigurasi dan pemulihan | Aksi terkonfirmasi, target jelas, tidak salah periode; secret tidak tercatat di log. |
| Guru mapel | Jadwal, absensi/nilai sesuai penugasan, survei | Kelas/mapel asing ditolak; kelas/semester konsisten; batch tidak hilang saat gagal. |
| Wali kelas | Kelengkapan data/rapor kelas binaan | Ringkasan cocok data sumber; kelas lain tidak terbuka; terbit tidak menimpa arsip. |
| Kepala madrasah | Ringkasan evaluasi dan rencana aksi | Agregat sesuai kewenangan, threshold privasi, batas waktu rencana existing. |
| Guru piket/Pembimbing | Catatan harian dan tindak lanjut siswa | Penugasan aktif/tanggal sah, duplikasi tertangani, scope tepat. |
| Bendahara/Pengelola tabungan | Pembayaran, setoran/tarik, slip, reversal | Saldo/alokasi/fee identik layar dan ekspor; konkurensi dan retry aman. |
| Siswa | Data sendiri, jadwal, rapor, survei, dokumen | Tidak dapat membaca/mengubah siswa lain melalui URL/API. |
| Orang tua multi-anak | Informasi setiap anak terhubung | Anak aktif jelas, pindah anak tidak mencampur snapshot; hubungan dicabut langsung berlaku. |
| Alumni | Dokumen kelulusan sesuai izin | Download dan preview terpisah sesuai kontrak; signed access tidak meluas. |
| Nasabah/customer | Layanan rekening sesuai izin | Rekening tidak ditentukan semata role; rekening asing ditolak. |
| Calon siswa | Profil/biodata sesuai akses | Tidak mendapat layanan akademik aktif hanya karena tampilan sidebar berubah. |

## Backlog terurut dan kriteria penerimaan

P0 = integritas/gerbang rilis; P1 = fondasi produktivitas; P2 = peningkatan lanjutan. P0 bukan klaim ada insiden aktif.

| ID | Prioritas / tahap | Pekerjaan dan batas | Kriteria penerimaan terukur |
|---|---|---|---|
| B01 | P1 / P02 | Inventaris pola dan pilot design system pada Hak akses saya + satu form mutasi | Token existing dipakai; keyboard/fokus dan error/empty/loading lulus; 4 viewport; hasil bisnis sama. |
| B02 | P1 / P03 | Kontrak konteks global tervalidasi, dipisahkan dari akses | Juli/Januari, tahun historis, kelas hilang/dicabut, reload/back dan dua tab teruji; tidak auto-save ke periode baru. |
| B03 | P0 / P04 | Matriks ack/idempotensi/konflik dan perlindungan draf per modul | Dua klik menghasilkan maksimal satu efek; write timeout diikuti readback; draf tetap ada saat gagal; data sensitif tidak masuk cache umum. |
| B04 | P1 / P05 | Rollout akun → kelas/jadwal → operasional → akademik → evaluasi | Setiap kelompok punya PR/regresi; 320/390/768/1440 dan landscape; tidak ada overflow dokumen horizontal; tabel scroll lokal. |
| B05 | P1 / P06 | Definisi metrik kerja setiap peran dan query scoped | Setiap angka memiliki definisi periode/sumber; cocok fixture/snapshot; tidak mengklaim data parsial sebagai total. |
| B06 | P1 / P07 | Definisi tugas manusia, urgensi, deadline, status, preferensi/dedupe | Status tugas mengacu sumber; revocation/dua tab/deduplikasi teruji; waktu WIB; notifikasi wajib tetap mengikuti kebijakan existing. |
| B07 | P1 / P08 | Pilot impor siswa, kemudian jadwal/nilai sesuai risiko | Preview tak menulis; validasi per baris; nol awal/minus utuh; batch duplicate/invalid/oversize dan retry teruji. |
| B08 | P1 / P08 | Laporan kualitas data berizin | Temuan punya alasan dan konteks, false positive dapat ditinjau; tidak menggabungkan akun atau memperbaiki saldo otomatis. |
| B09 | P0 / P09 | Matriks finalisasi dan audit coverage per command | Final tidak bisa ditimpa lewat API; alasan/pelaku/waktu tercatat tanpa secret; D10 tetap blocked sampai keputusan spesifik. |
| B10 | P0 / P10 | Pemantauan, request correlation, backup/restore, release gate | Error ID dapat ditelusuri tanpa PII; restore staging + rekonsiliasi + rollback terbukti; RPO/RTO dicatat dari latihan. |
| B11 | P0 / P10 | CI dan benchmark alur autentikasi | Pemeriksaan PR diwajibkan sesuai kemampuan repo; beban 60/132 sesuai runbook pada staging; p50/p95/error/lock dilaporkan, bukan health saja. |
| B12 | P1 / P11 | Uji tugas, panduan dan saluran kendala | Skenario peran di atas dijalankan; waktu/sukses/error tercatat; temuan prioritas tinggi ditangani sebelum penerimaan. |
| B13 | P2 / P12 | Perluasan AI existing dengan review dan kendali penggunaan | Label AI/sumber/periode, batas biaya/request, redaksi PII, refusal/timeout teruji; output tidak menulis nilai/keuangan/izin otomatis. |

## Rancangan pengukuran

Baseline perilaku pengguna **belum tersedia**. Jangan menyalin angka tes historis sebagai ukuran kepuasan/performa.

| Metrik | Cara mengukur | Kondisi awal / target |
|---|---|---|
| Waktu tugas dan keberhasilan | UAT tugas yang sama sebelum/sesudah, per peran, minimal 3 pengulangan; catat median dan kendala | Belum diukur; target ditetapkan setelah baseline awal, wajib tidak memperburuk tugas utama. |
| Salah input/ulang kerja | Jumlah validasi gagal, duplikasi, isian hilang dan retry per tugas; tanpa menyimpan isi sensitif | Belum diukur; integritas duplikasi/scope wajib lulus skenario otomatis. |
| Penyimpanan tak pasti | Fault injection sebelum/sesudah commit; catat hasil readback dan efek domain | Wajib tidak menampilkan sukses palsu/menulis ulang otomatis. |
| Tindak lanjut | Waktu penemuan tugas, penyelesaian, overdue dan dedupe pada P07 | Belum ada baseline lintas modul; ukur ketika definisi tugas disepakati. |
| Aksesibilitas/responsivitas | Keyboard, touch, axe, teks panjang, empty/many/error dan 4 viewport + landscape | Tidak ada pelanggaran kritis/serius yang belum ditangani; scrolling vertikal normal tetap. |
| Performa | p50/p95 baca/tulis/ekspor pada data representatif dan beban staging runbook | Belum diukur pada audit ini; tetapkan anggaran per alur setelah baseline, tanpa kapasitas fiktif. |
| Dukungan | Jumlah laporan per alur dan waktu penyelesaian, ID error tanpa credential | Belum diukur; siapkan pencatatan P10/P11. |

## Risiko, keputusan dan pekerjaan yang menunggu bukti

- Scope ganda (peran + penugasan + relasi) harus tetap berasal server; pemilihan periode/anak di client bukan izin.
- Global context dapat memindahkan pekerjaan ke periode salah; P03 bergantung validasi dan dirty guard, bukan state browser semata.
- Generalisasi hook terlalu dini dapat menghapus sifat idempoten domain; P04 harus membaca kontrak RPC setiap command.
- Import/finalisasi/audit dapat membutuhkan migrasi additive pada tahap terkait; bukan alasan merombak database sekarang.
- D10, matriks persetujuan baru, tarif/batas biaya AI, retensi log/draf dan target RPO/RTO memerlukan aturan konkret sebelum implementasi yang bergantung padanya. Persetujuan roadmap bukan keputusan nilai tersebut.
- Data sumber privat, operator restore, akun UAT dan lingkungan staging diperlukan untuk gerbang operasional. Catat blocked jika belum tersedia; lanjutkan pekerjaan independen.
- Laporan lama berisi pemeriksaan cloud pada waktu berbeda; status konfigurasi/provider saat ini belum diverifikasi ulang pada P01.

## Perubahan P01 dan validasi

| File | Alasan |
|---|---|
| `docs/development/ROADMAP.md` | Menyimpan tujuan, 12 tahap, dependensi, gerbang dan prosedur melanjutkan sesi. |
| `docs/development/STAGE-01-AUDIT.md` | Menyimpan inventaris fitur, temuan, alur data, skenario peran, backlog dan ukuran keberhasilan. |
| `docs/development/stage-01-baseline.json` | Snapshot route/menu/migrasi/perintah tes dan blob sumber pada SHA audit. |
| `docs/development/stage-01-verification.json` | Bukti exit code aktual dan batas pengujian tahap dokumentasi. |
| `README.md` | Titik masuk roadmap; mengganti hitungan tes/migrasi usang dengan acuan bertanggal. |
| `AGENTS.md` | Instruksi membaca konteks dan memeriksa baseline sebelum melanjutkan siklus baru. |
| `docs/architecture.md` | Menandai konteks fondasi lama sebagai historis tanpa menghapus kontrak arsitektur. |


P01 hanya menambah roadmap, laporan audit, snapshot inventaris dan bukti pemeriksaan; memperbarui titik masuk README/AGENTS serta menandai arsitektur awal sebagai catatan historis. Tidak ada perubahan source runtime, package/lockfile, migration, database, API, role atau data pengguna.

Hasil perintah aktual disimpan pada [verification](stage-01-verification.json). Pemeriksaan aplikasi adalah baseline kompatibilitas untuk commit dokumentasi. Browser/UAT/restore/load/provider nyata tidak dijalankan ulang pada P01. Laporan PR44 pada `../verification/access/` tetap bukti historis yang terpisah.

Langkah berikutnya: P02/B01, dimulai dari pembacaan MASTER dan pemetaan pola pilot, tanpa menjalankan P03–P12 sekaligus.
