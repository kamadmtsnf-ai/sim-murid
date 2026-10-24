# P05 — Navigasi dan UI/UX antarmodul

Tanggal 24 Oktober 2026 WIB. Baseline main `a0b8ec07b9d7bbb8af5ddd6acc59161dbfb997cc`. Identitas teal/Plass, stack dan aturan bisnis D01–D03/ACADEMIC-1.0 dipertahankan; D10 tetap terbuka. Tidak mengubah API, auth, RLS, database, ledger atau aturan finalisasi.

## Pelaksanaan per kelompok

| Kelompok | Cakupan | Status |
|---|---|---|
| A | Sidebar, pencarian, keyboard/mobile dan adapter formulir bersama | Selesai; [PR #49](https://github.com/kamadmtsnf-ai/sim-murid/pull/49), merged |
| B | Kelas/jadwal dan operasional siswa: filter, pagination, empty/loading/error | Selesai; [PR #50](https://github.com/kamadmtsnf-ai/sim-murid/pull/50), merged |
| C | Akademik/evaluasi: pagination dan konsistensi state presentasi | Implementasi dan verifikasi; PR terakhir sedang disiapkan |

Setiap kelompok dirilis melalui PR dan regresi tersendiri, sesuai B04/P05. Ringkasan hasil bukan UAT pengguna produksi; batas pengujian dicatat pada bukti verifikasi.

## A — Analisis, keputusan dan perubahan

Sidebar sudah scoped oleh `navigationFor`, dialog Radix sudah mengelola fokus dan P04 sudah menjaga dirty/pending. Ketiganya dipertahankan. Pencarian sebelumnya hanya substring judul/deskripsi: istilah tugas seperti KBM atau Guru Wali sulit ditemukan dan tidak ada pemulihan pencarian kosong selain menghapus teks manual. Kontrol domain masih menggunakan style terpisah dari Field pilot P02.

- Pencarian memakai seluruh kata, normalisasi whitespace/case/diakritik, nama kelompok dan alias tugas. Input pencarian hanya memfilter menu yang sudah diizinkan; tidak menambah capability atau link baru.
- Tombol Hapus pencarian menu mengembalikan fokus ke input; jumlah hasil dan empty state tersedia. Label input terpisah dari tombol agar accessible name tetap stabil setelah tombol muncul.
- Escape pertama pada pencarian mobile menghapus query, Escape berikutnya menutup drawer. Hook Escape opsional pada Dialog tidak mengubah dialog domain lain. Tautan yang dibatalkan guard P04 tidak menutup menu atau menghapus query.
- Menu aktif ditampilkan di dalam region gulir sidebar/drawer ketika terbuka atau query dibersihkan; tidak menggulir halaman utama. Drawer tetap menutup pada breakpoint desktop.
- Adapter TextField/SelectField memakai Field dan token kontrol P02. ID memakai useId; name/defaultValue/required/type/maxLength dan FormData tetap. Tidak mengubah controlled/uncontrolled behavior atau payload domain.
- Heading utama membungkus teks panjang dengan ukuran responsif; kontrol disabled/invalid mengikuti token semantik. Tidak menambah tombol perpindahan halaman pada konten.
- Regresi menemukan dua mock context GET lama membaca body POST setelah perubahan tes P04. Cabang GET stale dikembalikan ke simulasi increment revisi; cabang POST tetap memakai request revision + 1. Ini perbaikan harness, bukan perubahan logika aplikasi.

File A: `src/config/account-navigation.ts`, `src/components/workspace-shell.tsx`, `src/components/ui/dialog.tsx`, `src/components/domain-controls.tsx`, `src/app/globals.css`, `tests/ui.test.ts`, `tests/ui/navigation-fixture.tsx`, `scripts/verify-navigation.mjs`, perbaikan mock `verify-{committee,grades}.mjs`, package serta dokumentasi P05.

## Verifikasi dan batas

Lihat `../verification/navigation/` untuk hasil aktual dan total per kelompok. Browser menggunakan komponen asli, HTTP sintetis dan CSS produksi. Peran menu mencakup admin, teacher, student, parent, alumni, customer dan applicant; otorisasi server tetap diuji suite existing, bukan disimpulkan dari sidebar. Tidak mengirim email/AI berbayar atau memodifikasi data produksi. Gulir vertikal normal dan gulir lokal tabel tetap diperbolehkan. Batas guard browser Back SPA/pemulihan crash P04 tidak diubah P05.

Hasil A: npm ci, check lengkap (549 tes/63 kelompok), lint release dan build produksi berhasil. Browser 2310 pemeriksaan/234 axe pada 29 suite berhasil. Screenshot drawer 320/390/768, landscape/keyboard pendek diperiksa.

## B — Kelas/jadwal dan operasional

Filter kelas/jadwal dan form filter absensi/bimbingan/iuran/tabungan memakai FilterBar dengan handler, FormData, required/disabled dan parameter lama tetap. Pagination absensi, bimbingan, iuran dan mutasi memakai Pagination P02; nama tombol khusus Riwayat tetap tersedia lewat prop kompatibel. Fetch/total/pageSize/filter dan scope tetap di caller. Piket guru tetap tautan GET dengan query lama, diberi nav bernama, rel prev/next dan target sentuh; tidak diganti fetch client.

EmptyState operasional mempertahankan penjelasan domain dan scope. Loading Kelas/Jadwal memakai LoadingState; operasi mempunyai loading/error boundary lokal yang memakai komponen existing dan tidak mengungkap error internal. Tombol Coba kembali memanggil reset bawaan Next. Padding operasi mobile 16px dan desktop 24px; TableRegion existing tetap menggulir lokal tanpa menghilangkan kolom.

File B: collection-controls (prop label/summary additive), kelas/jadwal panel dan loading, lima panel operasi, operations page/loading/error, CSS tautan pagination, fixture/module-state browser dan perluasan 390px pada tujuh suite. Tidak mengubah request/API/SQL/state simpan.

Hasil B: 77 tes terkait/7 kelompok, TypeScript/lint/build lulus; 1174 cek browser/92 axe pada 9 suite lulus, termasuk 16 pemeriksaan state loading/error pada empat viewport.

## C — Akademik dan evaluasi

Pagination katalog Buku, riwayat Nilai, Rapor, Kenaikan/Ijazah, Poin, responden Hasil Survei, Notifikasi dan antrean Pekerjaan memakai satu Pagination. Label domain/total, halaman/ukuran dan callback domain dipertahankan. Notifikasi tetap mengembalikan fokus hasil; katalog Buku tetap fetch scoped dan mempertahankan data bila baca gagal. Teks halaman kini konsisten “Halaman x dari y”; selector katalog tes diperbarui tanpa melonggarkan pembuktian page/scope atau recovery.

Alur batch siswa Nilai, langkah pertanyaan/autosave/final Survei dan kontrol halaman/zoom PDF tetap khusus karena memiliki state dan side effect berbeda. Tidak mengganti ke pagination generik secara membabi buta. TableRegion existing menjaga seluruh kolom bisnis dan gulir lokal; tidak menyembunyikan data pada mobile.

Route Akademik dan Layanan mempunyai LoadingState/error boundary sendiri yang menggunakan komponen existing; judul konteks tetap pada breadcrumb dan error tidak mengekspos detail internal. Padding halaman menyesuaikan viewport. Kondisi empty/error/success/pending domain, RBAC, validasi, provider, final lock, arsip dan rumus tidak berubah.

File C: delapan panel pagination, learning/services page/loading/error, fixture state, penambahan viewport390 dan selector katalog pada skrip terkait. Tidak ada perubahan API/SQL/dependency/framework.

### Matriks adopsi dan yang dipertahankan

| Kelompok | Adopsi P05 | Yang tetap khusus |
|---|---|---|
| Akun/pengguna | Navigasi scoped, pencarian/fokus, Field adapter, heading/mobile | Validasi/security/OTP/provisioning/sesi/dokumen dan guard P04 |
| Kelas/jadwal | FilterBar, Field, LoadingState | Parameter tahun ajaran UUID, tab KBM/Piket, placement/dirty/modal |
| Operasional | FilterBar, Pagination/tautan GET, EmptyState, Loading/error | Tanggal kalender, scope penugasan, audit koreksi, ledger/fee/readback |
| Nilai/Rapor/Kelulusan/Buku | Pager koleksi, kontrol bersama, padding/state route | Batch nilai, arsip/D10, terbit snapshot, PDF dan private storage |
| Evaluasi/notifikasi/admin | Pager koleksi, state route, adapter Field | Survei autosave/final, rencana/AI, jobs/recovery dan filter khusus |

Standar tabel, dialog, status, token dan fokus yang sudah layak tetap dipakai. Tidak semua kontrol khusus dipaksa menggunakan satu wrapper; kesetaraan perilaku dan aksesibilitas lebih penting daripada jumlah komponen yang diganti. P06 berikutnya adalah Beranda sesuai peran, belum dikerjakan.

Hasil browser C: 1165 pemeriksaan/176 axe pada 17 suite lulus. Tambahan regresi Direktori, Detail pengguna, Dashboard, konteks akademik, guard formulir, Survei dan design system tetap lulus.

Pemeriksaan akhir kelompok C: `npm run check` selesai exit 0, 549 tes/63 kelompok tanpa gagal, termasuk TypeScript/lint, SQL terisolasi, drift tipe dan production build. Lint release juga exit 0. Tes awal Buku masih mengharapkan teks slash; kedua assertion katalog diubah ke region Halaman katalog dan “Halaman 2 dari 3”, kemudian seluruh 50 cek Buku lulus. Percobaan awal B memakai path CSS yang belum tersedia; suite diulang dengan CSS produksi yang telah dibangun. Jumlah per kelompok mencakup regresi berulang, bukan jumlah skenario unik seluruh tahap.
