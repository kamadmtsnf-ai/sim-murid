# Peningkatan modal dan feedback aplikasi

25 Oktober 2026 WIB. Baseline main `697e7b65b45664f023ab3698ec1af472d36fe614`; branch `feat/modal-feedback-experience`.

## Audit dan lingkup

Inventaris AST `docs/verification/modal-feedback/inventory.json`: 20 pemakaian Dialog, 72 pemanggilan confirmAction, 56 pemakaian Status (termasuk adapter bersama), dan 11 alur MutationFeedback. Sumber diperiksa pada komponen bersama, seluruh callsite modal, CSS per modul, hook mutasi, fokus/ref, navigation/unsaved guard dan feedback. Tidak ada alert/confirm/prompt native dalam source aplikasi; dialog beforeunload saat menutup tab tetap merupakan pengaman platform browser.

Temuan: closeDisabled sebelumnya hanya menonaktifkan X, belum memblok Escape pada komponen bersama; CSS 12 kelompok modal menggulirkan seluruh panel sehingga header/tombol tutup dapat keluar area; label tombol dapat melebar; feedback mutasi berupa kotak seragam sehingga sukses, validasi, akses terhenti dan hasil ambigu tidak mudah dibedakan. Ada penguji browser lama yang masih mengharapkan confirm native atau memeriksa fokus sebelum restorasi Radix selesai.

## Implementasi

- `components/ui/dialog.tsx`: satu permukaan modal, sudut/spasi/header/kontras konsisten, close44px, body scroll lokal dan overscroll contain, header deskripsi panjang dibatasi viewport. closeDisabled menolak penutupan dari X/Escape/Root, tanpa menghambat penutupan programatis setelah proses berhasil. Handler Escape khusus, returnFocusRef, trigger dan fokus Radix tetap didukung. Petunjuk tunggu ditampilkan saat penutupan terkunci. Drawer navigasi tetap mempertahankan geometri sendiri.
- `app/globals.css`: 12 override lama display:block/overflow-y:auto diganti flex/overflow:hidden agar body bersama menjadi area scroll. Tombol dan input dibatasi lebar serta label dapat membungkus. Reduced transparency/forced colors didukung; spinner hanya bergerak bila pengguna tidak memilih reduced motion.
- Callsite modal mutasi: closeDisabled memakai busy yang sudah ada. Modal baca (audit, pembaca PDF) dan navigasi tetap dapat ditutup tanpa menunggu proses mutasi yang tidak terkait. Tidak menambahkan timeout/simpan otomatis atau membuang draf.
- `components/ui/confirm-action.tsx`: ikon dan hierarki modern; opsi title/confirmLabel/cancelLabel/tone tambahan, default lama tetap kompatibel. Pembatalan menjadi keputusan aman; hanya persetujuan eksplisit menyelesaikan Promise true, tanpa antrean/replay. Pencabutan tugas memakai label `Cabut tugas`, judul spesifik dan warna destructive.
- `components/ui/status.tsx`: judul semantik berdasarkan tone yang dinyatakan caller, ikon+teks, opsi heading/hint, live region dan dukungan ref tetap. Tidak menebak keberhasilan dari teks, HTTP200 atau warna.
- `components/feedback/mutation-feedback.tsx`: presentasi dari phase existing: idle/info, pending, success, error, blocked, uncertain. Pesan domain dan kode laporan tetap ditampilkan. Uncertain memberi instruksi jangan kirim ulang, catat isian, periksa hasil; blocked mengarahkan pemeriksaan sesi/izin. Tidak mengubah state machine, penguncian, validasi, acknowledgement server, idempotensi atau API.
- Adapter diterapkan ke 11 alur kelas, jadwal, guru piket, absensi, bimbingan, komite, tabungan, poin, nilai, rapor dan kenaikan. Pembuatan/impor pengguna serta penugasan guru tetap memakai kontrak retry UUID mereka sendiri; instruksi retry aman tersebut tidak diganti dengan larangan generik.

## QA aktual

- npm ci, npm run check (suite lokal), TypeScript dan lint akhir, production build lulus. CI PR menjalankan ulang seluruh check pada commit final.
- Modal/feedback: 320,390,768,1440px; Escape diblok saat busy, close disabled, draft bertahan saat hasil ambigu, fokus kembali, konfirmasi cancel/accept tepat sekali, status blocked/error/pending/success/uncertain; empat scan axe bersih. Dua belas varian CSS pada320px memastikan posisi header stabil saat isi digulir dan tidak ada horizontal overflow.
- Regresi browser: confirm45checks/4axe, navigasi49/12, formulir50/4, tabungan48/6, penilaian62/7, buku50/8. Penugasan guru4viewport/4axe. Tidak ada error JavaScript pada laporan hasil lulus. Hasil disimpan di `docs/verification/modal-feedback/`.
- Hasil awal yang gagal ditelusuri: penguji lama tidak menangani popup Radix/terlalu dini menganggap modal tertutup saat konfirmasi aktif, menargetkan teks bantuan tersembunyi, atau berlomba dengan navigasi saat evaluate. Driver diperbarui untuk memilih aksi popup nyata, menunggu keputusan/restorasi fokus, dan menangani perpindahan konteks browser. Skenario bisnis tetap sama dan dijalankan ulang sampai lulus; hasil gagal tidak dianggap lulus.

## Batas dan kompatibilitas

Tidak mengubah backend/database, RBAC, ledger/nilai, SMTP/provider atau data akun nyata. Browser QA menggunakan komponen nyata dengan API terisolasi; bukan UAT produksi atau perangkat fisik. Scroll vertikal dalam modal memang diperlukan pada formulir panjang/layar pendek; tujuan tidak memotong konten, bukan memaksa semuanya muat satu layar. Tidak mengklaim semua copy aplikasi ditulis ulang atau semua skenario pengguna nyata telah diuji. Pesan khusus autentikasi/upload dan pemulihan existing tetap dipertahankan bila sudah memberi instruksi domain yang tepat.
