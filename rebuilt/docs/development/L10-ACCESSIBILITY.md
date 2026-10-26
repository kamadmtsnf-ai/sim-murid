# L10 — Konsolidasi aksesibilitas

Tanggal: 26 Oktober 2026, Asia/Jakarta. Baseline main: `59ee00ca94191cf0d42e3406632242137a3bbc38` (PR84/L09). Branch: `feat/l10-accessibility`.

Status: implementasi dan verifikasi otomatis; bukti rilis CI/merge/exact Production SHA dicatat pada PR. Target WCAG2.2AA, bukan sertifikasi kepatuhan penuh. Penerimaan pembaca layar oleh manusia/perangkat nyata tetap terbuka.

## Temuan dan perbaikan

| Temuan | Penyebab | Perubahan |
|---|---|---|
|15 target skip link belum menerima fokus pada11 berkas | Landmark main memiliki id tetapi tidak tabindex negatif | tabIndex=-1 pada target yang hilang; tidak menambah Tab stop normal |
| Fokus tombol berisiko hilang pada forced-colors | Button menghilangkan outline dan mengandalkan shadow/ring transparan | Outline solid2px ketika focus-visible; ring tetap dipertahankan |
| Varian kecil terutama ikon belum44×44px | Ukuran24/32px dan aturan ds-actions/dialog menimpa min-width | Target produk44px untuk varian kecil; min-width kelompok aksi dibatasi ruang tersedia. Ini bukan klaim44px adalah minimum AA universal |
| Kata panjang melebar/ruang baca menyempit saat teks diperbesar | Judul/label satu baris dan gutter/ikon ikut membesar | Wrapping judul/tombol, fieldset dapat menyusut; gutter Card/Status dan ikon feedback tetap pada ukuran normal ketika teks diperbesar |
| Login: padding textbox terlalu besar pada teks400% | Ruang toggle password3,5rem membesar sedangkan tombol tetap44px | Gutter60px sesuai tombol, tanpa mengubah show/hide, isian atau autentikasi |
| Seluruh halaman Login melebar sampai399px pada viewport320px | Summary panduan PWA di luar main, kata panjang dan gutter/list indent berbasis rem | Wrap anywhere dan gutter16/24/12px serta indent20px yang tidak membesar bersama teks; panduan tertutup dan terbuka diuji400% |

Tambahan temuan: pada browser tanpa JavaScript, streaming dapat menahan tampilan loading sehingga petunjuk di halaman akhir tidak terlihat. Petunjuk noscript dan style penyembunyi form dipindahkan ke LoginShell yang digunakan loading dan halaman akhir; unit test memeriksa keduanya. Native POST diuji secara programatik dari konteks tanpa JavaScript, bukan klaim bahwa Login dapat digunakan tanpa JavaScript.

Perilaku Radix dialog, pemulihan fokus, live region, tabel, role filtering dan reduced motion yang sudah baik dipertahankan. Outline normal yang tidak ada bukan otomatis kegagalan Focus Visible karena ring existing masih terlihat; forced-colors adalah alasan utama penguatan outline.

## Scope dan berkas

- 11 berkas halaman/loading/error: atribut target fokus saja. Daftar15 lokasi tepat ada pada source-before.json;60 node main dalam sumber bukan berarti60 halaman aktif.
- src/components/ui/button.tsx: outline, wrapping dan varian kompak.
- src/components/ui/card.tsx, status.tsx: gutter/ikon normal yang tetap menyediakan ruang baca saat teks membesar. Nama/peran/status tetap sama.
- src/app/globals.css: wrapping judul, fieldset dan aturan minimum kelompok aksi/dialog.
- src/app/login/login.module.css: gutter toggle password; login-shell.tsx/page.tsx: petunjuk tanpa JavaScript tersedia pada loading dan halaman akhir.
- src/components/pwa-install.tsx: reflow panduan; instalasi, online-only, status koneksi dan kebijakan tanpa cache privat tetap.
- scripts/accessibility/source-audit.mjs, tests/accessibility.test.mjs: inventaris AST dan guard regresi target fokus/positive literal tabindex.
- tests/ui/design-system-fixture.tsx, scripts/verify-accessibility.mjs: kontrol bersama aktual, keyboard, forced-colors, pembesaran, text spacing dan dialog.
- scripts/verify-design-system.mjs: tunggu fokus kembali ke tombol yang tepat setelah dialog benar-benar ditutup; bukan mengecek fokus sementara pada body.
- tests/login-page.test.mjs: regresi petunjuk noscript pada kedua keadaan Login.
- scripts/verify-login.mjs: status notifikasi akun dihitung dalam main, terpisah dari status koneksi PWA; tambah kasus panduan PWA terbuka400%.
- package.json: perintah tes dan integrasi source guard ke check. Tidak menambah dependency/lockfile.
- Roadmap, MASTER dan laporan JSON: standar, bukti dan batas penerimaan.

Tidak mengubah API, RPC, autentikasi, RBAC, rumus akademik/keuangan, data, schema, environment atau provider. Tidak perlu migrasi database.

## Verifikasi yang dapat diulang

Alat QA eksternal: Playwright1.58.2, esbuild0.25.12, axe-core4.11.0, Chrome Headless145.0.7632.6. Set UI_TEST_TOOLS dan CODEX_PRIMARY_RUNTIME_NODE_MODULES ke direktori QA; UI_CHROMIUM_EXECUTABLE ke Chrome. Aplikasi tetap memakai dependency terkunci existing.

- npm ci; npm run check; npm run test:ui; npm run test:pwa; npm run lint; npm run build.
- node scripts/accessibility/source-audit.mjs output.json --baseline membaca sumber Git baseline di atas; tanpa --baseline membaca working tree.
- ACCESSIBILITY_QA_OUTPUT=/tmp/l10-accessibility npm run test:accessibility:browser.
- LOGIN_QA_OUTPUT=/tmp/l10-login node scripts/verify-login.mjs.
- NAVIGATION_QA_OUTPUT=/tmp/l10-navigation node scripts/verify-navigation.mjs; ulang dengan --accordion-only dan direktori output berbeda.
- MODAL_FEEDBACK_QA_OUTPUT=/tmp/l10-modal node scripts/verify-modal-feedback.mjs.

Inventaris AST:60 main/15 target belum lengkap sebelum;60 main/0 target hilang sesudah; positive literal tabindex tetap0. Inventaris tidak membuktikan perilaku dinamis atau seluruh WCAG.

Suite khusus memakai viewport320/390/768/1440, keyboard/Shift+Tab/Escape, fokus balik, gulir tabel lokal, font200%, text spacing line-height1,5/letter0,12em/word0,16em/paragraf2em, dan aksi dialog terlihat pada320×568. Outline enam varian diperiksa dalam normal/forced-colors. Axe memakai wcag2a/wcag2aa/wcag21aa/wcag22aa/best-practice. Suite Login memakai halaman production lokal, termasuk200/400%teks, orientasi, fallback tanpa JavaScript; POST/SDK/Google CAPTCHA dibatasi fixture sintetis, tidak memverifikasi challenge Google atau mengirim OTP nyata.

Laporan final dan jumlah pemeriksaan ada pada `docs/verification/l10-accessibility/verification.json` serta JSON per suite. Screenshot diperiksa lokal; hanya laporan sintetis disimpan dalam Git. Full check lokal781 tes lulus sebelum refinement gutter akhir dan guard noscript; setelahnya build/TypeScript, lint, Login25/UI7/PWA3/source1 dan browser diulang. Hasil final:484 named browser checks,16 skenario modal,59 pemindaian axe, nol JavaScript error pada suite yang dijalankan. CI rilis wajib mengulang seluruh check pada exact PR head sebelum merge. Cache build lokal awal yang rusak dipindahkan ke /tmp lalu dibangun ulang; compiler/config produksi tetap.

## Gerbang penerimaan manusia

| Skenario | Bukti yang masih diperlukan | Status |
|---|---|---|
| NVDA/VoiceOver, Login/reCAPTCHA, onboarding email, status/error, tabel/form/modal | Tugas pengguna dapat diselesaikan dan pengumuman dibaca tepat | Belum diuji manusia; DOM/axe bukan pengganti |
| Zoom browser400%, teks200%, kontras OS nyata | Tidak ada kehilangan isi/aksi, fokus terlihat/tidak tertutup | Reflow/emulasi otomatis tersedia; perangkat nyata terbuka |
| Touch, PWA standalone dan pembaca PDF | Kontrol/dokumen dapat dipahami pada perangkat representatif | Belum diuji manusia pada tahap ini |

Tidak menyatakan seluruh WCAG2.2AA terpenuhi dari axe nol. L02 UAT manusia, L09 field/load, restore staging dan evaluasi AI tetap terbuka. Tidak menjalankan load/mutasi produksi. Rollback dengan revert PR; tidak ada schema/data yang perlu dibalik.

Referensi primer: https://www.w3.org/WAI/WCAG22/Understanding/focus-not-obscured-minimum.html ; https://www.w3.org/WAI/WCAG22/Understanding/reflow.html ; https://www.w3.org/WAI/ARIA/apg/patterns/tabs/ .
