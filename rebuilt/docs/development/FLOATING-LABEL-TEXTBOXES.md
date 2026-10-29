# Floating label textbox — 30 Oktober 2026

Permintaan: seluruh textbox memakai visual floating label. Baseline main: `6382c8addb8b7449c2f157d58d6778899308f2b4`. Branch: `ui/floating-label-textboxes`.

## Implementasi

- Komponen presentasi `src/components/ui/floating-label.tsx` mempertahankan elemen label native, asosiasi `htmlFor`/ID atau label implisit. CSS membaca focus/placeholder/value; tidak menambah listener global atau state salinan nilai.
- `Field` existing memakai komponen yang sama untuk input/textarea. Adapter mempertahankan ref, constraint, value/defaultValue dan event melalui clone native element; kontrol selain textbox tetap menggunakan label existing.
- 115 deklarasi input/textarea langsung di 34 modul/komponen memakai wrapper bersama. Empat deklarasi dalam adapter `Field` turut mendapat tampilan yang sama; helper domain menghasilkan field di banyak formulir. Pengujian AST mencakup semua deklarasi native textbox yang terlihat di `src`.
- Label tetap terlihat saat fokus dan terisi; label yang memiliki placeholder petunjuk serta tanggal/waktu selalu dinaikkan agar petunjuk native tidak tertimpa. Label panjang tetap dalam document flow dan dapat wrapping. Tinggi input minimal 44px pada teks 100%, ikon pencarian sejajar baris input. Mendukung readonly/disabled/error, fokus keyboard, forced colors dan reduced motion melalui token existing.
- Login tetap menggunakan toggle password existing; posisi di tengah field dan gutter tetap 60px untuk mencegah tabrakan saat teks diperbesar. Sidebar/search, filter, textarea dan field modal turut dimigrasikan.
- Checkbox, radio, file picker dan field tersembunyi tidak diubah menjadi textbox. Select bukan lingkup permintaan. Tidak mengubah autentikasi, RBAC, API, database, payload, dependencies, atau aturan domain.

## Bukti validasi

- 790 unit/integration tests lulus pada rangkaian `npm run check`; db type replay lulus. Build pertama terhenti karena fixture QA baru belum menyediakan description wajib, kemudian diperbaiki. Build ulang mengalami cache Turbopack rusak; cache dipindahkan secara reversibel, build bersih berhasil. Tidak mengubah konfigurasi compiler.
- Production build, pemeriksaan TypeScript dan lint terakhir lulus.
- Perbandingan AST sebelum/sesudah pada file TSX yang berubah: 161 native control mempertahankan atribut selain penambahan placeholder kosong untuk state CSS.
- Browser: viewport iframe nyata 320/390/768/1280 serta teks 200% dan 400% pada viewport 320. Enam axe scans tanpa pelanggaran dalam lingkup fixture dan tanpa horizontal overflow. Teks output diagnostik fixture sempat menyebabkan overflow, diperbaiki pada fixture; hasil akhir di `docs/verification/floating-label/browser.json`.
- FormData sintetis, reset input native/controlled, password show/hide, klik label memfokuskan input, Escape modal dan return focus diperiksa. Tidak ada transaksi produksi, OTP, CAPTCHA atau login sungguhan yang dilakukan.
- UAT fisik/pembaca layar dan autofill OS/password manager belum dijalankan. Ini bukan sertifikasi semua halaman/semua browser.

## Daftar file

Komponen bersama: `ui/floating-label.tsx`, `ui/field.tsx`, `workspace-shell.tsx`, `bulk/bulk-import.tsx`, `dashboard/follow-up-center.tsx`, `help/contextual-help.tsx`. Style: `app/globals.css`, `app/login/login.module.css`.

Formulir publik: login, recovery dan recovery/email. Modul account: biodata, classes, directory/add-user, directory/manage-assignments, email, families, settings, recovery, security, sessions; learning/books, grades, promotions, reports; operations/attendance, committee, duty, mentoring, savings; services/discipline, insights, jobs, notifications, reconciliation, survey-editor, survey-form. Semua perubahan modul hanya pembungkus label, import dan placeholder; handler serta atribut kontrol tetap dipertahankan.

Pengujian: `tests/ui.test.ts` menolak textbox baru yang melewati FloatingLabel/Field; `tests/ui/floating-label-fixture.tsx` menyediakan contoh dan kontrol viewport/ukuran teks/audit yang dapat dibundel untuk QA tanpa membuat route operasional produksi.
