# Tahap 1 — Matriks Kesetaraan Fungsional Rebuilt SiM-Murid

Versi 1.1 • 19 Oktober 2026 • Status tahap: **Selesai untuk inventaris dan perencanaan; implementasi belum dimulai**.

## 1. Dasar dan batas cakupan

Acuan: `Dasar_Pembangunan_Ulang_SiM-Murid_Nextjs_Supabase.md`, versi 1.0, SHA-256 `2b00916bda2843fbf37eed440df0486d4571860353a7653c9bd223aae7235064`. Identitas sumber lama: `kamadmtsnf-ai/sim-muridv2`, commit `bf1e0e0dcb8bec9c23319fba8eda6331889ebba1`. Semua nomor baris di sini merujuk Code.gs/Index.html pada commit tersebut, disalin dari katalog dokumen acuan, bukan nomor baris matriks.

Tujuan: mempertahankan kemampuan pengguna dan efek bisnis di **Next.js App Router + TypeScript + Vercel + Tailwind CSS + shadcn/ui + Zod + Supabase**. Matriks merupakan dokumen turunan; acuan asli tidak diubah. Rancangan route, tabel, dan service di sini adalah TARGET, bukan struktur yang sudah dibangun.

Matriks membedakan: (1) fitur yang ditelusuri langsung ke simbol sumber; (2) seluruh deklarasi backend/frontend yang diinventarisasi; (3) helper yang kepemilikan modulnya baru merupakan calon berdasarkan nama/lokasi. **Inventaris 100% tidak berarti seluruh fungsi sudah dipetakan secara semantik atau teruji.** Pada tahap implementasi, setiap calon wajib dikonfirmasi/dipindahkan serta diberi padanan nyata. Tidak ada akun produksi, isi spreadsheet, object Drive, atau runtime lama yang diuji pada Tahap 1.

## 2. Ringkasan kendali

- 125 unit fitur/kebutuhan pada 17 modul, masing-masing memiliki ID stabil, scope, sumber, kriteria uji, tahap dan status.
- 387 deklarasi backend (386 nama unik), termasuk dua deklarasi uploadFileToDrive yang dipisahkan berdasarkan lokasi.
- 1345 entri frontend, termasuk nested/assignment; identitas memakai nama+baris+bentuk, bukan nama saja.
- 29 kelompok uji U01–U29 pada dokumen dasar diwarisi. Kriteria tambahan per baris melengkapi kelompok tersebut.
- 9 keputusan/pemeriksaan awal D01–D09; D01–D03 disepakati 19 Oktober 2026 pukul 12.51 WIB. D10 tambahan KKM dicatat dalam dokumen Tahap 2; lainnya mengikuti status masing-masing.
- Semua implementasi berstatus **BELUM**; semua hasil uji **BELUM DIJALANKAN**. Penetapan tahap bukan estimasi durasi atau bukti implementasi.

### Status dan pembaruan

`BELUM` → `DIKERJAKAN` → `TERUJI`; `TERHAMBAT` dipakai jika item benar-benar tidak dapat dilanjutkan karena dependensi/keputusan. Tanda Dxx pada item BELUM menunjukkan dependensi keputusan, bukan alasan memblokir seluruh modul. Desain/review dapat berjalan sambil menunggu keputusan; rumus/otorisasi terkait tidak difinalkan diam-diam.

Setiap perubahan status harus mencatat ID fitur, path implementasi/commit, migrasi terkait, ID tes, hasil aktual, bukti, tanggal, serta penyimpangan yang disetujui. Kolom target dalam lampiran saat ini hanya owner/service yang direncanakan. Jangan menghapus baris fungsi lama saat digabung; tandai padanan bersama atau diganti mekanisme, dengan alasan dan tes regresinya.

## 3. Modul target, halaman, data dan dependensi

| Modul | Route dasar TARGET | Data utama TARGET | Dependensi utama | Tahap |
|---|---|---|---|---|
| M01 Akun/keamanan | /login, /security, /profile | Auth,profiles,app_sessions,recovery_requests,email_verifications | fondasi DB dan auth | 5–9,11 |
| M02 Dashboard | /dashboard | query agregat terotorisasi | seluruh modul data terkait | 30; shell pada8 |
| M03 Pengguna/direktori | /users,/teachers,/students,/applicants,/parents,/alumni | profiles,user_roles,user_assignments,student_guardians | M01,M04 | 9,13,20 |
| M04 Biodata/berkas | /profile,/students/[id],/documents | student_profiles,guardian_profiles,addresses,documents | M01,M03; Storage private | 11–12 |
| M05 Kelas/bimbingan | /classes,/mentoring | classes,enrollments,mentor_groups,mentor_students,mentoring_reports | M03,M04,master hafalan | 14,18 |
| M06 Jadwal | /schedules,/my/schedules | lesson_schedules,student_duty_assignments | M05,subjects,teacher assignments | 15 |
| M07 Absensi | /attendance,/my/attendance,/children/[id]/attendance | student_attendance,holidays,enrollments | M05,M08,M17 | 17 |
| M08 Guru piket | /duty | teacher_duty_sessions,outbox,job_runs | M03,M07,M17 | 16,29 |
| M09 Iuran | /fees,/my/fees,/children/[id]/fees | committee_payments,payment_allocations,family_benefits | M04,M05,fee policies | 19 |
| M10 Tabungan | /savings,/my/savings,/children/[id]/savings | savings_accounts,savings_transactions,fee_brackets,withdrawal_slips | M03,M04,profil sekolah,outbox | 20–21 |
| M11 Nilai/rapor | /grades,/my/grades,/children/[id]/grades | assessments,assessment_scores,minimum_passing_grades,report_policies | M05,M06,periode,profil sekolah | 22–23 |
| M12 Kenaikan/alumni | /graduation,/alumni | promotion_batches,enrollments,graduations | M03,M05,M13 | 24 |
| M13 Ijazah | /diplomas,/my/diplomas | diplomas,diploma_access_overrides,documents | M04,M12,Storage | 24 |
| M14 Buku | /ebooks | ebooks,documents | M01,flag premium,Storage/locator | 25 |
| M15 SPK | /discipline,/my/discipline,/children/[id]/discipline | point_catalog,point_events,point_balances,point_reset_snapshots,affective_scores | M04,M05,M17 | 26–27 |
| M16 Survei | /surveys,/my/surveys | survey_* ,micro_survey_questions,ai_analysis_runs | M01,M03,M06,M17 | 28–29 |
| M17 Lintas modul | /settings,/activity,/notifications | settings_public/private,school_profile,subjects,holidays,outbox,activity_logs | infrastruktur,semua domain | 8–10,27,29–30 |

Route /my dan /children adalah rancangan penamaan, dapat disesuaikan tanpa mengubah scope. Pemilihan anak wajib diverifikasi ulang di server. Dashboard final menunggu sumber data; shell bukan dashboard selesai. Ekspor dibangun bersama modulnya dan direkonsiliasi lagi pada30. RLS/log/audit/validasi bukan pekerjaan yang ditunda sampai tahap30.

## 4. Legenda akses

Admin = akun dengan izin administratif; Kepala = Guru bertugas Kepala Madrasah/Sekolah; Wali = Wali Kelas; Mentor = Guru Wali; Pengelola = Pengelola Tabungan; Bendahara = Bendahara Komite. Kepala bukan otomatis Admin. Kombinasi tugas menggabungkan izin yang sah, bukan memberi semua akses. Kata “sesuai izin” menandai granularitas aksi yang perlu dikonfirmasi pada D05; tidak dapat dipakai sebagai policy produksi yang belum ditulis.

Setiap aksi baca/tulis/ekspor/unduh memeriksa sesi+izin+scope. Tidak ada kebebasan mengisi callerUsername/adminUser dari browser. Siswa/Nasabah/Alumni melihat diri sendiri; orang tua melalui relasi anak; Guru melalui jadwal/kelas/mentor/tugas harian. Field role,verified,premium,aksesTabungan bukan field profil yang boleh diedit sendiri.

## 5. Matriks fitur dan penerimaan

Keterangan sumber: G=Code.gs; H=Index.html. Bila nama muncul di beberapa lokasi, semuanya dicantumkan agar shadowing/closure tidak hilang. Status awal seluruh baris BELUM, bukti implementasi/tes belum ada. ID Uxx mengacu bagian12 dokumen dasar; teks setelahnya adalah kriteria spesifik tambahan.

### M01 — Autentikasi, sesi, keamanan dan onboarding

| ID / Tahap | Fitur atau alur | Akses dan scope | Sumber yang ditelusuri | Penerimaan | Keputusan | Status |
|---|---|---|---|---|---|---|
| M01-F01 / 5 | Login username/password | Semua akun; identitas sendiri | `loginUser` (G:651) | U01: benar/salah; tidak memakai spreadsheet sebagai validator | D04 | BELUM |
| M01-F02 / 6 | Remember me dan batas usia sesi | Semua akun; sendiri | `verifySession` (G:1031); `logoutUser` (G:1020) | U01: 1 jam/168 jam, reload, expiry, logout efektif di API | D04 | BELUM |
| M01-F03 / 6 | Satu sesi aktif dan label perangkat | Semua akun; sendiri; Admin reset | `loginUser` (G:651); `getActiveSessionInfo` (G:6817); `adminResetSession` (G:826) | U01,U14: login perangkat kedua ditolak; reset mencabut akses lama | D04 | BELUM |
| M01-F04 / 6 | Ubah password dan wajib ganti awal | Semua akun; sendiri | `verifyPassword` (G:3884); `changePassword` (G:3898); `adminResetPassword` (G:753) | U02: password awal unik; password lama ditolak setelah ganti | D04 | BELUM |
| M01-F05 / 6 | Pertanyaan keamanan dan pemulihan password | Pemilik akun; Admin sesuai izin | `hashAnswer` (G:6665); `updateSecurityQuestion` (G:6670); `getSecurityQuestion` (G:6691); `requestUserReset` (G:6702); `selfResetPassword` (G:6736); `verifySecurityAnswer` (G:6879) | U01,U02: jawaban salah/rate limit ditolak; reset memakai bukti tambahan | D04 | BELUM |
| M01-F06 / 6 | Pemulihan dan permintaan reset sesi | Pemilik akun; Admin | `requestUserResetSesi` (G:6770); `selfResetSesi` (G:6845); `getPendingResetCount` (G:816) | U01: permintaan terlihat; reset tidak dapat memakai username korban saja | D04 | BELUM |
| M01-F07 / 11 | Gate kelengkapan profil | Siswa/Calon Siswa; sendiri | `checkProfileIncomplete` (G:5372) | U02,U06: semua kombinasi kondisional tidak membuat loop | — | BELUM |
| M01-F08 / 9 | Verifikasi email Guru dan perubahan email | Guru; sendiri | `requestEmailOtp` (G:394); `verifyEmailOtp` (G:397); `resendEmailOtp` (G:524); `updateProfil` (G:3734) | U03: TTL600s, cooldown60s,5 kirim/hari,5 percobaan; reuse ditolak | — | BELUM |
| M01-F09 / 8 | Urutan gate keamanan/profil/email/survei | Semua peran terkait | `generateMenu` (G:848); `_assertEmailGate` (G:629); `loadContent` (H:14714) | U02: prioritas tunggal; halaman perbaikan dan logout tetap dapat dijangkau | D04 | BELUM |
| M01-F10 / 7 | Otorisasi server dan perlindungan RLS | Seluruh aksi dan peran | `generateMenu` (G:848); `_isAdminOnly` (G:12809); `_isKepalaMadrasah` (G:12101) | U04,U05: caller palsu, direct route dan API lintas akun ditolak | D05 | BELUM |

### M02 — Dashboard seluruh peran

| ID / Tahap | Fitur atau alur | Akses dan scope | Sumber yang ditelusuri | Penerimaan | Keputusan | Status |
|---|---|---|---|---|---|---|
| M02-F01 / 30 | Dashboard Admin dan agregasi periode | Admin; seluruh data berizin | `getDashboardStatsAdmin` (G:3772); `getDashboardBundleAdmin` (G:14353) | U04: kartu/total periode cocok sumber transaksi, tidak mengambil semua data ke client | — | BELUM |
| M02-F02 / 30 | Dashboard Guru menurut tugas tambahan | Guru; kelas/mapel/tugas sah | `getDashboardStatsGuru` (G:3808); `getDashboardBundleGuru` (G:14445); `getPiketDashboard` (G:4529); `getTabunganDashboard` (G:4588) | U04: gabungan tugas benar; akses baca tidak berubah menjadi tulis | D05 | BELUM |
| M02-F03 / 30 | Dashboard Siswa | Siswa; sendiri | `getDashboardBundleSiswa` (G:14596); `getStudentAttendanceStats` (G:4733) | U11: jadwal/kehadiran/iuran/tabungan/poin sesuai akun | — | BELUM |
| M02-F04 / 30 | Dashboard Orangtua dan pemilihan anak | Orangtua; anak terhubung | `getAnakList` (G:7576); `getOrangtuaDashboard` (G:7620); `verifyAnakRelasi` (G:7723) | U05: ganti anak benar; ID anak keluarga lain ditolak | — | BELUM |
| M02-F05 / 30 | Dashboard Nasabah/Alumni/tabungan | Nasabah/Alumni/Guru berflag; sendiri | `getDashboardBundleSavings` (G:14650); `getGlobalSavingsSummary` (G:4809) | U04: saldo pribadi cocok ledger tanpa kebocoran saldo orang lain | — | BELUM |

### M03 — Pengguna dan direktori

| ID / Tahap | Fitur atau alur | Akses dan scope | Sumber yang ditelusuri | Penerimaan | Keputusan | Status |
|---|---|---|---|---|---|---|
| M03-F01 / 9 | CRUD akun dan flag akses | Admin; Kepala baca sesuai tugas | `addUser` (G:1551); `editUser` (G:1572); `deleteUser` (G:1606); `getAllUsers` (G:768) | U04: username unik; perubahan role/flag hanya berizin; histori tetap utuh | D05 | BELUM |
| M03-F02 / 9 | Pencarian/filter/status online/reset | Admin; scope kelola akun | `getAllUsers` (G:768); `getPendingResetCount` (G:816) | getAllUsers: urutan role/nama, badge reset dan online sesuai sesi valid | — | BELUM |
| M03-F03 / 13 | Direktori dan detail Guru | Admin/Kepala sesuai izin | `getAllGuruSummary` (G:5528); `getGuruDetail` (G:5479) | U04: penugasan/jadwal/kelas/bimbingan benar; profil pribadi terbatas | D05 | BELUM |
| M03-F04 / 13 | Direktori dan detail Siswa | Admin/Kepala; pengajar/wali sesuai scope | `getAllSiswaData` (G:3496); `getSiswaDetailAdmin` (G:5588) | U04,U05: pencarian/filter/detail tidak menembus scope | D05 | BELUM |
| M03-F05 / 13 | Direktori Calon Siswa dan progres profil | Admin/Kepala; calon sendiri | `getCalonSiswaData` (G:14667); `getCalonSiswaDetail` (G:14798); `_calculateProfileProgressPercentage` (G:14725) | U06: progres menangani syarat kondisional; detail terotorisasi | — | BELUM |
| M03-F06 / 13 | Direktori Orang Tua dan anak | Admin/Kepala sesuai izin | `getOrangTuaData` (G:14882); `getAnakList` (G:7576) | U05: relasi banyak anak benar tanpa pencocokan nama | — | BELUM |
| M03-F07 / 13 | Direktori Alumni | Admin/Kepala sesuai izin | `getAllAlumniData` (G:3448); `getAlumniDetailAdmin` (G:3462) | U18: kelulusan tidak menghilangkan biodata dan saldo | — | BELUM |
| M03-F08 / 20 | Daftar Nasabah/non-siswa | Admin/Pengelola Tabungan | `getNasabahList` (G:6892) | U04: Guru/Nasabah/Alumni sesuai model rekening dan izin | D08 | BELUM |

### M04 — Biodata siswa, keluarga, alamat dan dokumen

| ID / Tahap | Fitur atau alur | Akses dan scope | Sumber yang ditelusuri | Penerimaan | Keputusan | Status |
|---|---|---|---|---|---|---|
| M04-F01 / 11 | Biodata siswa dan keluarga lengkap | Siswa/Calon sendiri; Admin sesuai izin | `getSiswaDetail` (G:5233); `saveSiswaDetail` (G:5260); `ensureSiswaDetailHeaders` (G:5961) | U06: semua field sumber dipetakan; NIK/KK/HP text; nol bukan kosong | — | BELUM |
| M04-F02 / 11 | Alamat ayah/ibu/wali bersyarat | Pemilik profil; petugas berizin | `checkProfileIncomplete` (G:5372); `saveSiswaDetail` (G:5260) | U06: meninggal/luar negeri/sama alamat/wali lain konsisten UI-server | — | BELUM |
| M04-F03 / 11 | Relasi orang tua–anak dan saudara | Admin/petugas berizin | `getAnakList` (G:7576); `verifyAnakRelasi` (G:7723); `_syncSaudaraIuran` (G:1425) | U05,U12: relasi banyak-ke-banyak; tidak menggabungkan username numerik | D06 | BELUM |
| M04-F04 / 12 | Unggah/ganti dokumen per jenis | Pemilik profil; petugas berizin | `uploadStudentDocument` (G:5991); `_validateStudentDocFormat_` (G:5894); `_detectFileExtFromBytes_` (G:5879) | U07: jenis/ext/magic bytes/ukuran/empty; object ownership diverifikasi | — | BELUM |
| M04-F05 / 12 | Hapus dokumen dan rekonsiliasi metadata | Pemilik profil; petugas berizin | `deleteStudentDocument` (G:6061) | U07: gagal hapus/unggah tidak meninggalkan metadata sukses palsu | — | BELUM |
| M04-F06 / 12 | Preview PDF/gambar/zoom dan unduh | Pemilik/yang berizin | `getDocumentForDownload` (G:6634); `getDocumentBase64` (G:6653); `extractDriveFileId` (G:6649;H:41245) | U05,U07: URL/ID file milik pihak lain ditolak; signed URL expired tertangani | — | BELUM |
| M04-F07 / 10 | Logo/asset sekolah dan adapter unggah | Admin | `uploadFileToDrive` (G:5845,15011) | U07: dua deklarasi lama diganti layanan eksplisit; objek tetap sesuai kelas privasi | — | BELUM |

### M05 — Kelas, wali kelas, guru wali dan bimbingan

| ID / Tahap | Fitur atau alur | Akses dan scope | Sumber yang ditelusuri | Penerimaan | Keputusan | Status |
|---|---|---|---|---|---|---|
| M05-F01 / 14 | CRUD kelas dan wali kelas | Admin; Wali/Kepala sesuai scope | `addClass` (G:1325); `updateClass` (G:1341); `deleteClass` (G:1362); `getClassData` (G:1311); `getWaliKelasList` (G:1809) | U04: wali kelas berbeda dari Guru Wali; referensi histori tidak terhapus | D05 | BELUM |
| M05-F02 / 14 | Daftar siswa kelas dan ringkasannya | Wali kelas sendiri; Admin/Kepala | `getStudentsByClass` (G:1635); `getStudentsByWali` (G:1671); `getClassList` (G:1663) | U04,U12: kehadiran/iuran/saldo/bimbingan cocok ID siswa | — | BELUM |
| M05-F03 / 18 | Penugasan Guru Wali ke siswa | Admin; Kepala baca; mentor sendiri | `getGuruWaliCandidates` (G:3508); `getGuruWaliData` (G:3523); `saveGuruWali` (G:3540); `deleteGuruWali` (G:3573) | U04,U05: daftar bimbingan sah; edit ID hilang menghasilkan NOT_FOUND | D05 | BELUM |
| M05-F04 / 18 | Setoran hafalan | Guru Wali; siswa bimbingan | `handleSetoranSubmit` (H:27238); `saveLaporanBimbingan` (G:3597); `updateLaporanBimbingan` (G:5037) | surah,predikat,catatan,tanggal tersimpan; hafalan Lainnya wajib teks | — | BELUM |
| M05-F05 / 18 | Laporan perkembangan | Guru Wali; siswa bimbingan | `handleLaporanSubmit` (H:27371); `saveLaporanBimbingan` (G:3597); `updateLaporanBimbingan` (G:5037) | aspek,deskripsi,tanggal tersimpan; Guru tidak mengubah laporan pihak lain | — | BELUM |
| M05-F06 / 18 | Riwayat/rekap/edit/hapus bimbingan | Admin/Guru Wali sesuai ownership | `getAllLaporanBimbingan` (G:3627); `deleteLaporanBimbingan` (G:3666) | U04,U05: tampilan pimpinan/pribadi, filter dan koreksi konsisten | D05 | BELUM |
| M05-F07 / 18 | Bimbingan pribadi dan anak | Siswa sendiri; Orangtua anak sah | `getLaporanBimbinganBySiswa` (G:3689); `loadLaporanBimbinganAnak` (H:67857) | U05: hanya data sendiri/anak terhubung, termasuk detail hafalan | — | BELUM |

### M06 — Jadwal pelajaran dan piket siswa

| ID / Tahap | Fitur atau alur | Akses dan scope | Sumber yang ditelusuri | Penerimaan | Keputusan | Status |
|---|---|---|---|---|---|---|
| M06-F01 / 15 | CRUD jadwal Pelajaran | Admin; Wali kelas berizin; Kepala baca | `saveScheduleBatch` (G:3343); `getScheduleData` (G:3331); `deleteSchedule` (G:1107) | U08: kelas/hari/mapel/Guru/JTM/waktu tersimpan; edit benar | D05 | BELUM |
| M06-F02 / 15 | Kalkulasi waktu selesai dan istirahat | Pengelola jadwal sesuai scope | `hitungWaktuSelesai` (H:36364) | U08:07:00+2×40+15=08:35; istirahat tidak hilang saat edit | — | BELUM |
| M06-F03 / 15 | Batch piket siswa per kelas | Admin/Wali kelas sesuai izin | `saveScheduleBatch` (G:3343) | U08: mengganti Piket kelas atomik tanpa menghapus Pelajaran | — | BELUM |
| M06-F04 / 15 | Hapus jadwal batch dan filter | Pengelola jadwal sesuai scope | `deleteSchedulesBatch` (G:5136); `loadManajemenJadwal` (H:21612) | U08: selected IDs scoped; reload tidak memakai selection usang | — | BELUM |
| M06-F05 / 15 | Jadwal siswa/Guru harian | Siswa sendiri; Guru sendiri | `getStudentSchedules` (G:1151); `getScheduleByClass` (G:1135); `getTodayScheduleForTeacher` (G:5020) | U04: data jadwal sesuai kelas/penugasan, hari dan timezone | — | BELUM |

### M07 — Absensi siswa dan hari efektif

| ID / Tahap | Fitur atau alur | Akses dan scope | Sumber yang ditelusuri | Penerimaan | Keputusan | Status |
|---|---|---|---|---|---|---|
| M07-F01 / 17 | Input batch absensi | Admin/Guru Piket/pengganti terkonfirmasi sesuai scope | `saveAttendanceBatch` (G:1880) | U09,U10: validasi semua item,duplikat payload dan request bersamaan; atomik | D05 | BELUM |
| M07-F02 / 17 | Koreksi dan hapus absensi | Petugas berizin sesuai scope | `updateAttendance` (G:1967); `deleteAttendance` (G:2026) | U04,U09: perubahan diaudit; akses scope/tanggal ditegakkan server | D05 | BELUM |
| M07-F03 / 17 | Riwayat, rekap dan arsip absensi | Admin/Kepala/Wali sesuai scope | `getAttendanceData` (G:1821); `getAttendanceRecap` (G:4340); `getAttendanceRecapByPeriod` (G:5641) | U11: tahun kalender,filter,status,paginasi,total dan grouping benar | — | BELUM |
| M07-F04 / 17 | Absensi Kelasku | Wali Kelas; kelas kelolaan | `getAttendanceByClassAndDate` (G:4477); `getWaliKelasByGuru` (G:4458); `loadAbsensiKelasku` (H:25662) | U04: kelas lain ditolak; grafik/rekap/arsip konsisten | — | BELUM |
| M07-F05 / 17 | Kehadiranku dan Kehadiran Anak | Siswa sendiri; Orangtua anak sah | `getAttendanceSiswa` (G:4410); `getAttendanceRecapSiswa` (G:4436); `getKehadiranAnak` (G:7739) | U05,U11: riwayat/kalender/rekap hanya scope sah | — | BELUM |
| M07-F06 / 17 | Hari efektif dan dua persentase | Semua pembaca sesuai scope | `getHariEfektif` (G:4704); `getStudentAttendanceStats` (G:4733) | U11: Minggu/libur dikecualikan; denominator rekap vs hari efektif diberi label | — | BELUM |

### M08 — Konfirmasi guru piket dan pengingat

| ID / Tahap | Fitur atau alur | Akses dan scope | Sumber yang ditelusuri | Penerimaan | Keputusan | Status |
|---|---|---|---|---|---|---|
| M08-F01 / 16 | Konfirmasi/batal piket utama | Admin; data hari berjalan | `getPiketHariIni` (G:13425); `konfirmasiPiketUtama` (G:13477); `batalKonfirmasiPiketUtama` (G:13671) | U10: belum konfirmasi tidak bisa input; pembatalan mencabut izin langsung | — | BELUM |
| M08-F02 / 16 | Penunjukan/konfirmasi/batal pengganti | Admin; Guru pengganti di hari tugas | `tunjukPiketPengganti` (G:13528); `konfirmasiPiketPengganti` (G:13612); `batalKonfirmasiPiketPengganti` (G:13698); `batalTunjukPiketPengganti` (G:13730) | U10: non-Guru Piket dapat akses sementara; esok tidak mewarisi | — | BELUM |
| M08-F03 / 16 | Daftar pengganti dan verifikasi gate | Admin/Guru terkait | `getPiketPenggantiHariIni` (G:13576); `getAllGuruForPiket` (G:13653); `cekPiketPenggantiTerkonfirmasi` (G:13407); `_isPiketTerkonfirmasi_` (G:13385) | U10: sesi terverifikasi dan penugasan hari ini menjadi sumber izin | — | BELUM |
| M08-F04 / 29 | Pengingat absensi dan dedup harian | Job/petugas berizin | `kirimNotifikasiPiketHarian` (G:13918); `_hitungProgressPiketHariIni_` (G:13768); `_alreadySentPiketReminderToday_` (G:13871) | U28: lima pemeriksaan, maksimal satu sukses/user/hari; libur/lengkap dilewati | D07 | BELUM |
| M08-F05 / 29 | Preview/manual/status jadwal pengingat | Admin | `previewNotifikasiPiketHarian` (G:14019); `runNotifikasiPiketHarianNow` (G:14022); `getStatusTriggerNotifPiket` (G:14245) | U28: dry-run tidak kirim; error tercatat; retry tidak duplikat | D07 | BELUM |

### M09 — Iuran komite dan diskon saudara

| ID / Tahap | Fitur atau alur | Akses dan scope | Sumber yang ditelusuri | Penerimaan | Keputusan | Status |
|---|---|---|---|---|---|---|
| M09-F01 / 19 | Pembayaran iuran multibulan | Admin/Bendahara Komite; Kepala baca | `addIuran` (G:1408); `getIuranHistoryByStudent` (G:3126); `handleSubmitIuran` (H:16594) | U12: bulan/tahun/semester benar; bulan lunas terkunci kecuali transaksi edit | — | BELUM |
| M09-F02 / 19 | Diskon saudara kandung | Sistem; keluarga terhubung | `_syncSaudaraIuran` (G:1425) | U12: kelas natural terendah gratis Rp0; uang masuk tidak bertambah | D06 | BELUM |
| M09-F03 / 19 | Koreksi/hapus pembayaran dan waiver | Admin/Bendahara sesuai izin | `updateIuran` (G:1531); `deleteIuran` (G:1510) | U12: alokasi dan benefit turunan direkonsiliasi atomik dan diaudit | D06 | BELUM |
| M09-F04 / 19 | Rekap/tren/arsip dan tunggakan | Admin/Bendahara; Kepala baca | `getIuranData` (G:1383); `getIuranRecap` (G:3166); `hitungTotalIuranPeriode` (G:4645) | U12: termasuk belum pernah bayar; total uang dan status bulan tidak tercampur | D06 | BELUM |
| M09-F05 / 19 | Iuran pribadi dan anak | Siswa sendiri; Orangtua anak sah | `getIuranSiswa` (G:1168); `getIuranRecapSiswa` (G:1199); `getIuranAnak` (G:7757) | U05,U12: daftar bulan/histori cocok alokasi resmi | — | BELUM |

### M10 — Tabungan, fee dan slip

| ID / Tahap | Fitur atau alur | Akses dan scope | Sumber yang ditelusuri | Penerimaan | Keputusan | Status |
|---|---|---|---|---|---|---|
| M10-F01 / 20 | Setoran tabungan siswa/non-siswa | Admin/Pengelola Tabungan | `saveSavings` (G:2931); `getNasabahList` (G:6892) | U13,U14: minimal/kelipatan1000; setor kedua hari sama→DUPLICATE→edit | D08 | BELUM |
| M10-F02 / 20 | Penarikan dan pemeriksaan saldo | Admin/Pengelola Tabungan | `saveSavings` (G:2931); `getStudentSavingsInfo` (G:3021); `_calcSaldoSebelum_` (G:2126) | U13: cek saldo di transaksi DB; dua tarik bersamaan tidak overdraft | D02,D08 | BELUM |
| M10-F03 / 20 | Koreksi/void transaksi dan audit | Admin/Pengelola Tabungan | `updateSavings` (G:2980); `deleteSavings` (G:3001) | U14: efek lama dikeluarkan sebelum validasi; ledger+reversal mempertahankan histori | D08 | BELUM |
| M10-F04 / 20 | Riwayat/rekap/grafik/filter tabungan | Pengelola; Kepala baca; pemilik terbatas | `getSavingsData` (G:2068); `getSavingsRecap` (G:3059); `getGlobalSavingsSummary` (G:4809) | U13: sumSetor−sumTarik cocok akun; rekap periode dibedakan saldo keseluruhan | — | BELUM |
| M10-F05 / 20 | Tabunganku dan Tabungan Anak | Siswa/Nasabah/Alumni/Guru berflag; Orangtua anak sah | `getSavingsSiswa` (G:1290); `getSavingsRecapSiswa` (G:1306); `getTabunganAnak` (G:7748) | U05: saldo/riwayat sendiri atau anak sah; flag baca bukan izin kelola | — | BELUM |
| M10-F06 / 21 | CRUD bracket fee | Admin/Pengelola Tabungan | `getFeeConfig` (G:4934); `saveFeeConfig` (G:4954); `deleteFeeConfig` (G:4986) | U15: batas min/max, maxnull, persentase, overlap dan urutan deterministik | D02 | BELUM |
| M10-F07 / 21 | Toggle/pembulatan/penerapan fee | Pengelola; server authoritative | `calculateFeeAndPercent` (H:33731); `toggleFeeCalc` (H:33659); `_calcFeeAmount_` (G:2721) | U15:Rp123000×1%; hasil form/slip/ledger sama menurut keputusan | D02 | BELUM |
| M10-F08 / 21 | Nomor dan isi slip tarik HTML/PDF | Pengelola/penerima sah | `_generateNoSlip_` (G:15063); `_buildSlipPenarikanHtml` (G:2294); `_buildSlipPenarikanPdfBlob_` (G:2441); `terbilang` (G:2173) | U14,U27: nomor unik tetap,terbilang,saldo,fee,kop/tanda tangan konsisten | D02 | BELUM |
| M10-F09 / 21 | Email slip dan retry | Job; Admin/Pengelola sebagai penerima | `_dispatchSlipPenarikanEmail` (G:2752); `_getSlipEmailRecipients_` (G:2674) | U28: provider gagal tidak membatalkan ledger; retry tidak kirim ganda | D07 | BELUM |

### M11 — Penilaian, KKM dan rapor

| ID / Tahap | Fitur atau alur | Akses dan scope | Sumber yang ditelusuri | Penerimaan | Keputusan | Status |
|---|---|---|---|---|---|---|
| M11-F01 / 22 | Kelas/mapel mengajar dan input batch | Guru sesuai jadwal; Admin sesuai izin | `getGuruMapelKelas` (G:6910); `saveNilaiBatch` (G:6943) | U04,U17: Guru tidak input mapel/kelas lain; nilai0 berbeda kosong | D05 | BELUM |
| M11-F02 / 22 | Penomoran PH dan upsert jenis lain | Guru sesuai penugasan | `saveNilaiBatch` (G:6943); `getDistinctPHNumbers` (G:7282) | U17: PH historis tidak diulang; ATS/ASAS/Praktik unik per siswa/kelas/mapel/periode | — | BELUM |
| M11-F03 / 22 | Riwayat/edit/hapus nilai | Guru pemilik; Admin sesuai izin | `getRiwayatNilai` (G:7082); `updateNilai` (G:7160); `deleteNilai` (G:7138) | U04,U17: ownership ID Guru; filter tipe/PH/periode; audit koreksi | D05 | BELUM |
| M11-F04 / 22 | KKM per periode dan snapshot | Guru berizin; Admin | `getKKM` (G:7337); `saveKKM` (G:7359;H:49012); `getKKMByPeriode` (G:7427); `getAllKKM` (G:7440) | U17: KKM periode tepat; nilai lama mempertahankan snapshot | — | BELUM |
| M11-F05 / 23 | Rekap nilai dan rumus rapor gabungan | Guru/Siswa/Orangtua sesuai scope | `getRekapNilai` (G:7200); `renderRaportSiswa` (H:48854) | U16:82 vs84,5 pada data fixture; formula resmi berversi | D01 | BELUM |
| M11-F06 / 23 | Rapor per jenis/predikat/mapel | Guru berizin; siswa sendiri; orang tua anak sah | `getRaportSiswa` (G:7491); `getNilaiSiswa` (G:7303); `getNilaiAnak` (G:7730) | U16,U17: jenis/gabungan dibedakan; urutan mapel,KKM,predikat,pembulatan konsisten | D01 | BELUM |
| M11-F07 / 23 | Unduh rapor satu/pilihan/semua | Pengajar/petugas/pemilik sesuai scope | `downloadRaportPDF` (H:49548); `downloadRaportSingle` (H:49842); `downloadRaportBatch` (H:49868); `downloadRaportSemua` (H:49880) | U27: batch tidak melewati scope; PDF panjang/identitas/tanda tangan benar | D01 | BELUM |

### M12 — Kenaikan kelas dan alumni

| ID / Tahap | Fitur atau alur | Akses dan scope | Sumber yang ditelusuri | Penerimaan | Keputusan | Status |
|---|---|---|---|---|---|---|
| M12-F01 / 24 | Kenaikan massal dan promosi calon | Admin berizin | `processKenaikanKelas` (G:4136); `getKenaikanKelasData` (G:4059) | U18:7→8→9→Alumni;calon→7; batch tahun tidak diproses dua kali | — | BELUM |
| M12-F02 / 24 | Penempatan manual dan pemulihan status | Admin berizin | `processPenempatanKelas` (G:4229); `getSiswaForKenaikan` (G:4199) | U18: mappingID; Alumni/calon→kelas sah; histori tidak hilang | — | BELUM |
| M12-F03 / 24 | Registrasi alumni dan histori | Admin/sistem | `_registerAlumniToIjazahSheet_` (G:4087); `getAllAlumniData` (G:3448) | U18: ijazah baris baru deny; nilai/tabungan/iuran/dokumen tetap utuh | — | BELUM |

### M13 — Ijazah dan akses alumni

| ID / Tahap | Fitur atau alur | Akses dan scope | Sumber yang ditelusuri | Penerimaan | Keputusan | Status |
|---|---|---|---|---|---|---|
| M13-F01 / 24 | CRUD metadata dan berkas ijazah | Admin; Alumni sendiri sesuai izin | `saveIjazahData` (G:6517); `getIjazahData` (G:6425); `getAllIjazahData` (G:6452); `uploadIjazahDocument` (G:6560); `deleteIjazahDocument` (G:6604) | U07,U19: jenis file/metadata terpelihara; ownership object diverifikasi | — | BELUM |
| M13-F02 / 24 | Akses global dan override individual | Admin; Alumni pembaca | `getIjazahAccessSetting` (G:6104); `saveIjazahAccessSetting` (G:6121); `getIjazahAccessForUser` (G:6141); `saveAlumniIjazahAccess` (G:6204) | U19: allow/deny/inherit terpisah view/download; override mengungguli global | — | BELUM |
| M13-F03 / 24 | Akses ijazah massal dan lokasi | Admin | `getIjazahAccessAll` (G:6167); `saveAlumniIjazahAccessMassal` (G:6225); `getIjazahFolderSetting` (G:6302); `saveIjazahFolderSetting` (G:6330) | U19: bulk hanya alumni target; bucket/path padanan folder lama | — | BELUM |
| M13-F04 / 24 | Preview/unduh Ijazahku | Alumni sendiri dan berizin | `loadIjazahku` (H:51420); `downloadDocIjazah` (H:51621) | getDocumentForDownload: izin dicek sebelum bytes/URL; tidak ada endpoint URL sembarang | — | BELUM |

### M14 — Buku digital

| ID / Tahap | Fitur atau alur | Akses dan scope | Sumber yang ditelusuri | Penerimaan | Keputusan | Status |
|---|---|---|---|---|---|---|
| M14-F01 / 25 | CRUD katalog buku digital | Admin; semua pembaca sesuai izin | `getEBooks` (G:5063); `addEBook` (G:5083); `updateEBook` (G:5098); `deleteEBook` (G:5117) | metadata judul/penulis/penerbit/tahun/versi/kategori/mapel/kelas/URL/premium utuh | — | BELUM |
| M14-F02 / 25 | Pencarian/filter dan akses premium | Semua peran sesuai flag | `loadEBook` (H:33793) | U04: premium dicek server; pencarian/filter/paginasi tidak membocorkan akses | — | BELUM |
| M14-F03 / 25 | Reader/flipbook/scroll/zoom/fallback | Pembaca berizin | `_flipbookLoadPDF` (H:34767); `_flipbookRenderScrollMode` (H:34987); `_flipbookRenderFlipMode` (H:35449); `renderFlipbook` (H:36035) | PDF terbuka sesuai izin; pindah halaman/zoom/mode/fallback dan URL lama tertangani | — | BELUM |

### M15 — SPK / poin kedisiplinan

| ID / Tahap | Fitur atau alur | Akses dan scope | Sumber yang ditelusuri | Penerimaan | Keputusan | Status |
|---|---|---|---|---|---|---|
| M15-F01 / 26 | Katalog kode/poin/konsekuensi | Admin pengelola; Guru pembaca berizin | `getPoinKatalog` (G:7902); `savePoinKatalog` (G:7951); `deletePoinKatalog` (G:7991); `initSheetsSPK` (G:7837) | seed A01–I04 utuh; nonaktif menolak event baru, histori snapshot tetap | D05 | BELUM |
| M15-F02 / 26 | Input event dan pengali residivis | Guru/Admin sesuai scope | `savePoinEvent` (G:8186); `savePoinEventF3` (G:9412); `cekResidivis` (G:8011) | U20: A01−2 menghasilkan50→48→44→38→0; R02/R03 sesuai kode/bulan | D05 | BELUM |
| M15-F03 / 26 | Pembatalan/replay kronologis/rebuild | Petugas berizin | `deletePoinEvent` (G:8304); `recalculateSaldoSiswa` (G:8041); `rebuildPoinSaldo` (G:8557) | U20: cancel tidak dihitung; backdate replay; sesudah R03+5=5 | — | BELUM |
| M15-F04 / 26 | Saldo dan level batas | Semua pembaca sesuai scope | `getPoinSiswa` (G:8327); `hitungLevel` (G:7829) | U21: clamp−50..100; batas51/31/21/11/1/0 benar; label tidak mengeksekusi DO | — | BELUM |
| M15-F05 / 26 | Scope global/kelas/bimbingan/pribadi/anak | Admin/Guru/Wali/Guru Wali/Siswa/Orangtua | `getPoinPerKelas` (G:8384); `getPoinRekap` (G:8429); `getPoinSiswaBimbingan` (G:9477); `getPoinSiswaDashboard` (G:9551); `loadPoinAnak` (H:57654) | U04,U05: tab menurut tugas, data dan ekspor mengikuti scope sama | D05 | BELUM |
| M15-F06 / 27 | Notifikasi poin dan penerima | Sistem; siswa/BK/wali/orangtua/Admin | `kirimNotifikasiSPK` (G:8177); `kirimNotifEksternalSPK` (G:9064) | U20,U28: level>=2 penerima relasi;>=3 Admin;R02/R03 khusus tanpa hardcode admin | D07 | BELUM |
| M15-F07 / 27 | Reset bulanan/snapshot dan job | Job/Admin berizin | `resetPoinBulanan` (G:8513); `triggerResetPoinBulananF3` (G:9429); `setupTriggerResetBulananF3` (G:9465) | U21: bulan+siswa unik; retry tidak menimpa/menggandakan; bulan baru50 | D07 | BELUM |
| M15-F08 / 27 | Analitik/rekap/tren/ranking | Admin/Kepala sesuai izin | `getDashboardAnalitikSPK` (G:9291); `getDashboardStatsPoin` (G:8475) | U21: agregasi cocok event/snapshot, filter bulan/kelas konsisten | D05 | BELUM |
| M15-F09 / 27 | SoTM dan sertifikat | Pembaca berizin; pribadi/anak sesuai hak | `getStudentOfTheMonth` (G:9121); `exportSertifikatSoTM` (H:56295); `exportSertifikatSiswaSoTM` (H:57605) | U21,U27: saldo tertinggi,tie pelanggaran; kelas runner-up/globaltop3,sertifikat | D09 | BELUM |
| M15-F10 / 27 | Konversi nilai afektif | Admin berizin | `syncNilaiAfektifSPK` (G:9183) | U21:saldo50→67; periode/mapel/siswa unik; duplicate skipped | — | BELUM |
| M15-F11 / 27 | Konfigurasi SPK/WA/email | Admin | `getKonfigurasiSPK` (G:8936); `saveKonfigurasiSPK` (G:8966); `kirimEmailSPK` (G:8994); `kirimWhatsAppSPK` (G:9039) | U28: enable/threshold/modelmapel dipakai; credential tersamarkan | D07 | BELUM |

### M16 — Survei evaluasi, peer, mikro, rencana aksi dan AI

| ID / Tahap | Fitur atau alur | Akses dan scope | Sumber yang ditelusuri | Penerimaan | Keputusan | Status |
|---|---|---|---|---|---|---|
| M16-F01 / 28 | Kelola periode dan target survei | Admin/Kepala sesuai izin | `createSurveiPeriode` (G:10041); `updateSurveiPeriode` (G:10137); `tutupSurveiPeriode` (G:10206); `getAllSurveiPeriode` (G:9949) | U23: tanggal/status/target valid; periode tutup menolak jawaban baru | — | BELUM |
| M16-F02 / 28 | Peringatan dekat ujian | Admin/Kepala sesuai izin | `cekTimingUjian` (G:9977) | default14hari; data Hari_Libur ternormalisasi; override eksplisit tercatat | — | BELUM |
| M16-F03 / 28 | Gate survei wajib dan progres | Siswa/Guru/Orangtua sasaran | `cekSurveiWajib` (G:9882); `getSurveiStatus` (G:10361); `getSurveiPeriodeAktif` (G:9864) | U02,U22: gate menurut periode/role; progres reload konsisten | D03 | BELUM |
| M16-F04 / 28 | Instrumen A/B dan attention check | Siswa/Guru/Orangtua sasaran | `SURVEI_QBANK` (Lampiran C: seed instrumen); `_surveiKodeWajibBaginA` (G:10242); `_surveiAttentionExpected` (G:10266) | U23: kode/teks/role/jenis lengkap;ATT1=1,ATT2Siswa=5 | D03 | BELUM |
| M16-F05 / 28 | Rotasi delapan mapel siswa | Siswa sasaran | `generateMapelRotasi` (G:10520); `_surveiGetMapelRotasiSiswa` (G:10572) | U22:8 tetap saat reload; prioritas histori rendah+seed;4Likert+1esai/mapel | D03 | BELUM |
| M16-F06 / 28 | Evaluasi empat kegiatan | Siswa sasaran | `SURVEI_KEGIATAN_RUTIN` (Lampiran C: seed instrumen); `_surveiKodeDSiswa` (G:10494) | U23:UPB/RHS/SNM/MSP masing-masing3Likert+1esai terpetakan | D03 | BELUM |
| M16-F07 / 28 | Autosave lokal/server dan pemulihan koneksi | Responden sendiri | `saveSurveiJawaban` (G:10587); `_surveiSaveToServer` (H:65901); `_surveiAutoSyncDrafts` (H:65997); `_surveiSaveDraftLocal` (H:63776) | U22: offline/reload/sesiakhir/pulih; draft akun lain tidak terbaca; versi lama tak menimpa | — | BELUM |
| M16-F08 / 28 | Snapshot peer dan draft penilaian | Guru sasaran; selain diri sendiri | `generatePeerSnapshot` (G:11003); `saveSurveiPeerDraft` (G:11112); `getSurveiPeerStatus` (G:11042) | U24: daftar tetap;6dimensi1–5/TT; esai peer opsional; outsider ditolak | — | BELUM |
| M16-F09 / 28 | Submit peer dan submit utama | Responden sendiri | `submitSurveiPeer` (G:11272); `submitSurveiUtama` (G:10775); `_surveiValidateStep` (H:66007) | U23,U24: semua rekan selesai; final mengunci; aturan esai UI/server sama | D03 | BELUM |
| M16-F10 / 28 | Flag keandalan jawaban | Sistem; Admin/Kepala hasil sesuai izin | `submitSurveiUtama` (G:10775); `_surveiIsRowFlagged` (G:11537) | U23: straightline/durasi/attention menghasilkan tinggi/sedang/rendah sesuai aturan | — | BELUM |
| M16-F11 / 29 | Hasil personal Guru dan privasi peer | Guru sendiri | `getSkorPeerSayaSendiri` (G:11352); `getLaporanPersonalGuru` (G:11447) | U24:TT dikecualikan; minimal5penilai substantif; maksimal3kutipan; identitas tidak dibuka | — | BELUM |
| M16-F12 / 29 | Monitoring progres/flag/catatan | Admin/Kepala sesuai izin | `getSurveiProgressAll` (G:11613); `setCatatanAdminSurvei` (G:12069) | U23: daftar/status/flag/notes terotorisasi, tidak mengubah jawaban submitted | D05 | BELUM |
| M16-F13 / 29 | Rekap aspek/mapel/kegiatan/peer/esai | Admin/Kepala sesuai izin | `getSurveiRekapAspek` (G:11753); `getSurveiRekapMapel` (G:11799); `getSurveiRekapKegiatan` (G:11851); `getSurveiRekapPeer` (G:11902); `getSurveiEsaiAll` (G:11996) | filterperiode/role/flag benar; TT/nonrespon tidak dianggap skor0 | — | BELUM |
| M16-F14 / 29 | Tren antarsemester | Admin/Kepala sesuai izin | `getTrenAnterSemester` (G:12303) | periode/aspek/role/jumlahperiode konsisten dengan agregat dan versi instrumen | — | BELUM |
| M16-F15 / 29 | Rencana aksi dan ketercapaian | Kepala Madrasah penulis; pembaca sesuai fungsi publik | `simpanRencanaAksi` (G:12116); `getRencanaAksi` (G:12233); `getRencanaAksiPublik` (G:10423); `updateStatusKetercapaian` (G:12267) | U25:3–7poin;setelah tutup–H+30; status/aspek valid; Admin tanpa tugasKepala ditolak | — | BELUM |
| M16-F16 / 29 | Survei mikro | Admin/Kepala pengelola; responden sasaran | `createSurveiMikro` (G:12469); `getSurveiMikroAktifUntukUser` (G:12439); `saveSurveiMikroJawaban` (G:12564); `getLaporanSurveiMikro` (G:12712) | banner/target/waktu/pertanyaandinamis/submit/laporan benar; tidak tertukar surveiutama | — | BELUM |
| M16-F17 / 29 | Konfigurasi Gemini/Anthropic | Admin | `simpanKonfigurasiAI` (G:12848); `getKonfigurasiAI` (G:12870); `simpanAnthropicApiKey` (G:12884); `getAnthropicConfig` (G:12909) | U26: write-only secret; maskedstatus; provider aktual dibedakan | D07 | BELUM |
| M16-F18 / 29 | Analisis esai/cache/error/ulang | Admin/Kepala sesuai izin | `getEsaiUntukAnalisis` (G:12929); `jalankanAnalisisAI` (G:13052); `getHasilAnalisisAI` (G:13003); `hapusCacheAnalisisAI` (G:13261) | U26: min5,max150,1500karakter; validasiJSON; error/cache/token/model tercatat | D07 | BELUM |

### M17 — Pengaturan, log, notifikasi dan UX umum

| ID / Tahap | Fitur atau alur | Akses dan scope | Sumber yang ditelusuri | Penerimaan | Keputusan | Status |
|---|---|---|---|---|---|---|
| M17-F01 / 10 | Profil sekolah/kop/logo/alamat | Admin; pembaca sesuai keluaran | `getSchoolProfile` (G:5716); `saveSchoolProfile` (G:5775); `_buildAlamatGabungan_` (G:5701) | U27: field lengkap dan aset dipakai semua keluaran yang relevan | — | BELUM |
| M17-F02 / 10 | Master mapel dan hafalan | Admin; pengguna baca sesuai fitur | `getMapelData` (G:3928); `saveMapel` (G:3940); `updateMapel` (G:4292); `deleteMapel` (G:3970); `getHafalanData` (G:5155); `saveHafalan` (G:5167); `updateHafalan` (G:5194); `deleteHafalan` (G:5216) | CRUD tersimpan; rename tidak merusak histori/jadwal/nilai/laporan | — | BELUM |
| M17-F03 / 10 | Hari libur satuan/rentang | Admin; pembaca perhitungan | `saveHariLibur` (G:4004); `updateHariLibur` (G:4320); `deleteHariLibur` (G:4022); `saveHariLiburBatchRange` (G:4880); `listHariLibur` (G:14121); `addHariLibur` (G:14139;H:57012); `removeHariLibur` (G:14183;H:57036) | U11,U28: headerlama ternormalisasi, rentang inklusif dan dedup tanggal | — | BELUM |
| M17-F04 / 9 | Profil pribadi nama/HP/email/bio | Pemilik akun | `updateProfil` (G:3734); `getUserFreshData` (G:3396) | U03,U04: perubahan email reset verified; privilege tidak dapat disisipkan | — | BELUM |
| M17-F05 / 8 | Navigasi/subtab/anak aktif/mobile | Semua peran sesuai menu | `loadContent` (H:14714); `renderDashboard` (H:13054); `checkPageReadOnly` (H:15081) | U04: URL/subtab kembali benar; anak/filter tidak tertukar akun; focus/modal responsif | D05 | BELUM |
| M17-F06 / 8 | Loading/error/kosong/anti double-submit | Semua pengguna | `showLoading` (H:17487); `hideLoading` (H:17492); `showToast` (H:12841); `handleSavingsSubmit` (H:21293) | API gagal tidak tampil sukses; modal bisa dipulihkan; idempotency server melengkapi disablebutton | — | BELUM |
| M17-F07 / 9 | Log audit aksi dan log pribadi | Admin seluruh berizin; pengguna sendiri | `logActivity` (G:908); `getLogData` (G:929); `getLogDataByUser` (G:972); `exportLogCsv` (H:17567) | U04,U05,U27: actor dari sesi, filter/paginasi/CSV scoped, tidak memuat secret | — | BELUM |
| M17-F08 / 27 | Inbox notifikasi/badge/read | Penerima sendiri | `getNotifikasi` (G:8615); `tandaiDibaca` (G:8642); `tandaiSemuaDibaca` (G:8659) | U05: mark milik orang lain ditolak; badge konsisten | — | BELUM |
| M17-F09 / 29 | Outbox/retry/job dan observabilitas | Server/job berizin | `kirimNotifikasiPiketHarian` (G:13918); `_dispatchSlipPenarikanEmail` (G:2752); `kirimNotifEksternalSPK` (G:9064) | U28: kegagalan provider terpisah dari transaksi; retry idempotent dan dapat dipantau | D07 | BELUM |
| M17-F10 / 30 | Paket ekspor lintas modul | Sesuai scope data tiap modul | `exportTabunganPDF` (H:20893); `exportTabunganXLSX` (H:20976); `downloadRekapKelasPDF` (H:26579); `downloadRekapPDF` (H:31119); `exportPDFSiswa` (H:53953); `exportPDFRekap` (H:54464); `exportExcelGlobal` (H:54891) | U27: filter seluruh halaman,total,kop,tandatangan,font,CSV/XLSXinjection teruji | — | BELUM |
| M17-F11 / 30 | Rekonsiliasi migrasi dan restore | Petugas migrasi/operasional | `plainText` (G:4); `safeText` (G:9); `excelSerialToDate` (G:1); `_cmpUsername` (G:14) | U29: hitungbaris/orphan/saldo/alokasi/nilai/SPK/dokumen cocok; tabrakanusername direview | D04,D06 | BELUM |
| M17-F12 / 30 | Uji beban dan UAT seluruh peran | Tim penguji akun sanitasi | `getDashboardBundleAdmin` (G:14353); `saveAttendanceBatch` (G:1880); `saveSurveiJawaban` (G:10587) | U01–U29;60–132pengguna;ukurp50/p95,error,retry; bukan klaim hasil benchmark | — | BELUM |

## 6. Register keputusan Tahap 2

Status diperbarui sesuai keputusan pengguna pada dokumen Tahap 2 versi 1.0. D01–D03 DISEPAKATI; D04–D09 tetap merupakan pemeriksaan/desain sesuai rinciannya. D10 tambahan KKM masih rekomendasi. Semua status implementasi fitur tetap BELUM.

| ID | Hal yang perlu ditetapkan | Bukti/risiko | Rekomendasi awal untuk dibahas | Tahap terdampak |
|---|---|---|---|---|
| D01 | Rumus resmi rekap/rapor dan perlakuan nilai kosong | Backend20/30/50; frontend dengan Praktik20/25/40/15; berbeda hasil82 vs84,5 | DISEPAKATI: selalu PH20%+ATS30%+ASAS50%; Praktik terpisah; rincian arsip/KKM pada D10 belum diputus |22–23|
| D02 | Bracket, pembulatan, toggle dan pembebanan fee | UIribuan vs backendrupiah; slip menghitung fee dari bracket walau toggle tidak terbawa sebagai field | DISEPAKATI: pembulatan ribuan terdekat; fee mengurangi tunai diterima sesuai baseline slip; satu kalkulator dan snapshot fee_applied |20–21|
| D03 | Esai mana wajib/opsional dan validasi submit | _surveiValidateStep menganggap esai opsional; submitSurveiUtama mewajibkan esai tertentu | DISEPAKATI: esai wajib sesuai daftar backend; peer opsional; step/final/server/progres konsisten |28–29|
| D04 | Onboarding akun tanpa email, reset aman, satu sesi dan gate | Username/password wajib; Auth/sesi baru tidak otomatis setara perilaku lama; keamanan pertanyaan saja tidak cukup | Tetapkan jalur provisioning/recovery tanpa email dan prioritas gate; implementasi registry sesi server |5–9,11|
| D05 | Matriks izin aksi detail Kepala/Guru/BK/Wali | Menu dan read-only lama tidak cukup sebagai otorisasi; beberapa kemampuan bersifat scope-specific | Tetapkan resource×aksi×scope untuk tugas tunggal/gabungan; deny bila belum ditetapkan |7,9,13–18,22,26–29|
| D06 | Definisi keluarga/tarif/periode wajib dan koreksi diskon saudara | CSV orang tua ambigu; pembayaran diedit/dihapus tidak merekonsiliasi gratis; belum pernah bayar hilang dari rekap | Relasi eksplisit, allocations,waiver terhubung sumber; contoh saudara lebih dari2 dan orang tua ganda wajib dibahas |11,19|
| D07 | Penyedia email/WA/AI, scheduler dan operasional | Konfigurasi/runtime/batas paket aktual tidak ada; reminder5slot tetapi1sukses/hari | Adapter+outbox+retry+secret server; tetapkan penyedia dan jadwal sesuai kebutuhan/batas aktual |21,27–30|
| D08 | Koreksi/void ledger, setoran harian, jenis penabung | Hapus fisik lama, UI siswa/non-siswa vs label Siswa/Guru/Nasabah; alumni punya Tabunganku | Model rekening dan tipe terpisah role; append-only+reversal; jaga pengalaman DUPLICATE→edit |20–21|
| D09 | Tie SoTM setelah saldo dan pelanggaran sama | Urutan sisa pada sumber bisa mengikuti urutan data | Tetapkan tie-break stabil atau juara bersama beserta pengaruh sertifikat |27|

D01–D03 adalah konflik perilaku yang sudah diputus pengguna. Rekomendasi awal pada bagian lain tetap menjadi riwayat, bukan pilihan aktif bila bertentangan dengan keputusan tersebut. D04–D09 adalah keputusan/pemeriksaan desain dan kebijakan agar implementasi konkret; tidak semuanya memerlukan pertanyaan pengguna bila dapat dipastikan dari baseline dan konteks yang sah. Masalah yang belum diputus tidak membenarkan hilangnya fitur.

## 7. Kontrak lintas modul yang harus diuji

| Hubungan | Invariant dan uji integrasi |
|---|---|
| Akun→seluruh domain | Revoke sesi, perubahan role/tugas dan gate berlaku pada request berikutnya, bukan hanya navigasi |
| Keluarga→iuran/akses anak | Parent-anak memakai ID; siblingwaiver dan parentdashboard memakai relasi konsisten |
| Enrollment→histori | Kenaikan tidak memindahkan absensi/nilai/transaksi lama ke kelas baru; saldo rekening tetap |
| Jadwal→nilai | Kewenangan mapel/kelas mengikuti teaching assignment sah; histori tetap ber-ID stabil |
| Piket→absensi | Konfirmasi harian memberi izin sementara; batal langsung mencabut; tidak berlaku hari berikut |
| Hari libur→absensi/pengingat/survei | Satu tanggal bisnis WIB; Minggu/libur dan timing ujian dipahami sesuai konteks |
| Iuran→benefit saudara | Uang masuk terpisah pembebasan; edit/void sumber merekonsiliasi tanpa menggandakan |
| Ledger→slip/email/ekspor | Saldo/fee/nomor sama; email gagal tidak rollback ledger dan retry tidak mendebit ulang |
| SPK→saldo/notifikasi/SoTM/afektif | Replay menjadi sumber saldo; pembatalan/backdate memutakhirkan agregat sesuai periode; snapshot reset idempotent |
| Survei→progres/peer/final/rekap | Jawaban required konsisten; final immutable; TT bukan0; scope dan versi instrumen dipertahankan |
| Kelulusan→ijazah | Registrasi alumni baru deny; override efektif terpisah view/download |
| Data→ekspor | Query dan scope sama dengan layar; ekspor seluruh hasil filter, bukan halaman aktif saja |
| Sekolah→dokumen keluaran | Kop/logo/identitas/tanda tangan bersumber konfigurasi resmi; arsip snapshot bila dibutuhkan |

## 8. Kendali pengujian dan migrasi

Setiap fitur perlu minimal satu tes berhasil dan satu tes penolakan yang relevan; gunakan tes domain untuk rumus, integrasi transaksi untuk concurrency, RLS/API untuk izin dan E2E untuk alur pengguna. Bukan kewajiban membuat tes yang hanya menyalin detail implementasi. U01–U29 tidak ditandai lulus pada Tahap1.

Sebelum cutover kumpulkan bukti: schema/header spreadsheet aktual; jumlah baris per sheet; tabrakanusername; FK orphan; saldo per rekening dan total; totaluang iuran vs bulan paid/waived; nilai/KKM/rapor per periode; replay SPK/snapshot; jawaban draft/submitted dan peer; berkas/checksum/izin; job/scheduler yang aktif. Data produksi belum tersedia dan **tidak menjadi syarat inventaris Tahap1 selesai**, tetapi wajib untuk membuktikan migrasi pada30.

Template bukti per fitur:

```text
ID fitur:
Status: BELUM / DIKERJAKAN / TERUJI / TERHAMBAT
Path dan commit implementasi:
Migrasi/seed/RLS:
ID tes dan hasil aktual:
Bukti UI/API/DB/ekspor yang relevan:
Keputusan Dxx dan versi kebijakan:
Penyimpangan disetujui:
Tanggal verifikasi / penanggung jawab:
```

## 9. Lampiran pemetaan seluruh deklarasi backend

Setiap baris katalog backend asli dipertahankan. `Langsung` berarti fungsi menjadi rujukan fitur tertentu pada bagian5; `Calon` berarti owner modul yang diusulkan dari nama/lokasi dan wajib dikonfirmasi saat porting. Status semua BELUM; simbol padanan konkret serta bukti tes belum ada. Owner target `src/modules/<module>/service` dapat berubah; helper lintas domain ditempatkan pada lib bersama dengan catatan pemanggil. Fungsi GAS-only (bootstrap sheet/reauthorize/trigger) diganti mekanisme migrations/seed/job/adapter dan tidak perlu menjadi endpoint baru.

| Kunci sumber | Fungsi (signature lama) | Sheet literal | Modul target / jenis pemetaan | Fitur langsung | Padanan implementasi | Status |
|---|---|---|---|---|---|---|
| BE-00001 | `excelSerialToDate(serial)` | — | M17 / langsung | M17-F11 | Direncanakan; belum ada path/commit | BELUM |
| BE-00004 | `plainText(val)` | — | M17 / langsung | M17-F11 | Direncanakan; belum ada path/commit | BELUM |
| BE-00009 | `safeText(val)` | — | M17 / langsung | M17-F11 | Direncanakan; belum ada path/commit | BELUM |
| BE-00014 | `_cmpUsername(sheetVal, inputVal)` | — | M17 / langsung | M17-F11 | Direncanakan; belum ada path/commit | BELUM |
| BE-00040 | `_migrateAddEmailVerified_()` | Users | M01 / calon |  | Direncanakan; belum ada path/commit | BELUM |
| BE-00059 | `_ensureEmailOtpSheet_()` | — | M01 / calon |  | Direncanakan; belum ada path/commit | BELUM |
| BE-00084 | `_readOtpRows_()` | — | M01 / calon |  | Direncanakan; belum ada path/commit | BELUM |
| BE-00109 | `_appendOtpRow_(record)` | — | M01 / calon |  | Direncanakan; belum ada path/commit | BELUM |
| BE-00122 | `_updateOtpStatusById_(id, newStatus, opts)` | — | M01 / calon |  | Direncanakan; belum ada path/commit | BELUM |
| BE-00142 | `_supersedePendingOtpForUser_(username, emailTarget)` | — | M01 / calon |  | Direncanakan; belum ada path/commit | BELUM |
| BE-00165 | `_generateOtpCode_()` | — | M01 / calon |  | Direncanakan; belum ada path/commit | BELUM |
| BE-00170 | `_hashOtp_(plaintext, salt)` | — | M01 / calon |  | Direncanakan; belum ada path/commit | BELUM |
| BE-00178 | `_timingSafeEquals_(a, b)` | — | M10 / calon |  | Direncanakan; belum ada path/commit | BELUM |
| BE-00194 | `_maskEmail_(email)` | — | M17 / calon |  | Direncanakan; belum ada path/commit | BELUM |
| BE-00204 | `_buildOtpEmailBody_(otp, fullName)` | — | M01 / calon |  | Direncanakan; belum ada path/commit | BELUM |
| BE-00220 | `_requestOtpInternal_(username, sessionToken, actionLabel)` | Users | M01 / calon |  | Direncanakan; belum ada path/commit | BELUM |
| BE-00394 | `requestEmailOtp(username, sessionToken)` | — | M01 / langsung | M01-F08 | Direncanakan; belum ada path/commit | BELUM |
| BE-00397 | `verifyEmailOtp(username, otpCode, sessionToken)` | Users | M01 / langsung | M01-F08 | Direncanakan; belum ada path/commit | BELUM |
| BE-00524 | `resendEmailOtp(username, sessionToken)` | — | M01 / langsung | M01-F08 | Direncanakan; belum ada path/commit | BELUM |
| BE-00527 | `diagnoseEmailOtp(testEmail)` | — | M01 / calon |  | Direncanakan; belum ada path/commit | BELUM |
| BE-00612 | `forceReauthorize()` | — | M01 / calon |  | Direncanakan; belum ada path/commit | BELUM |
| BE-00629 | `_assertEmailGate(username)` | Users | M01 / langsung | M01-F09 | Direncanakan; belum ada path/commit | BELUM |
| BE-00643 | `doGet()` | — | M17 / calon |  | Direncanakan; belum ada path/commit | BELUM |
| BE-00651 | `loginUser(username, password, remember, userAgent)` | Sessions, Users | M01 / langsung | M01-F01,M01-F03 | Direncanakan; belum ada path/commit | BELUM |
| BE-00753 | `adminResetPassword(id, adminUser)` | Users | M01 / langsung | M01-F04 | Direncanakan; belum ada path/commit | BELUM |
| BE-00768 | `getAllUsers(_callerUsername)` | Sessions, Users | M03 / langsung | M03-F01,M03-F02 | Direncanakan; belum ada path/commit | BELUM |
| BE-00816 | `getPendingResetCount(_callerUsername)` | Users | M01,M03 / langsung | M01-F06,M03-F02 | Direncanakan; belum ada path/commit | BELUM |
| BE-00826 | `adminResetSession(username, adminUser)` | Sessions, Users | M01 / langsung | M01-F03 | Direncanakan; belum ada path/commit | BELUM |
| BE-00848 | `generateMenu(user)` | — | M01 / langsung | M01-F09,M01-F10 | Direncanakan; belum ada path/commit | BELUM |
| BE-00893 | `_getActivityLogsSheet()` | Activity_Logs | M17 / calon |  | Direncanakan; belum ada path/commit | BELUM |
| BE-00908 | `logActivity(username, action, description)` | — | M17 / langsung | M17-F07 | Direncanakan; belum ada path/commit | BELUM |
| BE-00919 | `_parseIsoTimestamp(val)` | — | M17 / calon |  | Direncanakan; belum ada path/commit | BELUM |
| BE-00929 | `getLogData(_callerUsername)` | — | M17 / langsung | M17-F07 | Direncanakan; belum ada path/commit | BELUM |
| BE-00972 | `getLogDataByUser(username)` | — | M17 / langsung | M17-F07 | Direncanakan; belum ada path/commit | BELUM |
| BE-01020 | `logoutUser(token)` | Sessions | M01 / langsung | M01-F02 | Direncanakan; belum ada path/commit | BELUM |
| BE-01031 | `verifySession(token)` | Sessions, Users | M01 / langsung | M01-F02 | Direncanakan; belum ada path/commit | BELUM |
| BE-01107 | `deleteSchedule(id, adminUser)` | Schedules | M06 / langsung | M06-F01 | Direncanakan; belum ada path/commit | BELUM |
| BE-01135 | `getScheduleByClass(kelas, _callerUsername)` | Schedules | M06 / langsung | M06-F05 | Direncanakan; belum ada path/commit | BELUM |
| BE-01151 | `getStudentSchedules(username)` | Users | M06 / langsung | M06-F05 | Direncanakan; belum ada path/commit | BELUM |
| BE-01168 | `getIuranSiswa(username)` | Iuran_Komite, Users | M09 / langsung | M09-F05 | Direncanakan; belum ada path/commit | BELUM |
| BE-01199 | `getIuranRecapSiswa(username)` | Iuran_Komite | M09 / langsung | M09-F05 | Direncanakan; belum ada path/commit | BELUM |
| BE-01290 | `getSavingsSiswa(username)` | Savings | M10 / langsung | M10-F05 | Direncanakan; belum ada path/commit | BELUM |
| BE-01306 | `getSavingsRecapSiswa(username)` | — | M10 / langsung | M10-F05 | Direncanakan; belum ada path/commit | BELUM |
| BE-01311 | `getClassData(_callerUsername)` | Classes | M05 / langsung | M05-F01 | Direncanakan; belum ada path/commit | BELUM |
| BE-01325 | `addClass(tingkat, nama, waliUsername, waliName, adminUser)` | Classes | M05 / langsung | M05-F01 | Direncanakan; belum ada path/commit | BELUM |
| BE-01341 | `updateClass(id, tingkat, nama, waliUsername, waliName, adminUser)` | Classes | M05 / langsung | M05-F01 | Direncanakan; belum ada path/commit | BELUM |
| BE-01362 | `deleteClass(id, adminUser)` | Classes | M05 / langsung | M05-F01 | Direncanakan; belum ada path/commit | BELUM |
| BE-01383 | `getIuranData(_callerUsername)` | Iuran_Komite | M09 / langsung | M09-F04 | Direncanakan; belum ada path/commit | BELUM |
| BE-01408 | `addIuran(siswa, kelas, tanggal, jumlah, ket, pencatat, logUser)` | Iuran_Komite | M09 / langsung | M09-F01 | Direncanakan; belum ada path/commit | BELUM |
| BE-01425 | `_syncSaudaraIuran(usernameYangBayar, kelasYangBayar, tanggal, ket, logUser)` | Iuran_Komite, SiswaDetail, Users | M04,M09 / langsung | M04-F03,M09-F02 | Direncanakan; belum ada path/commit | BELUM |
| BE-01510 | `deleteIuran(id, logUser)` | Iuran_Komite | M09 / langsung | M09-F03 | Direncanakan; belum ada path/commit | BELUM |
| BE-01531 | `updateIuran(id, siswa, kelas, tanggal, jumlah, ket, pencatat, logUser)` | Iuran_Komite | M09 / langsung | M09-F03 | Direncanakan; belum ada path/commit | BELUM |
| BE-01551 | `addUser(username, password, role, tugas, kelas, fullName, hariPiket, aksesPremium, aksesTabungan, adminUser)` | Users | M03 / langsung | M03-F01 | Direncanakan; belum ada path/commit | BELUM |
| BE-01572 | `editUser(id, username, role, tugas, kelas, fullName, hariPiket, aksesPremium, aksesTabungan, adminUser)` | Users | M03 / langsung | M03-F01 | Direncanakan; belum ada path/commit | BELUM |
| BE-01606 | `deleteUser(id, username, adminUser)` | Sessions, Users | M03 / langsung | M03-F01 | Direncanakan; belum ada path/commit | BELUM |
| BE-01635 | `getStudentsByClass(kelasTarget, _callerUsername)` | Users | M05 / langsung | M05-F02 | Direncanakan; belum ada path/commit | BELUM |
| BE-01663 | `getClassList(_callerUsername)` | Classes | M05 / langsung | M05-F02 | Direncanakan; belum ada path/commit | BELUM |
| BE-01671 | `getStudentsByWali(waliUsername)` | Attendance, Classes, Guru_Wali, Iuran_Komite, Savings, Users | M05 / langsung | M05-F02 | Direncanakan; belum ada path/commit | BELUM |
| BE-01809 | `getWaliKelasList(_callerUsername)` | Users | M05 / langsung | M05-F01 | Direncanakan; belum ada path/commit | BELUM |
| BE-01821 | `getAttendanceData(_callerUsername)` | Attendance | M07 / langsung | M07-F03 | Direncanakan; belum ada path/commit | BELUM |
| BE-01880 | `saveAttendanceBatch(attendanceList, pencatat, logUser)` | Attendance | M07,M17 / langsung | M07-F01,M17-F12 | Direncanakan; belum ada path/commit | BELUM |
| BE-01967 | `updateAttendance(id, tanggal, kelas, username, nama, status, ket, logUser)` | Attendance, Users | M07 / langsung | M07-F02 | Direncanakan; belum ada path/commit | BELUM |
| BE-02026 | `deleteAttendance(id, logUser)` | Attendance, Users | M07 / langsung | M07-F02 | Direncanakan; belum ada path/commit | BELUM |
| BE-02068 | `getSavingsData(_callerUsername)` | Savings | M10 / langsung | M10-F04 | Direncanakan; belum ada path/commit | BELUM |
| BE-02126 | `_calcSaldoSebelum_(username, excludeId, savingsData)` | — | M10 / langsung | M10-F02 | Direncanakan; belum ada path/commit | BELUM |
| BE-02173 | `terbilang(angka)` | — | M10 / langsung | M10-F08 | Direncanakan; belum ada path/commit | BELUM |
| BE-02268 | `_formatRupiah_(n)` | — | M17 / calon |  | Direncanakan; belum ada path/commit | BELUM |
| BE-02294 | `_buildSlipPenarikanHtml(params)` | — | M10 / langsung | M10-F08 | Direncanakan; belum ada path/commit | BELUM |
| BE-02441 | `_buildSlipPenarikanPdfBlob_(params)` | — | M10 / langsung | M10-F08 | Direncanakan; belum ada path/commit | BELUM |
| BE-02674 | `_getSlipEmailRecipients_()` | Users | M10 / langsung | M10-F09 | Direncanakan; belum ada path/commit | BELUM |
| BE-02721 | `_calcFeeAmount_(jumlah, feeConfigs)` | — | M10 / langsung | M10-F07 | Direncanakan; belum ada path/commit | BELUM |
| BE-02752 | `_dispatchSlipPenarikanEmail(params)` | Savings, Users | M10,M17 / langsung | M10-F09,M17-F09 | Direncanakan; belum ada path/commit | BELUM |
| BE-02931 | `saveSavings(tanggal, kelas, username, nama, jenis, jumlah, ket, pencatat, penabungType, logUser)` | Savings | M10 / langsung | M10-F01,M10-F02 | Direncanakan; belum ada path/commit | BELUM |
| BE-02980 | `updateSavings(id, tanggal, kelas, username, nama, jenis, jumlah, ket, penabungType, logUser)` | Savings | M10 / langsung | M10-F03 | Direncanakan; belum ada path/commit | BELUM |
| BE-03001 | `deleteSavings(id, logUser)` | Savings | M10 / langsung | M10-F03 | Direncanakan; belum ada path/commit | BELUM |
| BE-03021 | `getStudentSavingsInfo(username, dateStr, callerUsername)` | Savings | M10 / langsung | M10-F02 | Direncanakan; belum ada path/commit | BELUM |
| BE-03059 | `getSavingsRecap(startDate, endDate, _callerUsername)` | Savings | M10 / langsung | M10-F04 | Direncanakan; belum ada path/commit | BELUM |
| BE-03126 | `getIuranHistoryByStudent(studentName, yearFilter, _callerUsername)` | Iuran_Komite | M09 / langsung | M09-F01 | Direncanakan; belum ada path/commit | BELUM |
| BE-03166 | `getIuranRecap(tahunAjaran, _callerUsername)` | Iuran_Komite, Users | M09 / langsung | M09-F04 | Direncanakan; belum ada path/commit | BELUM |
| BE-03310 | `getGuruList(_callerUsername)` | Users | M17 / calon |  | Direncanakan; belum ada path/commit | BELUM |
| BE-03318 | `getMapelList(_callerUsername)` | Settings | M17 / calon |  | Direncanakan; belum ada path/commit | BELUM |
| BE-03331 | `getScheduleData(_callerUsername)` | Schedules | M06 / langsung | M06-F01 | Direncanakan; belum ada path/commit | BELUM |
| BE-03343 | `saveScheduleBatch(payload, adminUser)` | Schedules | M06 / langsung | M06-F01,M06-F03 | Direncanakan; belum ada path/commit | BELUM |
| BE-03396 | `getUserFreshData(username)` | Classes, Users | M17 / langsung | M17-F04 | Direncanakan; belum ada path/commit | BELUM |
| BE-03448 | `getAllAlumniData(_callerUsername)` | Users | M03,M12 / langsung | M03-F07,M12-F03 | Direncanakan; belum ada path/commit | BELUM |
| BE-03462 | `getAlumniDetailAdmin(alumniUsername, _callerUsername)` | SiswaDetail, Users | M03 / langsung | M03-F07 | Direncanakan; belum ada path/commit | BELUM |
| BE-03496 | `getAllSiswaData(callerUsername)` | Users | M03 / langsung | M03-F04 | Direncanakan; belum ada path/commit | BELUM |
| BE-03508 | `getGuruWaliCandidates(callerUsername)` | Users | M05 / langsung | M05-F03 | Direncanakan; belum ada path/commit | BELUM |
| BE-03523 | `getGuruWaliData(callerUsername)` | Guru_Wali | M05 / langsung | M05-F03 | Direncanakan; belum ada path/commit | BELUM |
| BE-03540 | `saveGuruWali(payload, adminUser)` | Guru_Wali | M05 / langsung | M05-F03 | Direncanakan; belum ada path/commit | BELUM |
| BE-03573 | `deleteGuruWali(id, adminUser)` | Guru_Wali | M05 / langsung | M05-F03 | Direncanakan; belum ada path/commit | BELUM |
| BE-03597 | `saveLaporanBimbingan(payload, guruUsername, guruNama)` | Laporan_Bimbingan | M05 / langsung | M05-F04,M05-F05 | Direncanakan; belum ada path/commit | BELUM |
| BE-03627 | `getAllLaporanBimbingan(callerUsername)` | Laporan_Bimbingan | M05 / langsung | M05-F06 | Direncanakan; belum ada path/commit | BELUM |
| BE-03666 | `deleteLaporanBimbingan(id, adminUser)` | Laporan_Bimbingan | M05 / langsung | M05-F06 | Direncanakan; belum ada path/commit | BELUM |
| BE-03689 | `getLaporanBimbinganBySiswa(username)` | Laporan_Bimbingan | M05 / langsung | M05-F07 | Direncanakan; belum ada path/commit | BELUM |
| BE-03734 | `updateProfil(username, fullName, noHP, email, bio)` | Users | M01,M17 / langsung | M01-F08,M17-F04 | Direncanakan; belum ada path/commit | BELUM |
| BE-03772 | `getDashboardStatsAdmin(_callerUsername)` | Classes, Iuran_Komite, Users | M02 / langsung | M02-F01 | Direncanakan; belum ada path/commit | BELUM |
| BE-03808 | `getDashboardStatsGuru(username)` | Attendance, Iuran_Komite, Savings, Users | M02 / langsung | M02-F02 | Direncanakan; belum ada path/commit | BELUM |
| BE-03884 | `verifyPassword(username, password)` | Users | M01 / langsung | M01-F04 | Direncanakan; belum ada path/commit | BELUM |
| BE-03898 | `changePassword(username, oldPassword, newPassword)` | Sessions, Users | M01 / langsung | M01-F04 | Direncanakan; belum ada path/commit | BELUM |
| BE-03928 | `getMapelData()` | Settings | M17 / langsung | M17-F02 | Direncanakan; belum ada path/commit | BELUM |
| BE-03940 | `saveMapel(namaMapel, adminUser)` | Settings | M17 / langsung | M17-F02 | Direncanakan; belum ada path/commit | BELUM |
| BE-03970 | `deleteMapel(id, adminUser)` | Settings | M17 / langsung | M17-F02 | Direncanakan; belum ada path/commit | BELUM |
| BE-03993 | `getHariLiburData()` | Hari_Libur | M17 / calon |  | Direncanakan; belum ada path/commit | BELUM |
| BE-04004 | `saveHariLibur(tanggal, keterangan, adminUser)` | Hari_Libur | M17 / langsung | M17-F03 | Direncanakan; belum ada path/commit | BELUM |
| BE-04022 | `deleteHariLibur(id, adminUser)` | Hari_Libur | M17 / langsung | M17-F03 | Direncanakan; belum ada path/commit | BELUM |
| BE-04041 | `isHariLibur(tanggal)` | Hari_Libur | M17 / calon |  | Direncanakan; belum ada path/commit | BELUM |
| BE-04059 | `getKenaikanKelasData()` | Users | M12 / langsung | M12-F01 | Direncanakan; belum ada path/commit | BELUM |
| BE-04087 | `_registerAlumniToIjazahSheet_(newAlumniList, adminUser)` | Ijazah | M12 / langsung | M12-F03 | Direncanakan; belum ada path/commit | BELUM |
| BE-04136 | `processKenaikanKelas(adminUser)` | Users | M12 / langsung | M12-F01 | Direncanakan; belum ada path/commit | BELUM |
| BE-04199 | `getSiswaForKenaikan(tingkat, callerUsername)` | Users | M12 / langsung | M12-F02 | Direncanakan; belum ada path/commit | BELUM |
| BE-04229 | `processPenempatanKelas(mappingData, adminUser)` | Users | M12 / langsung | M12-F02 | Direncanakan; belum ada path/commit | BELUM |
| BE-04292 | `updateMapel(id, newNamaMapel, adminUser)` | Settings | M17 / langsung | M17-F02 | Direncanakan; belum ada path/commit | BELUM |
| BE-04320 | `updateHariLibur(id, tanggal, keterangan, adminUser)` | Hari_Libur | M17 / langsung | M17-F03 | Direncanakan; belum ada path/commit | BELUM |
| BE-04340 | `getAttendanceRecap(month, year)` | Attendance, Users | M07 / langsung | M07-F03 | Direncanakan; belum ada path/commit | BELUM |
| BE-04410 | `getAttendanceSiswa(username)` | Attendance | M07 / langsung | M07-F05 | Direncanakan; belum ada path/commit | BELUM |
| BE-04436 | `getAttendanceRecapSiswa(username, month, year)` | — | M07 / langsung | M07-F05 | Direncanakan; belum ada path/commit | BELUM |
| BE-04458 | `getWaliKelasByGuru(username)` | Classes | M07 / langsung | M07-F04 | Direncanakan; belum ada path/commit | BELUM |
| BE-04477 | `getAttendanceByClassAndDate(kelas, tanggal)` | Attendance | M07 / langsung | M07-F04 | Direncanakan; belum ada path/commit | BELUM |
| BE-04513 | `getGuruWaliStudentCount(username)` | Guru_Wali | M05 / calon |  | Direncanakan; belum ada path/commit | BELUM |
| BE-04529 | `getPiketDashboard(username)` | Attendance, Classes, Users | M02 / langsung | M02-F02 | Direncanakan; belum ada path/commit | BELUM |
| BE-04588 | `getTabunganDashboard(username)` | Savings | M02 / langsung | M02-F02 | Direncanakan; belum ada path/commit | BELUM |
| BE-04630 | `getIuranTotalMingguIni()` | — | M09 / calon |  | Direncanakan; belum ada path/commit | BELUM |
| BE-04633 | `getIuranTotalBulanIni()` | — | M09 / calon |  | Direncanakan; belum ada path/commit | BELUM |
| BE-04636 | `getIuranTotalTriwulanIni()` | — | M09 / calon |  | Direncanakan; belum ada path/commit | BELUM |
| BE-04639 | `getIuranTotalSemesterIni()` | — | M09 / calon |  | Direncanakan; belum ada path/commit | BELUM |
| BE-04642 | `getIuranTotalTahunIni()` | — | M09 / calon |  | Direncanakan; belum ada path/commit | BELUM |
| BE-04645 | `hitungTotalIuranPeriode(periode)` | Iuran_Komite | M09 / langsung | M09-F04 | Direncanakan; belum ada path/commit | BELUM |
| BE-04704 | `getHariEfektif(startDate, endDate)` | Hari_Libur | M07 / langsung | M07-F06 | Direncanakan; belum ada path/commit | BELUM |
| BE-04733 | `getStudentAttendanceStats(username)` | — | M02,M07 / langsung | M02-F03,M07-F06 | Direncanakan; belum ada path/commit | BELUM |
| BE-04806 | `getIuranTotalHariIni()` | — | M09 / calon |  | Direncanakan; belum ada path/commit | BELUM |
| BE-04809 | `getGlobalSavingsSummary()` | Savings | M02,M10 / langsung | M02-F05,M10-F04 | Direncanakan; belum ada path/commit | BELUM |
| BE-04849 | `getGlobalAttendanceSummary()` | Attendance | M07 / calon |  | Direncanakan; belum ada path/commit | BELUM |
| BE-04880 | `saveHariLiburBatchRange(startDate, endDate, keterangan, adminUser)` | Hari_Libur | M17 / langsung | M17-F03 | Direncanakan; belum ada path/commit | BELUM |
| BE-04934 | `getFeeConfig()` | FeeConfig | M10 / langsung | M10-F06 | Direncanakan; belum ada path/commit | BELUM |
| BE-04954 | `saveFeeConfig(payload, adminUser)` | FeeConfig | M10 / langsung | M10-F06 | Direncanakan; belum ada path/commit | BELUM |
| BE-04986 | `deleteFeeConfig(id, adminUser)` | FeeConfig | M10 / langsung | M10-F06 | Direncanakan; belum ada path/commit | BELUM |
| BE-05008 | `getHariLiburKeterangan(tanggal)` | Hari_Libur | M17 / calon |  | Direncanakan; belum ada path/commit | BELUM |
| BE-05020 | `getTodayScheduleForTeacher(teacherName, day)` | Schedules | M06 / langsung | M06-F05 | Direncanakan; belum ada path/commit | BELUM |
| BE-05037 | `updateLaporanBimbingan(id, payload, guruUsername)` | Laporan_Bimbingan | M05 / langsung | M05-F04,M05-F05 | Direncanakan; belum ada path/commit | BELUM |
| BE-05063 | `getEBooks()` | eBook | M14 / langsung | M14-F01 | Direncanakan; belum ada path/commit | BELUM |
| BE-05083 | `addEBook(judul, penulis, penerbit, tahun, versi, kategori, mapel, kelas, url, premium, adminUser)` | eBook | M14 / langsung | M14-F01 | Direncanakan; belum ada path/commit | BELUM |
| BE-05098 | `updateEBook(id, judul, penulis, penerbit, tahun, versi, kategori, mapel, kelas, url, premium, adminUser)` | eBook | M14 / langsung | M14-F01 | Direncanakan; belum ada path/commit | BELUM |
| BE-05117 | `deleteEBook(id, adminUser)` | eBook | M14 / langsung | M14-F01 | Direncanakan; belum ada path/commit | BELUM |
| BE-05136 | `deleteSchedulesBatch(ids, adminUser)` | Schedules | M06 / langsung | M06-F04 | Direncanakan; belum ada path/commit | BELUM |
| BE-05155 | `getHafalanData()` | Settings | M17 / langsung | M17-F02 | Direncanakan; belum ada path/commit | BELUM |
| BE-05167 | `saveHafalan(namaHafalan, adminUser)` | Settings | M17 / langsung | M17-F02 | Direncanakan; belum ada path/commit | BELUM |
| BE-05194 | `updateHafalan(id, newNamaHafalan, adminUser)` | Settings | M17 / langsung | M17-F02 | Direncanakan; belum ada path/commit | BELUM |
| BE-05216 | `deleteHafalan(id, adminUser)` | Settings | M17 / langsung | M17-F02 | Direncanakan; belum ada path/commit | BELUM |
| BE-05233 | `getSiswaDetail(username)` | SiswaDetail | M04 / langsung | M04-F01 | Direncanakan; belum ada path/commit | BELUM |
| BE-05260 | `saveSiswaDetail(data, username)` | SiswaDetail, Users | M04 / langsung | M04-F01,M04-F02 | Direncanakan; belum ada path/commit | BELUM |
| BE-05372 | `checkProfileIncomplete(username)` | SiswaDetail | M01,M04 / langsung | M01-F07,M04-F02 | Direncanakan; belum ada path/commit | BELUM |
| BE-05479 | `getGuruDetail(username)` | Guru_Wali, Schedules, Users | M03 / langsung | M03-F03 | Direncanakan; belum ada path/commit | BELUM |
| BE-05528 | `getAllGuruSummary()` | Classes, Guru_Wali, Schedules, Users | M03 / langsung | M03-F03 | Direncanakan; belum ada path/commit | BELUM |
| BE-05588 | `getSiswaDetailAdmin(username)` | Classes, Guru_Wali, SiswaDetail, Users | M03 / langsung | M03-F04 | Direncanakan; belum ada path/commit | BELUM |
| BE-05641 | `getAttendanceRecapByPeriod(period, year)` | Attendance, Users | M07 / langsung | M07-F03 | Direncanakan; belum ada path/commit | BELUM |
| BE-05701 | `_buildAlamatGabungan_(profile)` | — | M17 / langsung | M17-F01 | Direncanakan; belum ada path/commit | BELUM |
| BE-05716 | `getSchoolProfile()` | SchoolProfile | M17 / langsung | M17-F01 | Direncanakan; belum ada path/commit | BELUM |
| BE-05775 | `saveSchoolProfile(profile, adminUser)` | SchoolProfile | M17 / langsung | M17-F01 | Direncanakan; belum ada path/commit | BELUM |
| BE-05845 | `uploadFileToDrive(base64, fileName, adminUser)` | — | M04 / langsung | M04-F07 | Direncanakan; belum ada path/commit | BELUM |
| BE-05879 | `_detectFileExtFromBytes_(bytes)` | — | M04 / langsung | M04-F04 | Direncanakan; belum ada path/commit | BELUM |
| BE-05894 | `_validateStudentDocFormat_(documentType, fileName, base64File)` | — | M04 / langsung | M04-F04 | Direncanakan; belum ada path/commit | BELUM |
| BE-05961 | `ensureSiswaDetailHeaders()` | SiswaDetail | M04 / langsung | M04-F01 | Direncanakan; belum ada path/commit | BELUM |
| BE-05991 | `uploadStudentDocument(username, documentType, base64File, fileName, fullName)` | SiswaDetail | M04 / langsung | M04-F04 | Direncanakan; belum ada path/commit | BELUM |
| BE-06061 | `deleteStudentDocument(documentType, username)` | SiswaDetail | M04 / langsung | M04-F05 | Direncanakan; belum ada path/commit | BELUM |
| BE-06104 | `getIjazahAccessSetting()` | Settings | M13 / langsung | M13-F02 | Direncanakan; belum ada path/commit | BELUM |
| BE-06121 | `saveIjazahAccessSetting(canView, canDownload, adminUser)` | Settings | M13 / langsung | M13-F02 | Direncanakan; belum ada path/commit | BELUM |
| BE-06141 | `getIjazahAccessForUser(username)` | Ijazah | M13 / langsung | M13-F02 | Direncanakan; belum ada path/commit | BELUM |
| BE-06167 | `getIjazahAccessAll()` | Ijazah | M13 / langsung | M13-F03 | Direncanakan; belum ada path/commit | BELUM |
| BE-06204 | `saveAlumniIjazahAccess(username, viewOverride, dlOverride, adminUser)` | — | M13 / langsung | M13-F02 | Direncanakan; belum ada path/commit | BELUM |
| BE-06225 | `saveAlumniIjazahAccessMassal(usernames, grantAccess, adminUser)` | Ijazah, Users | M13 / langsung | M13-F03 | Direncanakan; belum ada path/commit | BELUM |
| BE-06302 | `getIjazahFolderSetting()` | Settings | M13 / langsung | M13-F03 | Direncanakan; belum ada path/commit | BELUM |
| BE-06330 | `saveIjazahFolderSetting(folderIdOrUrl, adminUser)` | Settings | M13 / langsung | M13-F03 | Direncanakan; belum ada path/commit | BELUM |
| BE-06362 | `extractDriveFolderId(input)` | — | M17 / calon |  | Direncanakan; belum ada path/commit | BELUM |
| BE-06371 | `ensureIjazahSheet()` | Ijazah | M13 / calon |  | Direncanakan; belum ada path/commit | BELUM |
| BE-06404 | `getAlumniListForIjazah()` | Users | M13 / calon |  | Direncanakan; belum ada path/commit | BELUM |
| BE-06425 | `getIjazahData(username)` | Ijazah | M13 / langsung | M13-F01 | Direncanakan; belum ada path/commit | BELUM |
| BE-06452 | `getAllIjazahData()` | Ijazah | M13 / langsung | M13-F01 | Direncanakan; belum ada path/commit | BELUM |
| BE-06480 | `getIjazahByUsername(username)` | — | M13 / calon |  | Direncanakan; belum ada path/commit | BELUM |
| BE-06483 | `normalizeUsername(val)` | — | M17 / calon |  | Direncanakan; belum ada path/commit | BELUM |
| BE-06486 | `getOrCreateIjazahRow(username, fullName, adminUser)` | Ijazah | M13 / calon |  | Direncanakan; belum ada path/commit | BELUM |
| BE-06517 | `saveIjazahData(payload, adminUser)` | — | M13 / langsung | M13-F01 | Direncanakan; belum ada path/commit | BELUM |
| BE-06560 | `uploadIjazahDocument(username, docType, base64File, fileName, fullName, adminUser)` | — | M13 / langsung | M13-F01 | Direncanakan; belum ada path/commit | BELUM |
| BE-06604 | `deleteIjazahDocument(username, docType, adminUser)` | Ijazah | M13 / langsung | M13-F01 | Direncanakan; belum ada path/commit | BELUM |
| BE-06634 | `getDocumentForDownload(fileUrl)` | — | M04 / langsung | M04-F06 | Direncanakan; belum ada path/commit | BELUM |
| BE-06649 | `extractDriveFileId(url)` | — | M04 / langsung | M04-F06 | Direncanakan; belum ada path/commit | BELUM |
| BE-06653 | `getDocumentBase64(fileId)` | — | M04 / langsung | M04-F06 | Direncanakan; belum ada path/commit | BELUM |
| BE-06665 | `hashAnswer(answer)` | — | M01 / langsung | M01-F05 | Direncanakan; belum ada path/commit | BELUM |
| BE-06670 | `updateSecurityQuestion(username, question, answer)` | Users | M01 / langsung | M01-F05 | Direncanakan; belum ada path/commit | BELUM |
| BE-06691 | `getSecurityQuestion(username)` | Users | M01 / langsung | M01-F05 | Direncanakan; belum ada path/commit | BELUM |
| BE-06702 | `requestUserReset(username, answer)` | Users | M01 / langsung | M01-F05 | Direncanakan; belum ada path/commit | BELUM |
| BE-06736 | `selfResetPassword(username, newPassword)` | Sessions, Users | M01 / langsung | M01-F05 | Direncanakan; belum ada path/commit | BELUM |
| BE-06770 | `requestUserResetSesi(username, answer)` | Sessions, Users | M01 / langsung | M01-F06 | Direncanakan; belum ada path/commit | BELUM |
| BE-06817 | `getActiveSessionInfo(username)` | Sessions | M01 / langsung | M01-F03 | Direncanakan; belum ada path/commit | BELUM |
| BE-06845 | `selfResetSesi(username)` | Sessions, Users | M01 / langsung | M01-F06 | Direncanakan; belum ada path/commit | BELUM |
| BE-06879 | `verifySecurityAnswer(username, answer)` | Users | M01 / langsung | M01-F05 | Direncanakan; belum ada path/commit | BELUM |
| BE-06892 | `getNasabahList()` | Users | M03,M10 / langsung | M03-F08,M10-F01 | Direncanakan; belum ada path/commit | BELUM |
| BE-06910 | `getGuruMapelKelas(username)` | Schedules, Users | M11 / langsung | M11-F01 | Direncanakan; belum ada path/commit | BELUM |
| BE-06943 | `saveNilaiBatch(nilaiList, guruUsername, kkmSaatIni)` | Nilai, Users | M11 / langsung | M11-F01,M11-F02 | Direncanakan; belum ada path/commit | BELUM |
| BE-07082 | `getRiwayatNilai(guru, mapel, kelas, tipe, phNumber)` | Nilai | M11 / langsung | M11-F03 | Direncanakan; belum ada path/commit | BELUM |
| BE-07138 | `deleteNilai(id, guru)` | Nilai | M11 / langsung | M11-F03 | Direncanakan; belum ada path/commit | BELUM |
| BE-07160 | `updateNilai(id, payload, guru)` | Nilai | M11 / langsung | M11-F03 | Direncanakan; belum ada path/commit | BELUM |
| BE-07200 | `getRekapNilai(guru, mapel, kelas, tahun, semester)` | Nilai | M11 / langsung | M11-F05 | Direncanakan; belum ada path/commit | BELUM |
| BE-07282 | `getDistinctPHNumbers(guru, mapel, kelas)` | Nilai | M11 / langsung | M11-F02 | Direncanakan; belum ada path/commit | BELUM |
| BE-07303 | `getNilaiSiswa(username)` | Nilai | M11 / langsung | M11-F06 | Direncanakan; belum ada path/commit | BELUM |
| BE-07337 | `getKKM(kelas, mapel, tahun, semester)` | KKM | M11 / langsung | M11-F04 | Direncanakan; belum ada path/commit | BELUM |
| BE-07359 | `saveKKM(kelas, mapel, kkm, user, tgl)` | KKM, Nilai | M11 / langsung | M11-F04 | Direncanakan; belum ada path/commit | BELUM |
| BE-07427 | `getKKMByPeriode(kelas, mapel, tahun, semester)` | KKM | M11 / langsung | M11-F04 | Direncanakan; belum ada path/commit | BELUM |
| BE-07440 | `getAllKKM()` | KKM | M11 / langsung | M11-F04 | Direncanakan; belum ada path/commit | BELUM |
| BE-07455 | `ensureNilaiSheetHasKKM()` | Nilai | M11 / calon |  | Direncanakan; belum ada path/commit | BELUM |
| BE-07468 | `getSemesterDateRange(tahun, semester)` | — | M11 / calon |  | Direncanakan; belum ada path/commit | BELUM |
| BE-07481 | `getTahunSemester(tanggal)` | — | M11 / calon |  | Direncanakan; belum ada path/commit | BELUM |
| BE-07491 | `getRaportSiswa(username, tahun, semester, jenis)` | Nilai, Users | M11 / langsung | M11-F06 | Direncanakan; belum ada path/commit | BELUM |
| BE-07576 | `getAnakList(usernameOrtu)` | SiswaDetail, Users | M02,M03,M04 / langsung | M02-F04,M03-F06,M04-F03 | Direncanakan; belum ada path/commit | BELUM |
| BE-07620 | `getOrangtuaDashboard(usernameOrtu)` | Attendance, Nilai, Savings | M02 / langsung | M02-F04 | Direncanakan; belum ada path/commit | BELUM |
| BE-07723 | `verifyAnakRelasi(usernameOrtu, usernameAnak)` | — | M02,M04 / langsung | M02-F04,M04-F03 | Direncanakan; belum ada path/commit | BELUM |
| BE-07730 | `getNilaiAnak(usernameOrtu, usernameAnak)` | — | M11 / langsung | M11-F06 | Direncanakan; belum ada path/commit | BELUM |
| BE-07739 | `getKehadiranAnak(usernameOrtu, usernameAnak)` | — | M07 / langsung | M07-F05 | Direncanakan; belum ada path/commit | BELUM |
| BE-07748 | `getTabunganAnak(usernameOrtu, usernameAnak)` | — | M10 / langsung | M10-F05 | Direncanakan; belum ada path/commit | BELUM |
| BE-07757 | `getIuranAnak(usernameOrtu, usernameAnak)` | — | M09 / langsung | M09-F05 | Direncanakan; belum ada path/commit | BELUM |
| BE-07767 | `formatTanggalSPK(d, tampilkanHari, tampilkanWaktu)` | — | M15 / calon |  | Direncanakan; belum ada path/commit | BELUM |
| BE-07790 | `getBulanSPK(d)` | — | M15 / calon |  | Direncanakan; belum ada path/commit | BELUM |
| BE-07798 | `_normalizeBulanSPK(val)` | — | M15 / calon |  | Direncanakan; belum ada path/commit | BELUM |
| BE-07811 | `_parseSaldoSPK(val, defaultSaldo)` | — | M15 / calon |  | Direncanakan; belum ada path/commit | BELUM |
| BE-07819 | `_bulanLabel(bulan)` | — | M17 / calon |  | Direncanakan; belum ada path/commit | BELUM |
| BE-07829 | `hitungLevel(saldo)` | — | M15 / langsung | M15-F04 | Direncanakan; belum ada path/commit | BELUM |
| BE-07837 | `initSheetsSPK()` | PoinEvent, PoinKatalog, PoinNotifikasi, PoinResetLog, PoinSaldo | M15 / langsung | M15-F01 | Direncanakan; belum ada path/commit | BELUM |
| BE-07902 | `getPoinKatalog(termasukNonaktif)` | PoinKatalog | M15 / langsung | M15-F01 | Direncanakan; belum ada path/commit | BELUM |
| BE-07951 | `savePoinKatalog(data, adminUser)` | PoinKatalog | M15 / langsung | M15-F01 | Direncanakan; belum ada path/commit | BELUM |
| BE-07991 | `deletePoinKatalog(kodeID, adminUser)` | PoinKatalog | M15 / langsung | M15-F01 | Direncanakan; belum ada path/commit | BELUM |
| BE-08011 | `cekResidivis(username, kodeID, bulan)` | PoinEvent | M15 / langsung | M15-F02 | Direncanakan; belum ada path/commit | BELUM |
| BE-08041 | `recalculateSaldoSiswa(username, bulan)` | PoinEvent, PoinSaldo | M15 / langsung | M15-F03 | Direncanakan; belum ada path/commit | BELUM |
| BE-08177 | `kirimNotifikasiSPK(targetUsername, tipe, pesan)` | PoinNotifikasi | M15 / langsung | M15-F06 | Direncanakan; belum ada path/commit | BELUM |
| BE-08186 | `savePoinEvent(eventData, pencatat)` | Classes, PoinEvent, SiswaDetail, Users | M15 / langsung | M15-F02 | Direncanakan; belum ada path/commit | BELUM |
| BE-08304 | `deletePoinEvent(id, pencatat)` | PoinEvent | M15 / langsung | M15-F03 | Direncanakan; belum ada path/commit | BELUM |
| BE-08327 | `getPoinSiswa(username, bulan)` | PoinEvent, PoinSaldo | M15 / langsung | M15-F04 | Direncanakan; belum ada path/commit | BELUM |
| BE-08384 | `getPoinPerKelas(kelas, bulan)` | PoinSaldo, Users | M15 / langsung | M15-F05 | Direncanakan; belum ada path/commit | BELUM |
| BE-08429 | `getPoinRekap(bulan, kelas)` | PoinSaldo, Users | M15 / langsung | M15-F05 | Direncanakan; belum ada path/commit | BELUM |
| BE-08475 | `getDashboardStatsPoin()` | PoinEvent, PoinSaldo | M15 / langsung | M15-F08 | Direncanakan; belum ada path/commit | BELUM |
| BE-08513 | `resetPoinBulanan()` | PoinResetLog, PoinSaldo | M15 / langsung | M15-F07 | Direncanakan; belum ada path/commit | BELUM |
| BE-08554 | `triggerResetPoinBulanan()` | — | M15 / calon |  | Direncanakan; belum ada path/commit | BELUM |
| BE-08557 | `rebuildPoinSaldo(bulan)` | PoinEvent, PoinSaldo | M15 / langsung | M15-F03 | Direncanakan; belum ada path/commit | BELUM |
| BE-08601 | `setupTriggerResetBulanan()` | — | M17 / calon |  | Direncanakan; belum ada path/commit | BELUM |
| BE-08615 | `getNotifikasi(username)` | PoinNotifikasi | M17 / langsung | M17-F08 | Direncanakan; belum ada path/commit | BELUM |
| BE-08642 | `tandaiDibaca(notifId)` | PoinNotifikasi | M17 / langsung | M17-F08 | Direncanakan; belum ada path/commit | BELUM |
| BE-08659 | `tandaiSemuaDibaca(username)` | PoinNotifikasi | M17 / langsung | M17-F08 | Direncanakan; belum ada path/commit | BELUM |
| BE-08684 | `getDaftarKelasSPK()` | Classes | M15 / calon |  | Direncanakan; belum ada path/commit | BELUM |
| BE-08699 | `getSiswaPerKelasSPK(kelas)` | Users | M15 / calon |  | Direncanakan; belum ada path/commit | BELUM |
| BE-08721 | `getExportDataPoinSiswa(username, bulan)` | Classes, Users | M15 / calon |  | Direncanakan; belum ada path/commit | BELUM |
| BE-08800 | `getExportDataPoinGlobal(bulan, kelas)` | PoinEvent, PoinSaldo, Users | M15 / calon |  | Direncanakan; belum ada path/commit | BELUM |
| BE-08936 | `getKonfigurasiSPK()` | Settings | M15 / langsung | M15-F11 | Direncanakan; belum ada path/commit | BELUM |
| BE-08966 | `saveKonfigurasiSPK(config, adminUser)` | Settings | M15 / langsung | M15-F11 | Direncanakan; belum ada path/commit | BELUM |
| BE-08994 | `kirimEmailSPK(emailTo, namaOrtu, namaSiswa, kelas, saldo, level, tanggalEvent)` | — | M15 / langsung | M15-F11 | Direncanakan; belum ada path/commit | BELUM |
| BE-09039 | `kirimWhatsAppSPK(noHP, pesan, apiUrl, apiKey)` | — | M15 / langsung | M15-F11 | Direncanakan; belum ada path/commit | BELUM |
| BE-09064 | `kirimNotifEksternalSPK(username, namaLengkap, kelas, saldo, level, tanggalEvent)` | SiswaDetail, Users | M15,M17 / langsung | M15-F06,M17-F09 | Direncanakan; belum ada path/commit | BELUM |
| BE-09121 | `getStudentOfTheMonth(bulan)` | Classes, PoinSaldo, Users | M15 / langsung | M15-F09 | Direncanakan; belum ada path/commit | BELUM |
| BE-09183 | `syncNilaiAfektifSPK(periodeResetLog, adminUser)` | NilaiAfektif, PoinResetLog, PoinSaldo, Users | M15 / langsung | M15-F10 | Direncanakan; belum ada path/commit | BELUM |
| BE-09291 | `getDashboardAnalitikSPK()` | PoinResetLog, PoinSaldo, Users | M15 / langsung | M15-F08 | Direncanakan; belum ada path/commit | BELUM |
| BE-09412 | `savePoinEventF3(eventData, pencatat)` | — | M15 / langsung | M15-F02 | Direncanakan; belum ada path/commit | BELUM |
| BE-09429 | `triggerResetPoinBulananF3()` | PoinResetLog, Users | M15 / langsung | M15-F07 | Direncanakan; belum ada path/commit | BELUM |
| BE-09465 | `setupTriggerResetBulananF3()` | — | M15 / langsung | M15-F07 | Direncanakan; belum ada path/commit | BELUM |
| BE-09477 | `getPoinSiswaBimbingan(guruUsername, bulan)` | Guru_Wali, PoinSaldo, Users | M15 / langsung | M15-F05 | Direncanakan; belum ada path/commit | BELUM |
| BE-09551 | `getPoinSiswaDashboard(username, bulan)` | PoinResetLog, PoinSaldo, Users | M15 / langsung | M15-F05 | Direncanakan; belum ada path/commit | BELUM |
| BE-09678 | `_surveiFormatWIB(date)` | — | M16 / calon |  | Direncanakan; belum ada path/commit | BELUM |
| BE-09682 | `_surveiFormatTanggal(date)` | — | M16 / calon |  | Direncanakan; belum ada path/commit | BELUM |
| BE-09686 | `_surveiParseDate(val)` | — | M16 / calon |  | Direncanakan; belum ada path/commit | BELUM |
| BE-09711 | `_surveiIsUjian(keterangan)` | — | M16 / calon |  | Direncanakan; belum ada path/commit | BELUM |
| BE-09716 | `initSheetsSurvei()` | Settings | M16 / calon |  | Direncanakan; belum ada path/commit | BELUM |
| BE-09800 | `_ensureSheetsSurvei()` | Survei_AI_Analisis, Survei_Jawaban, Survei_Peer, Survei_Periode, Survei_Progress, Survei_Rencana_Aksi | M16 / calon |  | Direncanakan; belum ada path/commit | BELUM |
| BE-09811 | `_isAdminAtauKepalaMadrasah(adminUser)` | Users | M17 / calon |  | Direncanakan; belum ada path/commit | BELUM |
| BE-09828 | `_surveiPeriodeRowToObj(row)` | — | M16 / calon |  | Direncanakan; belum ada path/commit | BELUM |
| BE-09864 | `getSurveiPeriodeAktif()` | Survei_Periode | M16 / langsung | M16-F03 | Direncanakan; belum ada path/commit | BELUM |
| BE-09882 | `cekSurveiWajib(username)` | Survei_Progress | M16 / langsung | M16-F03 | Direncanakan; belum ada path/commit | BELUM |
| BE-09949 | `getAllSurveiPeriode(adminUser)` | Survei_Periode | M16 / langsung | M16-F01 | Direncanakan; belum ada path/commit | BELUM |
| BE-09977 | `cekTimingUjian(tglBuka)` | Hari_Libur, Settings | M16 / langsung | M16-F02 | Direncanakan; belum ada path/commit | BELUM |
| BE-10041 | `createSurveiPeriode(nama, tahunAjaran, semester, tipe, targetRole, tglBuka, tglTutup, adminUser, overrideTimingWarning)` | Survei_Periode | M16 / langsung | M16-F01 | Direncanakan; belum ada path/commit | BELUM |
| BE-10137 | `updateSurveiPeriode(periodeId, nama, tahunAjaran, semester, targetRole, tglBuka, tglTutup, adminUser)` | Survei_Periode | M16 / langsung | M16-F01 | Direncanakan; belum ada path/commit | BELUM |
| BE-10206 | `tutupSurveiPeriode(periodeId, adminUser)` | Survei_Periode | M16 / langsung | M16-F01 | Direncanakan; belum ada path/commit | BELUM |
| BE-10242 | `_surveiKodeWajibBaginA()` | — | M16 / langsung | M16-F04 | Direncanakan; belum ada path/commit | BELUM |
| BE-10252 | `_surveiKodeEsaiBaginA()` | — | M16 / calon |  | Direncanakan; belum ada path/commit | BELUM |
| BE-10253 | `_surveiKodeBaginBLikert(role)` | — | M16 / calon |  | Direncanakan; belum ada path/commit | BELUM |
| BE-10259 | `_surveiKodeBaginBEsai(role)` | — | M16 / calon |  | Direncanakan; belum ada path/commit | BELUM |
| BE-10263 | `_surveiKodeAttention(role)` | — | M16 / calon |  | Direncanakan; belum ada path/commit | BELUM |
| BE-10266 | `_surveiAttentionExpected(kode, role)` | — | M16 / langsung | M16-F04 | Direncanakan; belum ada path/commit | BELUM |
| BE-10271 | `_surveiTotalWajibAB(role)` | — | M16 / calon |  | Direncanakan; belum ada path/commit | BELUM |
| BE-10275 | `_surveiGetUserInfo(username)` | Users | M16 / calon |  | Direncanakan; belum ada path/commit | BELUM |
| BE-10293 | `_surveiGetOrCreateProgressRow(periodeId, username, opts)` | Survei_Progress | M16 / calon |  | Direncanakan; belum ada path/commit | BELUM |
| BE-10333 | `_surveiProgressRowToObj(row)` | — | M16 / calon |  | Direncanakan; belum ada path/commit | BELUM |
| BE-10361 | `getSurveiStatus(username, periodeId)` | Survei_Jawaban, Survei_Periode, Survei_Progress | M16 / langsung | M16-F03 | Direncanakan; belum ada path/commit | BELUM |
| BE-10423 | `getRencanaAksiPublik(periodeId)` | Survei_Periode, Survei_Rencana_Aksi | M16 / langsung | M16-F15 | Direncanakan; belum ada path/commit | BELUM |
| BE-10482 | `_surveiMapelKodeAll()` | — | M16 / calon |  | Direncanakan; belum ada path/commit | BELUM |
| BE-10485 | `_surveiKegiatanKodeAll()` | — | M16 / calon |  | Direncanakan; belum ada path/commit | BELUM |
| BE-10486 | `_surveiKodeCSiswa(mapelRotasi)` | — | M16 / calon |  | Direncanakan; belum ada path/commit | BELUM |
| BE-10494 | `_surveiKodeDSiswa()` | — | M16 / langsung | M16-F06 | Direncanakan; belum ada path/commit | BELUM |
| BE-10502 | `_surveiSeededHash(str)` | — | M16 / calon |  | Direncanakan; belum ada path/commit | BELUM |
| BE-10510 | `_surveiPrng(seed)` | — | M16 / calon |  | Direncanakan; belum ada path/commit | BELUM |
| BE-10520 | `generateMapelRotasi(username, periodeId)` | Survei_Progress | M16 / langsung | M16-F05 | Direncanakan; belum ada path/commit | BELUM |
| BE-10572 | `_surveiGetMapelRotasiSiswa(periodeId, username)` | Survei_Progress | M16 / langsung | M16-F05 | Direncanakan; belum ada path/commit | BELUM |
| BE-10587 | `saveSurveiJawaban(periodeId, username, jawabanList, logUser)` | Survei_Jawaban, Survei_Periode | M16,M17 / langsung | M16-F07,M17-F12 | Direncanakan; belum ada path/commit | BELUM |
| BE-10775 | `submitSurveiUtama(periodeId, username, logUser)` | Settings, Survei_Jawaban, Survei_Peer, Survei_Periode | M16 / langsung | M16-F09,M16-F10 | Direncanakan; belum ada path/commit | BELUM |
| BE-10988 | `_surveiGetAllGuruAktif()` | Users | M16 / calon |  | Direncanakan; belum ada path/commit | BELUM |
| BE-11003 | `generatePeerSnapshot(periodeId, penilaiUsername)` | Survei_Progress | M16 / langsung | M16-F08 | Direncanakan; belum ada path/commit | BELUM |
| BE-11042 | `getSurveiPeerStatus(periodeId, penilaiUsername)` | Survei_Peer | M16 / langsung | M16-F08 | Direncanakan; belum ada path/commit | BELUM |
| BE-11112 | `saveSurveiPeerDraft(periodeId, penilaiUsername, dinilaiUsername, ptsData, logUser)` | Survei_Peer, Survei_Periode, Survei_Progress | M16 / langsung | M16-F08 | Direncanakan; belum ada path/commit | BELUM |
| BE-11236 | `_surveiHitungStatusPeer(periodeId, penilaiUsername)` | Survei_Peer, Survei_Progress | M16 / calon |  | Direncanakan; belum ada path/commit | BELUM |
| BE-11272 | `submitSurveiPeer(periodeId, penilaiUsername, logUser)` | Survei_Peer, Survei_Periode, Survei_Progress | M16 / langsung | M16-F09 | Direncanakan; belum ada path/commit | BELUM |
| BE-11352 | `getSkorPeerSayaSendiri(periodeId, username)` | Settings, Survei_Peer | M16 / langsung | M16-F11 | Direncanakan; belum ada path/commit | BELUM |
| BE-11447 | `getLaporanPersonalGuru(periodeId, username)` | Schedules, Survei_Jawaban | M16 / langsung | M16-F11 | Direncanakan; belum ada path/commit | BELUM |
| BE-11537 | `_surveiIsRowFlagged(progressObj)` | — | M16 / langsung | M16-F10 | Direncanakan; belum ada path/commit | BELUM |
| BE-11545 | `_surveiProgressMap(periodeId)` | Survei_Progress | M16 / calon |  | Direncanakan; belum ada path/commit | BELUM |
| BE-11571 | `_surveiFlaggedUsernames(periodeId)` | — | M16 / calon |  | Direncanakan; belum ada path/commit | BELUM |
| BE-11579 | `_surveiTargetUsers(targetRoleArr)` | Users | M16 / calon |  | Direncanakan; belum ada path/commit | BELUM |
| BE-11601 | `_surveiGetPeriodeById(periodeId)` | Survei_Periode | M16 / calon |  | Direncanakan; belum ada path/commit | BELUM |
| BE-11613 | `getSurveiProgressAll(periodeId, adminUser)` | — | M16 / langsung | M16-F12 | Direncanakan; belum ada path/commit | BELUM |
| BE-11728 | `_surveiLoadJawabanPeriode(periodeId, excludeUsernames)` | Survei_Jawaban | M16 / calon |  | Direncanakan; belum ada path/commit | BELUM |
| BE-11753 | `getSurveiRekapAspek(periodeId, adminUser, excludeFlag)` | — | M16 / langsung | M16-F13 | Direncanakan; belum ada path/commit | BELUM |
| BE-11799 | `getSurveiRekapMapel(periodeId, adminUser, excludeFlag)` | — | M16 / langsung | M16-F13 | Direncanakan; belum ada path/commit | BELUM |
| BE-11851 | `getSurveiRekapKegiatan(periodeId, adminUser, excludeFlag)` | — | M16 / langsung | M16-F13 | Direncanakan; belum ada path/commit | BELUM |
| BE-11902 | `getSurveiRekapPeer(periodeId, adminUser)` | Settings, Survei_Peer | M16 / langsung | M16-F13 | Direncanakan; belum ada path/commit | BELUM |
| BE-11996 | `getSurveiEsaiAll(periodeId, bagian, kodeFilter, adminUser)` | Survei_Jawaban, Survei_Peer | M16 / langsung | M16-F13 | Direncanakan; belum ada path/commit | BELUM |
| BE-12069 | `setCatatanAdminSurvei(periodeId, username, catatan, adminUser)` | Survei_Progress | M16 / langsung | M16-F12 | Direncanakan; belum ada path/commit | BELUM |
| BE-12101 | `_isKepalaMadrasah(username)` | Users | M01 / langsung | M01-F10 | Direncanakan; belum ada path/commit | BELUM |
| BE-12116 | `simpanRencanaAksi(periodeId, poinList, kepalaUser)` | Survei_Periode, Survei_Rencana_Aksi | M16 / langsung | M16-F15 | Direncanakan; belum ada path/commit | BELUM |
| BE-12233 | `getRencanaAksi(periodeId)` | Survei_Rencana_Aksi | M16 / langsung | M16-F15 | Direncanakan; belum ada path/commit | BELUM |
| BE-12267 | `updateStatusKetercapaian(rencanaAksiId, statusBaru, kepalaUser)` | Survei_Rencana_Aksi | M16 / langsung | M16-F15 | Direncanakan; belum ada path/commit | BELUM |
| BE-12303 | `getTrenAnterSemester(adminUser, aspek, role, jumlahPeriode)` | Survei_Jawaban, Survei_Periode | M16 / langsung | M16-F14 | Direncanakan; belum ada path/commit | BELUM |
| BE-12421 | `getSurveiMikroAktif()` | Survei_Periode | M16 / calon |  | Direncanakan; belum ada path/commit | BELUM |
| BE-12439 | `getSurveiMikroAktifUntukUser(username)` | Survei_Progress | M16 / langsung | M16-F16 | Direncanakan; belum ada path/commit | BELUM |
| BE-12469 | `createSurveiMikro(nama, pertanyaanList, targetRole, tglBuka, tglTutup, adminUser)` | Survei_Periode | M16 / langsung | M16-F16 | Direncanakan; belum ada path/commit | BELUM |
| BE-12564 | `saveSurveiMikroJawaban(periodeId, username, jawabanList, logUser)` | Survei_Jawaban | M16 / langsung | M16-F16 | Direncanakan; belum ada path/commit | BELUM |
| BE-12712 | `getLaporanSurveiMikro(periodeId, adminUser)` | Survei_Jawaban | M16 / langsung | M16-F16 | Direncanakan; belum ada path/commit | BELUM |
| BE-12809 | `_isAdminOnly(adminUser)` | Users | M01 / langsung | M01-F10 | Direncanakan; belum ada path/commit | BELUM |
| BE-12821 | `_surveiSettingsGet(key)` | Settings | M16 / calon |  | Direncanakan; belum ada path/commit | BELUM |
| BE-12832 | `_surveiSettingsSet(key, value)` | Settings | M16 / calon |  | Direncanakan; belum ada path/commit | BELUM |
| BE-12848 | `simpanKonfigurasiAI(config, adminUser)` | — | M16 / langsung | M16-F17 | Direncanakan; belum ada path/commit | BELUM |
| BE-12870 | `getKonfigurasiAI(adminUser)` | — | M16 / langsung | M16-F17 | Direncanakan; belum ada path/commit | BELUM |
| BE-12884 | `simpanAnthropicApiKey(apiKey, adminUser)` | — | M16 / langsung | M16-F17 | Direncanakan; belum ada path/commit | BELUM |
| BE-12909 | `getAnthropicConfig(adminUser)` | — | M16 / langsung | M16-F17 | Direncanakan; belum ada path/commit | BELUM |
| BE-12929 | `getEsaiUntukAnalisis(periodeId, scopeAnalisis, adminUser)` | Survei_Jawaban, Survei_Peer | M16 / langsung | M16-F18 | Direncanakan; belum ada path/commit | BELUM |
| BE-13003 | `getHasilAnalisisAI(periodeId, scopeAnalisis, adminUser)` | Survei_AI_Analisis | M16 / langsung | M16-F18 | Direncanakan; belum ada path/commit | BELUM |
| BE-13052 | `jalankanAnalisisAI(periodeId, scopeAnalisis, adminUser)` | Survei_AI_Analisis | M16 / langsung | M16-F18 | Direncanakan; belum ada path/commit | BELUM |
| BE-13239 | `_surveiAiCacheTulisError(periodeId, scopeAnalisis, jumlahEsai, adminUser, modelName, pesanError)` | Survei_AI_Analisis | M16 / calon |  | Direncanakan; belum ada path/commit | BELUM |
| BE-13261 | `hapusCacheAnalisisAI(periodeId, scopeAnalisis, adminUser)` | Survei_AI_Analisis | M16 / langsung | M16-F18 | Direncanakan; belum ada path/commit | BELUM |
| BE-13299 | `_ensurePiketHadirSheet_()` | Piket_Hadir | M08 / calon |  | Direncanakan; belum ada path/commit | BELUM |
| BE-13338 | `_todayStr_()` | — | M17 / calon |  | Direncanakan; belum ada path/commit | BELUM |
| BE-13343 | `_normalizeDateStr_(val)` | — | M17 / calon |  | Direncanakan; belum ada path/commit | BELUM |
| BE-13352 | `_isAdmin_(username)` | Users | M17 / calon |  | Direncanakan; belum ada path/commit | BELUM |
| BE-13365 | `_getUserData_(username)` | Users | M17 / calon |  | Direncanakan; belum ada path/commit | BELUM |
| BE-13385 | `_isPiketTerkonfirmasi_(username)` | — | M08 / langsung | M08-F03 | Direncanakan; belum ada path/commit | BELUM |
| BE-13407 | `cekPiketPenggantiTerkonfirmasi(username, sessionToken)` | — | M08 / langsung | M08-F03 | Direncanakan; belum ada path/commit | BELUM |
| BE-13417 | `initPiketHadirSheet(adminUsername)` | — | M08 / calon |  | Direncanakan; belum ada path/commit | BELUM |
| BE-13425 | `getPiketHariIni(adminUsername)` | Users | M08 / langsung | M08-F01 | Direncanakan; belum ada path/commit | BELUM |
| BE-13477 | `konfirmasiPiketUtama(usernameGuru, adminUsername)` | — | M08 / langsung | M08-F01 | Direncanakan; belum ada path/commit | BELUM |
| BE-13528 | `tunjukPiketPengganti(usernameGuru, usernameDigantikan, adminUsername)` | — | M08 / langsung | M08-F02 | Direncanakan; belum ada path/commit | BELUM |
| BE-13576 | `getPiketPenggantiHariIni(adminUsername)` | Users | M08 / langsung | M08-F03 | Direncanakan; belum ada path/commit | BELUM |
| BE-13612 | `konfirmasiPiketPengganti(idSesi, adminUsername)` | — | M08 / langsung | M08-F02 | Direncanakan; belum ada path/commit | BELUM |
| BE-13653 | `getAllGuruForPiket(adminUsername)` | Users | M08 / langsung | M08-F03 | Direncanakan; belum ada path/commit | BELUM |
| BE-13671 | `batalKonfirmasiPiketUtama(usernameGuru, adminUsername)` | — | M08 / langsung | M08-F01 | Direncanakan; belum ada path/commit | BELUM |
| BE-13698 | `batalKonfirmasiPiketPengganti(idSesi, adminUsername)` | — | M08 / langsung | M08-F02 | Direncanakan; belum ada path/commit | BELUM |
| BE-13730 | `batalTunjukPiketPengganti(idSesi, adminUsername)` | — | M08 / langsung | M08-F02 | Direncanakan; belum ada path/commit | BELUM |
| BE-13768 | `_hitungProgressPiketHariIni_(username)` | Attendance, Classes, Users | M08 / langsung | M08-F04 | Direncanakan; belum ada path/commit | BELUM |
| BE-13841 | `_buildPiketReminderEmailBody_(fullName, todayName, summary)` | — | M08 / calon |  | Direncanakan; belum ada path/commit | BELUM |
| BE-13871 | `_alreadySentPiketReminderToday_(username, todayStr)` | Activity_Logs | M08 / langsung | M08-F04 | Direncanakan; belum ada path/commit | BELUM |
| BE-13891 | `_piketCandidatesForToday_()` | Users | M17 / calon |  | Direncanakan; belum ada path/commit | BELUM |
| BE-13918 | `kirimNotifikasiPiketHarian(opts)` | — | M08,M17 / langsung | M08-F04,M17-F09 | Direncanakan; belum ada path/commit | BELUM |
| BE-14019 | `previewNotifikasiPiketHarian()` | — | M08 / langsung | M08-F05 | Direncanakan; belum ada path/commit | BELUM |
| BE-14022 | `runNotifikasiPiketHarianNow(adminUser)` | — | M08 / langsung | M08-F05 | Direncanakan; belum ada path/commit | BELUM |
| BE-14034 | `_ensureHariLiburSheet_()` | — | M17 / calon |  | Direncanakan; belum ada path/commit | BELUM |
| BE-14065 | `_resolveHariLiburCols_(sh)` | — | M17 / calon |  | Direncanakan; belum ada path/commit | BELUM |
| BE-14089 | `_normalizeTanggalLibur_(v)` | — | M17 / calon |  | Direncanakan; belum ada path/commit | BELUM |
| BE-14105 | `_isHariLiburHariIni_()` | — | M17 / calon |  | Direncanakan; belum ada path/commit | BELUM |
| BE-14121 | `listHariLibur()` | — | M17 / langsung | M17-F03 | Direncanakan; belum ada path/commit | BELUM |
| BE-14139 | `addHariLibur(tanggalStr, keterangan, adminUser)` | — | M17 / langsung | M17-F03 | Direncanakan; belum ada path/commit | BELUM |
| BE-14183 | `removeHariLibur(tanggalStr, adminUser)` | — | M17 / langsung | M17-F03 | Direncanakan; belum ada path/commit | BELUM |
| BE-14211 | `_ensureNotifPiketTriggers_()` | — | M08 / calon |  | Direncanakan; belum ada path/commit | BELUM |
| BE-14245 | `getStatusTriggerNotifPiket()` | — | M08 / langsung | M08-F05 | Direncanakan; belum ada path/commit | BELUM |
| BE-14285 | `_hitungAllIuranPeriode_()` | Iuran_Komite | M09 / calon |  | Direncanakan; belum ada path/commit | BELUM |
| BE-14353 | `getDashboardBundleAdmin(callerUsername)` | Attendance, Classes, Savings, Users | M02,M17 / langsung | M02-F01,M17-F12 | Direncanakan; belum ada path/commit | BELUM |
| BE-14445 | `getDashboardBundleGuru(username)` | Hari_Libur, Savings, Users | M02 / langsung | M02-F02 | Direncanakan; belum ada path/commit | BELUM |
| BE-14596 | `getDashboardBundleSiswa(username)` | — | M02 / langsung | M02-F03 | Direncanakan; belum ada path/commit | BELUM |
| BE-14650 | `getDashboardBundleSavings(username)` | — | M02 / langsung | M02-F05 | Direncanakan; belum ada path/commit | BELUM |
| BE-14667 | `getCalonSiswaData(callerUsername)` | SiswaDetail, Users | M03 / langsung | M03-F05 | Direncanakan; belum ada path/commit | BELUM |
| BE-14725 | `_calculateProfileProgressPercentage(rowData, headers)` | — | M03 / langsung | M03-F05 | Direncanakan; belum ada path/commit | BELUM |
| BE-14798 | `getCalonSiswaDetail(userId, callerUsername)` | SiswaDetail, Users | M03 / langsung | M03-F05 | Direncanakan; belum ada path/commit | BELUM |
| BE-14882 | `getOrangTuaData(callerUsername)` | SiswaDetail, Users | M03 / langsung | M03-F06 | Direncanakan; belum ada path/commit | BELUM |
| BE-15011 | `uploadFileToDrive(base64Data, filename, adminUser)` | — | M04 / langsung | M04-F07 | Direncanakan; belum ada path/commit | BELUM |
| BE-15063 | `_generateNoSlip_(penabungType, tanggal, savingsData)` | — | M10 / langsung | M10-F08 | Direncanakan; belum ada path/commit | BELUM |

## 10. Lampiran inventaris frontend dan owner calon

Setiap entri dari katalog frontend asli disertakan. Pemetaan langsung merujuk bagian5; selainnya adalah **calon owner**, bukan verifikasi semantik closure. Fungsi renderPage/onload/saveNext yang berulang tidak boleh disatukan hanya karena nama sama. Item calon tetap menjadi kewajiban review pada tahap modul; reassign ownership jika inspeksi body menunjukkan tanggung jawab lain. Handler/CSS/markup di luar pola katalog tetap dirujuk melalui baseline, sehingga angka berikut bukan klaim analisis AST seluruh frontend.

| Kunci sumber | Fungsi/assignment | Bentuk | Modul target / jenis | Fitur langsung | Status |
|---|---|---|---|---|---|
| FE-11793-deklarasi | `formatRupiah` | deklarasi | M17 / calon | Review helper dalam modul calon | BELUM |
| FE-11800-deklarasi | `getActiveUser` | deklarasi | M17 / calon | Review helper dalam modul calon | BELUM |
| FE-11811-deklarasi | `getActiveUsername` | deklarasi | M17 / calon | Review helper dalam modul calon | BELUM |
| FE-11822-deklarasi | `requireActiveUser` | deklarasi | M17 / calon | Review helper dalam modul calon | BELUM |
| FE-11838-deklarasi | `toDateString` | deklarasi | M17 / calon | Review helper dalam modul calon | BELUM |
| FE-11855-deklarasi | `_setForceSurveiEvaluasi` | deklarasi | M16 / calon | Review helper dalam modul calon | BELUM |
| FE-11863-deklarasi | `_clearForceSurveiEvaluasi` | deklarasi | M16 / calon | Review helper dalam modul calon | BELUM |
| FE-11874-deklarasi | `_refreshForceSurveiEvaluasi` | deklarasi | M16 / calon | Review helper dalam modul calon | BELUM |
| FE-12019-deklarasi | `$` | deklarasi | M17 / calon | Review helper dalam modul calon | BELUM |
| FE-12021-deklarasi | `isLoading` | deklarasi | M17 / calon | Review helper dalam modul calon | BELUM |
| FE-12023-deklarasi | `setError` | deklarasi | M17 / calon | Review helper dalam modul calon | BELUM |
| FE-12035-deklarasi | `setEmailMasked` | deklarasi | M17 / calon | Review helper dalam modul calon | BELUM |
| FE-12040-deklarasi | `updateVerifyDisabled` | deklarasi | M17 / calon | Review helper dalam modul calon | BELUM |
| FE-12051-deklarasi | `updateResendDisabled` | deklarasi | M17 / calon | Review helper dalam modul calon | BELUM |
| FE-12060-deklarasi | `setVerifyLoading` | deklarasi | M17 / calon | Review helper dalam modul calon | BELUM |
| FE-12070-deklarasi | `setRequestLoading` | deklarasi | M17 / calon | Review helper dalam modul calon | BELUM |
| FE-12080-deklarasi | `renderCooldownText` | deklarasi | M17 / calon | Review helper dalam modul calon | BELUM |
| FE-12092-deklarasi | `clearCooldownTimer` | deklarasi | M17 / calon | Review helper dalam modul calon | BELUM |
| FE-12099-deklarasi | `startCooldown` | deklarasi | M17 / calon | Review helper dalam modul calon | BELUM |
| FE-12116-deklarasi | `bindListenersOnce` | deklarasi | M17 / calon | Review helper dalam modul calon | BELUM |
| FE-12162-deklarasi | `setButtonVisible` | deklarasi | M17 / calon | Review helper dalam modul calon | BELUM |
| FE-12174-deklarasi | `hideVerifyButton` | deklarasi | M17 / calon | Review helper dalam modul calon | BELUM |
| FE-12175-deklarasi | `hideResendButton` | deklarasi | M17 / calon | Review helper dalam modul calon | BELUM |
| FE-12176-deklarasi | `resetButtonsVisibility` | deklarasi | M17 / calon | Review helper dalam modul calon | BELUM |
| FE-12180-deklarasi | `focusResendButton` | deklarasi | M17 / calon | Review helper dalam modul calon | BELUM |
| FE-12193-deklarasi | `showRetryButton` | deklarasi | M17 / calon | Review helper dalam modul calon | BELUM |
| FE-12207-assignment | `onclick` | assignment | M17 / calon | Review helper dalam modul calon | BELUM |
| FE-12217-deklarasi | `hideRetryButton` | deklarasi | M17 / calon | Review helper dalam modul calon | BELUM |
| FE-12225-deklarasi | `resetUiForOpen` | deklarasi | M17 / calon | Review helper dalam modul calon | BELUM |
| FE-12248-deklarasi | `showModal` | deklarasi | M17 / calon | Review helper dalam modul calon | BELUM |
| FE-12259-deklarasi | `hideModal` | deklarasi | M17 / calon | Review helper dalam modul calon | BELUM |
| FE-12264-deklarasi | `getCallerContext` | deklarasi | M17 / calon | Review helper dalam modul calon | BELUM |
| FE-12272-deklarasi | `requestOtp` | deklarasi | M01 / calon | Review helper dalam modul calon | BELUM |
| FE-12282-assignment | `onResult` | assignment | M17 / calon | Review helper dalam modul calon | BELUM |
| FE-12300-assignment | `onFailure` | assignment | M17 / calon | Review helper dalam modul calon | BELUM |
| FE-12410-deklarasi | `wireOtpModalVerify` | deklarasi | M01 / calon | Review helper dalam modul calon | BELUM |
| FE-12413-deklarasi | `getCallerCtx` | deklarasi | M17 / calon | Review helper dalam modul calon | BELUM |
| FE-12421-deklarasi | `readOtpCode` | deklarasi | M01 / calon | Review helper dalam modul calon | BELUM |
| FE-12426-deklarasi | `safeShowToast` | deklarasi | M17 / calon | Review helper dalam modul calon | BELUM |
| FE-12430-deklarasi | `refreshProfilePage` | deklarasi | M17 / calon | Review helper dalam modul calon | BELUM |
| FE-12438-deklarasi | `handleVerifyResult` | deklarasi | M17 / calon | Review helper dalam modul calon | BELUM |
| FE-12501-deklarasi | `handleVerifyFailure` | deklarasi | M17 / calon | Review helper dalam modul calon | BELUM |
| FE-12508-deklarasi | `onVerifyClickHandler` | deklarasi | M17 / calon | Review helper dalam modul calon | BELUM |
| FE-12562-deklarasi | `wireOtpModalResend` | deklarasi | M01 / calon | Review helper dalam modul calon | BELUM |
| FE-12565-deklarasi | `getCallerCtx` | deklarasi | M17 / calon | Review helper dalam modul calon | BELUM |
| FE-12573-deklarasi | `safeShowToast` | deklarasi | M17 / calon | Review helper dalam modul calon | BELUM |
| FE-12577-deklarasi | `clearOtpInput` | deklarasi | M01 / calon | Review helper dalam modul calon | BELUM |
| FE-12585-deklarasi | `retryRequest` | deklarasi | M17 / calon | Review helper dalam modul calon | BELUM |
| FE-12606-deklarasi | `handleResendResult` | deklarasi | M17 / calon | Review helper dalam modul calon | BELUM |
| FE-12672-deklarasi | `handleResendFailure` | deklarasi | M17 / calon | Review helper dalam modul calon | BELUM |
| FE-12680-deklarasi | `onResendClickHandler` | deklarasi | M17 / calon | Review helper dalam modul calon | BELUM |
| FE-12735-deklarasi | `convertGoogleDriveLink` | deklarasi | M17 / calon | Review helper dalam modul calon | BELUM |
| FE-12760-deklarasi | `extractFileIdFromUrl` | deklarasi | M17 / calon | Review helper dalam modul calon | BELUM |
| FE-12774-deklarasi | `detectFileType` | deklarasi | M17 / calon | Review helper dalam modul calon | BELUM |
| FE-12785-deklarasi | `showPreviewLoading` | deklarasi | M17 / calon | Review helper dalam modul calon | BELUM |
| FE-12796-deklarasi | `showPreviewError` | deklarasi | M17 / calon | Review helper dalam modul calon | BELUM |
| FE-12809-deklarasi | `showPreviewContent` | deklarasi | M17 / calon | Review helper dalam modul calon | BELUM |
| FE-12820-deklarasi | `formatDateForInput` | deklarasi | M17 / calon | Review helper dalam modul calon | BELUM |
| FE-12841-deklarasi | `showToast` | deklarasi | M17 / langsung | M17-F06 | BELUM |
| FE-12861-deklarasi | `handleLogin` | deklarasi | M01 / calon | Review helper dalam modul calon | BELUM |
| FE-12880-deklarasi | `toggleSidebar` | deklarasi | M17 / calon | Review helper dalam modul calon | BELUM |
| FE-12896-deklarasi | `togglePassword` | deklarasi | M01 / calon | Review helper dalam modul calon | BELUM |
| FE-12913-deklarasi | `showLoginForm` | deklarasi | M01 / calon | Review helper dalam modul calon | BELUM |
| FE-12919-deklarasi | `closeLoginForm` | deklarasi | M01 / calon | Review helper dalam modul calon | BELUM |
| FE-12929-deklarasi | `onLoginSuccess` | deklarasi | M01 / calon | Review helper dalam modul calon | BELUM |
| FE-12972-assignment | `_dispatchAfterLogin` | assignment | M01 / calon | Review helper dalam modul calon | BELUM |
| FE-13045-deklarasi | `onLoginFail` | deklarasi | M01 / calon | Review helper dalam modul calon | BELUM |
| FE-13054-deklarasi | `renderDashboard` | deklarasi | M17 / langsung | M17-F05 | BELUM |
| FE-13272-assignment | `onclick` | assignment | M17 / calon | Review helper dalam modul calon | BELUM |
| FE-13306-assignment | `onmouseenter` | assignment | M17 / calon | Review helper dalam modul calon | BELUM |
| FE-13312-assignment | `onmouseleave` | assignment | M17 / calon | Review helper dalam modul calon | BELUM |
| FE-13348-assignment | `onclick` | assignment | M17 / calon | Review helper dalam modul calon | BELUM |
| FE-13403-assignment | `onmouseenter` | assignment | M17 / calon | Review helper dalam modul calon | BELUM |
| FE-13409-assignment | `onmouseleave` | assignment | M17 / calon | Review helper dalam modul calon | BELUM |
| FE-13474-assignment | `onclick` | assignment | M17 / calon | Review helper dalam modul calon | BELUM |
| FE-13537-assignment | `onmouseenter` | assignment | M17 / calon | Review helper dalam modul calon | BELUM |
| FE-13543-assignment | `onmouseleave` | assignment | M17 / calon | Review helper dalam modul calon | BELUM |
| FE-13612-assignment | `onclick` | assignment | M17 / calon | Review helper dalam modul calon | BELUM |
| FE-13658-assignment | `onmouseenter` | assignment | M17 / calon | Review helper dalam modul calon | BELUM |
| FE-13664-assignment | `onmouseleave` | assignment | M17 / calon | Review helper dalam modul calon | BELUM |
| FE-13734-assignment | `onclick` | assignment | M17 / calon | Review helper dalam modul calon | BELUM |
| FE-13799-assignment | `onmouseenter` | assignment | M17 / calon | Review helper dalam modul calon | BELUM |
| FE-13805-assignment | `onmouseleave` | assignment | M17 / calon | Review helper dalam modul calon | BELUM |
| FE-13909-assignment | `onclick` | assignment | M17 / calon | Review helper dalam modul calon | BELUM |
| FE-13953-assignment | `onmouseenter` | assignment | M17 / calon | Review helper dalam modul calon | BELUM |
| FE-13959-assignment | `onmouseleave` | assignment | M17 / calon | Review helper dalam modul calon | BELUM |
| FE-14033-assignment | `onclick` | assignment | M17 / calon | Review helper dalam modul calon | BELUM |
| FE-14078-assignment | `onmouseenter` | assignment | M17 / calon | Review helper dalam modul calon | BELUM |
| FE-14084-assignment | `onmouseleave` | assignment | M17 / calon | Review helper dalam modul calon | BELUM |
| FE-14148-assignment | `onclick` | assignment | M17 / calon | Review helper dalam modul calon | BELUM |
| FE-14193-assignment | `onmouseenter` | assignment | M17 / calon | Review helper dalam modul calon | BELUM |
| FE-14199-assignment | `onmouseleave` | assignment | M17 / calon | Review helper dalam modul calon | BELUM |
| FE-14263-assignment | `onclick` | assignment | M17 / calon | Review helper dalam modul calon | BELUM |
| FE-14309-assignment | `onmouseenter` | assignment | M17 / calon | Review helper dalam modul calon | BELUM |
| FE-14315-assignment | `onmouseleave` | assignment | M17 / calon | Review helper dalam modul calon | BELUM |
| FE-14379-assignment | `onclick` | assignment | M17 / calon | Review helper dalam modul calon | BELUM |
| FE-14424-assignment | `onmouseenter` | assignment | M17 / calon | Review helper dalam modul calon | BELUM |
| FE-14430-assignment | `onmouseleave` | assignment | M17 / calon | Review helper dalam modul calon | BELUM |
| FE-14549-assignment | `onclick` | assignment | M17 / calon | Review helper dalam modul calon | BELUM |
| FE-14590-assignment | `onmouseenter` | assignment | M17 / calon | Review helper dalam modul calon | BELUM |
| FE-14596-assignment | `onmouseleave` | assignment | M17 / calon | Review helper dalam modul calon | BELUM |
| FE-14689-assignment | `onmouseenter` | assignment | M17 / calon | Review helper dalam modul calon | BELUM |
| FE-14698-assignment | `onmouseleave` | assignment | M17 / calon | Review helper dalam modul calon | BELUM |
| FE-14714-deklarasi | `loadContent` | deklarasi | M01,M17 / langsung | M01-F09,M17-F05 | BELUM |
| FE-15081-deklarasi | `checkPageReadOnly` | deklarasi | M17 / langsung | M17-F05 | BELUM |
| FE-15099-deklarasi | `loadIuranKomite` | deklarasi | M09 / calon | Review helper dalam modul calon | BELUM |
| FE-15110-deklarasi | `getCurrentTahunAjaran` | deklarasi | M09 / calon | Review helper dalam modul calon | BELUM |
| FE-15114-deklarasi | `getCurrentSemester` | deklarasi | M09 / calon | Review helper dalam modul calon | BELUM |
| FE-15117-deklarasi | `getSemesterMonths` | deklarasi | M09 / calon | Review helper dalam modul calon | BELUM |
| FE-15125-deklarasi | `semesterLabel` | deklarasi | M09 / calon | Review helper dalam modul calon | BELUM |
| FE-15130-deklarasi | `calYearOfMonth` | deklarasi | M09 / calon | Review helper dalam modul calon | BELUM |
| FE-15133-deklarasi | `fmt` | deklarasi | M09 / calon | Review helper dalam modul calon | BELUM |
| FE-15613-deklarasi | `switchIuranTab` | deklarasi | M09 / calon | Review helper dalam modul calon | BELUM |
| FE-15640-deklarasi | `loadIuranTransactions` | deklarasi | M09 / calon | Review helper dalam modul calon | BELUM |
| FE-15659-deklarasi | `applyIuranFilters` | deklarasi | M09 / calon | Review helper dalam modul calon | BELUM |
| FE-15687-assignment | `cardHtml` | assignment | M09 / calon | Review helper dalam modul calon | BELUM |
| FE-15739-deklarasi | `loadIuranRecap` | deklarasi | M09 / calon | Review helper dalam modul calon | BELUM |
| FE-15763-deklarasi | `buildRecapRow` | deklarasi | M09 / calon | Review helper dalam modul calon | BELUM |
| FE-15793-deklarasi | `applyRecapFilters` | deklarasi | M09 / calon | Review helper dalam modul calon | BELUM |
| FE-15815-assignment | `rc` | assignment | M09 / calon | Review helper dalam modul calon | BELUM |
| FE-15846-deklarasi | `loadIuranTren` | deklarasi | M09 / calon | Review helper dalam modul calon | BELUM |
| FE-15907-deklarasi | `loadIuranArsipGrouped` | deklarasi | M09 / calon | Review helper dalam modul calon | BELUM |
| FE-15928-deklarasi | `applyArsipFilters` | deklarasi | M09 / calon | Review helper dalam modul calon | BELUM |
| FE-15967-deklarasi | `openArsipDetailModal` | deklarasi | M09 / calon | Review helper dalam modul calon | BELUM |
| FE-16031-deklarasi | `applyFilter` | deklarasi | M09 / calon | Review helper dalam modul calon | BELUM |
| FE-16071-deklarasi | `openAddModalIuran` | deklarasi | M09 / calon | Review helper dalam modul calon | BELUM |
| FE-16123-deklarasi | `renderBulanCheckboxesForPeriode` | deklarasi | M09 / calon | Review helper dalam modul calon | BELUM |
| FE-16151-deklarasi | `handleBulanCheckChange` | deklarasi | M09 / calon | Review helper dalam modul calon | BELUM |
| FE-16164-deklarasi | `setIuranQuickPeriode` | deklarasi | M09 / calon | Review helper dalam modul calon | BELUM |
| FE-16188-deklarasi | `updateIuranQuickChipState` | deklarasi | M09 / calon | Review helper dalam modul calon | BELUM |
| FE-16209-deklarasi | `setIuranQuickNominal` | deklarasi | M09 / calon | Review helper dalam modul calon | BELUM |
| FE-16222-deklarasi | `updateIuranMonthSummary` | deklarasi | M09 / calon | Review helper dalam modul calon | BELUM |
| FE-16242-deklarasi | `updateIuranStepperAndStatus` | deklarasi | M09 / calon | Review helper dalam modul calon | BELUM |
| FE-16288-deklarasi | `handleModalPeriodeChange` | deklarasi | M09 / calon | Review helper dalam modul calon | BELUM |
| FE-16338-deklarasi | `loadPaidMonthsForCurrentPeriode` | deklarasi | M09 / calon | Review helper dalam modul calon | BELUM |
| FE-16358-deklarasi | `handleStudentChangeForIuran` | deklarasi | M09 / calon | Review helper dalam modul calon | BELUM |
| FE-16376-deklarasi | `calculateIuran` | deklarasi | M09 / calon | Review helper dalam modul calon | BELUM |
| FE-16439-deklarasi | `handleIuranClassChange` | deklarasi | M09 / calon | Review helper dalam modul calon | BELUM |
| FE-16476-deklarasi | `closeModal` | deklarasi | M05 / calon | Review helper dalam modul calon | BELUM |
| FE-16506-deklarasi | `handleEditIuran` | deklarasi | M09 / calon | Review helper dalam modul calon | BELUM |
| FE-16594-deklarasi | `handleSubmitIuran` | deklarasi | M09 / langsung | M09-F01 | BELUM |
| FE-16679-assignment | `lockSubmit` | assignment | M05 / calon | Review helper dalam modul calon | BELUM |
| FE-16688-assignment | `unlockSubmit` | assignment | M05 / calon | Review helper dalam modul calon | BELUM |
| FE-16702-assignment | `refreshActiveTab` | assignment | M05 / calon | Review helper dalam modul calon | BELUM |
| FE-16710-assignment | `handleResult` | assignment | M05 / calon | Review helper dalam modul calon | BELUM |
| FE-16721-assignment | `handleError` | assignment | M05 / calon | Review helper dalam modul calon | BELUM |
| FE-16727-assignment | `doSave` | assignment | M05 / calon | Review helper dalam modul calon | BELUM |
| FE-16763-deklarasi | `handleDeleteIuran` | deklarasi | M09 / calon | Review helper dalam modul calon | BELUM |
| FE-16807-deklarasi | `closeDeleteModal` | deklarasi | M05 / calon | Review helper dalam modul calon | BELUM |
| FE-16808-deklarasi | `confirmDeleteAction` | deklarasi | M05 / calon | Review helper dalam modul calon | BELUM |
| FE-16835-deklarasi | `loadManajemenKelas` | deklarasi | M05 / calon | Review helper dalam modul calon | BELUM |
| FE-16942-deklarasi | `getTingkatBadge` | deklarasi | M05 / calon | Review helper dalam modul calon | BELUM |
| FE-16949-deklarasi | `getWaliAvatar` | deklarasi | M05 / calon | Review helper dalam modul calon | BELUM |
| FE-17110-deklarasi | `openClassModal` | deklarasi | M05 / calon | Review helper dalam modul calon | BELUM |
| FE-17164-deklarasi | `closeClassModal` | deklarasi | M05 / calon | Review helper dalam modul calon | BELUM |
| FE-17187-deklarasi | `handleClassSubmit` | deklarasi | M05 / calon | Review helper dalam modul calon | BELUM |
| FE-17285-deklarasi | `handleDeleteClass` | deklarasi | M05 / calon | Review helper dalam modul calon | BELUM |
| FE-17333-deklarasi | `openSiswaKelasModal` | deklarasi | M05 / calon | Review helper dalam modul calon | BELUM |
| FE-17388-deklarasi | `renderSiswaKelasList` | deklarasi | M05 / calon | Review helper dalam modul calon | BELUM |
| FE-17436-deklarasi | `filterSiswaKelas` | deklarasi | M05 / calon | Review helper dalam modul calon | BELUM |
| FE-17451-deklarasi | `closeSiswaKelasModal` | deklarasi | M05 / calon | Review helper dalam modul calon | BELUM |
| FE-17459-deklarasi | `logout` | deklarasi | M01 / calon | Review helper dalam modul calon | BELUM |
| FE-17487-deklarasi | `showLoading` | deklarasi | M17 / langsung | M17-F06 | BELUM |
| FE-17492-deklarasi | `hideLoading` | deklarasi | M17 / langsung | M17-F06 | BELUM |
| FE-17496-deklarasi | `confirmLogout` | deklarasi | M01 / calon | Review helper dalam modul calon | BELUM |
| FE-17500-deklarasi | `closeLogoutModal` | deklarasi | M01 / calon | Review helper dalam modul calon | BELUM |
| FE-17504-deklarasi | `performLogout` | deklarasi | M01 / calon | Review helper dalam modul calon | BELUM |
| FE-17534-deklarasi | `startInactivityTimer` | deklarasi | M17 / calon | Review helper dalam modul calon | BELUM |
| FE-17543-deklarasi | `resetInactivityTimer` | deklarasi | M17 / calon | Review helper dalam modul calon | BELUM |
| FE-17550-deklarasi | `stopInactivityTimer` | deklarasi | M17 / calon | Review helper dalam modul calon | BELUM |
| FE-17558-deklarasi | `loadLogAktivitas` | deklarasi | M17 / calon | Review helper dalam modul calon | BELUM |
| FE-17567-assignment | `exportLogCsv` | assignment | M17 / langsung | M17-F07 | BELUM |
| FE-17874-deklarasi | `loadManajemenUser` | deklarasi | M17 / calon | Review helper dalam modul calon | BELUM |
| FE-18103-deklarasi | `handleResetSession` | deklarasi | M01 / calon | Review helper dalam modul calon | BELUM |
| FE-18121-deklarasi | `handleResetPassword` | deklarasi | M01 / calon | Review helper dalam modul calon | BELUM |
| FE-18139-deklarasi | `handleDeleteUser` | deklarasi | M03 / calon | Review helper dalam modul calon | BELUM |
| FE-18157-deklarasi | `toggleTugasField` | deklarasi | M03 / calon | Review helper dalam modul calon | BELUM |
| FE-18167-deklarasi | `handleRoleChange` | deklarasi | M03 / calon | Review helper dalam modul calon | BELUM |
| FE-18189-deklarasi | `openUserModal` | deklarasi | M03 / calon | Review helper dalam modul calon | BELUM |
| FE-18267-deklarasi | `closeUserModal` | deklarasi | M03 / calon | Review helper dalam modul calon | BELUM |
| FE-18280-deklarasi | `handleUserSubmit` | deklarasi | M03 / calon | Review helper dalam modul calon | BELUM |
| FE-18365-deklarasi | `togglePiketGroup` | deklarasi | M03 / calon | Review helper dalam modul calon | BELUM |
| FE-18372-deklarasi | `openConfirmModal` | deklarasi | M03 / calon | Review helper dalam modul calon | BELUM |
| FE-18437-deklarasi | `closeConfirmModal` | deklarasi | M03 / calon | Review helper dalam modul calon | BELUM |
| FE-18637-deklarasi | `openResetRequestModal` | deklarasi | M07 / calon | Review helper dalam modul calon | BELUM |
| FE-18658-deklarasi | `closeResetRequestModal` | deklarasi | M07 / calon | Review helper dalam modul calon | BELUM |
| FE-18663-deklarasi | `openResetSesiModal` | deklarasi | M01 / calon | Review helper dalam modul calon | BELUM |
| FE-18684-deklarasi | `closeResetSesiModal` | deklarasi | M01 / calon | Review helper dalam modul calon | BELUM |
| FE-18689-deklarasi | `closeConfirmResetSesiModal` | deklarasi | M01 / calon | Review helper dalam modul calon | BELUM |
| FE-18694-deklarasi | `loadManajemenAbsensi` | deklarasi | M07 / calon | Review helper dalam modul calon | BELUM |
| FE-18702-assignment | `romanVal` | assignment | M07 / calon | Review helper dalam modul calon | BELUM |
| FE-18711-assignment | `parse` | assignment | M07 / calon | Review helper dalam modul calon | BELUM |
| FE-18764-deklarasi | `statusBadge` | deklarasi | M07 / calon | Review helper dalam modul calon | BELUM |
| FE-19027-assignment | `updateAbsStatCards` | assignment | M07 / calon | Review helper dalam modul calon | BELUM |
| FE-19037-assignment | `rc` | assignment | M07 / calon | Review helper dalam modul calon | BELUM |
| FE-19053-assignment | `applyAttFilters` | assignment | M07 / calon | Review helper dalam modul calon | BELUM |
| FE-19128-assignment | `refreshManajemenAbsensi` | assignment | M07 / calon | Review helper dalam modul calon | BELUM |
| FE-19167-assignment | `renderRekapData` | assignment | M07 / calon | Review helper dalam modul calon | BELUM |
| FE-19248-assignment | `applyRekapFilters` | assignment | M07 / calon | Review helper dalam modul calon | BELUM |
| FE-19253-assignment | `callback` | assignment | M07 / calon | Review helper dalam modul calon | BELUM |
| FE-19255-assignment | `onError` | assignment | M07 / calon | Review helper dalam modul calon | BELUM |
| FE-19264-assignment | `onchange` | assignment | M07 / calon | Review helper dalam modul calon | BELUM |
| FE-19271-assignment | `oninput` | assignment | M07 / calon | Review helper dalam modul calon | BELUM |
| FE-19280-assignment | `onchange` | assignment | M07 / calon | Review helper dalam modul calon | BELUM |
| FE-19293-deklarasi | `initAbsensiTabOnLoad` | deklarasi | M07 / calon | Review helper dalam modul calon | BELUM |
| FE-19331-deklarasi | `switchAbsensiTab` | deklarasi | M07 / calon | Review helper dalam modul calon | BELUM |
| FE-19389-deklarasi | `loadArsipAbsensi` | deklarasi | M07 / calon | Review helper dalam modul calon | BELUM |
| FE-19391-assignment | `applyArsipFilters` | assignment | M07 / calon | Review helper dalam modul calon | BELUM |
| FE-19413-deklarasi | `loadArsipAbsensiGrouped` | deklarasi | M07 / calon | Review helper dalam modul calon | BELUM |
| FE-19436-assignment | `applyArsipFilters` | assignment | M07 / calon | Review helper dalam modul calon | BELUM |
| FE-19480-assignment | `openArsipAbsensiDetailModal` | assignment | M07 / calon | Review helper dalam modul calon | BELUM |
| FE-19543-deklarasi | `updateStatistik` | deklarasi | M07 / calon | Review helper dalam modul calon | BELUM |
| FE-19553-deklarasi | `applyFilters` | deklarasi | M07 / calon | Review helper dalam modul calon | BELUM |
| FE-19577-deklarasi | `openAttendanceModal` | deklarasi | M07 / calon | Review helper dalam modul calon | BELUM |
| FE-19603-deklarasi | `continueOpenAttendanceModal` | deklarasi | M07 / calon | Review helper dalam modul calon | BELUM |
| FE-19671-deklarasi | `handleAttendanceClassChange` | deklarasi | M07 / calon | Review helper dalam modul calon | BELUM |
| FE-19744-deklarasi | `syncAttKet` | deklarasi | M07 / calon | Review helper dalam modul calon | BELUM |
| FE-19754-deklarasi | `setStudentStatus` | deklarasi | M07 / calon | Review helper dalam modul calon | BELUM |
| FE-19773-deklarasi | `setAllAttendance` | deklarasi | M07 / calon | Review helper dalam modul calon | BELUM |
| FE-19781-deklarasi | `handleStatusCheck` | deklarasi | M07 / calon | Review helper dalam modul calon | BELUM |
| FE-19785-deklarasi | `updateAttLiveStats` | deklarasi | M07 / calon | Review helper dalam modul calon | BELUM |
| FE-19820-deklarasi | `updateAttFooterStatus` | deklarasi | M07 / calon | Review helper dalam modul calon | BELUM |
| FE-19854-deklarasi | `closeAttendanceModal` | deklarasi | M07 / calon | Review helper dalam modul calon | BELUM |
| FE-19860-deklarasi | `closeEditAttendanceModal` | deklarasi | M07 / calon | Review helper dalam modul calon | BELUM |
| FE-19917-deklarasi | `handleAttendanceSubmit` | deklarasi | M07 / calon | Review helper dalam modul calon | BELUM |
| FE-19979-deklarasi | `handleDeleteAttendance` | deklarasi | M07 / calon | Review helper dalam modul calon | BELUM |
| FE-20011-deklarasi | `updateEditStatusPills` | deklarasi | M10 / calon | Review helper dalam modul calon | BELUM |
| FE-20024-deklarasi | `openEditAttendanceModal` | deklarasi | M07 / calon | Review helper dalam modul calon | BELUM |
| FE-20070-deklarasi | `handleEditAttendanceSubmit` | deklarasi | M07 / calon | Review helper dalam modul calon | BELUM |
| FE-20109-deklarasi | `loadManajemenTabungan` | deklarasi | M10 / calon | Review helper dalam modul calon | BELUM |
| FE-20112-deklarasi | `_savGetCurrentTA` | deklarasi | M10 / calon | Review helper dalam modul calon | BELUM |
| FE-20116-deklarasi | `_savGetCurrentSem` | deklarasi | M10 / calon | Review helper dalam modul calon | BELUM |
| FE-20117-deklarasi | `_savSemDateRange` | deklarasi | M10 / calon | Review helper dalam modul calon | BELUM |
| FE-20122-deklarasi | `_savSemLabel` | deklarasi | M10 / calon | Review helper dalam modul calon | BELUM |
| FE-20330-assignment | `_savOnPeriodChange` | assignment | M10 / calon | Review helper dalam modul calon | BELUM |
| FE-20357-deklarasi | `switchSavingsTab` | deklarasi | M10 / calon | Review helper dalam modul calon | BELUM |
| FE-20395-deklarasi | `loadSavingsStats` | deklarasi | M10 / calon | Review helper dalam modul calon | BELUM |
| FE-20411-assignment | `fmt` | assignment | M10 / calon | Review helper dalam modul calon | BELUM |
| FE-20447-deklarasi | `renderSavChart` | deklarasi | M10 / calon | Review helper dalam modul calon | BELUM |
| FE-20468-deklarasi | `doChart` | deklarasi | M10 / calon | Review helper dalam modul calon | BELUM |
| FE-20531-assignment | `onerror` | assignment | M10 / calon | Review helper dalam modul calon | BELUM |
| FE-20536-deklarasi | `loadSavingsTransactions` | deklarasi | M10 / calon | Review helper dalam modul calon | BELUM |
| FE-20598-deklarasi | `setupTransaksiFilters` | deklarasi | M10 / calon | Review helper dalam modul calon | BELUM |
| FE-20625-deklarasi | `applySavFilters` | deklarasi | M10 / calon | Review helper dalam modul calon | BELUM |
| FE-20748-deklarasi | `loadSavingsRecap` | deklarasi | M10 / calon | Review helper dalam modul calon | BELUM |
| FE-20759-deklarasi | `doRenderWithRoleMap` | deklarasi | M10 / calon | Review helper dalam modul calon | BELUM |
| FE-20783-deklarasi | `applyRecapFilters` | deklarasi | M10 / calon | Review helper dalam modul calon | BELUM |
| FE-20809-assignment | `fmt` | assignment | M10 / calon | Review helper dalam modul calon | BELUM |
| FE-20845-deklarasi | `attachDateListeners` | deklarasi | M10 / calon | Review helper dalam modul calon | BELUM |
| FE-20848-deklarasi | `onDateChange` | deklarasi | M10 / calon | Review helper dalam modul calon | BELUM |
| FE-20862-deklarasi | `fetchRecapWithRole` | deklarasi | M10 / calon | Review helper dalam modul calon | BELUM |
| FE-20893-deklarasi | `exportTabunganPDF` | deklarasi | M17 / langsung | M17-F10 | BELUM |
| FE-20976-deklarasi | `exportTabunganXLSX` | deklarasi | M17 / langsung | M17-F10 | BELUM |
| FE-20983-deklarasi | `doExport` | deklarasi | M10 / calon | Review helper dalam modul calon | BELUM |
| FE-21029-assignment | `onload` | assignment | M10 / calon | Review helper dalam modul calon | BELUM |
| FE-21030-assignment | `onerror` | assignment | M10 / calon | Review helper dalam modul calon | BELUM |
| FE-21035-deklarasi | `openSavingsModal` | deklarasi | M10 / calon | Review helper dalam modul calon | BELUM |
| FE-21121-assignment | `_tryFireNasabahChange` | assignment | M10 / calon | Review helper dalam modul calon | BELUM |
| FE-21252-deklarasi | `_savJumlahHandler` | deklarasi | M10 / calon | Review helper dalam modul calon | BELUM |
| FE-21258-deklarasi | `handleSavingsClassChange` | deklarasi | M10 / calon | Review helper dalam modul calon | BELUM |
| FE-21293-deklarasi | `handleSavingsSubmit` | deklarasi | M17 / langsung | M17-F06 | BELUM |
| FE-21385-assignment | `lockSubmitSav` | assignment | M10 / calon | Review helper dalam modul calon | BELUM |
| FE-21394-assignment | `unlockSubmitSav` | assignment | M10 / calon | Review helper dalam modul calon | BELUM |
| FE-21407-assignment | `refreshActiveSavTab` | assignment | M10 / calon | Review helper dalam modul calon | BELUM |
| FE-21414-assignment | `handleResultSav` | assignment | M10 / calon | Review helper dalam modul calon | BELUM |
| FE-21426-assignment | `handleErrorSav` | assignment | M10 / calon | Review helper dalam modul calon | BELUM |
| FE-21467-deklarasi | `handleDeleteSavings` | deklarasi | M10 / calon | Review helper dalam modul calon | BELUM |
| FE-21492-deklarasi | `handleSavingsStudentChange` | deklarasi | M10 / calon | Review helper dalam modul calon | BELUM |
| FE-21540-deklarasi | `applyPaymentHistoryToCheckboxes` | deklarasi | M09 / calon | Review helper dalam modul calon | BELUM |
| FE-21612-deklarasi | `loadManajemenJadwal` | deklarasi | M06 / langsung | M06-F04 | BELUM |
| FE-21616-deklarasi | `onFreshUserManajemenJadwal` | deklarasi | M06 / calon | Review helper dalam modul calon | BELUM |
| FE-21663-deklarasi | `getMapelColor` | deklarasi | M06 / calon | Review helper dalam modul calon | BELUM |
| FE-22068-deklarasi | `initSchedTabOnLoad` | deklarasi | M06 / calon | Review helper dalam modul calon | BELUM |
| FE-22070-deklarasi | `resolveTab` | deklarasi | M06 / calon | Review helper dalam modul calon | BELUM |
| FE-22109-deklarasi | `renderManajemenTable` | deklarasi | M06 / calon | Review helper dalam modul calon | BELUM |
| FE-22229-deklarasi | `renderPelajaranView` | deklarasi | M06 / calon | Review helper dalam modul calon | BELUM |
| FE-22272-deklarasi | `buildTimetableHtml` | deklarasi | M06 / calon | Review helper dalam modul calon | BELUM |
| FE-22297-deklarasi | `jamToMin` | deklarasi | M06 / calon | Review helper dalam modul calon | BELUM |
| FE-22301-deklarasi | `slotContainsNow` | deklarasi | M06 / calon | Review helper dalam modul calon | BELUM |
| FE-22410-assignment | `filterJadwalKelas` | assignment | M06 / calon | Review helper dalam modul calon | BELUM |
| FE-22425-deklarasi | `renderPiketView` | deklarasi | M06 / calon | Review helper dalam modul calon | BELUM |
| FE-22487-deklarasi | `toggleSchedKategori` | deklarasi | M06 / calon | Review helper dalam modul calon | BELUM |
| FE-22564-assignment | `selectSchedKategori` | assignment | M06 / calon | Review helper dalam modul calon | BELUM |
| FE-22569-assignment | `selectSchedHari` | assignment | M06 / calon | Review helper dalam modul calon | BELUM |
| FE-22577-assignment | `setSchedDurasi` | assignment | M06 / calon | Review helper dalam modul calon | BELUM |
| FE-22586-assignment | `onSchedIstirahatToggle` | assignment | M06 / calon | Review helper dalam modul calon | BELUM |
| FE-22598-assignment | `updateSchedTimePreview` | assignment | M06 / calon | Review helper dalam modul calon | BELUM |
| FE-22638-assignment | `updatePiketSummary` | assignment | M06 / calon | Review helper dalam modul calon | BELUM |
| FE-22654-assignment | `updateSchedStatus` | assignment | M06 / calon | Review helper dalam modul calon | BELUM |
| FE-22713-assignment | `closeScheduleModal` | assignment | M06 / calon | Review helper dalam modul calon | BELUM |
| FE-22720-deklarasi | `openScheduleModal` | deklarasi | M06 / calon | Review helper dalam modul calon | BELUM |
| FE-22818-deklarasi | `handleScheduleSubmit` | deklarasi | M06 / calon | Review helper dalam modul calon | BELUM |
| FE-22942-deklarasi | `handleDeleteSchedule` | deklarasi | M06 / calon | Review helper dalam modul calon | BELUM |
| FE-23002-deklarasi | `switchSchedTab` | deklarasi | M06 / calon | Review helper dalam modul calon | BELUM |
| FE-23073-deklarasi | `loadJadwalSiswa` | deklarasi | M06 / calon | Review helper dalam modul calon | BELUM |
| FE-23117-deklarasi | `getColor` | deklarasi | M06 / calon | Review helper dalam modul calon | BELUM |
| FE-23139-deklarasi | `jamToMin` | deklarasi | M06 / calon | Review helper dalam modul calon | BELUM |
| FE-23140-deklarasi | `slotNow` | deklarasi | M06 / calon | Review helper dalam modul calon | BELUM |
| FE-23282-deklarasi | `loadIuranSiswa` | deklarasi | M09 / calon | Review helper dalam modul calon | BELUM |
| FE-23421-assignment | `_toCombinedItem` | assignment | M06 / calon | Review helper dalam modul calon | BELUM |
| FE-23567-deklarasi | `switchIuranSiswaTab` | deklarasi | M09 / calon | Review helper dalam modul calon | BELUM |
| FE-23581-deklarasi | `renderTable` | deklarasi | M06 / calon | Review helper dalam modul calon | BELUM |
| FE-23657-deklarasi | `pillHTML` | deklarasi | M06 / calon | Review helper dalam modul calon | BELUM |
| FE-23797-deklarasi | `loadTabunganSiswa` | deklarasi | M10 / calon | Review helper dalam modul calon | BELUM |
| FE-23803-deklarasi | `_tabGetCurrentTA` | deklarasi | M06 / calon | Review helper dalam modul calon | BELUM |
| FE-23807-deklarasi | `_tabGetCurrentSem` | deklarasi | M06 / calon | Review helper dalam modul calon | BELUM |
| FE-23810-deklarasi | `_tabSemDateRange` | deklarasi | M06 / calon | Review helper dalam modul calon | BELUM |
| FE-23817-deklarasi | `_tabSemLabel` | deklarasi | M06 / calon | Review helper dalam modul calon | BELUM |
| FE-24084-assignment | `_tabUpdateHero` | assignment | M06 / calon | Review helper dalam modul calon | BELUM |
| FE-24144-assignment | `_tabOnPeriodChange` | assignment | M06 / calon | Review helper dalam modul calon | BELUM |
| FE-24190-deklarasi | `switchTabunganSiswaTab` | deklarasi | M10 / calon | Review helper dalam modul calon | BELUM |
| FE-24244-deklarasi | `applyFilters` | deklarasi | M06 / calon | Review helper dalam modul calon | BELUM |
| FE-24346-deklarasi | `_toDateInputVal` | deklarasi | M05 / calon | Review helper dalam modul calon | BELUM |
| FE-24354-assignment | `_tabToggleDatePreset` | assignment | M05 / calon | Review helper dalam modul calon | BELUM |
| FE-24377-assignment | `_tabApplyPreset` | assignment | M05 / calon | Review helper dalam modul calon | BELUM |
| FE-24429-assignment | `_tabClearDate` | assignment | M05 / calon | Review helper dalam modul calon | BELUM |
| FE-24442-assignment | `_tabClearSearch` | assignment | M05 / calon | Review helper dalam modul calon | BELUM |
| FE-24452-assignment | `setTabJenis` | assignment | M05 / calon | Review helper dalam modul calon | BELUM |
| FE-24459-assignment | `resetTabFilters` | assignment | M05 / calon | Review helper dalam modul calon | BELUM |
| FE-24524-deklarasi | `renderTabunganSiswaRekap` | deklarasi | M10 / calon | Review helper dalam modul calon | BELUM |
| FE-24632-deklarasi | `loadManajemenGuruWali` | deklarasi | M05 / calon | Review helper dalam modul calon | BELUM |
| FE-25179-deklarasi | `applyFilterRekapAll` | deklarasi | M05 / calon | Review helper dalam modul calon | BELUM |
| FE-25192-deklarasi | `renderRekapAll` | deklarasi | M05 / calon | Review helper dalam modul calon | BELUM |
| FE-25273-deklarasi | `applyFilterRekapMy` | deklarasi | M05 / calon | Review helper dalam modul calon | BELUM |
| FE-25284-deklarasi | `renderRekapMy` | deklarasi | M05 / calon | Review helper dalam modul calon | BELUM |
| FE-25376-deklarasi | `openGuruWaliModal` | deklarasi | M05 / calon | Review helper dalam modul calon | BELUM |
| FE-25452-deklarasi | `handleGwGuruChange` | deklarasi | M07 / calon | Review helper dalam modul calon | BELUM |
| FE-25491-deklarasi | `renderGwSiswaChecklist` | deklarasi | M07 / calon | Review helper dalam modul calon | BELUM |
| FE-25541-deklarasi | `handleGwCheckboxChange` | deklarasi | M07 / calon | Review helper dalam modul calon | BELUM |
| FE-25555-deklarasi | `renderGwSelectedStudents` | deklarasi | M07 / calon | Review helper dalam modul calon | BELUM |
| FE-25591-deklarasi | `removeGwStudent` | deklarasi | M07 / calon | Review helper dalam modul calon | BELUM |
| FE-25606-deklarasi | `handleGuruWaliSubmit` | deklarasi | M05 / calon | Review helper dalam modul calon | BELUM |
| FE-25643-deklarasi | `handleDeleteGuruWali` | deklarasi | M05 / calon | Review helper dalam modul calon | BELUM |
| FE-25662-deklarasi | `loadAbsensiKelasku` | deklarasi | M07 / langsung | M07-F04 | BELUM |
| FE-26025-deklarasi | `_absAnimateNum` | deklarasi | M07 / calon | Review helper dalam modul calon | BELUM |
| FE-26091-deklarasi | `renderAbsKelasChart` | deklarasi | M05 / calon | Review helper dalam modul calon | BELUM |
| FE-26155-deklarasi | `doChart` | deklarasi | M07 / calon | Review helper dalam modul calon | BELUM |
| FE-26195-assignment | `onerror` | assignment | M07 / calon | Review helper dalam modul calon | BELUM |
| FE-26201-assignment | `_absChangeChartRange` | assignment | M07 / calon | Review helper dalam modul calon | BELUM |
| FE-26221-assignment | `_absResetFilters` | assignment | M07 / calon | Review helper dalam modul calon | BELUM |
| FE-26232-assignment | `_absFilterToday` | assignment | M07 / calon | Review helper dalam modul calon | BELUM |
| FE-26244-assignment | `_absQuickFilter` | assignment | M07 / calon | Review helper dalam modul calon | BELUM |
| FE-26267-deklarasi | `applyKelasAttFiltersForRange` | deklarasi | M05 / calon | Review helper dalam modul calon | BELUM |
| FE-26271-deklarasi | `applyKelasAttFiltersWithRange` | deklarasi | M05 / calon | Review helper dalam modul calon | BELUM |
| FE-26382-deklarasi | `renderRekapKelas` | deklarasi | M05 / calon | Review helper dalam modul calon | BELUM |
| FE-26471-deklarasi | `loadRekapKelas` | deklarasi | M05 / calon | Review helper dalam modul calon | BELUM |
| FE-26499-deklarasi | `loadArsipKelasGrouped` | deklarasi | M05 / calon | Review helper dalam modul calon | BELUM |
| FE-26579-assignment | `downloadRekapKelasPDF` | assignment | M17 / langsung | M17-F10 | BELUM |
| FE-26954-assignment | `openArsipKelasDetailModal` | assignment | M05 / calon | Review helper dalam modul calon | BELUM |
| FE-27014-deklarasi | `updateStats` | deklarasi | M05 / calon | Review helper dalam modul calon | BELUM |
| FE-27023-deklarasi | `applyArsipDetailFilters` | deklarasi | M05 / calon | Review helper dalam modul calon | BELUM |
| FE-27101-deklarasi | `switchAbsensiKelaskuTab` | deklarasi | M07 / calon | Review helper dalam modul calon | BELUM |
| FE-27127-deklarasi | `openSetoranModal` | deklarasi | M05 / calon | Review helper dalam modul calon | BELUM |
| FE-27176-deklarasi | `openEditSetoranModal` | deklarasi | M05 / calon | Review helper dalam modul calon | BELUM |
| FE-27238-deklarasi | `handleSetoranSubmit` | deklarasi | M05 / langsung | M05-F04 | BELUM |
| FE-27303-deklarasi | `toggleSurahLainnya` | deklarasi | M05 / calon | Review helper dalam modul calon | BELUM |
| FE-27317-deklarasi | `openLaporanModal` | deklarasi | M05 / calon | Review helper dalam modul calon | BELUM |
| FE-27342-deklarasi | `openEditLaporanModal` | deklarasi | M05 / calon | Review helper dalam modul calon | BELUM |
| FE-27371-deklarasi | `handleLaporanSubmit` | deklarasi | M05 / langsung | M05-F05 | BELUM |
| FE-27423-deklarasi | `openViewLaporanModal` | deklarasi | M05 / calon | Review helper dalam modul calon | BELUM |
| FE-27468-deklarasi | `handleDeleteLaporan` | deklarasi | M05 / calon | Review helper dalam modul calon | BELUM |
| FE-27492-deklarasi | `loadLaporanBimbinganSiswa` | deklarasi | M05 / calon | Review helper dalam modul calon | BELUM |
| FE-27680-assignment | `setLbFilter` | assignment | M05 / calon | Review helper dalam modul calon | BELUM |
| FE-27686-assignment | `resetLbFilters` | assignment | M05 / calon | Review helper dalam modul calon | BELUM |
| FE-27705-deklarasi | `renderLbCards` | deklarasi | M05 / calon | Review helper dalam modul calon | BELUM |
| FE-27739-deklarasi | `renderPage` | deklarasi | M05 / calon | Review helper dalam modul calon | BELUM |
| FE-27813-assignment | `lbChangePage` | assignment | M05 / calon | Review helper dalam modul calon | BELUM |
| FE-27817-assignment | `openLbDetailModal` | assignment | M05 / calon | Review helper dalam modul calon | BELUM |
| FE-27870-deklarasi | `loadProfil` | deklarasi | M05 / calon | Review helper dalam modul calon | BELUM |
| FE-27945-deklarasi | `renderProfilGuruAdmin` | deklarasi | M05 / calon | Review helper dalam modul calon | BELUM |
| FE-28326-deklarasi | `handleProfilSubmit` | deklarasi | M17 / calon | Review helper dalam modul calon | BELUM |
| FE-28394-deklarasi | `loadDashboard` | deklarasi | M02 / calon | Review helper dalam modul calon | BELUM |
| FE-29117-deklarasi | `fetchAdminGlobalStats` | deklarasi | M17 / calon | Review helper dalam modul calon | BELUM |
| FE-29166-deklarasi | `_fetchAdminGlobalStatsLegacy` | deklarasi | M17 / calon | Review helper dalam modul calon | BELUM |
| FE-29209-deklarasi | `fetchKepsekGlobalStats` | deklarasi | M17 / calon | Review helper dalam modul calon | BELUM |
| FE-29249-deklarasi | `_fetchKepsekGlobalStatsLegacy` | deklarasi | M17 / calon | Review helper dalam modul calon | BELUM |
| FE-29292-deklarasi | `fetchAdminStats` | deklarasi | M17 / calon | Review helper dalam modul calon | BELUM |
| FE-29306-deklarasi | `fetchKepsekStats` | deklarasi | M17 / calon | Review helper dalam modul calon | BELUM |
| FE-29318-deklarasi | `fetchGuruStats` | deklarasi | M17 / calon | Review helper dalam modul calon | BELUM |
| FE-29331-deklarasi | `_renderGuruDashboardFromBundle` | deklarasi | M02 / calon | Review helper dalam modul calon | BELUM |
| FE-29444-deklarasi | `_fetchGuruStatsLegacy` | deklarasi | M17 / calon | Review helper dalam modul calon | BELUM |
| FE-29576-deklarasi | `fetchSiswaStats` | deklarasi | M17 / calon | Review helper dalam modul calon | BELUM |
| FE-29588-deklarasi | `_renderSiswaAttendanceFromStats` | deklarasi | M07 / calon | Review helper dalam modul calon | BELUM |
| FE-29610-deklarasi | `fetchSiswaDashboardBundle` | deklarasi | M02 / calon | Review helper dalam modul calon | BELUM |
| FE-29704-deklarasi | `fetchSavingsBundle` | deklarasi | M10 / calon | Review helper dalam modul calon | BELUM |
| FE-29738-deklarasi | `_applyPoinDashboard` | deklarasi | M15 / calon | Review helper dalam modul calon | BELUM |
| FE-29763-deklarasi | `loadSiswaIuranInfo` | deklarasi | M09 / calon | Review helper dalam modul calon | BELUM |
| FE-29781-deklarasi | `loadSiswaTabunganInfo` | deklarasi | M10 / calon | Review helper dalam modul calon | BELUM |
| FE-29792-deklarasi | `loadSiswaJadwalHariIni` | deklarasi | M06 / calon | Review helper dalam modul calon | BELUM |
| FE-29828-deklarasi | `createMenuCard` | deklarasi | M17 / calon | Review helper dalam modul calon | BELUM |
| FE-29847-deklarasi | `loadPengaturanKeamanan` | deklarasi | M17 / calon | Review helper dalam modul calon | BELUM |
| FE-29979-deklarasi | `loadPengaturanFee` | deklarasi | M10 / calon | Review helper dalam modul calon | BELUM |
| FE-30028-deklarasi | `loadPengaturanMapel` | deklarasi | M17 / calon | Review helper dalam modul calon | BELUM |
| FE-30076-deklarasi | `loadPengaturanKenaikanKelas` | deklarasi | M12 / calon | Review helper dalam modul calon | BELUM |
| FE-30228-deklarasi | `loadPengaturanHariLibur` | deklarasi | M17 / calon | Review helper dalam modul calon | BELUM |
| FE-30276-deklarasi | `loadPengaturanMasterHafalan` | deklarasi | M17 / calon | Review helper dalam modul calon | BELUM |
| FE-30324-deklarasi | `loadPengaturanFolderIjazah` | deklarasi | M13 / calon | Review helper dalam modul calon | BELUM |
| FE-30381-assignment | `handleSimpanFolderIjazah` | assignment | M13 / calon | Review helper dalam modul calon | BELUM |
| FE-30407-deklarasi | `loadPengaturanAksesIjazah` | deklarasi | M13 / calon | Review helper dalam modul calon | BELUM |
| FE-30509-deklarasi | `loadAksesIjazahData` | deklarasi | M13 / calon | Review helper dalam modul calon | BELUM |
| FE-30545-deklarasi | `_populateTahunAksesIjazahFilter` | deklarasi | M13 / calon | Review helper dalam modul calon | BELUM |
| FE-30563-assignment | `saveGlobalAksesIjazah` | assignment | M13 / calon | Review helper dalam modul calon | BELUM |
| FE-30586-assignment | `filterAksesIjazahTable` | assignment | M13 / calon | Review helper dalam modul calon | BELUM |
| FE-30610-deklarasi | `escapeHtml` | deklarasi | M17 / calon | Review helper dalam modul calon | BELUM |
| FE-30621-deklarasi | `renderAksesIjazahTable` | deklarasi | M13 / calon | Review helper dalam modul calon | BELUM |
| FE-30669-deklarasi | `renderAksesIjazahPagination` | deklarasi | M13 / calon | Review helper dalam modul calon | BELUM |
| FE-30689-assignment | `changePageAksesIjazah` | assignment | M13 / calon | Review helper dalam modul calon | BELUM |
| FE-30694-assignment | `toggleAllAksesIjazahChecks` | assignment | M13 / calon | Review helper dalam modul calon | BELUM |
| FE-30699-assignment | `applyAksesIjazahMassal` | assignment | M13 / calon | Review helper dalam modul calon | BELUM |
| FE-30728-deklarasi | `loadPengaturanProfilSekolah` | deklarasi | M17 / calon | Review helper dalam modul calon | BELUM |
| FE-30959-deklarasi | `loadPengaturanKonfigurasiAI` | deklarasi | M16 / calon | Review helper dalam modul calon | BELUM |
| FE-31066-deklarasi | `handleSimpanKonfigurasiAI` | deklarasi | M16 / calon | Review helper dalam modul calon | BELUM |
| FE-31092-deklarasi | `switchSettingTab` | deklarasi | M17 / calon | Review helper dalam modul calon | BELUM |
| FE-31119-assignment | `downloadRekapPDF` | assignment | M17 / langsung | M17-F10 | BELUM |
| FE-31483-deklarasi | `switchSecSubtab` | deklarasi | M17 / calon | Review helper dalam modul calon | BELUM |
| FE-31500-deklarasi | `handleChangePassword` | deklarasi | M01 / calon | Review helper dalam modul calon | BELUM |
| FE-31531-deklarasi | `togglePasswordVisibility` | deklarasi | M01 / calon | Review helper dalam modul calon | BELUM |
| FE-31547-deklarasi | `validatePasswordRealtime` | deklarasi | M01 / calon | Review helper dalam modul calon | BELUM |
| FE-31599-deklarasi | `loadSchoolProfile` | deklarasi | M17 / calon | Review helper dalam modul calon | BELUM |
| FE-31697-deklarasi | `_updateSchoolAlamatPreview` | deklarasi | M17 / calon | Review helper dalam modul calon | BELUM |
| FE-31726-deklarasi | `handleSchoolProfileSubmit` | deklarasi | M17 / calon | Review helper dalam modul calon | BELUM |
| FE-31779-deklarasi | `loadAnthropicConfigStatus` | deklarasi | M16 / calon | Review helper dalam modul calon | BELUM |
| FE-31814-deklarasi | `handleAnthropicApiKeySubmit` | deklarasi | M16 / calon | Review helper dalam modul calon | BELUM |
| FE-31853-deklarasi | `handleAnthropicApiKeyClear` | deklarasi | M16 / calon | Review helper dalam modul calon | BELUM |
| FE-31886-deklarasi | `openMapelModal` | deklarasi | M17 / calon | Review helper dalam modul calon | BELUM |
| FE-31907-deklarasi | `handleMapelSubmit` | deklarasi | M17 / calon | Review helper dalam modul calon | BELUM |
| FE-31952-deklarasi | `saveNext` | deklarasi | M17 / calon | Review helper dalam modul calon | BELUM |
| FE-31981-deklarasi | `loadMapelData` | deklarasi | M17 / calon | Review helper dalam modul calon | BELUM |
| FE-32014-deklarasi | `handleDeleteMapel` | deklarasi | M17 / calon | Review helper dalam modul calon | BELUM |
| FE-32035-deklarasi | `loadKenaikanData` | deklarasi | M12 / calon | Review helper dalam modul calon | BELUM |
| FE-32055-deklarasi | `handleKenaikanKelas` | deklarasi | M12 / calon | Review helper dalam modul calon | BELUM |
| FE-32078-deklarasi | `initKenaikanPenempatan` | deklarasi | M12 / calon | Review helper dalam modul calon | BELUM |
| FE-32091-deklarasi | `_populateKelasTujuanMassal` | deklarasi | M05 / calon | Review helper dalam modul calon | BELUM |
| FE-32100-deklarasi | `loadSiswaForKenaikan` | deklarasi | M12 / calon | Review helper dalam modul calon | BELUM |
| FE-32151-deklarasi | `_renderPenempatanTable` | deklarasi | M12 / calon | Review helper dalam modul calon | BELUM |
| FE-32196-deklarasi | `toggleAllKenaikanChecks` | deklarasi | M12 / calon | Review helper dalam modul calon | BELUM |
| FE-32201-deklarasi | `applyKelasTujuanMassal` | deklarasi | M05 / calon | Review helper dalam modul calon | BELUM |
| FE-32224-deklarasi | `_checkKenaikanValidity` | deklarasi | M12 / calon | Review helper dalam modul calon | BELUM |
| FE-32245-deklarasi | `submitPenempatanKelas` | deklarasi | M12 / calon | Review helper dalam modul calon | BELUM |
| FE-32279-deklarasi | `openLiburModal` | deklarasi | M17 / calon | Review helper dalam modul calon | BELUM |
| FE-32315-deklarasi | `handleHariLiburSubmit` | deklarasi | M17 / calon | Review helper dalam modul calon | BELUM |
| FE-32381-deklarasi | `setMinTanggalAkhir` | deklarasi | M17 / calon | Review helper dalam modul calon | BELUM |
| FE-32391-deklarasi | `loadLiburData` | deklarasi | M17 / calon | Review helper dalam modul calon | BELUM |
| FE-32426-deklarasi | `handleDeleteLibur` | deklarasi | M17 / calon | Review helper dalam modul calon | BELUM |
| FE-32449-deklarasi | `loadKehadiranSiswa` | deklarasi | M07 / calon | Review helper dalam modul calon | BELUM |
| FE-32697-assignment | `setKdhStatus` | assignment | M17 / calon | Review helper dalam modul calon | BELUM |
| FE-32703-assignment | `resetKdhFilters` | assignment | M17 / calon | Review helper dalam modul calon | BELUM |
| FE-32735-deklarasi | `applyKdhFilters` | deklarasi | M17 / calon | Review helper dalam modul calon | BELUM |
| FE-32780-deklarasi | `switchKehadiranSiswaTab` | deklarasi | M07 / calon | Review helper dalam modul calon | BELUM |
| FE-32793-deklarasi | `loadRekapKehadiranSiswa` | deklarasi | M07 / calon | Review helper dalam modul calon | BELUM |
| FE-32928-deklarasi | `_kdhGetCurrentTA` | deklarasi | M17 / calon | Review helper dalam modul calon | BELUM |
| FE-32932-deklarasi | `_kdhGetCurrentSem` | deklarasi | M17 / calon | Review helper dalam modul calon | BELUM |
| FE-32933-deklarasi | `_kdhSemDateRange` | deklarasi | M17 / calon | Review helper dalam modul calon | BELUM |
| FE-32938-deklarasi | `_kdhSemLabel` | deklarasi | M17 / calon | Review helper dalam modul calon | BELUM |
| FE-32943-deklarasi | `_kdhBuildTaOptions` | deklarasi | M17 / calon | Review helper dalam modul calon | BELUM |
| FE-32951-deklarasi | `_kdhFilterBySemester` | deklarasi | M17 / calon | Review helper dalam modul calon | BELUM |
| FE-32969-deklarasi | `_kdhUpdatePeriodeBadge` | deklarasi | M17 / calon | Review helper dalam modul calon | BELUM |
| FE-32995-deklarasi | `_kdhBuildHeroCard` | deklarasi | M17 / calon | Review helper dalam modul calon | BELUM |
| FE-33048-deklarasi | `_kdhUpdateHeroStats` | deklarasi | M10 / calon | Review helper dalam modul calon | BELUM |
| FE-33119-deklarasi | `loadKehadiranSiswaRiwayat` | deklarasi | M07 / calon | Review helper dalam modul calon | BELUM |
| FE-33220-assignment | `setKdhStatus` | assignment | M10 / calon | Review helper dalam modul calon | BELUM |
| FE-33226-assignment | `resetKdhFilters` | assignment | M10 / calon | Review helper dalam modul calon | BELUM |
| FE-33264-deklarasi | `loadKehadiranSiswaRekap` | deklarasi | M07 / calon | Review helper dalam modul calon | BELUM |
| FE-33332-deklarasi | `_kdhPopulateBulanRekap` | deklarasi | M10 / calon | Review helper dalam modul calon | BELUM |
| FE-33364-assignment | `_kdhOnRekapPeriodChange` | assignment | M10 / calon | Review helper dalam modul calon | BELUM |
| FE-33372-assignment | `_kdhResetRekap` | assignment | M10 / calon | Review helper dalam modul calon | BELUM |
| FE-33397-deklarasi | `initSiswaBulanKehadiran` | deklarasi | M07 / calon | Review helper dalam modul calon | BELUM |
| FE-33414-deklarasi | `loadBulanData` | deklarasi | M10 / calon | Review helper dalam modul calon | BELUM |
| FE-33435-deklarasi | `getTriwulanLabel` | deklarasi | M10 / calon | Review helper dalam modul calon | BELUM |
| FE-33443-deklarasi | `navigateToWithTab` | deklarasi | M10 / calon | Review helper dalam modul calon | BELUM |
| FE-33451-deklarasi | `toggleLiburMode` | deklarasi | M10 / calon | Review helper dalam modul calon | BELUM |
| FE-33475-deklarasi | `openFeeModal` | deklarasi | M10 / calon | Review helper dalam modul calon | BELUM |
| FE-33504-deklarasi | `closeFeeModal` | deklarasi | M10 / calon | Review helper dalam modul calon | BELUM |
| FE-33510-deklarasi | `handleFeeSubmit` | deklarasi | M10 / calon | Review helper dalam modul calon | BELUM |
| FE-33572-assignment | `unlockFeeBtn` | assignment | M10 / calon | Review helper dalam modul calon | BELUM |
| FE-33606-deklarasi | `handleDeleteFee` | deklarasi | M10 / calon | Review helper dalam modul calon | BELUM |
| FE-33630-deklarasi | `loadFeeConfig` | deklarasi | M10 / calon | Review helper dalam modul calon | BELUM |
| FE-33659-deklarasi | `toggleFeeCalc` | deklarasi | M10 / langsung | M10-F07 | BELUM |
| FE-33712-deklarasi | `toggleFeeOnJenisChange` | deklarasi | M10 / calon | Review helper dalam modul calon | BELUM |
| FE-33731-deklarasi | `calculateFeeAndPercent` | deklarasi | M10 / langsung | M10-F07 | BELUM |
| FE-33746-deklarasi | `closeSavingsModal` | deklarasi | M10 / calon | Review helper dalam modul calon | BELUM |
| FE-33780-deklarasi | `getPencatat` | deklarasi | M10 / calon | Review helper dalam modul calon | BELUM |
| FE-33789-deklarasi | `getUsername` | deklarasi | M10 / calon | Review helper dalam modul calon | BELUM |
| FE-33793-deklarasi | `loadEBook` | deklarasi | M14 / langsung | M14-F02 | BELUM |
| FE-33977-deklarasi | `renderPage` | deklarasi | M17 / calon | Review helper dalam modul calon | BELUM |
| FE-34096-assignment | `_ebRenderPage` | assignment | M17 / calon | Review helper dalam modul calon | BELUM |
| FE-34098-deklarasi | `applyFilters` | deklarasi | M17 / calon | Review helper dalam modul calon | BELUM |
| FE-34158-deklarasi | `openEbookModal` | deklarasi | M14 / calon | Review helper dalam modul calon | BELUM |
| FE-34248-deklarasi | `toggleMapelField` | deklarasi | M17 / calon | Review helper dalam modul calon | BELUM |
| FE-34263-deklarasi | `toggleFileSource` | deklarasi | M17 / calon | Review helper dalam modul calon | BELUM |
| FE-34340-deklarasi | `handleEbookSubmit` | deklarasi | M14 / calon | Review helper dalam modul calon | BELUM |
| FE-34407-assignment | `onload` | assignment | M17 / calon | Review helper dalam modul calon | BELUM |
| FE-34424-deklarasi | `handleDeleteEbook` | deklarasi | M14 / calon | Review helper dalam modul calon | BELUM |
| FE-34445-deklarasi | `_flipbookExtractDriveId` | deklarasi | M14 / calon | Review helper dalam modul calon | BELUM |
| FE-34450-deklarasi | `showFlipbookLoading` | deklarasi | M14 / calon | Review helper dalam modul calon | BELUM |
| FE-34461-deklarasi | `showFlipbookError` | deklarasi | M14 / calon | Review helper dalam modul calon | BELUM |
| FE-34474-deklarasi | `showFlipbookContent` | deklarasi | M14 / calon | Review helper dalam modul calon | BELUM |
| FE-34485-deklarasi | `setFlipbookHeader` | deklarasi | M14 / calon | Review helper dalam modul calon | BELUM |
| FE-34549-deklarasi | `openEbookReader` | deklarasi | M14 / calon | Review helper dalam modul calon | BELUM |
| FE-34588-deklarasi | `openFlipbookModal` | deklarasi | M14 / calon | Review helper dalam modul calon | BELUM |
| FE-34655-deklarasi | `_flipbookShowLoading` | deklarasi | M14 / calon | Review helper dalam modul calon | BELUM |
| FE-34666-deklarasi | `_flipbookShowError` | deklarasi | M14 / calon | Review helper dalam modul calon | BELUM |
| FE-34679-deklarasi | `_flipbookShowContent` | deklarasi | M14 / calon | Review helper dalam modul calon | BELUM |
| FE-34695-deklarasi | `_flipbookUpdateLoadingStage` | deklarasi | M14 / calon | Review helper dalam modul calon | BELUM |
| FE-34711-deklarasi | `_flipbookPreloadPDF` | deklarasi | M14 / calon | Review helper dalam modul calon | BELUM |
| FE-34718-deklarasi | `_flipbookDoPreload` | deklarasi | M14 / calon | Review helper dalam modul calon | BELUM |
| FE-34743-deklarasi | `_decodeBase64Chunked` | deklarasi | M17 / calon | Review helper dalam modul calon | BELUM |
| FE-34750-deklarasi | `processChunk` | deklarasi | M17 / calon | Review helper dalam modul calon | BELUM |
| FE-34767-deklarasi | `_flipbookLoadPDF` | deklarasi | M14 / langsung | M14-F03 | BELUM |
| FE-34815-deklarasi | `decodeChunk` | deklarasi | M17 / calon | Review helper dalam modul calon | BELUM |
| FE-34849-deklarasi | `_flipbookInitPDF` | deklarasi | M14 / calon | Review helper dalam modul calon | BELUM |
| FE-34856-assignment | `onProgress` | assignment | M17 / calon | Review helper dalam modul calon | BELUM |
| FE-34892-deklarasi | `_flipbookQueueRenderPage` | deklarasi | M14 / calon | Review helper dalam modul calon | BELUM |
| FE-34914-deklarasi | `_flipbookProcessRenderQueue` | deklarasi | M14 / calon | Review helper dalam modul calon | BELUM |
| FE-34933-deklarasi | `_flipbookExecuteRender` | deklarasi | M14 / calon | Review helper dalam modul calon | BELUM |
| FE-34977-deklarasi | `_flipbookRetryPage` | deklarasi | M14 / calon | Review helper dalam modul calon | BELUM |
| FE-34987-deklarasi | `_flipbookRenderScrollMode` | deklarasi | M14 / langsung | M14-F03 | BELUM |
| FE-35070-deklarasi | `_flipbookLoadIframe` | deklarasi | M14 / calon | Review helper dalam modul calon | BELUM |
| FE-35107-assignment | `onload` | assignment | M17 / calon | Review helper dalam modul calon | BELUM |
| FE-35111-assignment | `onerror` | assignment | M17 / calon | Review helper dalam modul calon | BELUM |
| FE-35127-deklarasi | `_flipbookUpdateToolbar` | deklarasi | M14 / calon | Review helper dalam modul calon | BELUM |
| FE-35164-deklarasi | `adjustFlipbookZoom` | deklarasi | M14 / calon | Review helper dalam modul calon | BELUM |
| FE-35194-deklarasi | `resetFlipbookZoom` | deklarasi | M14 / calon | Review helper dalam modul calon | BELUM |
| FE-35219-deklarasi | `_flipbookReRenderVisiblePages` | deklarasi | M14 / calon | Review helper dalam modul calon | BELUM |
| FE-35258-deklarasi | `fitFlipbookToWidth` | deklarasi | M14 / calon | Review helper dalam modul calon | BELUM |
| FE-35289-deklarasi | `_flipbookGotoValidate` | deklarasi | M14 / calon | Review helper dalam modul calon | BELUM |
| FE-35308-deklarasi | `goToFlipbookPage` | deklarasi | M14 / calon | Review helper dalam modul calon | BELUM |
| FE-35335-deklarasi | `_flipbookReRenderAll` | deklarasi | M14 / calon | Review helper dalam modul calon | BELUM |
| FE-35364-deklarasi | `changeFlipbookPage` | deklarasi | M14 / calon | Review helper dalam modul calon | BELUM |
| FE-35388-deklarasi | `_flipbookScrollTracker` | deklarasi | M14 / calon | Review helper dalam modul calon | BELUM |
| FE-35423-deklarasi | `toggleFlipbookMode` | deklarasi | M14 / calon | Review helper dalam modul calon | BELUM |
| FE-35449-deklarasi | `_flipbookRenderFlipMode` | deklarasi | M14 / langsung | M14-F03 | BELUM |
| FE-35555-deklarasi | `_flipbookRenderFlipPages` | deklarasi | M14 / calon | Review helper dalam modul calon | BELUM |
| FE-35587-deklarasi | `_flipbookRenderOnePage` | deklarasi | M14 / calon | Review helper dalam modul calon | BELUM |
| FE-35637-deklarasi | `_flipbookPreRenderNext` | deklarasi | M14 / calon | Review helper dalam modul calon | BELUM |
| FE-35653-deklarasi | `renderNext` | deklarasi | M17 / calon | Review helper dalam modul calon | BELUM |
| FE-35668-deklarasi | `flipbookTurnPage` | deklarasi | M14 / calon | Review helper dalam modul calon | BELUM |
| FE-35694-deklarasi | `_flipbookExtractDriveId` | deklarasi | M14 / calon | Review helper dalam modul calon | BELUM |
| FE-35709-deklarasi | `closeFlipbookModal` | deklarasi | M14 / calon | Review helper dalam modul calon | BELUM |
| FE-35765-deklarasi | `_flipbookInitEvents` | deklarasi | M14 / calon | Review helper dalam modul calon | BELUM |
| FE-36035-deklarasi | `renderFlipbook` | deklarasi | M14 / langsung | M14-F03 | BELUM |
| FE-36129-deklarasi | `applyZoom` | deklarasi | M17 / calon | Review helper dalam modul calon | BELUM |
| FE-36226-deklarasi | `renderPageIfNotExist` | deklarasi | M17 / calon | Review helper dalam modul calon | BELUM |
| FE-36260-deklarasi | `closeFlipbookModal` | deklarasi | M14 / calon | Review helper dalam modul calon | BELUM |
| FE-36308-deklarasi | `toggleMapelField` | deklarasi | M17 / calon | Review helper dalam modul calon | BELUM |
| FE-36322-deklarasi | `loadMapelOptions` | deklarasi | M17 / calon | Review helper dalam modul calon | BELUM |
| FE-36337-deklarasi | `toggleSidebarDesktop` | deklarasi | M17 / calon | Review helper dalam modul calon | BELUM |
| FE-36354-deklarasi | `updateMainMargin` | deklarasi | M17 / calon | Review helper dalam modul calon | BELUM |
| FE-36364-deklarasi | `hitungWaktuSelesai` | deklarasi | M06 / langsung | M06-F02 | BELUM |
| FE-36401-deklarasi | `toggleScheduleSelect` | deklarasi | M06 / calon | Review helper dalam modul calon | BELUM |
| FE-36428-deklarasi | `hapusJadwalTerpilih` | deklarasi | M06 / calon | Review helper dalam modul calon | BELUM |
| FE-36463-deklarasi | `openHafalanModal` | deklarasi | M17 / calon | Review helper dalam modul calon | BELUM |
| FE-36491-deklarasi | `closeHafalanModal` | deklarasi | M17 / calon | Review helper dalam modul calon | BELUM |
| FE-36503-deklarasi | `handleHafalanSubmit` | deklarasi | M17 / calon | Review helper dalam modul calon | BELUM |
| FE-36540-deklarasi | `saveNext` | deklarasi | M17 / calon | Review helper dalam modul calon | BELUM |
| FE-36569-deklarasi | `loadHafalanData` | deklarasi | M17 / calon | Review helper dalam modul calon | BELUM |
| FE-36601-deklarasi | `handleDeleteHafalan` | deklarasi | M17 / calon | Review helper dalam modul calon | BELUM |
| FE-36622-assignment | `handleSaveSiswaDetail` | assignment | M04 / calon | Review helper dalam modul calon | BELUM |
| FE-36668-assignment | `switchProfilTab` | assignment | M17 / calon | Review helper dalam modul calon | BELUM |
| FE-36678-assignment | `showProfilTab` | assignment | M17 / calon | Review helper dalam modul calon | BELUM |
| FE-36713-assignment | `updateProfilNavButtons` | assignment | M04 / calon | Review helper dalam modul calon | BELUM |
| FE-36761-assignment | `checkTabComplete` | assignment | M04 / calon | Review helper dalam modul calon | BELUM |
| FE-36851-assignment | `checkAllProfilComplete` | assignment | M04 / calon | Review helper dalam modul calon | BELUM |
| FE-36859-assignment | `enableEditProfil` | assignment | M04 / calon | Review helper dalam modul calon | BELUM |
| FE-36914-assignment | `disableProfilFields` | assignment | M04 / calon | Review helper dalam modul calon | BELUM |
| FE-36941-deklarasi | `generatePendidikanOptions` | deklarasi | M04 / calon | Review helper dalam modul calon | BELUM |
| FE-36946-deklarasi | `generatePekerjaanOptions` | deklarasi | M04 / calon | Review helper dalam modul calon | BELUM |
| FE-36951-deklarasi | `generatePenghasilanOptions` | deklarasi | M04 / calon | Review helper dalam modul calon | BELUM |
| FE-36956-deklarasi | `generateDataSiswaTab` | deklarasi | M04 / calon | Review helper dalam modul calon | BELUM |
| FE-36980-deklarasi | `generateAyahTab` | deklarasi | M04 / calon | Review helper dalam modul calon | BELUM |
| FE-36997-deklarasi | `generateIbuTab` | deklarasi | M04 / calon | Review helper dalam modul calon | BELUM |
| FE-37014-deklarasi | `generateWaliTab` | deklarasi | M04 / calon | Review helper dalam modul calon | BELUM |
| FE-37046-deklarasi | `generateAlamatTab` | deklarasi | M04 / calon | Review helper dalam modul calon | BELUM |
| FE-37395-deklarasi | `syncWaliTab` | deklarasi | M04 / calon | Review helper dalam modul calon | BELUM |
| FE-37475-deklarasi | `handleSaveSiswaDetail` | deklarasi | M04 / calon | Review helper dalam modul calon | BELUM |
| FE-37537-deklarasi | `renderProfilSiswa` | deklarasi | M04 / calon | Review helper dalam modul calon | BELUM |
| FE-37544-assignment | `_normUser` | assignment | M04 / calon | Review helper dalam modul calon | BELUM |
| FE-37573-deklarasi | `fieldFilled` | deklarasi | M04 / calon | Review helper dalam modul calon | BELUM |
| FE-37577-deklarasi | `tabProgress` | deklarasi | M04 / calon | Review helper dalam modul calon | BELUM |
| FE-37717-deklarasi | `tabBtn` | deklarasi | M04 / calon | Review helper dalam modul calon | BELUM |
| FE-37754-deklarasi | `tabBtnMobile` | deklarasi | M04 / calon | Review helper dalam modul calon | BELUM |
| FE-37961-assignment | `onclick` | assignment | M04 / calon | Review helper dalam modul calon | BELUM |
| FE-37964-assignment | `onclick` | assignment | M04 / calon | Review helper dalam modul calon | BELUM |
| FE-37994-deklarasi | `_sanitizeDigits` | deklarasi | M04 / calon | Review helper dalam modul calon | BELUM |
| FE-38051-deklarasi | `_guruAvatarColor` | deklarasi | M04 / calon | Review helper dalam modul calon | BELUM |
| FE-38057-deklarasi | `_guruInitials` | deklarasi | M04 / calon | Review helper dalam modul calon | BELUM |
| FE-38064-deklarasi | `_attachMobileInputScrollFix` | deklarasi | M04 / calon | Review helper dalam modul calon | BELUM |
| FE-38096-deklarasi | `loadManajemenGuru` | deklarasi | M04 / calon | Review helper dalam modul calon | BELUM |
| FE-38164-deklarasi | `renderCards` | deklarasi | M04 / calon | Review helper dalam modul calon | BELUM |
| FE-38238-deklarasi | `showGuruDetail` | deklarasi | M03 / calon | Review helper dalam modul calon | BELUM |
| FE-38392-deklarasi | `loadManajemenSiswa` | deklarasi | M04 / calon | Review helper dalam modul calon | BELUM |
| FE-38553-deklarasi | `getAvatarColorObj` | deklarasi | M04 / calon | Review helper dalam modul calon | BELUM |
| FE-38559-deklarasi | `getInitials` | deklarasi | M04 / calon | Review helper dalam modul calon | BELUM |
| FE-38570-deklarasi | `renderPage` | deklarasi | M04 / calon | Review helper dalam modul calon | BELUM |
| FE-38634-assignment | `mswGoPage` | assignment | M04 / calon | Review helper dalam modul calon | BELUM |
| FE-38636-deklarasi | `applyFilter` | deklarasi | M04 / calon | Review helper dalam modul calon | BELUM |
| FE-38664-deklarasi | `mswSwitchTab` | deklarasi | M04 / calon | Review helper dalam modul calon | BELUM |
| FE-38673-deklarasi | `showSiswaDetailAdmin` | deklarasi | M04 / calon | Review helper dalam modul calon | BELUM |
| FE-38829-deklarasi | `getInitials2` | deklarasi | M04 / calon | Review helper dalam modul calon | BELUM |
| FE-39154-assignment | `onload` | assignment | M04 / calon | Review helper dalam modul calon | BELUM |
| FE-39190-assignment | `_dispatchAfterRestore` | assignment | M04 / calon | Review helper dalam modul calon | BELUM |
| FE-39258-deklarasi | `showServerError` | deklarasi | M04 / calon | Review helper dalam modul calon | BELUM |
| FE-39262-deklarasi | `refreshCurrentPage` | deklarasi | M04 / calon | Review helper dalam modul calon | BELUM |
| FE-39270-deklarasi | `enableScreenshotProtection` | deklarasi | M01 / calon | Review helper dalam modul calon | BELUM |
| FE-39291-deklarasi | `disableScreenshotProtection` | deklarasi | M01 / calon | Review helper dalam modul calon | BELUM |
| FE-39304-deklarasi | `preventDefault` | deklarasi | M04 / calon | Review helper dalam modul calon | BELUM |
| FE-39308-deklarasi | `preventScreenshotKeys` | deklarasi | M04 / calon | Review helper dalam modul calon | BELUM |
| FE-39349-assignment | `openFlipbookModal` | assignment | M14 / calon | Review helper dalam modul calon | BELUM |
| FE-39356-assignment | `closeFlipbookModal` | assignment | M14 / calon | Review helper dalam modul calon | BELUM |
| FE-39362-deklarasi | `loadProvinces` | deklarasi | M04 / calon | Review helper dalam modul calon | BELUM |
| FE-39379-deklarasi | `loadRegencies` | deklarasi | M04 / calon | Review helper dalam modul calon | BELUM |
| FE-39410-deklarasi | `loadDistricts` | deklarasi | M04 / calon | Review helper dalam modul calon | BELUM |
| FE-39441-deklarasi | `loadVillages` | deklarasi | M04 / calon | Review helper dalam modul calon | BELUM |
| FE-39465-deklarasi | `setWilayahFromDetail` | deklarasi | M04 / calon | Review helper dalam modul calon | BELUM |
| FE-39492-deklarasi | `initAlamatTab` | deklarasi | M04 / calon | Review helper dalam modul calon | BELUM |
| FE-39493-deklarasi | `createHiddenInput` | deklarasi | M04 / calon | Review helper dalam modul calon | BELUM |
| FE-39503-deklarasi | `setFieldState` | deklarasi | M04 / calon | Review helper dalam modul calon | BELUM |
| FE-39524-deklarasi | `syncAyah` | deklarasi | M04 / calon | Review helper dalam modul calon | BELUM |
| FE-39553-deklarasi | `syncIbu` | deklarasi | M04 / calon | Review helper dalam modul calon | BELUM |
| FE-39614-deklarasi | `syncWali` | deklarasi | M04 / calon | Review helper dalam modul calon | BELUM |
| FE-39653-deklarasi | `syncSiswa` | deklarasi | M04 / calon | Review helper dalam modul calon | BELUM |
| FE-39699-deklarasi | `syncOrtuBioState` | deklarasi | M04 / calon | Review helper dalam modul calon | BELUM |
| FE-39727-deklarasi | `syncWaliOptions` | deklarasi | M04 / calon | Review helper dalam modul calon | BELUM |
| FE-39761-deklarasi | `syncSiswaOptions` | deklarasi | M04 / calon | Review helper dalam modul calon | BELUM |
| FE-39977-deklarasi | `loadStudentDocuments` | deklarasi | M04 / calon | Review helper dalam modul calon | BELUM |
| FE-39987-deklarasi | `renderDocumentsList` | deklarasi | M04 / calon | Review helper dalam modul calon | BELUM |
| FE-40099-deklarasi | `_sniffFileExtFromHeader` | deklarasi | M04 / calon | Review helper dalam modul calon | BELUM |
| FE-40117-deklarasi | `_readHeaderBytes` | deklarasi | M04 / calon | Review helper dalam modul calon | BELUM |
| FE-40140-deklarasi | `uploadDocument` | deklarasi | M04 / calon | Review helper dalam modul calon | BELUM |
| FE-40225-assignment | `onload` | assignment | M04 / calon | Review helper dalam modul calon | BELUM |
| FE-40253-deklarasi | `deleteDocument` | deklarasi | M04 / calon | Review helper dalam modul calon | BELUM |
| FE-40287-deklarasi | `switchProfilTab` | deklarasi | M04 / calon | Review helper dalam modul calon | BELUM |
| FE-40298-deklarasi | `getFileDisplayName` | deklarasi | M04 / calon | Review helper dalam modul calon | BELUM |
| FE-40334-deklarasi | `getFileExtension` | deklarasi | M04 / calon | Review helper dalam modul calon | BELUM |
| FE-40355-deklarasi | `getFileTypeIconHtml` | deklarasi | M04 / calon | Review helper dalam modul calon | BELUM |
| FE-40414-deklarasi | `getFileTypeBadgeHtml` | deklarasi | M04 / calon | Review helper dalam modul calon | BELUM |
| FE-40445-deklarasi | `openDocumentPreview` | deklarasi | M04 / calon | Review helper dalam modul calon | BELUM |
| FE-40494-deklarasi | `updatePreviewModalHeader` | deklarasi | M04 / calon | Review helper dalam modul calon | BELUM |
| FE-40528-deklarasi | `getFileTypeIconInnerHtml` | deklarasi | M04 / calon | Review helper dalam modul calon | BELUM |
| FE-40577-deklarasi | `getFileTypeIconBgClass` | deklarasi | M05 / calon | Review helper dalam modul calon | BELUM |
| FE-40588-deklarasi | `getFileTypeBadgeClass` | deklarasi | M05 / calon | Review helper dalam modul calon | BELUM |
| FE-40609-deklarasi | `loadPdfPreview` | deklarasi | M04 / calon | Review helper dalam modul calon | BELUM |
| FE-40632-deklarasi | `renderPdfFromBase64` | deklarasi | M04 / calon | Review helper dalam modul calon | BELUM |
| FE-40669-deklarasi | `renderAllPdfPages` | deklarasi | M04 / calon | Review helper dalam modul calon | BELUM |
| FE-40738-deklarasi | `renderPdfFallbackIframe` | deklarasi | M04 / calon | Review helper dalam modul calon | BELUM |
| FE-40753-assignment | `onload` | assignment | M04 / calon | Review helper dalam modul calon | BELUM |
| FE-40754-assignment | `onerror` | assignment | M04 / calon | Review helper dalam modul calon | BELUM |
| FE-40763-deklarasi | `loadImagePreview` | deklarasi | M04 / calon | Review helper dalam modul calon | BELUM |
| FE-40785-deklarasi | `renderImageFromBase64` | deklarasi | M04 / calon | Review helper dalam modul calon | BELUM |
| FE-40800-assignment | `onload` | assignment | M04 / calon | Review helper dalam modul calon | BELUM |
| FE-40854-assignment | `onerror` | assignment | M04 / calon | Review helper dalam modul calon | BELUM |
| FE-40861-deklarasi | `loadImageFromUrl` | deklarasi | M04 / calon | Review helper dalam modul calon | BELUM |
| FE-40873-assignment | `onload` | assignment | M04 / calon | Review helper dalam modul calon | BELUM |
| FE-40924-assignment | `onerror` | assignment | M04 / calon | Review helper dalam modul calon | BELUM |
| FE-40934-assignment | `onload` | assignment | M04 / calon | Review helper dalam modul calon | BELUM |
| FE-40935-assignment | `onerror` | assignment | M04 / calon | Review helper dalam modul calon | BELUM |
| FE-40945-deklarasi | `closeDocumentPreview` | deklarasi | M04 / calon | Review helper dalam modul calon | BELUM |
| FE-40993-deklarasi | `changePdfPage` | deklarasi | M04 / calon | Review helper dalam modul calon | BELUM |
| FE-41013-deklarasi | `updatePdfPageInfo` | deklarasi | M04 / calon | Review helper dalam modul calon | BELUM |
| FE-41026-deklarasi | `adjustPreviewZoom` | deklarasi | M04 / calon | Review helper dalam modul calon | BELUM |
| FE-41040-deklarasi | `resetPreviewZoom` | deklarasi | M04 / calon | Review helper dalam modul calon | BELUM |
| FE-41048-deklarasi | `fitPreviewToWidth` | deklarasi | M04 / calon | Review helper dalam modul calon | BELUM |
| FE-41078-deklarasi | `applyZoomToContent` | deklarasi | M04 / calon | Review helper dalam modul calon | BELUM |
| FE-41108-deklarasi | `reRenderPdfForZoom` | deklarasi | M01 / calon | Review helper dalam modul calon | BELUM |
| FE-41162-deklarasi | `updateZoomLabel` | deklarasi | M01 / calon | Review helper dalam modul calon | BELUM |
| FE-41170-deklarasi | `initPreviewScrollZoom` | deklarasi | M01 / calon | Review helper dalam modul calon | BELUM |
| FE-41183-deklarasi | `initPreviewBackdropClose` | deklarasi | M01 / calon | Review helper dalam modul calon | BELUM |
| FE-41193-deklarasi | `initDocumentPreview` | deklarasi | M04 / calon | Review helper dalam modul calon | BELUM |
| FE-41227-deklarasi | `refreshSiswaDetail` | deklarasi | M04 / calon | Review helper dalam modul calon | BELUM |
| FE-41245-deklarasi | `extractDriveFileId` | deklarasi | M04 / langsung | M04-F06 | BELUM |
| FE-41250-deklarasi | `renderPdfPreview` | deklarasi | M01 / calon | Review helper dalam modul calon | BELUM |
| FE-41305-deklarasi | `confirmEditProfil` | deklarasi | M01 / calon | Review helper dalam modul calon | BELUM |
| FE-41314-deklarasi | `formatBadge` | deklarasi | M01 / calon | Review helper dalam modul calon | BELUM |
| FE-41323-deklarasi | `docCard` | deklarasi | M01 / calon | Review helper dalam modul calon | BELUM |
| FE-41349-deklarasi | `closeEditProfilConfirmModal` | deklarasi | M01 / calon | Review helper dalam modul calon | BELUM |
| FE-41353-deklarasi | `toggleEpReadyBtn` | deklarasi | M01 / calon | Review helper dalam modul calon | BELUM |
| FE-41361-deklarasi | `doActivateEditProfil` | deklarasi | M01 / calon | Review helper dalam modul calon | BELUM |
| FE-41374-deklarasi | `handleSecurityQuestionSubmit` | deklarasi | M01 / calon | Review helper dalam modul calon | BELUM |
| FE-41417-deklarasi | `getSecurityQuestionForReset` | deklarasi | M01 / calon | Review helper dalam modul calon | BELUM |
| FE-41460-deklarasi | `verifyAnswerForReset` | deklarasi | M01 / calon | Review helper dalam modul calon | BELUM |
| FE-41495-deklarasi | `openNewPasswordModal` | deklarasi | M01 / calon | Review helper dalam modul calon | BELUM |
| FE-41505-deklarasi | `closeNewPasswordModal` | deklarasi | M01 / calon | Review helper dalam modul calon | BELUM |
| FE-41510-deklarasi | `togglePwVis` | deklarasi | M01 / calon | Review helper dalam modul calon | BELUM |
| FE-41520-deklarasi | `_resetPwChecklist` | deklarasi | M01 / calon | Review helper dalam modul calon | BELUM |
| FE-41535-deklarasi | `_setReq` | deklarasi | M01 / calon | Review helper dalam modul calon | BELUM |
| FE-41543-deklarasi | `evalNewPwStrength` | deklarasi | M01 / calon | Review helper dalam modul calon | BELUM |
| FE-41599-deklarasi | `submitNewPassword` | deklarasi | M01 / calon | Review helper dalam modul calon | BELUM |
| FE-41640-deklarasi | `getSecurityQuestionForResetSesi` | deklarasi | M01 / calon | Review helper dalam modul calon | BELUM |
| FE-41683-deklarasi | `verifyAnswerForResetSesi` | deklarasi | M01 / calon | Review helper dalam modul calon | BELUM |
| FE-41727-deklarasi | `openConfirmResetSesiModal` | deklarasi | M01 / calon | Review helper dalam modul calon | BELUM |
| FE-41786-deklarasi | `doSelfResetSesi` | deklarasi | M01 / calon | Review helper dalam modul calon | BELUM |
| FE-41833-deklarasi | `togglePenabungType` | deklarasi | M10 / calon | Review helper dalam modul calon | BELUM |
| FE-41874-deklarasi | `selectPenabungType` | deklarasi | M10 / calon | Review helper dalam modul calon | BELUM |
| FE-41881-deklarasi | `selectSavJenis` | deklarasi | M01 / calon | Review helper dalam modul calon | BELUM |
| FE-41901-deklarasi | `setSavQuickAmount` | deklarasi | M01 / calon | Review helper dalam modul calon | BELUM |
| FE-41920-deklarasi | `updateSavingsHeaderSaldo` | deklarasi | M10 / calon | Review helper dalam modul calon | BELUM |
| FE-41936-deklarasi | `validateSavAmount` | deklarasi | M01 / calon | Review helper dalam modul calon | BELUM |
| FE-41983-deklarasi | `updateSavingsStatusAndButton` | deklarasi | M10 / calon | Review helper dalam modul calon | BELUM |
| FE-42023-deklarasi | `openNasabahModal` | deklarasi | M10 / calon | Review helper dalam modul calon | BELUM |
| FE-42090-deklarasi | `closeNasabahModal` | deklarasi | M10 / calon | Review helper dalam modul calon | BELUM |
| FE-42096-deklarasi | `switchNasabahRole` | deklarasi | M10 / calon | Review helper dalam modul calon | BELUM |
| FE-42138-deklarasi | `handleNasabahSubmit` | deklarasi | M10 / calon | Review helper dalam modul calon | BELUM |
| FE-42146-assignment | `refreshSavings` | assignment | M10 / calon | Review helper dalam modul calon | BELUM |
| FE-42154-assignment | `lockBtn` | assignment | M01 / calon | Review helper dalam modul calon | BELUM |
| FE-42163-assignment | `unlockBtn` | assignment | M01 / calon | Review helper dalam modul calon | BELUM |
| FE-42290-deklarasi | `handleSavingsNasabahChange` | deklarasi | M10 / calon | Review helper dalam modul calon | BELUM |
| FE-42340-deklarasi | `setRequiredState` | deklarasi | M01 / calon | Review helper dalam modul calon | BELUM |
| FE-42360-deklarasi | `loadManajemenNilai` | deklarasi | M11 / calon | Review helper dalam modul calon | BELUM |
| FE-42422-deklarasi | `renderNilaiPage` | deklarasi | M11 / calon | Review helper dalam modul calon | BELUM |
| FE-43155-deklarasi | `switchNilaiTab` | deklarasi | M11 / calon | Review helper dalam modul calon | BELUM |
| FE-43217-deklarasi | `loadSiswaForNilai` | deklarasi | M11 / calon | Review helper dalam modul calon | BELUM |
| FE-43345-deklarasi | `submitNilaiBatch` | deklarasi | M11 / calon | Review helper dalam modul calon | BELUM |
| FE-43420-deklarasi | `loadRiwayatNilai` | deklarasi | M11 / calon | Review helper dalam modul calon | BELUM |
| FE-43446-deklarasi | `refreshRiwayat` | deklarasi | M11 / calon | Review helper dalam modul calon | BELUM |
| FE-43452-deklarasi | `handleDeleteNilai` | deklarasi | M11 / calon | Review helper dalam modul calon | BELUM |
| FE-43476-deklarasi | `openEditNilaiModal` | deklarasi | M11 / calon | Review helper dalam modul calon | BELUM |
| FE-43511-deklarasi | `closeEditNilaiModal` | deklarasi | M11 / calon | Review helper dalam modul calon | BELUM |
| FE-43519-deklarasi | `handleEditNilaiSubmit` | deklarasi | M11 / calon | Review helper dalam modul calon | BELUM |
| FE-43562-deklarasi | `loadRekapNilai` | deklarasi | M11 / calon | Review helper dalam modul calon | BELUM |
| FE-43629-deklarasi | `togglePHNumberFilter` | deklarasi | M11 / calon | Review helper dalam modul calon | BELUM |
| FE-43642-deklarasi | `populatePHNumbers` | deklarasi | M11 / calon | Review helper dalam modul calon | BELUM |
| FE-43677-deklarasi | `_ortuEsc` | deklarasi | M11 / calon | Review helper dalam modul calon | BELUM |
| FE-43687-assignment | `_ortuSelectAnak` | assignment | M11 / calon | Review helper dalam modul calon | BELUM |
| FE-43692-deklarasi | `_ortuAnakSelector` | deklarasi | M11 / calon | Review helper dalam modul calon | BELUM |
| FE-43726-deklarasi | `_ortuNilaiFmtTgl` | deklarasi | M11 / calon | Review helper dalam modul calon | BELUM |
| FE-43732-deklarasi | `_ortuNilaiFmtTglShort` | deklarasi | M11 / calon | Review helper dalam modul calon | BELUM |
| FE-43740-deklarasi | `_ortuNilaiTipeBadge` | deklarasi | M11 / calon | Review helper dalam modul calon | BELUM |
| FE-43752-deklarasi | `_ortuNilaiColor` | deklarasi | M11 / calon | Review helper dalam modul calon | BELUM |
| FE-43763-deklarasi | `_ortuNilaiTAOf` | deklarasi | M11 / calon | Review helper dalam modul calon | BELUM |
| FE-43770-deklarasi | `loadNilaiAnak` | deklarasi | M11 / calon | Review helper dalam modul calon | BELUM |
| FE-43785-assignment | `onSelect` | assignment | M11 / calon | Review helper dalam modul calon | BELUM |
| FE-43843-assignment | `onSelect` | assignment | M11 / calon | Review helper dalam modul calon | BELUM |
| FE-43858-deklarasi | `_loadOrtuNilai` | deklarasi | M11 / calon | Review helper dalam modul calon | BELUM |
| FE-44050-deklarasi | `filterByPeriode` | deklarasi | M11 / calon | Review helper dalam modul calon | BELUM |
| FE-44070-assignment | `_applyOrtuNilaiFilter` | assignment | M11 / calon | Review helper dalam modul calon | BELUM |
| FE-44103-assignment | `_resetOrtuNilaiFilter` | assignment | M11 / calon | Review helper dalam modul calon | BELUM |
| FE-44116-assignment | `_ortuNilaiSwitchTab` | assignment | M11 / calon | Review helper dalam modul calon | BELUM |
| FE-44145-deklarasi | `_ortuNilaiUpdateStatCards` | deklarasi | M11 / calon | Review helper dalam modul calon | BELUM |
| FE-44172-deklarasi | `_ortuNilaiUpdateProgress` | deklarasi | M11 / calon | Review helper dalam modul calon | BELUM |
| FE-44207-deklarasi | `_ortuNilaiUpdateInsight` | deklarasi | M11 / calon | Review helper dalam modul calon | BELUM |
| FE-44295-deklarasi | `_ortuNilaiRenderRiwayat` | deklarasi | M11 / calon | Review helper dalam modul calon | BELUM |
| FE-44348-deklarasi | `_ortuNilaiCalculateRekap` | deklarasi | M11 / calon | Review helper dalam modul calon | BELUM |
| FE-44401-deklarasi | `_ortuNilaiRenderRaport` | deklarasi | M11 / calon | Review helper dalam modul calon | BELUM |
| FE-44446-assignment | `_ortuNilaiOpenDetail` | assignment | M11 / calon | Review helper dalam modul calon | BELUM |
| FE-44563-assignment | `_ortuNilaiCloseDetail` | assignment | M11 / calon | Review helper dalam modul calon | BELUM |
| FE-44570-assignment | `_ortuNilaiOpenChart` | assignment | M11 / calon | Review helper dalam modul calon | BELUM |
| FE-44589-assignment | `renderChart` | assignment | M11 / calon | Review helper dalam modul calon | BELUM |
| FE-44651-assignment | `onerror` | assignment | M11 / calon | Review helper dalam modul calon | BELUM |
| FE-44659-assignment | `_ortuNilaiCloseChart` | assignment | M11 / calon | Review helper dalam modul calon | BELUM |
| FE-44667-assignment | `_ortuNilaiExportPDF` | assignment | M11 / calon | Review helper dalam modul calon | BELUM |
| FE-44681-assignment | `doExport` | assignment | M11 / calon | Review helper dalam modul calon | BELUM |
| FE-44809-deklarasi | `_ortuHadiFmtTglFull` | deklarasi | M11 / calon | Review helper dalam modul calon | BELUM |
| FE-44815-deklarasi | `_ortuHadiFmtTglShort` | deklarasi | M11 / calon | Review helper dalam modul calon | BELUM |
| FE-44821-deklarasi | `_ortuHadiBulanKey` | deklarasi | M11 / calon | Review helper dalam modul calon | BELUM |
| FE-44827-deklarasi | `_ortuHadiBulanLabel` | deklarasi | M11 / calon | Review helper dalam modul calon | BELUM |
| FE-44833-deklarasi | `_ortuHadiTAOf` | deklarasi | M11 / calon | Review helper dalam modul calon | BELUM |
| FE-44840-deklarasi | `_ortuHadiStatusInfo` | deklarasi | M11 / calon | Review helper dalam modul calon | BELUM |
| FE-44849-deklarasi | `_ortuHadiStatusBadge` | deklarasi | M11 / calon | Review helper dalam modul calon | BELUM |
| FE-44855-deklarasi | `loadKehadiranAnak` | deklarasi | M07 / calon | Review helper dalam modul calon | BELUM |
| FE-44907-assignment | `onSelect` | assignment | M11 / calon | Review helper dalam modul calon | BELUM |
| FE-44919-deklarasi | `_loadOrtuKehadiran` | deklarasi | M07 / calon | Review helper dalam modul calon | BELUM |
| FE-45113-deklarasi | `filterByPeriode` | deklarasi | M11 / calon | Review helper dalam modul calon | BELUM |
| FE-45138-assignment | `_applyOrtuHadiFilter` | assignment | M11 / calon | Review helper dalam modul calon | BELUM |
| FE-45166-assignment | `_resetOrtuHadiFilter` | assignment | M11 / calon | Review helper dalam modul calon | BELUM |
| FE-45177-assignment | `_ortuHadiSwitchTab` | assignment | M11 / calon | Review helper dalam modul calon | BELUM |
| FE-45214-deklarasi | `_ortuHadiCount` | deklarasi | M07 / calon | Review helper dalam modul calon | BELUM |
| FE-45227-deklarasi | `_ortuHadiUpdateStatCards` | deklarasi | M07 / calon | Review helper dalam modul calon | BELUM |
| FE-45263-assignment | `_ortuHadiQuickFilterStatus` | assignment | M07 / calon | Review helper dalam modul calon | BELUM |
| FE-45272-deklarasi | `_ortuHadiUpdatePercentBar` | deklarasi | M07 / calon | Review helper dalam modul calon | BELUM |
| FE-45302-deklarasi | `_ortuHadiUpdateInsight` | deklarasi | M07 / calon | Review helper dalam modul calon | BELUM |
| FE-45403-deklarasi | `_ortuHadiUpdateActiveFilters` | deklarasi | M07 / calon | Review helper dalam modul calon | BELUM |
| FE-45425-assignment | `_ortuHadiClearChip` | assignment | M07 / calon | Review helper dalam modul calon | BELUM |
| FE-45442-deklarasi | `_ortuHadiRenderKalender` | deklarasi | M07 / calon | Review helper dalam modul calon | BELUM |
| FE-45560-assignment | `_ortuHadiCalShift` | assignment | M07 / calon | Review helper dalam modul calon | BELUM |
| FE-45588-assignment | `_ortuHadiCalToday` | assignment | M07 / calon | Review helper dalam modul calon | BELUM |
| FE-45597-assignment | `_ortuHadiCalCellClick` | assignment | M07 / calon | Review helper dalam modul calon | BELUM |
| FE-45622-deklarasi | `_ortuHadiRenderRiwayat` | deklarasi | M07 / calon | Review helper dalam modul calon | BELUM |
| FE-45655-deklarasi | `_ortuHadiCalculateRekap` | deklarasi | M07 / calon | Review helper dalam modul calon | BELUM |
| FE-45688-deklarasi | `_ortuHadiRenderRekap` | deklarasi | M07 / calon | Review helper dalam modul calon | BELUM |
| FE-45727-assignment | `_ortuHadiOpenDetail` | assignment | M07 / calon | Review helper dalam modul calon | BELUM |
| FE-45814-assignment | `_ortuHadiCloseDetail` | assignment | M07 / calon | Review helper dalam modul calon | BELUM |
| FE-45821-assignment | `_ortuHadiOpenChart` | assignment | M07 / calon | Review helper dalam modul calon | BELUM |
| FE-45840-assignment | `renderChart` | assignment | M07 / calon | Review helper dalam modul calon | BELUM |
| FE-45887-assignment | `onerror` | assignment | M07 / calon | Review helper dalam modul calon | BELUM |
| FE-45895-assignment | `_ortuHadiCloseChart` | assignment | M07 / calon | Review helper dalam modul calon | BELUM |
| FE-45903-assignment | `_ortuHadiExportPDF` | assignment | M07 / calon | Review helper dalam modul calon | BELUM |
| FE-45924-assignment | `doExport` | assignment | M07 / calon | Review helper dalam modul calon | BELUM |
| FE-46054-deklarasi | `_ortuIuranFmtRp` | deklarasi | M09 / calon | Review helper dalam modul calon | BELUM |
| FE-46057-deklarasi | `_ortuIuranFmtTglShort` | deklarasi | M09 / calon | Review helper dalam modul calon | BELUM |
| FE-46063-deklarasi | `_ortuIuranFmtTglFull` | deklarasi | M09 / calon | Review helper dalam modul calon | BELUM |
| FE-46069-deklarasi | `_ortuIuranTAOf` | deklarasi | M09 / calon | Review helper dalam modul calon | BELUM |
| FE-46075-deklarasi | `_ortuIuranSemesterOf` | deklarasi | M09 / calon | Review helper dalam modul calon | BELUM |
| FE-46082-deklarasi | `_ortuIuranParseBulan` | deklarasi | M09 / calon | Review helper dalam modul calon | BELUM |
| FE-46089-deklarasi | `loadIuranAnak` | deklarasi | M09 / calon | Review helper dalam modul calon | BELUM |
| FE-46141-assignment | `onSelect` | assignment | M07 / calon | Review helper dalam modul calon | BELUM |
| FE-46153-deklarasi | `_loadOrtuIuran` | deklarasi | M09 / calon | Review helper dalam modul calon | BELUM |
| FE-46294-deklarasi | `filterByPeriode` | deklarasi | M07 / calon | Review helper dalam modul calon | BELUM |
| FE-46310-assignment | `_applyOrtuIuranFilter` | assignment | M09 / calon | Review helper dalam modul calon | BELUM |
| FE-46333-assignment | `_resetOrtuIuranFilter` | assignment | M09 / calon | Review helper dalam modul calon | BELUM |
| FE-46343-assignment | `_ortuIuranSwitchTab` | assignment | M09 / calon | Review helper dalam modul calon | BELUM |
| FE-46382-deklarasi | `_ortuIuranUpdateStatCards` | deklarasi | M09 / calon | Review helper dalam modul calon | BELUM |
| FE-46413-deklarasi | `_ortuIuranUpdateInsight` | deklarasi | M09 / calon | Review helper dalam modul calon | BELUM |
| FE-46487-deklarasi | `_ortuIuranUpdateSemesterCards` | deklarasi | M09 / calon | Review helper dalam modul calon | BELUM |
| FE-46540-deklarasi | `_ortuIuranUpdateActiveFilters` | deklarasi | M09 / calon | Review helper dalam modul calon | BELUM |
| FE-46561-assignment | `_ortuIuranClearChip` | assignment | M09 / calon | Review helper dalam modul calon | BELUM |
| FE-46577-deklarasi | `_ortuIuranRenderRiwayat` | deklarasi | M09 / calon | Review helper dalam modul calon | BELUM |
| FE-46614-deklarasi | `_ortuIuranRenderRekap` | deklarasi | M09 / calon | Review helper dalam modul calon | BELUM |
| FE-46696-assignment | `_ortuIuranOpenDetail` | assignment | M09 / calon | Review helper dalam modul calon | BELUM |
| FE-46774-assignment | `_ortuIuranCloseDetail` | assignment | M09 / calon | Review helper dalam modul calon | BELUM |
| FE-46781-assignment | `_ortuIuranOpenChart` | assignment | M09 / calon | Review helper dalam modul calon | BELUM |
| FE-46800-assignment | `renderChart` | assignment | M09 / calon | Review helper dalam modul calon | BELUM |
| FE-46858-assignment | `onerror` | assignment | M09 / calon | Review helper dalam modul calon | BELUM |
| FE-46866-assignment | `_ortuIuranCloseChart` | assignment | M09 / calon | Review helper dalam modul calon | BELUM |
| FE-46874-assignment | `_ortuIuranExportPDF` | assignment | M09 / calon | Review helper dalam modul calon | BELUM |
| FE-46888-assignment | `doExport` | assignment | M09 / calon | Review helper dalam modul calon | BELUM |
| FE-47008-deklarasi | `_ortuTabFmtRp` | deklarasi | M09 / calon | Review helper dalam modul calon | BELUM |
| FE-47013-deklarasi | `_ortuTabFmtRpSigned` | deklarasi | M09 / calon | Review helper dalam modul calon | BELUM |
| FE-47019-deklarasi | `_ortuTabFmtTglShort` | deklarasi | M09 / calon | Review helper dalam modul calon | BELUM |
| FE-47025-deklarasi | `_ortuTabFmtTglFull` | deklarasi | M09 / calon | Review helper dalam modul calon | BELUM |
| FE-47031-deklarasi | `_ortuTabBulanKey` | deklarasi | M09 / calon | Review helper dalam modul calon | BELUM |
| FE-47037-deklarasi | `_ortuTabBulanLabel` | deklarasi | M09 / calon | Review helper dalam modul calon | BELUM |
| FE-47043-deklarasi | `_ortuTabTAOf` | deklarasi | M09 / calon | Review helper dalam modul calon | BELUM |
| FE-47050-deklarasi | `loadTabunganAnak` | deklarasi | M10 / calon | Review helper dalam modul calon | BELUM |
| FE-47101-assignment | `onSelect` | assignment | M09 / calon | Review helper dalam modul calon | BELUM |
| FE-47113-deklarasi | `_loadOrtuTabungan` | deklarasi | M10 / calon | Review helper dalam modul calon | BELUM |
| FE-47308-deklarasi | `filterByPeriode` | deklarasi | M10 / calon | Review helper dalam modul calon | BELUM |
| FE-47324-assignment | `_applyOrtuTabFilter` | assignment | M10 / calon | Review helper dalam modul calon | BELUM |
| FE-47352-assignment | `_resetOrtuTabFilter` | assignment | M10 / calon | Review helper dalam modul calon | BELUM |
| FE-47364-assignment | `_ortuTabSwitchTab` | assignment | M10 / calon | Review helper dalam modul calon | BELUM |
| FE-47394-deklarasi | `_ortuTabUpdateSaldoHero` | deklarasi | M10 / calon | Review helper dalam modul calon | BELUM |
| FE-47434-deklarasi | `_ortuTabUpdateStatCards` | deklarasi | M10 / calon | Review helper dalam modul calon | BELUM |
| FE-47460-deklarasi | `_ortuTabUpdateInsight` | deklarasi | M10 / calon | Review helper dalam modul calon | BELUM |
| FE-47555-deklarasi | `_ortuTabUpdateActiveFilters` | deklarasi | M10 / calon | Review helper dalam modul calon | BELUM |
| FE-47578-assignment | `_ortuTabClearChip` | assignment | M10 / calon | Review helper dalam modul calon | BELUM |
| FE-47593-deklarasi | `_ortuTabRenderRiwayat` | deklarasi | M10 / calon | Review helper dalam modul calon | BELUM |
| FE-47635-deklarasi | `_ortuTabCalculateRekap` | deklarasi | M10 / calon | Review helper dalam modul calon | BELUM |
| FE-47678-deklarasi | `_ortuTabRenderRekap` | deklarasi | M10 / calon | Review helper dalam modul calon | BELUM |
| FE-47708-assignment | `_ortuTabOpenDetail` | assignment | M10 / calon | Review helper dalam modul calon | BELUM |
| FE-47818-assignment | `_ortuTabCloseDetail` | assignment | M10 / calon | Review helper dalam modul calon | BELUM |
| FE-47825-assignment | `_ortuTabOpenChart` | assignment | M10 / calon | Review helper dalam modul calon | BELUM |
| FE-47845-assignment | `renderChart` | assignment | M10 / calon | Review helper dalam modul calon | BELUM |
| FE-47884-assignment | `_doRenderChart` | assignment | M10 / calon | Review helper dalam modul calon | BELUM |
| FE-47890-assignment | `onerror` | assignment | M10 / calon | Review helper dalam modul calon | BELUM |
| FE-47900-assignment | `_ortuTabCloseChart` | assignment | M10 / calon | Review helper dalam modul calon | BELUM |
| FE-47908-assignment | `_ortuTabExportPDF` | assignment | M10 / calon | Review helper dalam modul calon | BELUM |
| FE-47920-assignment | `doExport` | assignment | M10 / calon | Review helper dalam modul calon | BELUM |
| FE-48055-deklarasi | `switchNilaiSiswaTab` | deklarasi | M11 / calon | Review helper dalam modul calon | BELUM |
| FE-48066-deklarasi | `loadNilaiSiswa` | deklarasi | M11 / calon | Review helper dalam modul calon | BELUM |
| FE-48286-assignment | `_nilaikuUpdatePeriodeBadge` | assignment | M11 / calon | Review helper dalam modul calon | BELUM |
| FE-48329-deklarasi | `filterNilaiBySemester` | deklarasi | M11 / calon | Review helper dalam modul calon | BELUM |
| FE-48349-deklarasi | `populateNilaiFilterOptions` | deklarasi | M11 / calon | Review helper dalam modul calon | BELUM |
| FE-48367-assignment | `applyFilterNilaiSiswa` | assignment | M11 / calon | Review helper dalam modul calon | BELUM |
| FE-48418-deklarasi | `_nilaikuToggleRaportFilters` | deklarasi | M11 / calon | Review helper dalam modul calon | BELUM |
| FE-48434-assignment | `resetFilterNilaiSiswa` | assignment | M11 / calon | Review helper dalam modul calon | BELUM |
| FE-48453-deklarasi | `renderRiwayatNilaiSiswa` | deklarasi | M11 / calon | Review helper dalam modul calon | BELUM |
| FE-48508-assignment | `_nilaikuRenderTab` | assignment | M11 / calon | Review helper dalam modul calon | BELUM |
| FE-48558-deklarasi | `calculateRekapNilaiSiswa` | deklarasi | M11 / calon | Review helper dalam modul calon | BELUM |
| FE-48654-assignment | `_nilaikuShowRaportInfo` | assignment | M11 / calon | Review helper dalam modul calon | BELUM |
| FE-48845-deklarasi | `_rkKeydown` | deklarasi | M11 / calon | Review helper dalam modul calon | BELUM |
| FE-48854-deklarasi | `renderRaportSiswa` | deklarasi | M11 / langsung | M11-F05 | BELUM |
| FE-48928-deklarasi | `updateSiswaStatCards` | deklarasi | M11 / calon | Review helper dalam modul calon | BELUM |
| FE-48993-deklarasi | `loadKKM` | deklarasi | M11 / calon | Review helper dalam modul calon | BELUM |
| FE-49012-deklarasi | `saveKKM` | deklarasi | M11 / langsung | M11-F04 | BELUM |
| FE-49043-deklarasi | `loadRekapKKM` | deklarasi | M11 / calon | Review helper dalam modul calon | BELUM |
| FE-49067-deklarasi | `updatePredikatInfo` | deklarasi | M11 / calon | Review helper dalam modul calon | BELUM |
| FE-49115-deklarasi | `updateKeteranganForNilaiInput` | deklarasi | M11 / calon | Review helper dalam modul calon | BELUM |
| FE-49149-deklarasi | `updateEditKeterangan` | deklarasi | M11 / calon | Review helper dalam modul calon | BELUM |
| FE-49183-deklarasi | `populateTahunDropdown` | deklarasi | M11 / calon | Review helper dalam modul calon | BELUM |
| FE-49195-deklarasi | `populateTahunDropdownRiwayat` | deklarasi | M11 / calon | Review helper dalam modul calon | BELUM |
| FE-49216-deklarasi | `applyRiwayatFilters` | deklarasi | M11 / calon | Review helper dalam modul calon | BELUM |
| FE-49315-deklarasi | `updateRiwayatStats` | deklarasi | M11 / calon | Review helper dalam modul calon | BELUM |
| FE-49335-deklarasi | `updateRekapStats` | deklarasi | M11 / calon | Review helper dalam modul calon | BELUM |
| FE-49361-deklarasi | `handleInputFocusInModal` | deklarasi | M11 / calon | Review helper dalam modul calon | BELUM |
| FE-49372-deklarasi | `initRaportTab` | deklarasi | M11 / calon | Review helper dalam modul calon | BELUM |
| FE-49388-deklarasi | `populateTahunAjaran` | deklarasi | M11 / calon | Review helper dalam modul calon | BELUM |
| FE-49401-deklarasi | `loadKelasOptionsRaport` | deklarasi | M11 / calon | Review helper dalam modul calon | BELUM |
| FE-49439-deklarasi | `loadRaportSiswa` | deklarasi | M11 / calon | Review helper dalam modul calon | BELUM |
| FE-49463-deklarasi | `renderRaport` | deklarasi | M11 / calon | Review helper dalam modul calon | BELUM |
| FE-49548-deklarasi | `downloadRaportPDF` | deklarasi | M11 / langsung | M11-F07 | BELUM |
| FE-49713-deklarasi | `loadDaftarSiswaRaport` | deklarasi | M11 / calon | Review helper dalam modul calon | BELUM |
| FE-49734-deklarasi | `renderRaportSiswaTable` | deklarasi | M11 / calon | Review helper dalam modul calon | BELUM |
| FE-49784-deklarasi | `onRaportSiswaChecked` | deklarasi | M11 / calon | Review helper dalam modul calon | BELUM |
| FE-49796-deklarasi | `toggleSelectAllRaport` | deklarasi | M11 / calon | Review helper dalam modul calon | BELUM |
| FE-49808-deklarasi | `updateRaportBatchButtons` | deklarasi | M11 / calon | Review helper dalam modul calon | BELUM |
| FE-49819-deklarasi | `updateRaportSelectionInfo` | deklarasi | M11 / calon | Review helper dalam modul calon | BELUM |
| FE-49825-deklarasi | `previewRaportSingle` | deklarasi | M11 / calon | Review helper dalam modul calon | BELUM |
| FE-49842-deklarasi | `downloadRaportSingle` | deklarasi | M11 / langsung | M11-F07 | BELUM |
| FE-49868-deklarasi | `downloadRaportBatch` | deklarasi | M11 / langsung | M11-F07 | BELUM |
| FE-49880-deklarasi | `downloadRaportSemua` | deklarasi | M11 / langsung | M11-F07 | BELUM |
| FE-49892-deklarasi | `runBatchDownload` | deklarasi | M11 / calon | Review helper dalam modul calon | BELUM |
| FE-49953-deklarasi | `generateBatchPDF` | deklarasi | M11 / calon | Review helper dalam modul calon | BELUM |
| FE-50103-deklarasi | `generateAndDownloadRaportPDF` | deklarasi | M11 / calon | Review helper dalam modul calon | BELUM |
| FE-50231-deklarasi | `loadManajemenAlumni` | deklarasi | M12 / calon | Review helper dalam modul calon | BELUM |
| FE-50246-deklarasi | `buildManajemenAlumniUI` | deklarasi | M12 / calon | Review helper dalam modul calon | BELUM |
| FE-50395-deklarasi | `initManajemenAlumni` | deklarasi | M12 / calon | Review helper dalam modul calon | BELUM |
| FE-50399-deklarasi | `filterAlumniRows` | deklarasi | M12 / calon | Review helper dalam modul calon | BELUM |
| FE-50406-deklarasi | `malmSwitchTab` | deklarasi | M12 / calon | Review helper dalam modul calon | BELUM |
| FE-50417-deklarasi | `showAlumniDetail` | deklarasi | M12 / calon | Review helper dalam modul calon | BELUM |
| FE-50673-deklarasi | `closeAlumniModal` | deklarasi | M12 / calon | Review helper dalam modul calon | BELUM |
| FE-50679-deklarasi | `initManajemenAlumni` | deklarasi | M12 / calon | Review helper dalam modul calon | BELUM |
| FE-50687-deklarasi | `loadManajemenIjazah` | deklarasi | M13 / calon | Review helper dalam modul calon | BELUM |
| FE-50691-deklarasi | `tryRender` | deklarasi | M12 / calon | Review helper dalam modul calon | BELUM |
| FE-50708-deklarasi | `buildManajemenIjazahUI` | deklarasi | M13 / calon | Review helper dalam modul calon | BELUM |
| FE-50897-deklarasi | `initManajemenIjazah` | deklarasi | M13 / calon | Review helper dalam modul calon | BELUM |
| FE-50936-deklarasi | `filterMijRows` | deklarasi | M13 / calon | Review helper dalam modul calon | BELUM |
| FE-50945-deklarasi | `openIjazahForm` | deklarasi | M13 / calon | Review helper dalam modul calon | BELUM |
| FE-50995-deklarasi | `_bindMijDropzones` | deklarasi | M13 / calon | Review helper dalam modul calon | BELUM |
| FE-51001-assignment | `handlePreventAndStop` | assignment | M13 / calon | Review helper dalam modul calon | BELUM |
| FE-51041-deklarasi | `fillMijForm` | deklarasi | M13 / calon | Review helper dalam modul calon | BELUM |
| FE-51043-deklarasi | `cleanStr` | deklarasi | M13 / calon | Review helper dalam modul calon | BELUM |
| FE-51060-deklarasi | `buildDocActionBar` | deklarasi | M13 / calon | Review helper dalam modul calon | BELUM |
| FE-51075-deklarasi | `extractClientDriveFileId` | deklarasi | M13 / calon | Review helper dalam modul calon | BELUM |
| FE-51094-deklarasi | `loadIjazahFolderStatus` | deklarasi | M13 / calon | Review helper dalam modul calon | BELUM |
| FE-51129-deklarasi | `verifyAndSaveIjazahFolder` | deklarasi | M13 / calon | Review helper dalam modul calon | BELUM |
| FE-51156-deklarasi | `showMijModalLoading` | deklarasi | M13 / calon | Review helper dalam modul calon | BELUM |
| FE-51163-deklarasi | `hideMijModalLoading` | deklarasi | M13 / calon | Review helper dalam modul calon | BELUM |
| FE-51168-deklarasi | `closeMijModal` | deklarasi | M13 / calon | Review helper dalam modul calon | BELUM |
| FE-51206-deklarasi | `switchMijTab` | deklarasi | M13 / calon | Review helper dalam modul calon | BELUM |
| FE-51214-deklarasi | `handleMijFile` | deklarasi | M13 / calon | Review helper dalam modul calon | BELUM |
| FE-51228-deklarasi | `uploadMijDocument` | deklarasi | M04 / calon | Review helper dalam modul calon | BELUM |
| FE-51237-assignment | `onload` | assignment | M13 / calon | Review helper dalam modul calon | BELUM |
| FE-51269-assignment | `onerror` | assignment | M13 / calon | Review helper dalam modul calon | BELUM |
| FE-51277-deklarasi | `deleteMijDoc` | deklarasi | M13 / calon | Review helper dalam modul calon | BELUM |
| FE-51310-deklarasi | `saveMijData` | deklarasi | M13 / calon | Review helper dalam modul calon | BELUM |
| FE-51359-assignment | `lockBtn` | assignment | M13 / calon | Review helper dalam modul calon | BELUM |
| FE-51368-assignment | `unlockBtn` | assignment | M13 / calon | Review helper dalam modul calon | BELUM |
| FE-51420-deklarasi | `loadIjazahku` | deklarasi | M13 / langsung | M13-F04 | BELUM |
| FE-51424-deklarasi | `tryRender` | deklarasi | M13 / calon | Review helper dalam modul calon | BELUM |
| FE-51445-deklarasi | `buildIjazahkuUI` | deklarasi | M13 / calon | Review helper dalam modul calon | BELUM |
| FE-51621-deklarasi | `downloadDocIjazah` | deklarasi | M13 / langsung | M13-F04 | BELUM |
| FE-51658-deklarasi | `_loadScript` | deklarasi | M13 / calon | Review helper dalam modul calon | BELUM |
| FE-51663-assignment | `onerror` | assignment | M13 / calon | Review helper dalam modul calon | BELUM |
| FE-51667-deklarasi | `_ensureTurnLibs` | deklarasi | M13 / calon | Review helper dalam modul calon | BELUM |
| FE-51684-deklarasi | `openPdfViewer` | deklarasi | M13 / calon | Review helper dalam modul calon | BELUM |
| FE-51694-deklarasi | `_buildTurnModal` | deklarasi | M13 / calon | Review helper dalam modul calon | BELUM |
| FE-51848-deklarasi | `_tvApplyTransform` | deklarasi | M13 / calon | Review helper dalam modul calon | BELUM |
| FE-51855-deklarasi | `_tvZoom` | deklarasi | M13 / calon | Review helper dalam modul calon | BELUM |
| FE-51860-deklarasi | `_tvZoomReset` | deklarasi | M13 / calon | Review helper dalam modul calon | BELUM |
| FE-51865-deklarasi | `_tvPrev` | deklarasi | M13 / calon | Review helper dalam modul calon | BELUM |
| FE-51866-deklarasi | `_tvNext` | deklarasi | M13 / calon | Review helper dalam modul calon | BELUM |
| FE-51868-deklarasi | `_tvUpdatePageInfo` | deklarasi | M13 / calon | Review helper dalam modul calon | BELUM |
| FE-51873-deklarasi | `_renderTurnBook` | deklarasi | M14 / calon | Review helper dalam modul calon | BELUM |
| FE-51914-deklarasi | `_renderPdfPages` | deklarasi | M13 / calon | Review helper dalam modul calon | BELUM |
| FE-51938-deklarasi | `renderPage` | deklarasi | M13 / calon | Review helper dalam modul calon | BELUM |
| FE-51973-deklarasi | `_initTurnJs` | deklarasi | M13 / calon | Review helper dalam modul calon | BELUM |
| FE-52041-deklarasi | `closePdfViewer` | deklarasi | M15 / calon | Review helper dalam modul calon | BELUM |
| FE-52066-deklarasi | `getPoinLevelInfo` | deklarasi | M15 / calon | Review helper dalam modul calon | BELUM |
| FE-52084-deklarasi | `_spkEscHtml` | deklarasi | M15 / calon | Review helper dalam modul calon | BELUM |
| FE-52092-deklarasi | `_spkEscJs` | deklarasi | M15 / calon | Review helper dalam modul calon | BELUM |
| FE-52108-deklarasi | `loadDashPoinSiswa` | deklarasi | M15 / calon | Review helper dalam modul calon | BELUM |
| FE-52134-deklarasi | `loadManajemenPoinSiswa` | deklarasi | M15 / calon | Review helper dalam modul calon | BELUM |
| FE-52363-deklarasi | `generateBulanOptions` | deklarasi | M15 / calon | Review helper dalam modul calon | BELUM |
| FE-52378-deklarasi | `loadKelasSPKDropdown` | deklarasi | M15 / calon | Review helper dalam modul calon | BELUM |
| FE-52394-deklarasi | `switchSpkTab` | deklarasi | M15 / calon | Review helper dalam modul calon | BELUM |
| FE-52412-deklarasi | `loadSpkData` | deklarasi | M15 / calon | Review helper dalam modul calon | BELUM |
| FE-52482-deklarasi | `renderSpkStats` | deklarasi | M15 / calon | Review helper dalam modul calon | BELUM |
| FE-52500-deklarasi | `renderSpkTable` | deklarasi | M15 / calon | Review helper dalam modul calon | BELUM |
| FE-52519-deklarasi | `renderSpkTableRows` | deklarasi | M15 / calon | Review helper dalam modul calon | BELUM |
| FE-52569-deklarasi | `filterSpkTable` | deklarasi | M15 / calon | Review helper dalam modul calon | BELUM |
| FE-52583-deklarasi | `showSiswaDetailPoin` | deklarasi | M15 / calon | Review helper dalam modul calon | BELUM |
| FE-52612-deklarasi | `closeModalDetailPoin` | deklarasi | M15 / calon | Review helper dalam modul calon | BELUM |
| FE-52618-deklarasi | `renderModalDetailPoin` | deklarasi | M15 / calon | Review helper dalam modul calon | BELUM |
| FE-52796-deklarasi | `hapusPoinEvent` | deklarasi | M15 / calon | Review helper dalam modul calon | BELUM |
| FE-52826-deklarasi | `openModalInputPoin` | deklarasi | M15 / calon | Review helper dalam modul calon | BELUM |
| FE-52859-deklarasi | `closeModalInputPoin` | deklarasi | M15 / calon | Review helper dalam modul calon | BELUM |
| FE-52864-deklarasi | `loadKelasForInputPoin` | deklarasi | M15 / calon | Review helper dalam modul calon | BELUM |
| FE-52893-deklarasi | `loadSiswaForInputPoin` | deklarasi | M15 / calon | Review helper dalam modul calon | BELUM |
| FE-52918-deklarasi | `loadKatalogForInputPoin` | deklarasi | M15 / calon | Review helper dalam modul calon | BELUM |
| FE-52993-deklarasi | `onKodeChange` | deklarasi | M15 / calon | Review helper dalam modul calon | BELUM |
| FE-53044-deklarasi | `_getBulanFromTanggalForm` | deklarasi | M15 / calon | Review helper dalam modul calon | BELUM |
| FE-53053-deklarasi | `onTanggalChange` | deklarasi | M15 / calon | Review helper dalam modul calon | BELUM |
| FE-53055-deklarasi | `getBulanFrontend` | deklarasi | M15 / calon | Review helper dalam modul calon | BELUM |
| FE-53060-deklarasi | `showResiduvisInfo` | deklarasi | M15 / calon | Review helper dalam modul calon | BELUM |
| FE-53090-deklarasi | `hitungPrakiraan` | deklarasi | M15 / calon | Review helper dalam modul calon | BELUM |
| FE-53128-deklarasi | `submitInputPoin` | deklarasi | M15 / calon | Review helper dalam modul calon | BELUM |
| FE-53192-deklarasi | `loadKatalogKode` | deklarasi | M15 / calon | Review helper dalam modul calon | BELUM |
| FE-53198-deklarasi | `loadKatalogKodeReadonly` | deklarasi | M15 / calon | Review helper dalam modul calon | BELUM |
| FE-53202-deklarasi | `_openKatalogModal` | deklarasi | M15 / calon | Review helper dalam modul calon | BELUM |
| FE-53225-deklarasi | `closeModalKatalog` | deklarasi | M15 / calon | Review helper dalam modul calon | BELUM |
| FE-53230-deklarasi | `refreshKatalogTable` | deklarasi | M15 / calon | Review helper dalam modul calon | BELUM |
| FE-53316-deklarasi | `editKatalogKode` | deklarasi | M15 / calon | Review helper dalam modul calon | BELUM |
| FE-53331-deklarasi | `openFormKatalogBaru` | deklarasi | M15 / calon | Review helper dalam modul calon | BELUM |
| FE-53344-deklarasi | `submitKatalogForm` | deklarasi | M15 / calon | Review helper dalam modul calon | BELUM |
| FE-53377-deklarasi | `nonaktifkanKatalog` | deklarasi | M15 / calon | Review helper dalam modul calon | BELUM |
| FE-53393-deklarasi | `toggleNotifikasiPanel` | deklarasi | M15 / calon | Review helper dalam modul calon | BELUM |
| FE-53413-deklarasi | `loadNotifikasi` | deklarasi | M15 / calon | Review helper dalam modul calon | BELUM |
| FE-53448-deklarasi | `tandaiNotifDibaca` | deklarasi | M15 / calon | Review helper dalam modul calon | BELUM |
| FE-53454-deklarasi | `tandaiSemuaNotifDibaca` | deklarasi | M15 / calon | Review helper dalam modul calon | BELUM |
| FE-53466-deklarasi | `updateNotifBadge` | deklarasi | M15 / calon | Review helper dalam modul calon | BELUM |
| FE-53486-deklarasi | `toggleSpkEksporDropdown` | deklarasi | M15 / calon | Review helper dalam modul calon | BELUM |
| FE-53501-deklarasi | `loadJsPDF` | deklarasi | M15 / calon | Review helper dalam modul calon | BELUM |
| FE-53505-assignment | `onerror` | assignment | M15 / calon | Review helper dalam modul calon | BELUM |
| FE-53508-assignment | `onload` | assignment | M15 / calon | Review helper dalam modul calon | BELUM |
| FE-53511-assignment | `onerror` | assignment | M15 / calon | Review helper dalam modul calon | BELUM |
| FE-53521-deklarasi | `loadSheetJS` | deklarasi | M15 / calon | Review helper dalam modul calon | BELUM |
| FE-53526-assignment | `onerror` | assignment | M15 / calon | Review helper dalam modul calon | BELUM |
| FE-53533-deklarasi | `getLevelColorRGB` | deklarasi | M15 / calon | Review helper dalam modul calon | BELUM |
| FE-53566-deklarasi | `_pdfDocId` | deklarasi | M15 / calon | Review helper dalam modul calon | BELUM |
| FE-53580-deklarasi | `drawKopSurat` | deklarasi | M15 / calon | Review helper dalam modul calon | BELUM |
| FE-53689-deklarasi | `addFooterPDF` | deklarasi | M15 / calon | Review helper dalam modul calon | BELUM |
| FE-53725-deklarasi | `_pdfWatermark` | deklarasi | M15 / calon | Review helper dalam modul calon | BELUM |
| FE-53753-deklarasi | `_pdfApplyWatermarkAllPages` | deklarasi | M15 / calon | Review helper dalam modul calon | BELUM |
| FE-53762-deklarasi | `_pdfPanel` | deklarasi | M15 / calon | Review helper dalam modul calon | BELUM |
| FE-53785-deklarasi | `_pdfKpiCard` | deklarasi | M15 / calon | Review helper dalam modul calon | BELUM |
| FE-53808-deklarasi | `_pdfSaldoBar` | deklarasi | M10 / calon | Review helper dalam modul calon | BELUM |
| FE-53854-deklarasi | `_pdfDonut` | deklarasi | M15 / calon | Review helper dalam modul calon | BELUM |
| FE-53905-deklarasi | `_pdfInterpretasi` | deklarasi | M15 / calon | Review helper dalam modul calon | BELUM |
| FE-53924-deklarasi | `_pdfSignatures` | deklarasi | M15 / calon | Review helper dalam modul calon | BELUM |
| FE-53953-deklarasi | `exportPDFSiswa` | deklarasi | M17 / langsung | M17-F10 | BELUM |
| FE-53980-deklarasi | `_generatePDFSiswa` | deklarasi | M15 / calon | Review helper dalam modul calon | BELUM |
| FE-54402-deklarasi | `openModalPilihSiswaPDF` | deklarasi | M15 / calon | Review helper dalam modul calon | BELUM |
| FE-54426-deklarasi | `closeModalPilihSiswaPDF` | deklarasi | M15 / calon | Review helper dalam modul calon | BELUM |
| FE-54431-deklarasi | `onPilihSiswaKelasChange` | deklarasi | M05 / calon | Review helper dalam modul calon | BELUM |
| FE-54452-deklarasi | `submitPilihSiswaPDF` | deklarasi | M15 / calon | Review helper dalam modul calon | BELUM |
| FE-54464-deklarasi | `exportPDFRekap` | deklarasi | M17 / langsung | M17-F10 | BELUM |
| FE-54499-deklarasi | `_generatePDFRekap` | deklarasi | M15 / calon | Review helper dalam modul calon | BELUM |
| FE-54891-deklarasi | `exportExcelGlobal` | deklarasi | M17 / langsung | M17-F10 | BELUM |
| FE-54916-deklarasi | `_generateExcelGlobal` | deklarasi | M15 / calon | Review helper dalam modul calon | BELUM |
| FE-55038-deklarasi | `loadDashboardAnalitikSPK` | deklarasi | M15 / calon | Review helper dalam modul calon | BELUM |
| FE-55085-deklarasi | `_fetchAnalitikData` | deklarasi | M15 / calon | Review helper dalam modul calon | BELUM |
| FE-55095-deklarasi | `_retryAnalitik` | deklarasi | M15 / calon | Review helper dalam modul calon | BELUM |
| FE-55101-deklarasi | `renderDashboardAnalitik` | deklarasi | M15 / calon | Review helper dalam modul calon | BELUM |
| FE-55145-deklarasi | `_normalizeAnalitikData` | deklarasi | M15 / calon | Review helper dalam modul calon | BELUM |
| FE-55172-deklarasi | `_formatBulanLabel` | deklarasi | M15 / calon | Review helper dalam modul calon | BELUM |
| FE-55183-deklarasi | `_analitikLayoutHTML` | deklarasi | M15 / calon | Review helper dalam modul calon | BELUM |
| FE-55250-deklarasi | `_onAnalitikFilterChange` | deklarasi | M15 / calon | Review helper dalam modul calon | BELUM |
| FE-55261-deklarasi | `_resetAnalitikFilter` | deklarasi | M15 / calon | Review helper dalam modul calon | BELUM |
| FE-55271-deklarasi | `_applyAnalitikFilters` | deklarasi | M15 / calon | Review helper dalam modul calon | BELUM |
| FE-55297-deklarasi | `_renderAnalitikKPIs` | deklarasi | M15 / calon | Review helper dalam modul calon | BELUM |
| FE-55313-deklarasi | `card` | deklarasi | M15 / calon | Review helper dalam modul calon | BELUM |
| FE-55377-deklarasi | `_computeDistribusi` | deklarasi | M15 / calon | Review helper dalam modul calon | BELUM |
| FE-55396-deklarasi | `_computeRataPeriode` | deklarasi | M15 / calon | Review helper dalam modul calon | BELUM |
| FE-55411-deklarasi | `_computeRataPeriodeLalu` | deklarasi | M15 / calon | Review helper dalam modul calon | BELUM |
| FE-55429-deklarasi | `_renderAnalitikDistribusi` | deklarasi | M15 / calon | Review helper dalam modul calon | BELUM |
| FE-55490-deklarasi | `_renderAnalitikRanking` | deklarasi | M15 / calon | Review helper dalam modul calon | BELUM |
| FE-55547-deklarasi | `_analitikColorByScore` | deklarasi | M15 / calon | Review helper dalam modul calon | BELUM |
| FE-55554-deklarasi | `_filterByKelas` | deklarasi | M05 / calon | Review helper dalam modul calon | BELUM |
| FE-55563-deklarasi | `_renderAnalitikHeatmap` | deklarasi | M15 / calon | Review helper dalam modul calon | BELUM |
| FE-55634-deklarasi | `_hexToRgba` | deklarasi | M15 / calon | Review helper dalam modul calon | BELUM |
| FE-55644-deklarasi | `_renderChartTrenAnalitik` | deklarasi | M15 / calon | Review helper dalam modul calon | BELUM |
| FE-55678-deklarasi | `buildChart` | deklarasi | M15 / calon | Review helper dalam modul calon | BELUM |
| FE-55803-deklarasi | `_onChartLoadError` | deklarasi | M15 / calon | Review helper dalam modul calon | BELUM |
| FE-55812-deklarasi | `_formatBulanLabelShort` | deklarasi | M15 / calon | Review helper dalam modul calon | BELUM |
| FE-55822-deklarasi | `_trenDataTableHTML` | deklarasi | M15 / calon | Review helper dalam modul calon | BELUM |
| FE-55840-deklarasi | `_openAnalitikDrillDown` | deklarasi | M15 / calon | Review helper dalam modul calon | BELUM |
| FE-55926-deklarasi | `_drillDownInfoHTML` | deklarasi | M15 / calon | Review helper dalam modul calon | BELUM |
| FE-55930-deklarasi | `_drillDownTableKelasHTML` | deklarasi | M05 / calon | Review helper dalam modul calon | BELUM |
| FE-55957-deklarasi | `_closeAnalitikDrillDown` | deklarasi | M15 / calon | Review helper dalam modul calon | BELUM |
| FE-55971-deklarasi | `_analitikGlobalKeyHandler` | deklarasi | M15 / calon | Review helper dalam modul calon | BELUM |
| FE-55988-deklarasi | `_analitikDocClick` | deklarasi | M15 / calon | Review helper dalam modul calon | BELUM |
| FE-56000-deklarasi | `_toggleAnalitikExportMenu` | deklarasi | M15 / calon | Review helper dalam modul calon | BELUM |
| FE-56010-deklarasi | `_analitikExport` | deklarasi | M15 / calon | Review helper dalam modul calon | BELUM |
| FE-56105-deklarasi | `_analitikSkeletonHTML` | deklarasi | M15 / calon | Review helper dalam modul calon | BELUM |
| FE-56107-deklarasi | `box` | deklarasi | M15 / calon | Review helper dalam modul calon | BELUM |
| FE-56120-deklarasi | `_analitikErrorHTML` | deklarasi | M15 / calon | Review helper dalam modul calon | BELUM |
| FE-56130-deklarasi | `_analitikEmptyKelasHTML` | deklarasi | M15 / calon | Review helper dalam modul calon | BELUM |
| FE-56139-deklarasi | `_injectAnalitikStyles` | deklarasi | M15 / calon | Review helper dalam modul calon | BELUM |
| FE-56179-deklarasi | `_esc` | deklarasi | M15 / calon | Review helper dalam modul calon | BELUM |
| FE-56189-deklarasi | `openModalSoTM` | deklarasi | M15 / calon | Review helper dalam modul calon | BELUM |
| FE-56206-deklarasi | `closeModalSoTM` | deklarasi | M15 / calon | Review helper dalam modul calon | BELUM |
| FE-56211-deklarasi | `renderSoTM` | deklarasi | M15 / calon | Review helper dalam modul calon | BELUM |
| FE-56295-deklarasi | `exportSertifikatSoTM` | deklarasi | M15 / langsung | M15-F09 | BELUM |
| FE-56307-deklarasi | `_generateSertifikatSoTM` | deklarasi | M15 / calon | Review helper dalam modul calon | BELUM |
| FE-56630-deklarasi | `openModalSyncAfektif` | deklarasi | M15 / calon | Review helper dalam modul calon | BELUM |
| FE-56651-deklarasi | `closeModalSyncAfektif` | deklarasi | M15 / calon | Review helper dalam modul calon | BELUM |
| FE-56656-deklarasi | `submitSyncAfektif` | deklarasi | M15 / calon | Review helper dalam modul calon | BELUM |
| FE-56696-deklarasi | `openModalKonfigSPK` | deklarasi | M15 / calon | Review helper dalam modul calon | BELUM |
| FE-56709-deklarasi | `closeModalKonfigSPK` | deklarasi | M15 / calon | Review helper dalam modul calon | BELUM |
| FE-56714-deklarasi | `renderKonfigSPKForm` | deklarasi | M15 / calon | Review helper dalam modul calon | BELUM |
| FE-56828-deklarasi | `submitKonfigSPK` | deklarasi | M15 / calon | Review helper dalam modul calon | BELUM |
| FE-56858-deklarasi | `setupTriggerF3` | deklarasi | M15 / calon | Review helper dalam modul calon | BELUM |
| FE-56881-deklarasi | `refreshNotifPiketStatus` | deklarasi | M15 / calon | Review helper dalam modul calon | BELUM |
| FE-56906-deklarasi | `previewNotifPiket` | deklarasi | M15 / calon | Review helper dalam modul calon | BELUM |
| FE-56948-deklarasi | `runNotifPiketNow` | deklarasi | M15 / calon | Review helper dalam modul calon | BELUM |
| FE-56980-deklarasi | `refreshHariLiburList` | deklarasi | M15 / calon | Review helper dalam modul calon | BELUM |
| FE-57012-deklarasi | `addHariLibur` | deklarasi | M17 / langsung | M17-F03 | BELUM |
| FE-57036-deklarasi | `removeHariLibur` | deklarasi | M17 / langsung | M17-F03 | BELUM |
| FE-57064-deklarasi | `rebuildSaldoPoin` | deklarasi | M15 / calon | Review helper dalam modul calon | BELUM |
| FE-57095-deklarasi | `loadPoinKedisiplinanku` | deklarasi | M15 / calon | Review helper dalam modul calon | BELUM |
| FE-57128-deklarasi | `reloadPoinKedisiplinanku` | deklarasi | M15 / calon | Review helper dalam modul calon | BELUM |
| FE-57136-deklarasi | `_fetchPoinKedisiplinanku` | deklarasi | M15 / calon | Review helper dalam modul calon | BELUM |
| FE-57152-deklarasi | `_renderPoinKedisiplinanku` | deklarasi | M15 / calon | Review helper dalam modul calon | BELUM |
| FE-57393-deklarasi | `_switchPkTab` | deklarasi | M15 / calon | Review helper dalam modul calon | BELUM |
| FE-57407-deklarasi | `_renderPkTable` | deklarasi | M15 / calon | Review helper dalam modul calon | BELUM |
| FE-57498-deklarasi | `_filterPkTable` | deklarasi | M15 / calon | Review helper dalam modul calon | BELUM |
| FE-57520-deklarasi | `_renderPkTrenChart` | deklarasi | M15 / calon | Review helper dalam modul calon | BELUM |
| FE-57521-deklarasi | `doChart` | deklarasi | M15 / calon | Review helper dalam modul calon | BELUM |
| FE-57594-assignment | `onerror` | assignment | M15 / calon | Review helper dalam modul calon | BELUM |
| FE-57605-deklarasi | `exportSertifikatSiswaSoTM` | deklarasi | M15 / langsung | M15-F09 | BELUM |
| FE-57645-deklarasi | `_poinAnakSkeleton` | deklarasi | M15 / calon | Review helper dalam modul calon | BELUM |
| FE-57654-deklarasi | `loadPoinAnak` | deklarasi | M15 / langsung | M15-F05 | BELUM |
| FE-57828-deklarasi | `_poinAnakErrorBox` | deklarasi | M15 / calon | Review helper dalam modul calon | BELUM |
| FE-57846-deklarasi | `_renderPoinAnakShell` | deklarasi | M15 / calon | Review helper dalam modul calon | BELUM |
| FE-57851-assignment | `onSelect` | assignment | M15 / calon | Review helper dalam modul calon | BELUM |
| FE-57859-deklarasi | `_switchPoinAnak` | deklarasi | M15 / calon | Review helper dalam modul calon | BELUM |
| FE-57867-deklarasi | `_reloadPoinAnakData` | deklarasi | M15 / calon | Review helper dalam modul calon | BELUM |
| FE-57873-deklarasi | `_loadPoinAnakData` | deklarasi | M15 / calon | Review helper dalam modul calon | BELUM |
| FE-57903-deklarasi | `_poinAnakFmtTgl` | deklarasi | M15 / calon | Review helper dalam modul calon | BELUM |
| FE-57919-deklarasi | `_renderPoinAnakData` | deklarasi | M15 / calon | Review helper dalam modul calon | BELUM |
| FE-58190-deklarasi | `_renderPoinAnakSotmBtns` | deklarasi | M15 / calon | Review helper dalam modul calon | BELUM |
| FE-58199-assignment | `onmouseover` | assignment | M16 / calon | Review helper dalam modul calon | BELUM |
| FE-58200-assignment | `onmouseout` | assignment | M16 / calon | Review helper dalam modul calon | BELUM |
| FE-58201-assignment | `onclick` | assignment | M16 / calon | Review helper dalam modul calon | BELUM |
| FE-58207-deklarasi | `_renderPoinAnakTable` | deklarasi | M15 / calon | Review helper dalam modul calon | BELUM |
| FE-58325-deklarasi | `_switchPoinAnakTab` | deklarasi | M15 / calon | Review helper dalam modul calon | BELUM |
| FE-58339-deklarasi | `_resetPoinAnakFilter` | deklarasi | M15 / calon | Review helper dalam modul calon | BELUM |
| FE-58355-deklarasi | `_filterPoinAnakTable` | deklarasi | M15 / calon | Review helper dalam modul calon | BELUM |
| FE-58377-deklarasi | `_renderPoinAnakTrenChart` | deklarasi | M15 / calon | Review helper dalam modul calon | BELUM |
| FE-58378-deklarasi | `doChart` | deklarasi | M16 / calon | Review helper dalam modul calon | BELUM |
| FE-58451-assignment | `onerror` | assignment | M16 / calon | Review helper dalam modul calon | BELUM |
| FE-58464-deklarasi | `_showPoinAnakEventDetail` | deklarasi | M15 / calon | Review helper dalam modul calon | BELUM |
| FE-58574-deklarasi | `_showPoinAnakInfoModal` | deklarasi | M15 / calon | Review helper dalam modul calon | BELUM |
| FE-58588-deklarasi | `buildCaraKerja` | deklarasi | M16 / calon | Review helper dalam modul calon | BELUM |
| FE-58620-deklarasi | `buildLevel` | deklarasi | M16 / calon | Review helper dalam modul calon | BELUM |
| FE-58649-deklarasi | `buildIstilah` | deklarasi | M16 / calon | Review helper dalam modul calon | BELUM |
| FE-58685-deklarasi | `buildFAQ` | deklarasi | M16 / calon | Review helper dalam modul calon | BELUM |
| FE-58711-deklarasi | `_piInfoCard` | deklarasi | M16 / calon | Review helper dalam modul calon | BELUM |
| FE-58724-deklarasi | `switchTab` | deklarasi | M16 / calon | Review helper dalam modul calon | BELUM |
| FE-58796-deklarasi | `_showPoinAnakWaliModal` | deklarasi | M15 / calon | Review helper dalam modul calon | BELUM |
| FE-58847-deklarasi | `_exportPoinAnakPDF` | deklarasi | M15 / calon | Review helper dalam modul calon | BELUM |
| FE-58905-deklarasi | `loadManajemenSurvei` | deklarasi | M16 / calon | Review helper dalam modul calon | BELUM |
| FE-58969-deklarasi | `switchSurveiTab` | deklarasi | M16 / calon | Review helper dalam modul calon | BELUM |
| FE-59034-deklarasi | `renderSurveiKelolaPeriode` | deklarasi | M16 / calon | Review helper dalam modul calon | BELUM |
| FE-59162-assignment | `fmtYmd` | assignment | M16 / calon | Review helper dalam modul calon | BELUM |
| FE-59176-deklarasi | `onSurveiTipeChange` | deklarasi | M16 / calon | Review helper dalam modul calon | BELUM |
| FE-59197-deklarasi | `onSurveiTglBukaChange` | deklarasi | M16 / calon | Review helper dalam modul calon | BELUM |
| FE-59230-deklarasi | `resetSurveiForm` | deklarasi | M16 / calon | Review helper dalam modul calon | BELUM |
| FE-59239-assignment | `fmtYmd` | assignment | M16 / calon | Review helper dalam modul calon | BELUM |
| FE-59253-deklarasi | `submitSurveiPeriode` | deklarasi | M16 / calon | Review helper dalam modul calon | BELUM |
| FE-59328-deklarasi | `loadSurveiPeriodeList` | deklarasi | M16 / calon | Review helper dalam modul calon | BELUM |
| FE-59353-deklarasi | `renderSurveiPeriodeTable` | deklarasi | M16 / calon | Review helper dalam modul calon | BELUM |
| FE-59364-assignment | `escAttr` | assignment | M16 / calon | Review helper dalam modul calon | BELUM |
| FE-59373-assignment | `escJsArg` | assignment | M16 / calon | Review helper dalam modul calon | BELUM |
| FE-59465-deklarasi | `confirmTutupSurveiPeriode` | deklarasi | M16 / calon | Review helper dalam modul calon | BELUM |
| FE-59527-deklarasi | `openEditSurveiPeriode` | deklarasi | M16 / calon | Review helper dalam modul calon | BELUM |
| FE-59536-deklarasi | `toDateInput` | deklarasi | M16 / calon | Review helper dalam modul calon | BELUM |
| FE-59558-assignment | `esc` | assignment | M16 / calon | Review helper dalam modul calon | BELUM |
| FE-59711-deklarasi | `_surveiEnsureChartJs` | deklarasi | M16 / calon | Review helper dalam modul calon | BELUM |
| FE-59722-assignment | `onerror` | assignment | M16 / calon | Review helper dalam modul calon | BELUM |
| FE-59729-deklarasi | `_surveiEnsurePeriodeList` | deklarasi | M16 / calon | Review helper dalam modul calon | BELUM |
| FE-59747-deklarasi | `_surveiGetActivePeriodeId` | deklarasi | M16 / calon | Review helper dalam modul calon | BELUM |
| FE-59761-deklarasi | `_surveiRenderToolbar` | deklarasi | M16 / calon | Review helper dalam modul calon | BELUM |
| FE-59830-deklarasi | `onSurveiPeriodeChange` | deklarasi | M16 / calon | Review helper dalam modul calon | BELUM |
| FE-59836-deklarasi | `onSurveiExcludeFlagChange` | deklarasi | M16 / calon | Review helper dalam modul calon | BELUM |
| FE-59841-deklarasi | `loadSurveiPeriodeListThenRefresh` | deklarasi | M16 / calon | Review helper dalam modul calon | BELUM |
| FE-59862-deklarasi | `_surveiNoPeriodePlaceholder` | deklarasi | M16 / calon | Review helper dalam modul calon | BELUM |
| FE-59877-deklarasi | `_surveiCheckRencanaAksiGate` | deklarasi | M16 / calon | Review helper dalam modul calon | BELUM |
| FE-59890-deklarasi | `_surveiRencanaGateBox` | deklarasi | M16 / calon | Review helper dalam modul calon | BELUM |
| FE-59907-deklarasi | `_surveiLoadingBox` | deklarasi | M16 / calon | Review helper dalam modul calon | BELUM |
| FE-59914-deklarasi | `_surveiErrorBox` | deklarasi | M16 / calon | Review helper dalam modul calon | BELUM |
| FE-59920-deklarasi | `_surveiSkorWarna` | deklarasi | M16 / calon | Review helper dalam modul calon | BELUM |
| FE-59931-deklarasi | `renderSurveiTabProgress` | deklarasi | M16 / calon | Review helper dalam modul calon | BELUM |
| FE-59938-deklarasi | `_renderSurveiTabProgressInner` | deklarasi | M16 / calon | Review helper dalam modul calon | BELUM |
| FE-59962-deklarasi | `_renderSurveiProgressData` | deklarasi | M16 / calon | Review helper dalam modul calon | BELUM |
| FE-60091-deklarasi | `renderSurveiTabAspek` | deklarasi | M16 / calon | Review helper dalam modul calon | BELUM |
| FE-60098-deklarasi | `_renderSurveiTabAspekInner` | deklarasi | M16 / calon | Review helper dalam modul calon | BELUM |
| FE-60155-deklarasi | `onSurveiAspekRoleFilter` | deklarasi | M16 / calon | Review helper dalam modul calon | BELUM |
| FE-60177-deklarasi | `_renderSurveiAspekContent` | deklarasi | M16 / calon | Review helper dalam modul calon | BELUM |
| FE-60276-deklarasi | `renderSurveiTabMapel` | deklarasi | M16 / calon | Review helper dalam modul calon | BELUM |
| FE-60283-deklarasi | `_renderSurveiTabMapelInner` | deklarasi | M16 / calon | Review helper dalam modul calon | BELUM |
| FE-60312-deklarasi | `_renderSurveiMapelContent` | deklarasi | M16 / calon | Review helper dalam modul calon | BELUM |
| FE-60433-deklarasi | `renderSurveiTabKegiatan` | deklarasi | M16 / calon | Review helper dalam modul calon | BELUM |
| FE-60440-deklarasi | `_renderSurveiTabKegiatanInner` | deklarasi | M16 / calon | Review helper dalam modul calon | BELUM |
| FE-60469-deklarasi | `_renderSurveiKegiatanContent` | deklarasi | M16 / calon | Review helper dalam modul calon | BELUM |
| FE-60547-deklarasi | `renderSurveiTabPeer` | deklarasi | M16 / calon | Review helper dalam modul calon | BELUM |
| FE-60554-deklarasi | `_renderSurveiTabPeerInner` | deklarasi | M16 / calon | Review helper dalam modul calon | BELUM |
| FE-60589-deklarasi | `_renderSurveiPeerContent` | deklarasi | M16 / calon | Review helper dalam modul calon | BELUM |
| FE-60660-deklarasi | `renderSurveiTabEsai` | deklarasi | M16 / calon | Review helper dalam modul calon | BELUM |
| FE-60667-deklarasi | `_renderSurveiTabEsaiInner` | deklarasi | M16 / calon | Review helper dalam modul calon | BELUM |
| FE-60724-deklarasi | `_surveiEsaiKodeDebounce` | deklarasi | M16 / calon | Review helper dalam modul calon | BELUM |
| FE-60733-deklarasi | `onSurveiEsaiFilterChange` | deklarasi | M16 / calon | Review helper dalam modul calon | BELUM |
| FE-60739-deklarasi | `onSurveiEsaiToggleNama` | deklarasi | M16 / calon | Review helper dalam modul calon | BELUM |
| FE-60744-deklarasi | `_surveiLoadEsai` | deklarasi | M16 / calon | Review helper dalam modul calon | BELUM |
| FE-60766-deklarasi | `_surveiRenderEsaiList` | deklarasi | M16 / calon | Review helper dalam modul calon | BELUM |
| FE-60813-deklarasi | `renderSurveiTabFlag` | deklarasi | M16 / calon | Review helper dalam modul calon | BELUM |
| FE-60820-deklarasi | `_renderSurveiTabFlagInner` | deklarasi | M16 / calon | Review helper dalam modul calon | BELUM |
| FE-60849-deklarasi | `_renderSurveiFlagContent` | deklarasi | M16 / calon | Review helper dalam modul calon | BELUM |
| FE-60855-deklarasi | `_flagSeverity` | deklarasi | M16 / calon | Review helper dalam modul calon | BELUM |
| FE-60964-deklarasi | `simpanCatatanAdminFlag` | deklarasi | M16 / calon | Review helper dalam modul calon | BELUM |
| FE-61012-deklarasi | `renderSurveiTabRencana` | deklarasi | M16 / calon | Review helper dalam modul calon | BELUM |
| FE-61019-deklarasi | `_renderSurveiTabRencanaInner` | deklarasi | M16 / calon | Review helper dalam modul calon | BELUM |
| FE-61045-deklarasi | `_renderSurveiRencanaContent` | deklarasi | M16 / calon | Review helper dalam modul calon | BELUM |
| FE-61293-deklarasi | `_renderRencanaPoinForm` | deklarasi | M15 / calon | Review helper dalam modul calon | BELUM |
| FE-61351-deklarasi | `onRencanaFieldChange` | deklarasi | M16 / calon | Review helper dalam modul calon | BELUM |
| FE-61357-deklarasi | `addRencanaPoin` | deklarasi | M15 / calon | Review helper dalam modul calon | BELUM |
| FE-61367-deklarasi | `removeRencanaPoin` | deklarasi | M15 / calon | Review helper dalam modul calon | BELUM |
| FE-61377-deklarasi | `resetRencanaForm` | deklarasi | M16 / calon | Review helper dalam modul calon | BELUM |
| FE-61395-deklarasi | `simpanRencanaAksiSubmit` | deklarasi | M16 / calon | Review helper dalam modul calon | BELUM |
| FE-61481-deklarasi | `onUpdateStatusKetercapaian` | deklarasi | M16 / calon | Review helper dalam modul calon | BELUM |
| FE-61526-deklarasi | `renderSurveiTabTren` | deklarasi | M16 / calon | Review helper dalam modul calon | BELUM |
| FE-61533-deklarasi | `_renderSurveiTabTrenInner` | deklarasi | M16 / calon | Review helper dalam modul calon | BELUM |
| FE-61619-deklarasi | `onSurveiTrenChange` | deklarasi | M16 / calon | Review helper dalam modul calon | BELUM |
| FE-61631-deklarasi | `_surveiLoadTrenData` | deklarasi | M16 / calon | Review helper dalam modul calon | BELUM |
| FE-61658-deklarasi | `_renderSurveiTrenContent` | deklarasi | M16 / calon | Review helper dalam modul calon | BELUM |
| FE-61832-deklarasi | `renderSurveiTabMikro` | deklarasi | M16 / calon | Review helper dalam modul calon | BELUM |
| FE-61845-deklarasi | `_renderSurveiTabMikroInner` | deklarasi | M16 / calon | Review helper dalam modul calon | BELUM |
| FE-61849-assignment | `fmt` | assignment | M16 / calon | Review helper dalam modul calon | BELUM |
| FE-62210-deklarasi | `_renderMikroPertanyaanForm` | deklarasi | M16 / calon | Review helper dalam modul calon | BELUM |
| FE-62241-deklarasi | `onMikroQTipeChange` | deklarasi | M16 / calon | Review helper dalam modul calon | BELUM |
| FE-62246-deklarasi | `onMikroQLabelChange` | deklarasi | M16 / calon | Review helper dalam modul calon | BELUM |
| FE-62250-deklarasi | `addMikroPertanyaan` | deklarasi | M16 / calon | Review helper dalam modul calon | BELUM |
| FE-62259-deklarasi | `removeMikroPertanyaan` | deklarasi | M16 / calon | Review helper dalam modul calon | BELUM |
| FE-62269-deklarasi | `resetMikroForm` | deklarasi | M16 / calon | Review helper dalam modul calon | BELUM |
| FE-62286-assignment | `fmtDate` | assignment | M16 / calon | Review helper dalam modul calon | BELUM |
| FE-62302-deklarasi | `submitMikroBuat` | deklarasi | M16 / calon | Review helper dalam modul calon | BELUM |
| FE-62363-deklarasi | `_loadMikroDaftar` | deklarasi | M16 / calon | Review helper dalam modul calon | BELUM |
| FE-62392-deklarasi | `_renderMikroDaftarList` | deklarasi | M16 / calon | Review helper dalam modul calon | BELUM |
| FE-62401-assignment | `escJsArg` | assignment | M16 / calon | Review helper dalam modul calon | BELUM |
| FE-62460-deklarasi | `confirmTutupMikro` | deklarasi | M16 / calon | Review helper dalam modul calon | BELUM |
| FE-62492-deklarasi | `loadMikroLaporan` | deklarasi | M16 / calon | Review helper dalam modul calon | BELUM |
| FE-62531-deklarasi | `_renderMikroLaporanContent` | deklarasi | M16 / calon | Review helper dalam modul calon | BELUM |
| FE-62629-deklarasi | `_surveiAIScopeOptions` | deklarasi | M16 / calon | Review helper dalam modul calon | BELUM |
| FE-62675-deklarasi | `renderSurveiTabAI` | deklarasi | M16 / calon | Review helper dalam modul calon | BELUM |
| FE-62682-deklarasi | `_renderSurveiTabAIInner` | deklarasi | M16 / calon | Review helper dalam modul calon | BELUM |
| FE-62781-deklarasi | `_surveiAILoadConfig` | deklarasi | M16 / calon | Review helper dalam modul calon | BELUM |
| FE-62814-deklarasi | `onSurveiAIScopeChange` | deklarasi | M16 / calon | Review helper dalam modul calon | BELUM |
| FE-62824-deklarasi | `_surveiAILoadDataScope` | deklarasi | M16 / calon | Review helper dalam modul calon | BELUM |
| FE-62882-deklarasi | `_surveiAIRefreshActions` | deklarasi | M16 / calon | Review helper dalam modul calon | BELUM |
| FE-62922-deklarasi | `onSurveiAIAnalisisBaru` | deklarasi | M16 / calon | Review helper dalam modul calon | BELUM |
| FE-62956-deklarasi | `_surveiAIScopeLabel` | deklarasi | M16 / calon | Review helper dalam modul calon | BELUM |
| FE-62966-deklarasi | `_surveiAIJalankan` | deklarasi | M16 / calon | Review helper dalam modul calon | BELUM |
| FE-63013-deklarasi | `onSurveiAIGunakanCache` | deklarasi | M16 / calon | Review helper dalam modul calon | BELUM |
| FE-63022-deklarasi | `onSurveiAIHapusCache` | deklarasi | M16 / calon | Review helper dalam modul calon | BELUM |
| FE-63070-deklarasi | `_surveiAIErrorBox` | deklarasi | M16 / calon | Review helper dalam modul calon | BELUM |
| FE-63083-deklarasi | `_surveiAIRenderHasil` | deklarasi | M16 / calon | Review helper dalam modul calon | BELUM |
| FE-63497-deklarasi | `_surveiBuildPertanyaanMapel` | deklarasi | M16 / calon | Review helper dalam modul calon | BELUM |
| FE-63516-deklarasi | `_surveiBuildPertanyaanKegiatan` | deklarasi | M16 / calon | Review helper dalam modul calon | BELUM |
| FE-63569-deklarasi | `_surveiEsc` | deklarasi | M16 / calon | Review helper dalam modul calon | BELUM |
| FE-63580-deklarasi | `_surveiInjectModalStyle` | deklarasi | M16 / calon | Review helper dalam modul calon | BELUM |
| FE-63709-deklarasi | `_surveiModalHeader` | deklarasi | M16 / calon | Review helper dalam modul calon | BELUM |
| FE-63745-deklarasi | `_surveiModalBody` | deklarasi | M16 / calon | Review helper dalam modul calon | BELUM |
| FE-63750-deklarasi | `_surveiBtnIcon` | deklarasi | M16 / calon | Review helper dalam modul calon | BELUM |
| FE-63763-deklarasi | `_surveiBtnHtml` | deklarasi | M16 / calon | Review helper dalam modul calon | BELUM |
| FE-63766-deklarasi | `_surveiLocalStorageKey` | deklarasi | M16 / calon | Review helper dalam modul calon | BELUM |
| FE-63769-deklarasi | `_surveiLoadDraftLocal` | deklarasi | M16 / calon | Review helper dalam modul calon | BELUM |
| FE-63776-deklarasi | `_surveiSaveDraftLocal` | deklarasi | M16 / langsung | M16-F07 | BELUM |
| FE-63784-deklarasi | `_surveiClearDraftLocal` | deklarasi | M16 / calon | Review helper dalam modul calon | BELUM |
| FE-63789-deklarasi | `_surveiParseTanggalIndo` | deklarasi | M16 / calon | Review helper dalam modul calon | BELUM |
| FE-63816-deklarasi | `_surveiCekDalamPeriode` | deklarasi | M16 / calon | Review helper dalam modul calon | BELUM |
| FE-63853-deklarasi | `_surveiHitungSisaHari` | deklarasi | M16 / calon | Review helper dalam modul calon | BELUM |
| FE-63875-deklarasi | `loadSurveiEvaluasi` | deklarasi | M16 / calon | Review helper dalam modul calon | BELUM |
| FE-63946-deklarasi | `_surveiErrorBox` | deklarasi | M16 / calon | Review helper dalam modul calon | BELUM |
| FE-63989-deklarasi | `_renderSurveiHalaman` | deklarasi | M16 / calon | Review helper dalam modul calon | BELUM |
| FE-64105-deklarasi | `_surveiLoadMikroBannerForUser` | deklarasi | M16 / calon | Review helper dalam modul calon | BELUM |
| FE-64160-deklarasi | `bukaSurveiMikroPengisian` | deklarasi | M16 / calon | Review helper dalam modul calon | BELUM |
| FE-64296-deklarasi | `_renderModalSurveiMikro` | deklarasi | M16 / calon | Review helper dalam modul calon | BELUM |
| FE-64472-deklarasi | `_surveiUpdateMikroProgress` | deklarasi | M16 / calon | Review helper dalam modul calon | BELUM |
| FE-64486-deklarasi | `onMikroFillChange` | deklarasi | M16 / calon | Review helper dalam modul calon | BELUM |
| FE-64533-deklarasi | `_submitMikroJawaban` | deklarasi | M16 / calon | Review helper dalam modul calon | BELUM |
| FE-64641-deklarasi | `_renderSurveiBelumDibuka` | deklarasi | M16 / calon | Review helper dalam modul calon | BELUM |
| FE-64712-deklarasi | `_renderSurveiSelesai` | deklarasi | M16 / calon | Review helper dalam modul calon | BELUM |
| FE-64752-deklarasi | `_surveiLoadRencanaAksiPublik` | deklarasi | M16 / calon | Review helper dalam modul calon | BELUM |
| FE-64837-deklarasi | `_renderSurveiForm` | deklarasi | M16 / calon | Review helper dalam modul calon | BELUM |
| FE-64994-deklarasi | `_buildSurveiQuestionList` | deklarasi | M16 / calon | Review helper dalam modul calon | BELUM |
| FE-65060-deklarasi | `_surveiSeededRandom` | deklarasi | M16 / calon | Review helper dalam modul calon | BELUM |
| FE-65070-deklarasi | `_surveiAttachConnListeners` | deklarasi | M16 / calon | Review helper dalam modul calon | BELUM |
| FE-65102-deklarasi | `_surveiUpdateOfflineBanner` | deklarasi | M16 / calon | Review helper dalam modul calon | BELUM |
| FE-65108-deklarasi | `_surveiTouchTimestampMulai` | deklarasi | M16 / calon | Review helper dalam modul calon | BELUM |
| FE-65116-deklarasi | `_surveiRenderStep` | deklarasi | M16 / calon | Review helper dalam modul calon | BELUM |
| FE-65240-deklarasi | `_surveiPlaceholderFase3` | deklarasi | M16 / calon | Review helper dalam modul calon | BELUM |
| FE-65255-deklarasi | `_surveiGenerateMapelRotasiThenRender` | deklarasi | M16 / calon | Review helper dalam modul calon | BELUM |
| FE-65294-deklarasi | `_surveiRenderStep3Siswa` | deklarasi | M16 / calon | Review helper dalam modul calon | BELUM |
| FE-65405-deklarasi | `goToSurveiMapel` | deklarasi | M16 / calon | Review helper dalam modul calon | BELUM |
| FE-65415-deklarasi | `_surveiNextMapel` | deklarasi | M16 / calon | Review helper dalam modul calon | BELUM |
| FE-65458-deklarasi | `_surveiSaveMapelAktifKeServer` | deklarasi | M16 / calon | Review helper dalam modul calon | BELUM |
| FE-65485-deklarasi | `_surveiRenderStep4Siswa` | deklarasi | M16 / calon | Review helper dalam modul calon | BELUM |
| FE-65561-deklarasi | `_surveiRenderQuestions` | deklarasi | M16 / calon | Review helper dalam modul calon | BELUM |
| FE-65649-deklarasi | `_surveiRenderQuestionItem` | deklarasi | M16 / calon | Review helper dalam modul calon | BELUM |
| FE-65698-deklarasi | `_surveiAttachInputHandlers` | deklarasi | M16 / calon | Review helper dalam modul calon | BELUM |
| FE-65747-deklarasi | `_surveiOnAnswerChange` | deklarasi | M16 / calon | Review helper dalam modul calon | BELUM |
| FE-65765-deklarasi | `_surveiUpdateProgress` | deklarasi | M16 / calon | Review helper dalam modul calon | BELUM |
| FE-65832-deklarasi | `_surveiSetSaveStatus` | deklarasi | M16 / calon | Review helper dalam modul calon | BELUM |
| FE-65858-deklarasi | `_surveiBuildJawabanPayload` | deklarasi | M16 / calon | Review helper dalam modul calon | BELUM |
| FE-65901-deklarasi | `_surveiSaveToServer` | deklarasi | M16 / langsung | M16-F07 | BELUM |
| FE-65997-deklarasi | `_surveiAutoSyncDrafts` | deklarasi | M16 / langsung | M16-F07 | BELUM |
| FE-66007-deklarasi | `_surveiValidateStep` | deklarasi | M16 / langsung | M16-F09 | BELUM |
| FE-66055-deklarasi | `_surveiHighlightMissing` | deklarasi | M16 / calon | Review helper dalam modul calon | BELUM |
| FE-66083-deklarasi | `nextSurveiStep` | deklarasi | M16 / calon | Review helper dalam modul calon | BELUM |
| FE-66352-deklarasi | `prevSurveiStep` | deklarasi | M16 / calon | Review helper dalam modul calon | BELUM |
| FE-66357-deklarasi | `goToSurveiStep` | deklarasi | M16 / calon | Review helper dalam modul calon | BELUM |
| FE-66376-deklarasi | `_surveiKonfirmasiSubmitFinal` | deklarasi | M16 / calon | Review helper dalam modul calon | BELUM |
| FE-66463-deklarasi | `_surveiShowSubmitConfirmation` | deklarasi | M16 / calon | Review helper dalam modul calon | BELUM |
| FE-66593-deklarasi | `_surveiDoSubmitFinal` | deklarasi | M16 / calon | Review helper dalam modul calon | BELUM |
| FE-66674-deklarasi | `_surveiDoSaveAndSubmit` | deklarasi | M16 / calon | Review helper dalam modul calon | BELUM |
| FE-66743-deklarasi | `_surveiDoFinalSubmitCall` | deklarasi | M16 / calon | Review helper dalam modul calon | BELUM |
| FE-66810-deklarasi | `_surveiTampilkanTerimaKasih` | deklarasi | M16 / calon | Review helper dalam modul calon | BELUM |
| FE-66866-deklarasi | `_surveiPlayConfetti` | deklarasi | M16 / calon | Review helper dalam modul calon | BELUM |
| FE-66922-deklarasi | `_surveiLoadPeerStatusThenRender` | deklarasi | M16 / calon | Review helper dalam modul calon | BELUM |
| FE-66980-deklarasi | `_surveiRenderStep3Guru` | deklarasi | M16 / calon | Review helper dalam modul calon | BELUM |
| FE-67141-deklarasi | `onPeerLikertChange` | deklarasi | M16 / calon | Review helper dalam modul calon | BELUM |
| FE-67166-deklarasi | `onPeerTTChange` | deklarasi | M16 / calon | Review helper dalam modul calon | BELUM |
| FE-67177-deklarasi | `onPeerEsaiChange` | deklarasi | M16 / calon | Review helper dalam modul calon | BELUM |
| FE-67187-deklarasi | `goToSurveiPeer` | deklarasi | M16 / calon | Review helper dalam modul calon | BELUM |
| FE-67197-deklarasi | `_surveiNextPeer` | deklarasi | M16 / calon | Review helper dalam modul calon | BELUM |
| FE-67242-deklarasi | `_surveiSavePeerAktif` | deklarasi | M16 / calon | Review helper dalam modul calon | BELUM |
| FE-67311-deklarasi | `_surveiKonfirmasiSubmitPeer` | deklarasi | M16 / calon | Review helper dalam modul calon | BELUM |
| FE-67490-deklarasi | `_surveiDoSubmitPeer` | deklarasi | M16 / calon | Review helper dalam modul calon | BELUM |
| FE-67610-deklarasi | `_surveiRenderStep4Guru` | deklarasi | M16 / calon | Review helper dalam modul calon | BELUM |
| FE-67617-assignment | `card` | assignment | M16 / calon | Review helper dalam modul calon | BELUM |
| FE-67681-deklarasi | `_surveiLoadLaporanPersonalGuru` | deklarasi | M16 / calon | Review helper dalam modul calon | BELUM |
| FE-67707-deklarasi | `_surveiRenderLaporanPersonalGuru` | deklarasi | M16 / calon | Review helper dalam modul calon | BELUM |
| FE-67713-deklarasi | `colorByScore` | deklarasi | M16 / calon | Review helper dalam modul calon | BELUM |
| FE-67857-deklarasi | `loadLaporanBimbinganAnak` | deklarasi | M05 / langsung | M05-F07 | BELUM |
| FE-67944-assignment | `onSelect` | assignment | M05 / calon | Review helper dalam modul calon | BELUM |
| FE-67964-deklarasi | `_ortuLapBimSkeleton` | deklarasi | M05 / calon | Review helper dalam modul calon | BELUM |
| FE-67976-deklarasi | `_loadOrtuLapBim` | deklarasi | M05 / calon | Review helper dalam modul calon | BELUM |
| FE-68003-deklarasi | `_renderOrtuLapBimData` | deklarasi | M05 / calon | Review helper dalam modul calon | BELUM |
| FE-68150-deklarasi | `_lbaUpdateFilterBtns` | deklarasi | M05 / calon | Review helper dalam modul calon | BELUM |
| FE-68166-assignment | `_lbaSetFilter` | assignment | M05 / calon | Review helper dalam modul calon | BELUM |
| FE-68174-assignment | `_resetLbaFilters` | assignment | M05 / calon | Review helper dalam modul calon | BELUM |
| FE-68185-deklarasi | `_renderLbaCards` | deklarasi | M05 / calon | Review helper dalam modul calon | BELUM |
| FE-68305-assignment | `_lbaChangePage` | assignment | M05 / calon | Review helper dalam modul calon | BELUM |
| FE-68310-assignment | `_openLbaDetailModal` | assignment | M05 / calon | Review helper dalam modul calon | BELUM |
| FE-68402-assignment | `_lbaEscHandler` | assignment | M05 / calon | Review helper dalam modul calon | BELUM |
| FE-68409-assignment | `_closeLbaDetailModal` | assignment | M05 / calon | Review helper dalam modul calon | BELUM |
| FE-68419-deklarasi | `sanitizeInput` | deklarasi | M05 / calon | Review helper dalam modul calon | BELUM |
| FE-68429-deklarasi | `_calonEsc` | deklarasi | M05 / calon | Review helper dalam modul calon | BELUM |
| FE-68439-deklarasi | `_formatDate` | deklarasi | M05 / calon | Review helper dalam modul calon | BELUM |
| FE-68456-deklarasi | `renderCalonSiswaPage` | deklarasi | M03 / calon | Review helper dalam modul calon | BELUM |
| FE-68474-deklarasi | `_renderCalonSiswaTable` | deklarasi | M03 / calon | Review helper dalam modul calon | BELUM |
| FE-68587-assignment | `_handleCSSearch` | assignment | M03 / calon | Review helper dalam modul calon | BELUM |
| FE-68605-assignment | `_changeCSPage` | assignment | M03 / calon | Review helper dalam modul calon | BELUM |
| FE-68613-assignment | `showCalonSiswaDetail` | assignment | M04 / calon | Review helper dalam modul calon | BELUM |
| FE-68654-deklarasi | `getInitials2` | deklarasi | M03 / calon | Review helper dalam modul calon | BELUM |
| FE-68983-assignment | `showOrphanedSiswaModal` | assignment | M03 / calon | Review helper dalam modul calon | BELUM |
| FE-69169-deklarasi | `renderOrangTuaPage` | deklarasi | M08 / calon | Review helper dalam modul calon | BELUM |
| FE-69188-deklarasi | `_renderOrangTuaTable` | deklarasi | M08 / calon | Review helper dalam modul calon | BELUM |
| FE-69324-assignment | `_handleOTSearch` | assignment | M08 / calon | Review helper dalam modul calon | BELUM |
| FE-69346-assignment | `_changeOTPage` | assignment | M01 / calon | Review helper dalam modul calon | BELUM |
| FE-69354-assignment | `showCalonSiswaDetailByUname` | assignment | M04 / calon | Review helper dalam modul calon | BELUM |
| FE-69439-deklarasi | `loadPiketPage` | deklarasi | M08 / calon | Review helper dalam modul calon | BELUM |
| FE-69530-deklarasi | `_piketCheckDone` | deklarasi | M08 / calon | Review helper dalam modul calon | BELUM |
| FE-69539-deklarasi | `_isiDropdownPengganti` | deklarasi | M08 / calon | Review helper dalam modul calon | BELUM |
| FE-69625-deklarasi | `renderTabelPiketUtama` | deklarasi | M08 / calon | Review helper dalam modul calon | BELUM |
| FE-69679-deklarasi | `_setPenggantiFormDisabled` | deklarasi | M08 / calon | Review helper dalam modul calon | BELUM |
| FE-69728-deklarasi | `renderTabelPiketPengganti` | deklarasi | M08 / calon | Review helper dalam modul calon | BELUM |
| FE-69764-deklarasi | `doKonfirmasiPiketUtama` | deklarasi | M08 / calon | Review helper dalam modul calon | BELUM |
| FE-69818-deklarasi | `doTunjukPengganti` | deklarasi | M08 / calon | Review helper dalam modul calon | BELUM |
| FE-69886-deklarasi | `_evaluasiStatePenggantiForm` | deklarasi | M08 / calon | Review helper dalam modul calon | BELUM |
| FE-69900-deklarasi | `_updateAksiBtnDigantikan` | deklarasi | M08 / calon | Review helper dalam modul calon | BELUM |
| FE-69933-deklarasi | `_restoreAksiBtnDigantikan` | deklarasi | M08 / calon | Review helper dalam modul calon | BELUM |
| FE-69969-deklarasi | `doKonfirmasiPiketPengganti` | deklarasi | M08 / calon | Review helper dalam modul calon | BELUM |
| FE-70014-deklarasi | `doBatalKonfirmasiPiketUtama` | deklarasi | M08 / calon | Review helper dalam modul calon | BELUM |
| FE-70069-deklarasi | `doBatalKonfirmasiPiketPengganti` | deklarasi | M08 / calon | Review helper dalam modul calon | BELUM |
| FE-70117-deklarasi | `doBatalTunjukPiketPengganti` | deklarasi | M08 / calon | Review helper dalam modul calon | BELUM |

## 11. Checklist hasil Tahap 1

- [x] Acuan dan commit sumber dibekukan dalam matriks; hash file dicatat.
- [x] 17 modul memiliki kelompok fitur, scope, sumber, tahap dan kriteria penerimaan.
- [x] Semua entri katalog backend/frontend acuan dimasukkan tanpa membuang nama duplikat.
- [x] Pemetaan langsung dibedakan dari calon owner; tidak mengklaim seluruh helper sudah dianalisis semantik.
- [x] Konflik/keputusan terbuka dicatat; tidak ditetapkan diam-diam.
- [x] Dependensi antarmodul, prinsip histori/otorisasi/transaksi dan format bukti selesai ditetapkan.
- [x] Status implementasi dan uji tetap BELUM; dokumen dasar tidak diubah.
- [x] Keputusan utama Tahap 2 D01–D03 dicatat dalam spesifikasi versi 1.0; review izin detail/D10 tetap sesuai dependensi implementasi.
- [ ] Tahap3–30: implementasikan, lengkapi padanan setiap fungsi, uji dan rekonsiliasi.

### Hasil pemeriksaan otomatis dokumen

125 ID fitur unik; 387 baris backend dan 1345 baris frontend cocok katalog acuan; semua simbol rujukan fitur ditemukan dalam katalog atau bank instrumen. Backend: 290 langsung, 97 calon. Frontend: 47 langsung, 1298 calon. Kode keputusan D01–D09 dan kelompok uji U01–U29 tersedia. Semua baris berstatus BELUM.

Pemeriksaan ini memastikan struktur dan cakupan inventaris, bukan kebenaran runtime aplikasi. Tidak ada deployment, perubahan Supabase, pengiriman pesan, atau push GitHub pada Tahap1.

## 12. Pembaruan pelacakan — 19 Oktober 2026, 12.51 WIB

D01 RAPOR-1.0: selalu PH20%,ATS30%,ASAS50%; Praktik terpisah. D02 FEE-1.0: pembulatan ribuan terdekat. D03 SURVEI-REQUIRED-1.0: daftar esai wajib backend, esai peer opsional; validasi konsisten. Rujukan: Tahap_02_Spesifikasi_Aturan_Bisnis_SiM-Murid.md versi 1.0, bagian 15.

U16 pada dokumen dasar semula menunjukkan konflik82 vs84,50. Untuk penerimaan implementasi baru hasil resmi kedua kondisi adalah82; angka84,50 dipertahankan hanya sebagai pembanding baseline lama. U15 memakai fee resmiRp1.000 untukRp123.000×1%;Rp1.230 adalah pembanding jalur lama, bukan hasil aktif.

Belum ada implementasi atau tes yang dijalankan; semua baris fitur BELUM. D10 perilaku pembaruan KKM perlu diselesaikan sebelum rilis fitur terkait. Tidak mengubah dokumen dasar yang membekukan bukti kode lama.
