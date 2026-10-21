# Audit dan refactoring Dashboard

Baseline: main `4155373866a4c0550242e9012585fc4288224eb1`. Branch: `fix/dashboard-audit`. Lingkup: `rebuilt/`, terpisah dari pekerjaan release/D10 pada PR #4. Identitas teal dan adaptasi Plass existing dipertahankan.

## Alur dan dampak sebelum perubahan

Pembukaan `/account` → Proxy memperbarui cookie → layout membaca principal terverifikasi dan context capability → sidebar disaring → page memeriksa principal, onboarding, lalu survei wajib → Dashboard menerima nama dan expiry serta membaca navigasi dari WorkspaceContext. Ketiga gate server tetap berurutan. Dashboard tidak melakukan fetch atau mutasi client. Tidak ada CRUD, tabel, pagination, tab, form bisnis, atau Google Apps Script di Dashboard rebuilt. Form logout, pencarian navigasi, drawer Radix, dan error/loading boundary merupakan dependensi interaktifnya.

Event: pencarian mengubah query tunggal; pemilihan menu menutup drawer; Escape/tombol tutup mengembalikan fokus; perpindahan breakpoint menutup modal dan memindahkan target fokus ke sidebar desktop. Status server tidak digantikan oleh state browser. Tidak ada perubahan API, database, RLS, kontrak logout, validasi, formula, atau kebijakan bisnis.

## A. Temuan dan penyebab

| Temuan | Penyebab / bukti | Perbaikan |
|---|---|---|
| Tanggal sesi rusak dapat meruntuhkan seluruh Dashboard | `Intl.DateTimeFormat.format(Invalid Date)` melempar RangeError; direproduksi melalui fixture | Validasi timestamp sebelum format; tampilkan fallback, tanpa `time` palsu |
| Drawer diposisikan di tengah dan sebagian terpotong | Utility centering/translate Dialog mengalahkan class drawer; terlihat pada screenshot baseline | Override geometri hanya untuk drawer; netralkan kedua utility translate melalui instance Dialog |
| Drawer tetap modal pada desktop | Tidak ada lifecycle listener breakpoint | Listener matchMedia selama terbuka, cleanup saat tutup; fokus kembali ke brand sidebar yang terlihat |
| Menu menyusut menjadi 20px pada landscape dengan identitas panjang | Nama/username sidebar wrap tanpa batas dan mengambil tinggi menu | Nama sidebar dibatasi dengan ellipsis/title; nama lengkap tetap wrap di ringkasan; header ringkas dan menu bergulir |
| Logout terpotong saat tinggi viewport 240px | Total header/brand/search/footer melebihi tinggi viewport | Pada tinggi ≤300px, seluruh body drawer dapat digulir; pencarian/logout tetap dapat dijangkau |
| Daftar layanan kosong tanpa penjelasan | Grid dirender meskipun tidak memiliki grup | Empty state eksplisit, terpisah dari error akses |
| Context hilang menampilkan `@` tanpa username | Optional chaining diterapkan hanya pada nilai, bukan pada seluruh output identitas | Fallback username dan pesan daftar layanan tidak tersedia |
| Kegagalan context akses tampak sebagai daftar lengkap | Error ditelan di layout; tidak dibedakan dari grants kosong | Flag presentasi `navigationUnavailable`; tetap tidak menambah capability |
| Error verifikasi akun tidak mempunyai aksi retry | Page mengembalikan pesan statis, melewati error boundary existing | Gunakan client server existing dan error boundary yang sudah memiliki reset |
| Loading belum memiliki heading utama | Ditemukan axe sebagai `page-has-heading-one` tingkat moderate | Heading sr-only tanpa mengubah loading state |

Tanggal invalid dan context hilang adalah penguatan defensif: principal produksi tetap divalidasi schema server. Badge menjadi “Akun terverifikasi”, tanpa menyatakan pengecekan sesi terus berlangsung selama tab terbuka. Tidak menambahkan timer otorisasi atau auto-logout client.

## B. File dan alasan perubahan

| File | Alasan |
|---|---|
| `src/components/account-dashboard.tsx` | Fallback tanggal/identitas, empty/unavailable states, hierarki bagian, spacing card, ikon layanan yang sama dengan sidebar |
| `src/components/workspace-shell.tsx` | Lifecycle drawer/focus pada resize, netralisasi translate, wrapping menu dan ringkasan identitas sidebar |
| `src/app/account/layout.tsx` | Meneruskan kegagalan pemuatan context akses sebagai status presentasi |
| `src/app/account/page.tsx` | Menggunakan factory server existing; error verifikasi memakai boundary retry existing; gate tetap sama |
| `src/app/account/loading.tsx` | Heading aksesibel pada loading |
| `src/app/globals.css` | Geometri drawer, layout pendek, wrapping konten, service list, batas lebar topbar |
| `tests/dashboard.test.mjs` | Regresi alur login/onboarding/survei, actor/session, error, grants dan admin terverifikasi |
| `tests/ui/dashboard-fixture.tsx` | Fixture sintetis normal, panjang, 360 layanan, kosong, context hilang/error, tanggal rusak, loading dan error |
| `scripts/verify-dashboard.mjs` | Browser regression untuk layout, aksesibilitas, resize/orientasi, keyboard, touch, search dan retry |
| `package.json` | Mendaftarkan test Dashboard dan memasukkannya ke check |
| `docs/design-system/MASTER.md` | Menetapkan perilaku Dashboard/drawer tanpa sistem desain kedua |
| `docs/verification/dashboard/*` | Bukti baseline, hasil browser, regresi lintas modul, ringkasan validasi |

## C. Kode final dan cara verifikasi

Kode final berada pada file implementasi di atas, bukan pseudocode. Tidak ada dependency baru atau perubahan lockfile. Halaman normal tetap tidak memiliki tombol/tautan navigasi modul yang menduplikasi sidebar.

```bash
npm ci
npm run check
npm run audit:deadcode
# Gunakan instalasi tooling QA terpisah yang menyediakan esbuild dan axe-core,
# serta Playwright dari runtime atau dependency lokal yang tersedia.
UI_TEST_TOOLS=/path/to/qa/node_modules UI_CHROMIUM_EXECUTABLE=/path/to/chromium npm run test:dashboard:browser
# Regresi existing; optional UI_QA_ENV_FILE hanya berisi URL/key publishable.
UI_TEST_TOOLS=/path/to/qa/node_modules UI_CHROMIUM_EXECUTABLE=/path/to/chromium npm run test:ui:browser
```

Fixture berada di `tests/`, tidak diekspos sebagai route aplikasi, tidak menjadi validator login, dan tidak memakai identitas produksi. Baseline `--baseline` dijalankan sebelum perbaikan; untuk mereproduksinya gunakan source baseline. Script sengaja memerlukan tool QA eksternal seperti suite browser existing, tanpa menambah dependency aplikasi.

## D. Hasil dan batas verifikasi

Hasil mesin: `dashboard/baseline-results.json`, `dashboard/browser-results.json`, `dashboard/cross-module-results.json`, dan `dashboard/automated-results.json`.

- 172 tes aplikasi lulus, termasuk 9 tes Dashboard baru. Tes SQL memakai replay migrasi/fixture lokal; tidak melakukan mutasi produksi.
- Typecheck, lint, sinkronisasi 14 tipe tabel publik, audit dead code dan production build lulus pada eksekusi yang dicatat. `unreachable: []`.
- 75 pemeriksaan browser Dashboard dan 60 pemeriksaan browser lintas modul lulus; 19 layar axe tanpa pelanggaran teridentifikasi.
- Lebar 320, 360, 375, 390, 768, 1024, 1280 dan 1440px; landscape 812×375, 812×320, serta viewport pendek 812×240.
- Kondisi normal, role terbatas, data kosong, 360 layanan/12 grup, nama 400 karakter, username 600 karakter, tanggal invalid/kosong, loading dan error; skala teks 200%.
- Forward/backward Tab, focus trap, Escape/restore focus, tombol tutup sentuh ≥44px, pemilihan menu, pencarian/hasil kosong, error reset, tiga siklus resize/orientasi.
- Browser tidak menemukan horizontal overflow halaman atau JavaScript/console error dalam cakupan pengujian akhir. Gulir vertikal halaman panjang tetap tersedia; fokus, menu bawah, logout dan footer bisa dijangkau.
- Regresi lintas modul memakai suite existing: login, kelas, operasi, pembelajaran dan layanan; payload form tetap sama; API lokal anonim tetap 401, mutasi origin asing tetap 403.

Satu eksekusi `npm run check` menyelesaikan 172 tes dan pemeriksaan tipe/lint/database, lalu gagal pada cache persistence Turbopack (`invalid digit found in string`). Cache build dipisahkan dan production build dijalankan ulang dengan hasil sukses; ini tidak diperbaiki dengan mengubah framework atau dependency. Penyesuaian terakhir pada heading/loading dan CSS diuji ulang lewat lint, build, browser Dashboard dan regresi browser existing.

Bukti ini menggunakan Chromium headless dan fixture komponen. Pengalihan server diuji dengan mock pada batas dependency; ini bukan sesi login produksi atau UAT seluruh role pada database live. Belum diuji dengan perangkat fisik Safari/Firefox atau pengguna teknologi bantu. Tidak mengklaim jaminan aplikasi 100% bebas bug ataupun seluruh modul siap produksi berdasarkan audit satu halaman.
