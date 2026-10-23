# Audit Kenaikan dan ijazah — 23 Oktober 2026

## A. Temuan dan analisis

Dibaca sebelum perubahan: semua blok promotions pada LearningPanel serta filter/submit/load/upload/delete; LearningPage/API learning/server/validation; asset prepare/finalize/delete dan endpoint preview/download; Dialog, domain controls dan confirmed mutation; M12/M13, kebijakan disepakati/ACADEMIC-1.0; SQL promotion/enrollment/history/diplomas/assets/access/cleanup, learning read/write dan override singleton terbaru. Caller tetap verified principal/session → onboarding/survey gate → scoped RPC → UI. Write tetap UUID/revision → validasi atomik SQL → role/enrollment/piket/mentor/history/diploma → authoritative readback.

1. **Bug API kritis:** `commands.promotions` memakai discriminatedUnion `type` dengan dua opsi `access` (global dan individual). Zod melempar `Duplicate discriminator value "access"` pada runtime; seluruh varian perintah promotions dapat gagal sebelum RPC. Tes lama learning hanya mengetes DTO grades dan SQL langsung, sehingga tidak menangkap jalur API ini.
2. Form pemetaan tidak menyaring kelas tujuan menurut tahun/jenjang, dan opsi kosong awal berarti Alumni/lulus. Source year dapat tidak sesuai kelas asal yang diambil dari filter. Pilihan harus eksplisit, pratinjau harus menjaga seluruh target lintas pagination, dan server perlu menolak kesalahan scope pada revision fresh.
3. Form metadata memakai defaultValues dari `edit`, tetapi dropdown alumni tidak mengubah `edit`/metadata. Mengganti target alumni bisa mengirim nilai kosong atau metadata alumni sebelumnya ke target baru.
4. Akses global dan individual bercampur dalam satu form; override awal deny dapat menyamarkan dampak perubahan. Perlu prefill global, pemisahan scope, pilihan policy eksplisit dan konfirmasi target.
5. Read/write/upload/delete tidak memakai lock bersama; delete tidak memiliki catch/confirmation/disabled guard; acknowledgement malformed/unknown dan gagal readback belum dipisahkan dari gagal input. Route delete hanya memeriksa error SDK tanpa memverifikasi code hasil RPC sebelum menghapus Storage.
6. Daftar panjang, filename/nama/metadata panjang, formulir 13 field dan pratinjau batch membutuhkan wrapping, pagination, fokus dan scroll modal terbatas viewport. Empty/loading/error states belum konsisten.

## B. Perbaikan

- Union biasa dengan bentuk perintah lama yang sama menggantikan discriminator bentrok. ID target akses individual harus unik (maksimal500). Semua varian diuji lewat parser dan actual route.
- PromotionsPanel khusus menggantikan cabang lama tanpa duplikasi. Tab Kenaikan & penempatan / Alumni & dokumen / Akses ijazah, keyboard navigation, controlled state dan dirty guard. Read-only hanya dokumen sesuai capability backend. Filter nama dan pagination20; mapping/pilihan akses tetap utuh lintas halaman/pencarian.
- Source year membatasi siswa ke enrollment aktif tahun tersebut; calon/alumni tanpa enrollment tetap tersedia pada operasi yang sesuai. Tahun tujuan promote harus tepat tahun berikutnya; kelas aktif disaring tahun dan jenjang. Placeholder tujuan bukan Alumni; kelulusan menjadi pilihan eksplisit. Manual placement/restoration tetap didukung.
- mappingError dipakai UI dan API sebagai preflight pada revision fresh. Stale revision tetap diteruskan ke SQL agar pengecekan replay UUID terjadi sebelum revision check, mempertahankan idempotency existing. Backend tetap final authority. Konfirmasi menampilkan target/tahun/alasan dan menjelaskan efek enrollment/piket/bimbingan.
- Success hanya setelah known acknowledgement, revision lebih baru dan readback cocok terhadap kelas/role, seluruh field metadata, atau policy global/individual. API mempertahankan result/message dengan code/data tambahan. Unknown/network/malformed/timeout/readback failures memblokir blind retry dan meminta reload.
- Metadata modal dibuka dari satu alumni dan seluruh13 field dihidrasi dari alumni itu; field tetap string kompatibel termasuk tanggal/tahun lulus legacy. Tidak mengubah tahun kalender lulus menjadi tahun ajaran. Nilai0 tidak dianggap kosong. Dirty cancel mempertahankan draft bila pengguna menolak membuang.
- Form akses hanya menampilkan scope relevan. Izin lihat/unduh terpisah; global memakai nilai existing; individual wajib memilih allow/deny/inherit; deny default alumni baru dan aturan effective access tidak diubah.
- Upload modal memvalidasi metadata file sebelum prepare, memeriksa path target/token, upload signed URL, finalize dan readback assetID/slot. File lama tetap berlaku sampai validasi pengganti berhasil. Delete confirmation dan readback memastikan asset tidak lagi terlihat. API menambahkan saved/id/action dan memverifikasi RPC delete ack; cleanup/replacement/TTL existing tetap.
- Lock sinkron bersama untuk read/mutation/upload/delete/download; timeout dan unmount cleanup; unduhan blob dengan feedback/revoke URL, preview native tetap melalui endpoint berizin dan tab baru. Modal scroll penuh, focus trap/return, acknowledgement, controls44px, wrapping nama/filename/metadata dan scroll daftar bertarget keyboard.

Tidak ada migrasi, perubahan DB produksi, auth/RBAC/RLS, rule kenaikan, history, saldo/iuran/nilai/arsip, mekanisme cleanup atau kontrak RPC. SQL existing tetap menutup enrollment dan mencabut penugasan aktif sesuai alur sebelumnya; arsip tidak dihapus. File type/size/content inspection, slot IJAZAH/TRANSKRIP/SKL dan view/download authorization tetap.

## C. File final

| File | Perubahan |
| --- | --- |
| src/lib/learning/validation.ts | Perbaiki union runtime dan ID target akses unik |
| src/lib/learning/promotions.ts | DTO, scope/jenjang, metadata hydration dan readback verification |
| src/app/account/learning/[module]/promotions-panel.tsx | Tab, controlled forms, mapping, metadata/access/asset modal, feedback dan guards |
| src/app/account/learning/[module]/panel.tsx | Dispatcher dan hapus cabang promotions lama |
| src/app/account/learning/[module]/page.tsx | Retry boundary promotions |
| src/lib/learning/server.ts | Validasi upstream DTO, safe unavailable error |
| src/app/api/learning/[module]/route.ts | Fresh preflight, idempotent replay preservation, confirmed ack/readback |
| src/app/api/learning/assets/route.ts | Delete ack dan additive typed finalize/delete response |
| src/app/globals.css | Scoped wrapping/touch/dialog |
| tests/promotions.test.mjs | Actual API/page/server/schema/assets/content inspection/permissions |
| tests/ui/promotions* + scripts/verify-promotions.mjs | Actual component/shell; synthetic Auth/HTTP/Storage boundaries |
| tests/ui/academic-fixture.tsx | Metadata/levels sesuai DTO promotions |
| package.json | Test scripts dan check integration |
| docs/design-system/MASTER.md + docs/verification/promotions* | Pedoman/audit/bukti QA |

## D. Validasi dan batas

Tahap tes `npm run check` lulus **405/405 tes / 47 kelompok runner**, beserta typecheck, lint dan generated types14 tabel hasil replay. Build awal berhenti karena cache Turbopack lokal rusak (`invalid digit found in string`), bukan error kode. Cache generated dibersihkan; production build berikutnya lulus. Typecheck/lint/build dijalankan ulang pada sumber final setelah penyempurnaan browser. Suite promotions17, grades16 dan reports19 juga diulang setelah penyesuaian preflight agar replay UUID tetap kompatibel; semuanya lulus. Audit source graph tidak menemukan unreachable source; diff check lulus.

Browser final lulus **104 pemeriksaan / 13 axe runs**. Regresi periode akademik lulus **41 pemeriksaan / 6 axe runs**, termasuk promotions, grades, reports dan modul akademik lain. Tidak ada violation, uncaught JavaScript error atau horizontal page overflow pada skenario teruji. Viewport320×740,768×1024,1440×900, landscape740×320; metadata/confirmation footer terjangkau; focus trap/return/Escape, ArrowLeft/Right tab, checkbox touch, metadata details keyboard expansion, dirty cancel preserve/discard, identitas metadata alumni berbeda, explicit graduation dan filtered year/level/archive; mapping pagination20/pencarian; pagination kembali ke halaman1 setelah data menyusut pada readback/reload; alumni kosong/70 records/read-only; akses global/individual terpisah; file invalid sebelum network, prepare→signed Storage→finalize→readback, replacement slot, download success/denied, delete ack/readback, loading/failed read retains snapshot, doubleclick satu mutation, network/malformed/stale/uncertain delete dan timeout30detik memblokir retry. Screenshot desktop/mobile final diperiksa visual. Ringkasan nomor ijazah/tahun lulus/rata-rata ditampilkan terlebih dahulu;10 field lainnya tetap tersedia melalui details native untuk mengurangi panjang kartu mobile.

Tes actual route mencakup semua bentuk DTO legacy (termasuk bug duplicate discriminator), scope source/target, stale dan replay, compare readback role/class/metadata/policy, schema invalid, auth/origin/survey/role, signed path, delete ack, inspeksi PDF valid/rusak actual dan endpoint view/download no-store/nosniff. Integrasi DB existing memverifikasi batch atomic, jenjang/kelulusan, riwayat, tabungan/arsip tetap, default deny, global/override terpisah, tiga slot, replacement race, pending denied, restore alumni dan penolakan akses setelah role berubah.

Bukti: promotions/check-results.json, browser-results.json, academic-regression/browser-results.json. Preview dokumen tetap native dan otorisasi ulang di server; verifikasi otomatis memeriksa endpoint dan capability, bukan interaksi setiap PDF viewer bawaan browser. Tidak ada kenaikan siswa, kelulusan, perubahan akses, upload/delete dokumen atau mutasi data produksi selama QA. Browser memakai komponen nyata dengan HTTP/Storage/Auth sintetis; SQL integration memakai migrasi aktual pada PGlite. Katalog backend existing maksimal2000 people; perintah maksimal500 target. Multi-year active enrollments tetap didukung melalui identitas siswa+kelas; duplicate identity yang sama ditolak, tidak dipotong diam-diam. Preview native tetap mengecek akses ulang di API. Tidak mengklaim seluruh skenario produksi, perangkat fisik atau manual screen reader telah diuji. Gulir vertikal konten/modal panjang adalah perilaku normal; tidak menyembunyikan overflow global.
