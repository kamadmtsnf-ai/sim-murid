# P03 — Konteks akademik lintas halaman

Tanggal: 24 Oktober 2026 (WIB). Baseline main `f83e4cdd216be4c7da6c56a517210a7bad4505f0`. Branch `feat/academic-context-p03`.

PR implementasi: [#47](https://github.com/kamadmtsnf-ai/sim-murid/pull/47).

Status: implementasi dan verifikasi P03 selesai; preferensi diterapkan secara eksplisit pada modul yang sesuai.

## Analisis sebelum perubahan

Dibaca roadmap/P01/P02, keputusan ACADEMIC-1.0 dan D01–D03/D10, helper periode, shell/layout, panel/filter Kelas, Jadwal, Penilaian, Rapor, Absensi, Bimbingan, Poin, Kenaikan, Survei/Hasil Survei, kontrak snapshot serta API profile/read dan tes akademik terkait. Periode antarhalaman berbeda semantik; satu query global tidak boleh ditempelkan ke semua endpoint.

| Area | Semantik existing | Keputusan P03 |
|---|---|---|
| Kelas dan siswa | Tahun ajaran UUID dan roster kelas | Dapat mengingat dan menerapkan tahun/kelas; penempatan yang belum disimpan tetap meminta konfirmasi. |
| Jadwal KBM/Piket | Tahun ajaran UUID, kelas, hari dan personal; tidak ada filter semester | Tahun/kelas dapat ditransfer; hari/personal/tab dipertahankan. Semester diingat untuk lintas halaman dan dinyatakan tidak menyaring jadwal. |
| Penilaian dan KKM | Tahun dari kelas, semester, mapel dan siswa | Transfer kelas/semester hanya ke kelas dalam katalog baca. Mapel/siswa dependen dibersihkan; input modal memblokir pergantian konteks. |
| Rapor | Tahun dari kelas, semester dan pilihan publikasi | Transfer kelas/semester lewat GET tervalidasi; pilihan rapor meminta konfirmasi sebelum dibuang. |
| Absensi, piket guru, bimbingan, poin | Tanggal/rentang/tahun kalender operasional | Tidak diganti menjadi tahun ajaran atau disaring oleh preferensi akademik. |
| Iuran, tabungan, buku, biodata, dokumen | Bulan/tanggal transaksi, tahun terbit/lulus dan tanggal pribadi | Tidak diubah. Preferensi bukan payload transaksi. |
| Survei/Hasil Survei | ID periode, instrumen, target dan tanggal resmi; satu semester bisa memiliki beberapa survei | Tetap memilih periode eksplisit. Preferensi tidak memilih satu periode secara ambigu atau memindahkan draf/jawaban/rencana aksi. |
| Kenaikan/ijazah | Dua tahun asal/tujuan dan tahun lulus | Pemetaan asal/tujuan tetap eksplisit; preferensi tunggal tidak otomatis mengubah dua sisi kenaikan. |

## Kontrak konteks

Pilihan tersimpan **berbeda dari filter yang sedang diterapkan**. Topbar menampilkan pilihan akademik tersimpan. Empat halaman akademik mempunyai disclosure konteks: ringkasan tahun/semester/kelas yang benar-benar diterapkan, tombol Ingat pilihan halaman, Terapkan pilihan tersimpan, dan Hapus pilihan tersimpan.

- Tidak ada auto-apply saat mount, reload, Back, storage event atau tab lain berubah. Pengguna menerapkan pilihan secara eksplisit; keadaan halaman lama tetap otoritatif sampai pembacaan baru terkonfirmasi. Ini mencegah formulir aktif berpindah periode tanpa tindakan pengguna.
- Preferensi versi 1 berisi tahun awal internal, ordinal semester 1/2 dan UUID kelas atau null. Label selalu pasangan `Y/Y+1` dan Ganjil/Genap lewat helper existing.
- Tahun/kelas diperiksa terhadap katalog snapshot halaman yang sudah tunduk sesi dan izin. Tahun/kelas yang hilang atau tidak cocok menonaktifkan transfer; tidak fallback ke semua kelas. Nilai storage tidak memberi capability atau digunakan sebagai actor.
- Halaman Nilai/Rapor memerlukan kelas; preferensi tanpa kelas tidak diperlebar. Kelas/schedule dapat menyimpan tahun tanpa kelas karena memang memiliki tampilan semua kelas sesuai izin.
- Semester halaman yang tidak memiliki semester hanya untuk preferensi lintas halaman, dengan label tersendiri. Saran awal berasal tanggal WIB yang dirender server; bukan jam browser untuk otorisasi atau tanggal penulisan. Tanggal historis dan semester di formulir tetap mengikuti helper existing.
- Kunci storage dipisah berdasarkan username persis, termasuk case, nol awal dan minus. Provider di-remount saat identitas berubah. Payload malformed, versi tak dikenal, atribut tambahan dan ukuran lebih dari 2048 karakter ditolak.
- Storage event memperbarui pilihan tersimpan, bukan filter/draf. Bila storage gagal, ada fallback memori dengan pesan batas persistensi. Logout menghapus preferensi akun terkait tanpa menghapus preferensi lain.

## Perubahan dan alasan

| File | Perubahan |
|---|---|
| `src/lib/academic/context.ts` | Kontrak/parse preferensi, label dan pemeriksaan tahun/kelas; pure helper untuk tes. |
| `src/components/academic/academic-context.tsx` | Provider useSyncExternalStore, sinkronisasi tab dan memori, ringkasan dan transfer eksplisit; memakai komponen P02. |
| `src/components/workspace-shell.tsx` | Membungkus akun berdasarkan identitas, menampilkan pilihan dan menghapus preferensi saat logout. |
| `src/app/account/layout.tsx` | Mengirim tanggal WIB server sebagai saran semester UI. Tidak menambah query database atau mengubah sesi. |
| `src/app/account/classes/class-panel.tsx` | Adapter tahun/roster dengan guard penempatan dan modal. |
| `src/app/account/schedules/schedule-panel.tsx` | Adapter URL filter tahun/kelas memakai router existing; hari/tab/personal tetap. |
| `src/app/account/learning/[module]/grades-panel.tsx` | Adapter scope, konfirmasi respons GET dan remount filter setelah sukses sehingga kontrol tidak menunjukkan kelas/mapel lama. |
| `src/app/account/learning/[module]/reports-panel.tsx` | Adapter load eksplisit, echo scope tervalidasi, kontrol mengikuti respons, konfirmasi pilihan sebelum pindah. |
| `src/app/globals.css` | Wrapping disclosure/topbar tanpa menyembunyikan konten. |
| `tests/academic-context.test.ts`, fixture/shim dan `scripts/verify-academic-context.mjs` | Storage tak tepercaya, catalog mismatch, akun berbeda, pergantian halaman nyata, konflik/error, storage tab dan fallback. |
| `package.json` | Tes kontrak masuk test:academic; perintah browser tambahan. Tidak ada dependency/lockfile berubah. |
| Roadmap, MASTER dan bukti P03 | Status, batas semantik dan prosedur melanjutkan sesi. |

Tidak ada perubahan database/migration/RLS, API contract, actor, logika nilai/fee/survei/arsip. Query transfer hanya GET atau navigasi filter pada halaman sama, tidak menyimpan data domain. Identitas dan izin server tetap sumber kebenaran.

## Penerimaan dan batas bukti

Wajib menguji pasangan tahun/semester termasuk Juli/Januari, periode historis, kelas tidak tersedia, reload dan perubahan tab, dua akun, storage rusak/tidak tersedia, respons gagal/tidak sesuai, isian dan modal, serta 320/390/768/1440 px dan keyboard/touch/landscape pada regresi panel.

Tes browser menggunakan komponen aplikasi nyata dan HTTP/data sintetis, bukan akun produksi. Katalog snapshot dapat berubah setelah halaman dimuat; server tetap memeriksa setiap GET/POST. Transfer yang ditolak tidak memberikan izin baru. UAT produksi/perangkat fisik/restore/load bukan bagian klaim P03.

Hasil aktual dan batas pengujian dicatat di `../verification/academic-context/`. Tahap berikutnya P04: keandalan formulir dan penyimpanan; tidak menggeneralisasi hook mutasi dalam P03.

## Hasil aktual

- `npm ci`, TypeScript, lint, 546 tes / 62 kelompok runner dan drift tipe lulus. Rangkaian check dieksekusi per perintah. Mock loader Jadwal diperbarui agar menyediakan import router; pengujian browser Nilai diarahkan ke disclosure nilai, bukan disclosure konteks baru.
- Build awal dan build bersih final lulus. Build incremental sempat gagal membuka cache persistence Turbopack; cache lokal dipindahkan dan build bersih berhasil. Ini bukan kegagalan database aplikasi.
- Browser final: konteks 45 cek / 8 axe; Kelas 393 / 16; Jadwal 145 / 14; Nilai 61 / 7; Rapor 62 / 7. Total 706 pemeriksaan dan 52 audit axe lulus. Tidak ditemukan JavaScript pageerror atau overflow horizontal pada skenario final. Screenshot desktop/mobile diperiksa.
- Konteks memeriksa tanggal Januari/Juli, Ganjil lintas pergantian kalender, Genap historis, transfer antarmodul dan URL Jadwal, Back/reload, pembatalan isian, respons salah/gagal, kelas hilang, akun berbeda, perubahan tab, storage rusak/tidak tersedia dan layout landscape.
- Bukti ringkas ada di checks.json serta hasil browser per suite pada direktori verifikasi P03. Hasil gagal pada percobaan awal tidak dihitung sebagai hasil release.
