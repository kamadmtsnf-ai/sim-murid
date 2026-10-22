# Audit Kelas dan Siswa — 22 Oktober 2026

Baseline: main `379a26c1d0a59f288929b6f47bc36cf46eca3a6b` (PR #14). Branch `fix/classes-audit`.

## A. Temuan

| Masalah | Penyebab dan bukti |
|---|---|
| Parameter `year` tidak valid masih dapat menyimpan data sebelum menghasilkan 400 | Validasi query sesudah `app_classes_write`; regresi route mereproduksi masalah. |
| Data upstream rusak dikembalikan sebagai kesalahan isian 400 | ZodError snapshot tercampur dengan validasi request. Reader kini mengubahnya menjadi service failure 503. |
| Tahun baru tidak otomatis terpilih | Callback hanya memilih tahun ketika filter sebelumnya kosong. |
| Wali kelas tidak aktif bisa berubah menjadi kosong tanpa pilihan eksplisit | ID lama tidak ada di option guru aktif, sehingga select native jatuh ke option pertama. |
| Error penyimpanan tertutup modal dan hasil tak pasti dapat dikirim ulang | Feedback global berada di belakang Dialog; hook selalu melepaskan lock sesudah kegagalan jaringan. |
| Siswa nonaktif tidak bisa dikeluarkan; kelas tetap tidak bisa diarsipkan | SQL menerapkan syarat akun siswa aktif untuk penambahan dan pengeluaran sekaligus. Test DB baru gagal `invalid` sebelum perbaikan. |
| Pengeluaran campuran ID relevan/tidak relevan dapat diterima sebagian | SQL tidak memvalidasi keanggotaan target untuk seluruh ID sebelum update. Test DB baru mereproduksi `saved` yang seharusnya `not_found`. |
| Interaksi roster/draft kurang jelas | Tombol tidak memindah fokus; pilihan tidak dikontrol, pencarian siswa tidak tersedia, perpindahan tanpa konfirmasi. |
| Layout rentan teks panjang/zoom/layar pendek | Kolom berdasarkan viewport, flex label dapat menyempit berlebihan, header modal tetap memakan area tinggi. |
| Kegagalan baca disamakan dengan gate keamanan | Page menangkap semua error tanpa retry yang sesuai. |

Pembacaan meliputi page/panel/API, reader/validator/hook bersama dan semua konsumennya (Keluarga/Jadwal), Dialog/controls/Status, shell/navigation/styles, migrasi read/write/access dan integrasi penempatan–jadwal/piket, serta spesifikasi D04/D05 dan kebijakan yang disepakati. Tidak ada integrasi Google Apps Script pada alur ini.

## B. Perbaikan

- Validasi URL sebelum write, snapshot lebih ketat dan service failure aman; caller/session, payload, kontrak respons dan pemeriksaan Origin tetap sama.
- Tahun baru dipilih tanpa otomatis diaktifkan; filter semua tahun tetap tersedia. Wali yang tidak tersedia tetap tampil dan harus diganti/dikosongkan secara eksplisit.
- Form kelas memakai Dialog existing, validasi klien dan server, feedback fokus di modal, konfirmasi draft, pencegahan double-submit, dan reload setelah stale/denied/hasil tak pasti. Timeout 30 detik hanya untuk mode confirmed yang dipakai Kelas; Keluarga/Jadwal tetap memakai mode default. Respons setelah unmount tidak menjalankan callback.
- Pilihan siswa/tanggal dikontrol, pencarian tidak menghilangkan pilihan, siswa yang sudah di kelas dikeluarkan dari kandidat tambah, maksimum 500, perpindahan dikonfirmasi, dan roster menerima fokus.
- Perbaikan SQL hanya mengganti fungsi write: pengeluaran memvalidasi penempatan aktif di kelas untuk setiap ID, terlepas dari status akun; penambahan tetap mensyaratkan siswa aktif. Tidak ada perubahan tabel, grants, privilege, penghapusan riwayat, atau pelebaran RBAC. Revision lock, idempotency, audit, dan pengarsipan piket tetap dipertahankan.
- Loading/error boundary tersendiri; retry layanan tidak menyalahkan kelengkapan akun. CSS baru dibatasi pada kelas/dialognya, tanpa design system atau komponen duplikat.

## C. Kode final dan daftar file

| File di `rebuilt/` | Tujuan |
|---|---|
| `src/app/account/classes/{page,class-panel,loading,error}.tsx` | State, formulir, roster, feedback, judul semantik, loading dan retry. |
| `src/app/api/classes/route.ts` | Validasi query sebelum mutasi. |
| `src/lib/education/{server,validation,use-mutation}.ts` | Klasifikasi service error, snapshot, lock dan lifecycle. |
| `src/app/globals.css` | Grid berbasis konten, wrapping, touch target, modal pendek. |
| `supabase/migrations/*_class_enrollment_removal.sql` | Pengeluaran siswa nonaktif dan validasi atomik ID. |
| `tests/classes.test.mjs`, `tests/database/education.test.mjs` | Regresi actual route/reader/schema dan SQL. |
| `tests/database/foundation.test.mjs`, `docs/database/schema-snapshot.json` | Hitungan 36 migrasi dan snapshot yang diregenerasi; mencakup provisioning yang sudah ada, bukan tabel baru pada audit ini. |
| `tests/ui/classes-*.{tsx,ts}`, `scripts/verify-classes.mjs`, `package.json` | Fixture sintetis dan suite browser yang dapat diulang. |
| `docs/design-system/MASTER.md`, laporan ini dan `docs/verification/classes/*.json` | Aturan desain, hasil dan batas verifikasi. |

## D. Verifikasi

Hasil mesin tersimpan pada `classes/automated-results.json`, `classes/browser-results.json`, dan `classes/ui-regression-results.json`. Route suite dijalankan pada baseline: 6/10 lulus, 4 gagal; setelah perbaikan: 10/10. Dua tes DB baru gagal pada baseline; setelah migrasi seluruh 17 tes pendidikan lulus.

Browser menguji komponen produksi aktual dalam fixture terisolasi: desktop/tablet/mobile 320–1440px, landscape 812×240, teks 200%/400%, data panjang/banyak/kosong, read-only, loading/error/retry, modal, keyboard/focus, resize/orientasi, pencarian/pilihan, respons duplicate/stale/network/malformed/timeout, dan tidak ada replay otomatis. Pemeriksaan axe tidak menggantikan pengujian pembaca layar oleh pengguna.

Tidak dilakukan CRUD data siswa/akun produksi atau UAT browser dengan sesi produksi seluruh role. RBAC dan efek bisnis diuji pada database lokal terisolasi; Origin/anonymous diuji terpisah pada server produksi lokal. Gulir vertikal normal untuk halaman panjang dan daftar kandidat tetap tersedia; targetnya tidak ada elemen terpotong atau overflow horizontal halaman.

Lingkungan sempat reset dan menghapus worktree sebelumnya. Kode dipulihkan dari main dan semua bukti dalam laporan ini berasal dari pengujian ulang. Build awal gagal karena cache `.next` lama yang ikut dipulihkan; cache dipindahkan dan build bersih dijalankan. Kesalahan props fixture QA ditemukan oleh TypeScript lalu diperbaiki sebelum build final. Tidak ada hasil gagal yang disebut lulus.

### Rilis database

Migrasi `20261022091201_class_enrollment_removal` telah diterapkan ke project Supabase yang sama. Body fungsi produksi cocok persis dengan SQL yang diuji; 36 migrasi tercatat, security invoker dan grants service_role-only tetap sama, panggilan tanpa identitas ditolak (`denied`). Pemeriksaan advisor sebelum/sesudah identik: private RLS tanpa policy tetap fail-closed dan peringatan leaked-password protection yang sudah ada. [Rujukan peringatan password](https://supabase.com/docs/guides/auth/password-security#password-strength-and-leaked-password-protection). Tidak ada data kelas/siswa produksi yang dimutasi untuk pengujian.

Hasil final: `npm run check` lulus (257 tes, 0 gagal, TypeScript, lint, tipe database dan build), 360 pemeriksaan browser Kelas/16 layar axe, serta 69 pemeriksaan browser lintas modul/8 layar axe. Audit deadcode tidak menemukan file source yang tidak terjangkau. Smoke HTTP juga lulus.
