# L02 — Pengujian alur lintas role dan bukti UAT

Tanggal: 26 Oktober 2026 (WIB). Baseline main `493971f5f001dc6c556bb46b5262b2b910c5b31a` (PR76/L01). Branch `feat/l02-role-journey-validation`.

**Status:** tooling dan regresi otomatis; UAT manusia, baseline waktu, retest temuan manusia dan penerimaan pemilik belum tersedia. Bukan pernyataan seluruh L02 selesai. Tidak menjalankan L03–L11 atau PWA.

## Analisis dan keputusan implementasi

P11 sudah memiliki protokol pengguna; P10 sudah memiliki taksonomi 14 role/penugasan dan gerbang restore/load. Tidak membuat dashboard UAT, tabel database atau layanan pengumpulan data baru. Kebutuhan L02 yang belum tersedia adalah ID tugas terukur, schema pencatatan, agregasi per tugas, pairing baseline/setelah dan pemeriksaan kelengkapan bukti.

`user-evaluation.mjs` melengkapi protokol P11 dan memvalidasi katalog terhadap taksonomi P10. Target 95% adalah usulan dalam roadmap, bukan persentase keberhasilan pengguna yang telah diamati. Report template saat ini diblokir karena belum ada observasi manusia; angka kosong adalah null, bukan nol.

## Matriks tugas

| ID | Role/penugasan | Tugas dan hasil yang diperiksa |
|---|---|---|
| A01 | admin | Akun baru, password sementara, login ulang dan email/OTP |
| A02 | admin | Impor Excel: pratinjau, kesalahan baris dan retry tanpa akun ganda |
| A03 | admin | Tugas tambahan guru: beri, akhiri, lalu periksa penolakan akses |
| A04 | school_head | Ringkasan dan tindak lanjut sesuai cakupan |
| A05 | subject_teacher | Absensi pertemuan: simpan, cek riwayat, tolak kelas asing |
| A06 | subject_teacher | Input nilai: periode benar, hasil sesuai rumus existing |
| A07 | homeroom | Pratinjau rapor kelas binaan tanpa mengubah arsip terbit |
| A08 | mentor | Catat bimbingan siswa binaan dan tolak siswa asing |
| A09 | duty | Absensi harian sesuai roster dan tanggal WIB |
| A10 | duty | Piket pengganti: akses aktif lalu penolakan saat dibatalkan/kedaluwarsa |
| A11 | counselor | Tindak lanjut sesuai cakupan dan penolakan tanpa tugas aktif |
| A12 | committee_treasurer | Pembayaran komite: alokasi, riwayat dan retry tidak ganda |
| A13 | savings_manager | Setor/tarik: saldo, fee, slip dan ledger cocok |
| A14 | student | Onboarding biodata, email dan pertanyaan tidak saling melewati |
| A15 | student | Jadwal, survei dan rapor sendiri; data siswa asing ditolak |
| A16 | parent_multi_child | Pindah anak: cakupan benar termasuk setelah relasi dicabut |
| A17 | alumni | Dokumen kelulusan sesuai izin |
| A18 | customer | Rekening/transaksi sendiri, rekening asing ditolak |
| A19 | applicant | Biodata calon siswa tanpa akses akademik aktif |
| A20 | admin | Logout dibatalkan/disetujui serta sesi lama ditolak |
| A21 | subject_teacher | Timeout/offline: status belum pasti diperiksa tanpa submit ganda |

Skenario negatif merupakan bagian wajib hasil tugas: cakupan siswa/kelas/anak/rekening yang salah harus ditolak, tugas tambahan kedaluwarsa tidak memberi akses, retry ambigu tidak menggandakan hasil. Hasil nilai/fee mengikuti kebijakan existing, tidak mengubah D01/D02/D03/D10. Guru piket pengganti tetap penugasan, bukan role dasar baru.

## Bukti otomatis dan batasnya

| Area tugas | Suite existing dalam npm run check | Apa yang dibuktikan |
|---|---|---|
| Akun baru, sesi, email dan logout | auth/login/security/account-completion/email/sessions/forms | Kontrak gate, sesi lama, validasi, OTP, guard; provider terisolasi |
| Impor dan penugasan tambahan | excel/users/directory/user-detail/authorization/duty | Validasi file, idempotensi dan cakupan penugasan |
| Absensi dan bimbingan | attendance/mentoring/authorization | State/domain/scoping dan penolakan akses |
| Nilai dan rapor | grades/reports/learning | Rumus, periode, status dan arsip sesuai tes |
| Komite dan tabungan | committee/savings/reconciliation | Alokasi, fee, saldo/ledger dan kontrak retry |
| Relasi, biodata dan layanan | families/biodata/services/surveys | Relasi pengguna, data sendiri dan workflow sesuai tes |

Suite tersebut adalah regresi kode/API/database terisolasi, **bukan** satu sesi browser→Auth→database→SMTP staging yang dioperasikan manusia. Pengukuran durasi test runner tidak dipakai sebagai durasi tugas manusia. Tidak ada klaim kapasitas produksi dari kelulusan tes atau endpoint health.

## Penerimaan bukti

- Katalog A01–A21 mencakup semua scenario P10 dan tugas minimum L02.
- Minimal tiga percobaan baseline serta setelah per tugas, pasangan peserta/dataset/pengulangan/viewport setara, SHA sesuai fase.
- Outcome gagal/aborted tetap dihitung. Sukses harus mencakup hasil domain, penolakan akses terlarang dan pencegahan duplikasi yang diwajibkan skenario.
- Simulasi/isolated tidak dapat memenuhi gerbang manusia/staging; consent, hash bukti privat dan attestation operator wajib.
- P0/P1 terbuka memblokir; retest merujuk percobaan setelah yang sukses pada tugas dan SHA target. Kegagalan integritas/akses harus memiliki triase P0 dan retest, termasuk bila terjadi pada baseline.
- Laporan hanya agregat per tugas; tidak menyimpan identitas/kode peserta, token, catatan bebas atau isi data transaksi.
- Validasi struktur tidak membuktikan manusia benar-benar hadir. Verifikasi bukti privat dan persetujuan tetap tanggung jawab fasilitator/pemilik.
- Tool tidak otomatis memberi persetujuan deploy atau meluluskan P10 restore/load/owner acceptance.

## Hasil yang tersedia

- `npm ci`: dijalankan; dependensi/lockfile tidak berubah.
- `test:user-evaluation`: 10 tes lulus, termasuk kelengkapan matriks, metrik null, pasangan tidak cocok, duplikasi, aborted, success tidak aman, retest, schema ketat, CLI privacy dan proteksi overwrite input.
- CLI pada template kosong: exit 2 / blocked seperti diharapkan; laporan di `docs/verification/l02-role-journeys/human-evidence-status.json`. Ini bukti penolakan evidence kosong, bukan hasil sesi pengguna.
- `npm run check`: exit 0; 741 tes/78 kelompok, TypeScript, lint, replay tipe database dan production build lulus. Bukti pada `verification.json`. Tidak mengulang browser suite pada tahap tanpa perubahan UI ini.
- Tidak ada sesi manusia/staging berakun nyata, kiriman email, undangan peserta, data produksi, beban produksi atau aktivasi provider.

Lint awal menemukan import taksonomi belum dipakai; ditangani dengan validasi runtime katalog terhadap taksonomi P10. Pemeriksaan berikutnya dijalankan ulang. Tidak menemukan/mengklaim bug domain aplikasi baru hanya dari penambahan tooling ini.

## File dan alasan

- `scripts/operations/user-evaluation.mjs`: katalog, validator, statistik dan CLI lokal tanpa request jaringan.
- `tests/user-evaluation.test.mjs`: regresi penerimaan/penolakan evidence dan privasi CLI.
- `docs/help/USER-EVALUATION.md`: perluasan protokol existing, schema dan cara penggunaan.
- `docs/help/USER-EVALUATION-TEMPLATE.json`: kerangka kosong; tidak berisi kredensial/hasil contoh sukses.
- `package.json`: evaluator CLI dan tes baru ke check.
- Roadmap/laporan L01: mengoreksi status historis L01 yang sudah dirilis PR76 dan mencatat L02 parsial dengan jujur.
- Bukti otomatis tersunting di `docs/verification/l02-role-journeys/`.

## Langkah UAT manusia yang masih diperlukan

1. Pemilik menyediakan lingkungan staging terisolasi dan fasilitator; verifikasi staging/RLS/Auth/Storage sesuai P10 sebelum mutasi uji.
2. Rekrut peserta dengan persetujuan melalui saluran resmi secara manual. Tidak ada pesan otomatis dari pekerjaan ini.
3. Peserta masuk sendiri; gunakan data sintetis setara dan peran/penugasan/relasi yang benar. Simpan baseline sebelum perubahan yang akan dibandingkan.
4. Catat observasi privat memakai ID tugas, durasi, bantuan, error dan bukti hasil domain. Jangan commit data mentah.
5. Triase P0/P1/P2, buat perbaikan sesuai temuan, retest versi target dan jalankan evaluator.
6. Pemilik meninjau agregat, bukti privat dan batas sampel; baru menandai penerimaan L02. Jika data belum ada, tetap blocked.

## Rilis dan rollback

User telah mengizinkan PR/merge untuk L02 setelah CI lulus. Tidak ada migrasi yang diperlukan karena tidak mengubah database atau runtime bisnis. Rilis tooling dapat dilakukan terpisah dari penerimaan UAT manusia. Rollback cukup revert file tooling/dokumentasi; tidak menyentuh ledger/arsip. PR/SHA/CI/Production dicatat setelah benar-benar tersedia.
