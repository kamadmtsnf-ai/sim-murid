# Modernisasi Tailwind CSS + DaisyUI — 7 November 2026

## A. Ringkasan

Baseline `main`: `2562fe6db2fb54c865709d7fdfcccd292f5a3827` (PR97). Branch `design/daisyui-modernization-20261107`. DaisyUI **5.7.50**, Tailwind **4.3.3**, Node **24.22.1**. Direktori aktif `rebuilt/`; aplikasi GAS root tidak diubah.

Inventaris mencakup **23 file page.tsx**, **140 file TSX**, termasuk panel pada tiga dispatcher route dinamis. Semua 23 entry halaman mewarisi tema/layout/komponen bersama; ini bukan klaim 23 alur produksi telah di-UAT. **271 deklarasi kontrol native** di **43 file** mendapat kelas DaisyUI; shared primitives, shell, badge dan feedback dimigrasikan terpisah. Inventaris lengkap per-file di [inventory.json](daisyui/inventory.json).

Kontrak diperiksa melalui perbandingan AST terhadap baseline: **594 kontrol native/komponen** mempertahankan seluruh atribut selain className, termasuk event, value/defaultValue, constraint, aria, ref dan props. Perubahan label tambahan: detail Lainnya memakai FloatingLabel dan spasi label nominal komite dikoreksi. Perilaku UX baru hanya pemulihan visibilitas pencarian sidebar pada viewport pendek; regresinya diuji.

Sumber yang ditinjau: AGENTS/README/MASTER, roadmap/P01 dan status siklus pengembangan, keputusan PWA dan approved-business-policy, spesifikasi modul/kesetaraan/aturan bisnis, route/page/panel, primitives dan CSS. Dokumen historis dipakai sebagai kontrak, bukan status produksi kini. Tidak mengubah Auth, API, Zod, database/migrasi/RLS, domain service, rumus atau ekspor.

## B. Perubahan komponen

| Komponen | Sebelum | Setelah | Status |
|---|---|---|---|
| Tema / tokens | Alias CSS lokal, permukaan kaca dan styling lokal | Tema DaisyUI sim-murid; alias kompatibel menuju satu palet; light-only | Diterapkan |
| Button | cva/shadcn dengan kelas custom | btn-primary / btn-error / btn-secondary; props/asChild tetap | Diterapkan; default/hover/pressed/focus/disabled/busy diperiksa |
| Card | Surface custom | card bg-base-100, header/content ber-layout existing | Diterapkan |
| Field / FloatingLabel | Label native dan CSS dalam flow | Dipertahankan sebagai adapter dengan kontrol input/textarea DaisyUI | Diterapkan; label panjang/zoom tetap aman |
| Native controls | Utility lokal | input, textarea, select, checkbox, radio, file-input | Diterapkan lintas panel |
| Dialog / confirm | Radix + surface custom | Radix + modal-box, controlled geometry dan overlay existing | Diterapkan; Escape/trap/restore fokus tetap |
| TableRegion | Region scroll + table native | table table-zebra; region/caption/scope/kolom tetap | Diterapkan |
| Status / content-state | Card status custom | alert-soft semantik + ikon/live region, skeleton DaisyUI | Diterapkan |
| Guidance | details/summary custom | DaisyUI collapse pada struktur details yang sesuai | Diterapkan; details kompleks lain tetap native |
| Collection controls / summary | Fieldset/pagination/chip custom | fieldset, badge-soft dan Button bersama | Diterapkan; server/client pagination tetap berbeda |
| PagedCollection / LinkPagination | Memakai Button/Pagination | Mewarisi perubahan shared; slicing/URL tidak diubah | Dipertahankan dan tervalidasi via regresi |
| Shell | Sidebar/topbar custom + glass | navbar, menu, breadcrumbs, badge; permukaan opaque | Diterapkan; drawer Radix dan capability tetap |
| PWA | Footer launcher + requirement screen | Mewarisi Button/Dialog, policy admin/non-admin tetap | Tidak menambah worker/cache/instalasi otomatis |

Benturan penting diperbaiki: warna legacy `--border` diganti `--border-color`; `--border:1px` disediakan bagi DaisyUI. Radix modal-box menetralkan opacity/scale tertutup, tanpa membatalkan transform centering. Plugin dibatasi pada komponen yang digunakan. Dependensi hanya bertambah paket CSS DaisyUI; tidak menambah JavaScript client.

## C. Halaman/modul

| Kelompok / entry | Perubahan UI / UX | Responsive | Bukti / batas |
|---|---|---|---|
| Beranda / | Tema, tombol solid, Card, footer PWA | 320–1920px, landscape, teks 200/400% | 64 browser checks, 6 axe |
| Login /login | Kontrol DaisyUI, floating password, status sesi, footer | 320–1440px, layar pendek, teks 400% | 215 browser checks, 17 axe |
| Pemulihan publik /recovery, /recovery/email | Input/select/Button/Status bersama | Shared + source/layout audit | Pengiriman OTP nyata tidak dijalankan |
| Dashboard /account | Card, badge status dan ringkasan tugas | Shared shell dan overview/follow-up fixtures | Tanpa metrik dummy |
| Profil /account/profile | Field/FloatingLabel/Button bersama | Shared + fixture parsial | Profil 87 checks / 8 axe lulus |
| Biodata /account/biodata, /account/biodata/[id] | Select/textbox/file-input; detail Lainnya FloatingLabel | Fixture biodata | Pilihan Lainnya dan validasi existing tetap |
| Direktori /account/directory, /account/directory/[id] | Tabel/card mobile, badge/progress, form pengguna/penugasan/impor | 320–1440px + zoom/orientasi | Direktori, user-detail, bulk fixtures lulus |
| Keluarga /account/families | Tab Radix + DaisyUI, tabel dan select | Mobile/desktop fixtures | Regresi keluarga lulus |
| Kelas /account/classes | Input, checkbox, tabel | Mobile/desktop fixtures | Regresi kelas lulus |
| Jadwal /account/schedules | Tabs, filter, form, tabel dan modal | Mobile/desktop fixtures | Regresi jadwal lulus |
| Operasional /account/operations/[module] | Piket, absensi, bimbingan, komite, tabungan memakai kontrol bersama | Mobile/desktop fixtures | Kelima suite lulus; rumus/ledger tidak diubah |
| Akademik /account/learning/[module] | Nilai, rapor, kenaikan, buku dan dokumen memakai tema/kontrol bersama | Mobile/desktop fixtures | Grades/reports/promotions/books lulus |
| Layanan /account/services/[module] | Notifikasi, poin, survei, AI review, jobs dan rekonsiliasi | Shared + fixtures | Notifications/jobs/reconciliation lulus; Points dan Surveys kini lulus |
| Keamanan/email/sesi/akses | Form/table/alert/Button dan konteks akun | Shared + fixtures | Account-security/email/accessibility lulus; pemulihan admin 46 checks / 5 axe lulus |
| Pengaturan /account/settings | Kontrol dan tabel, Card/Status bersama | Shared + fixture parsial | Settings 39 checks / 5 axe lulus |
| Kesehatan /account/health dan bantuan | Card/status/skeleton, panduan kontekstual | Accessibility/help fixtures | Lulus dalam lingkup fixture |
| Akses ditolak / error / not-found / loading | Shared PermissionDenied, Status, Button dan skeleton | Shared + source/regresi | Tidak menambah route atau izin |

Entry `[module]` tetap divalidasi dispatcher existing; daftar modul tidak menciptakan route baru. Pencarian/filter/sorting/pagination dan scope tetap pada caller. Tabel boleh scroll lokal; halaman tidak dipaksa overflow hidden untuk menyembunyikan masalah.

## D. Validasi

| Pemeriksaan | Hasil nyata |
|---|---|
| npm ci | Lulus, lockfile tersinkron dengan dependensi eksak |
| Baseline npm run check | Berhenti pada test:ui: satu input detail Lainnya belum FloatingLabel; bukan baseline hijau |
| npm run check setelah migrasi | **792 tests / 83 groups lulus**, typecheck/lint/db type replay/build lulus |
| Build/lint final setelah pembatasan output CSS | Lulus ulang |
| npm run audit:deadcode | Selesai; hanya instrumentation.ts dan app/manifest.ts terlapor unreachable oleh graf impor biasa. Keduanya entry framework, dipertahankan |
| Browser | **38 suite lulus, 3.417 checks**, **365 axe scans** dalam suite sukses. Angka memakai bentuk hasil masing-masing fixture, bukan jumlah tugas manusia |
| Design system | 82 checks / 13 axe, viewport 320/390/768/1024/1280/1440, dialog, state, pagination, reduced motion |
| Navigation | 66 checks / 14 axe, lintas peran, drawer, layar pendek, fokus pencarian |
| Forms | 87 checks / 7 axe, validasi, pending/uncertain, draf dan submit ganda |
| Accessibility | 108 checks / 18 axe, forced colors, keyboard, zoom dan dialog |
| Audit atribut | 594 kontrol dibandingkan terhadap baseline; tidak ada perubahan atribut interaksi |
| Browser produksi | Beranda dan login memakai server build lokal; mayoritas modul lain memakai komponen asli dengan API fixture terisolasi |
| CI | Head awal PR98 lulus; CI head terbaru diperiksa di PR sebelum merge |

Bukti terstruktur: [summary.json](daisyui/summary.json), hasil per-suite pada direktori `daisyui/`, serta screenshot [sebelum](daisyui/screenshots/components-before-390.png), [sesudah](daisyui/screenshots/components-after-390.png), dan [Login](daisyui/screenshots/login-after-390.png). Browser Chromium 153 dengan Playwright runtime, esbuild dan axe-core dipasang hanya di lingkungan QA, tidak ditambahkan ke aplikasi.

Skrip QA disesuaikan pada selector yang usang: variant ghost/link yang sudah tidak ada; empty state tanpa pencarian; region border floating label; label sesi berakhir; summary riwayat yang harus dibedakan dari bantuan. Pemeriksaan footer pada teks 400% menguji ujung footer bisa dijangkau dengan scroll, bukan memaksa seluruh footer yang lebih tinggi dari viewport muat sekaligus. Tidak menghapus pemeriksaan mutasi/otorisasi.

### Performa

CSS hasil kompilasi seluruh source (belum minifikasi): baseline 107.466 byte / gzip 17.121 byte; DaisyUI 216.872 byte / gzip 28.859 byte. Kenaikan gzip **11.738 byte**. Konfigurasi `include` menurunkan output dibanding integrasi semua komponen (~280KB). Ini pengukuran CSS lokal, bukan Core Web Vitals produksi atau uji beban. Tidak menambah paket runtime JS, memindahkan Server Component menjadi client, menambah fetch, atau menambah state tema.

## E. GitHub

PR: [#98](https://github.com/kamadmtsnf-ai/sim-murid/pull/98). Branch `design/daisyui-modernization-20261107`, baseline main `2562fe6`. Source terunggah sebelumnya diverifikasi identik dengan tree lokal yang diuji. Izin push kemudian diberikan pengguna; penolakan awal sudah terselesaikan. CI dan preview Vercel pada head awal `a3d413e` lulus.

Pada 7 November 2026 pengguna mengizinkan merge setelah syarat kelayakan terpenuhi. Lima blocker browser diselesaikan tanpa perubahan kode bisnis/runtime; pemeriksaan lokal akhir lulus. Status CI head terbaru dan hasil merge dicatat pada PR, bukan disimpulkan dari CI head lama. Tidak melakukan force push atau migrasi database.

## F. Temuan tersisa dan batas penerimaan

Kelima kegagalan baseline berikut **sudah diselesaikan** pada tindak lanjut kesiapan merge. Bukti kegagalan lama dipertahankan sebagai riwayat, sedangkan hasil terkini tersedia pada JSON per-suite.

| Suite | Titik berhenti | Bukti baseline |
|---|---|---|
| Settings | Setelah pembatalan pindah tab, selector Nama sekolah tidak tersedia karena test masih menerima dialog native | [log](daisyui/settings-baseline-failure.txt) |
| Surveys | Penutupan draf kedua terhalang konfirmasi yang tidak diselesaikan test | [log](daisyui/surveys-baseline-failure.txt) |
| Personal-profile | Save setelah pembatalan reload terhalang konfirmasi custom yang belum ditangani skrip | [log](daisyui/personal-profile-baseline-failure.txt) |
| Account-recovery | Konfirmasi pembatalan approve tidak diselesaikan skrip | [log](daisyui/account-recovery-baseline-failure.txt) |
| Points | Assertion payload active katalog tidak cocok; perlu rekonsiliasi fixture/kontrak sebelum mengubah logika | [log](daisyui/points-baseline-failure.txt) |

### Penyelesaian blocker sebelum merge

| Suite | Pemeriksaan lulus | Axe | Akar masalah / perbaikan |
|---|---:|---:|---|
| Settings | 39 | 5 | Skrip memilih Batal/Lanjutkan pada alertdialog Radix saat pindah tab dan reload |
| Personal-profile | 87 | 8 | Konfirmasi reload diselesaikan; assertion pesan dipisahkan dari heading Status |
| Account-recovery | 46 | 5 | Konfirmasi approve/reject/hapus tampilan password diuji secara eksplisit, termasuk batal tanpa write |
| Points | 67 | 8 | Menunggu keputusan konfirmasi dan commit UI sebelum membaca payload; active=false terbukti benar |
| Surveys | 60 | 6 | Konfirmasi tutup draf/final/periode/reload/logout ditangani; logout pending diuji tertahan sebelum konfirmasi |

Helper test `scripts/testing/confirmation.mjs` mengeklik tombol asli pada role alertdialog, menunggu unmount/restore fokus dan commit React. Tidak mengganti atau menonaktifkan `confirmAction`, tidak mengarang hasil respons, tidak menghapus assertion izin/payload. Pending write tetap mencegah logout; setelah save selesai, logout yang dikonfirmasi membersihkan draf dan mempertahankan preferensi lain. Lima suite dijalankan kembali setelah perapian driver dan semuanya lulus. Tambahan bukti: 299 checks / 32 axe; total migrasi menjadi 38 suite / 3.417 checks / 365 axe.

`npm run check` terakhir kembali lulus: 792 tes / 83 grup, typecheck, lint, replay tipe database dan build. Final diff memperbaiki driver QA dan dokumentasi saja; tidak ada perubahan Auth/API/RLS/schema/rumus atau runtime aplikasi pada tindak lanjut ini.

UAT akun/perangkat nyata, pembaca layar manusia, seluruh kombinasi peran/data produksi, autofill OS, email/CAPTCHA nyata, PDF/Excel aktual dan pengukuran beban produksi belum dijalankan. Tes domain/ekspor lokal dan fixture bukan pengganti penerimaan tersebut. Tidak mengklaim 100% bebas bug atau sertifikasi WCAG. Status akhir otomatis: migrasi visual dan lima suite browser yang sebelumnya tertahan telah lulus. Batas UAT manusia/produksi tersebut tetap terbuka dan tidak disamakan dengan blocker regresi migrasi visual.
