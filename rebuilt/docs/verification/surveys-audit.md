# Audit Halaman Survei — 23 Oktober 2026

Baseline `d9a1c432ef827255e0364777b693d36f61b1779c`; branch `fix/surveys-audit`.

## Analisis sebelum perubahan

Dibaca seluruh page/dispatcher/editor Survei, API services, server reader/validator, instrumen dan peer extras, spesifikasi M16, keputusan D03 dan akademik, MASTER design system, migrasi instrumen/responden, periode akademik, concurrent drafts, services read/write termasuk override singleton, tes services/database/production serta fixture akademik. Instrumen server dan aturan bisnis menjadi sumber kebenaran; tidak mengganti bank pertanyaan dengan contoh.

Alur: principal/sesi terverifikasi → services read → periode berizin dan responden milik caller. `start` membuat snapshot instrumen/rotasi/rekan; draft utama dan peer memakai revisi responden sendiri. Administrasi periode memakai revisi global. UUID replay tetap diselesaikan oleh RPC sebelum pemeriksaan revisi. `submit` utama Guru mensyaratkan peer final. Final tidak dapat ditulis ulang. Gate survei wajib tetap mengecualikan endpoint penyelesaian survei.

## Temuan dan perbaikan

| Temuan / sebab | Perbaikan |
| --- | --- |
| Ack autosave dapat menghapus ketikan/draft yang dibuat ketika request masih berjalan | Canonical draft dengan sequence terpisah; ack hanya membersihkan versi yang benar-benar dikirim; perubahan berikutnya diantrikan dengan revisi baru |
| Draft peer hanya berada di state, tidak ikut cache/recovery | Cache tervalidasi menyimpan jawaban utama dan peer, dirty flags dan revisi; cache lama utama tetap kompatibel |
| Pilihan kosong berubah menjadi angka 0 pada peer; Likert utama tidak dapat dikosongkan | Hapus key jawaban kosong, tidak melakukan `Number("")`; validasi tipe/rentang sesuai instrumen |
| Storage failure disembunyikan dan dapat menggagalkan penanganan save sukses | Feedback jujur; kegagalan cache tidak melempar ke alur commit server; server save tetap dapat digunakan |
| Timer autosave, klik manual/final dan reconnect dapat bertabrakan | Satu lock request, satu timer yang dibersihkan, queue autosave, guard unmount/logout, dan kunci input selama finalisasi |
| Response HTTP sukses tidak membuktikan versi/jawaban/final yang diinginkan | Ack dikenal + readback tervalidasi, cocok pemilik/periode/revisi/isi dan lock final; hasil ambigu memblokir retry buta |
| Payload default 64 KiB menolak jawaban esai valid yang panjang | Batas khusus Survei 4 MiB; tes payload 50 esai ×10.000 karakter dengan JSON escaped >3 MB; services lain tetap 64 KiB |
| `start` dapat mengirim `admin_note` meski read biasa sudah menyembunyikannya | Hapus catatan admin dari acknowledgement ke pengguna |
| Pengelola ditawarkan tombol responden di luar target perannya | Resolusi role dari baris database caller terverifikasi; backend tetap mengotorisasi setiap command |
| Form panjang sulit dinavigasi, status/kode internal kurang jelas | Sepuluh pertanyaan per halaman, progress wajib, fokus pertanyaan belum lengkap, status berbahasa pengguna, kartu periode dan empty state |
| Tidak tersedia review nyaman untuk periode ditutup/final | Tampilan jawaban read-only; rencana tindak lanjut tetap tersedia; tidak membuka kembali arsip |
| Kegagalan load awal menjadi halaman buntu | Memakai retry error boundary akun existing |
| Pembersihan draft logout hanya aktif ketika editor terpasang | Helper logout pada shell semua modul; request yang masih berjalan tidak membuat ulang cache sesudah logout |
| Tombol/spacing nested form sempit di ponsel | Kontrol 44px, teks/tombol wrap, padding mobile khusus Survei; gulir vertikal normal |

## Berkas dan alasan

- `src/app/account/services/[module]/survey-form.tsx`: formulir periode, keterkaitan tahun ajaran/semester, target, mikro, daftar periode, buka/tutup/review dan guard draft. Tahun ajaran tetap pasangan dan ordinal semester tetap 1/2.
- `survey-editor.tsx`: state draft, autosave/reconnect/recovery, main/peer final, progress, pagination pertanyaan dan aksesibilitas.
- `surveys-panel.tsx`: koordinasi request, timeout/abort, confirmed result, reload dan feedback; terpisah dari modul services lainnya.
- `panel.tsx`, `page.tsx`: dispatcher Survei dan retry boundary; alur modul lain dipertahankan.
- `src/lib/services/surveys.ts`: schema snapshot/cache serta pemeriksaan jawaban terhadap instrumen/rekan.
- `src/lib/services/server.ts`: validasi upstream/pemilik dan role responden pengelola melalui `user_roles` caller sendiri.
- `src/app/api/services/[module]/route.ts`: batas body Survei, ack/readback terverifikasi dan penyaringan catatan privat; `result`/`message` tetap tersedia, `code`/`data` ditambahkan.
- `src/lib/services/survey-storage.ts`, `src/components/workspace-shell.tsx`: pembersihan hanya cache Survei pada logout eksplisit dari seluruh halaman.
- `src/app/globals.css`: styling terbatas `.survey-*`/`.surveys-panel`, progress dan padding mobile.
- `tests/surveys.test.mjs`: 17 pengujian actual route/page/reader/validator dengan boundary Auth/SDK sintetis; termasuk body budget dan privasi.
- `scripts/verify-surveys.mjs`, `tests/ui/surveys-fixture.tsx`, `surveys-navigation-shim.ts`: actual panel/editor/shell dengan HTTP/records sintetis; fixture server mempertahankan revisi lintas reload.
- `package.json`: tes Survei masuk `check`; tidak menambah dependency aplikasi atau mengubah lockfile.
- MASTER dan JSON verifikasi: keputusan desain, hasil terukur dan batas bukti.

## Verifikasi

- `npm ci`: selesai menggunakan lockfile existing.
- `npm run check`: 435 tes /49 runner groups lulus, mencakup 17 tes Survei, seluruh regresi domain/database, TypeScript, lint, tipe 14 tabel, production build.
- Typecheck dan lint diulang setelah fixture browser dibuat dan lulus.
- `npm run test:academic:browser`: 41 checks /6 axe runs lulus. Tahun ajaran 2026/2027, Ganjil/Genap, pembatasan tanggal survei dan perubahan tahun tetap konsisten.
- `npm run test:surveys:browser`: 57 checks /6 axe runs lulus, tanpa JavaScript page errors atau violation axe pada skenario yang diuji. Hasil final browser Survei: `surveys/browser-results.json`. Viewport 320/768/1440 dan resize landscape 740×360; autosave race/queue, recovery main/peer, offline/reconnect, storage failure, empty/large/closed, create/close/mikro, required/focus, final locks, stale/malformed/timeout, reload dan logout.
- `npm run audit:deadcode`: 129 entry,190 source files, `unreachable: []`; metadata kebijakan tetap dipertahankan.
- Screenshot desktop/mobile ditinjau secara visual; bukti sukses JSON disimpan, screenshot/diagnostic tidak dimasukkan ke source.

## Kompatibilitas dan batas bukti

Tidak mengubah schema/migrasi, autentikasi, database, struktur instrumen/rotasi/rekan, D03, kalkulasi kualitas, mandatory gate, final-lock, kontrak command maupun UUID replay. Readback memakai sesi server yang sama; role UI bukan pengganti otorisasi RPC. Hasil survei/AI tetap pada modul existing dan tidak diubah. Tidak membuat route login atau data produksi palsu.

Browser memakai Auth/HTTP sintetis dan menjalankan komponen asli; tes database menjalankan migrasi nyata di PGlite. Tidak dilakukan pengiriman jawaban/periode terautentikasi di produksi, pengujian perangkat fisik, atau screen reader manual. Tidak mengklaim sertifikasi WCAG menyeluruh atau seluruh kondisi bebas bug. Gulir vertikal untuk formulir panjang diperlukan; targetnya tidak ada overflow horizontal halaman/kontrol terpotong pada viewport yang diuji. Cache dengan revisi berbeda dipertahankan tetapi tidak diterapkan otomatis agar tidak menimpa jawaban server.
