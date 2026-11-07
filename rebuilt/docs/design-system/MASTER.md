# Sistem desain SiM-Murid — Tailwind CSS 4 + DaisyUI 5

Berlaku sejak migrasi 7 November 2026. Identitas: SiM-Murid / MTs Nurul Falah. Aplikasi aktif `rebuilt/`. Laporan, inventaris route dan batas verifikasi: [modernisasi DaisyUI](../verification/daisyui-modernization.md).

## Fondasi

Tailwind CSS mengatur layout, spacing, breakpoint dan penyesuaian; DaisyUI **5.7.50** mengatur komponen visual. React/Next.js tetap mengatur state/rendering; Lucide untuk ikon. Radix Dialog, AlertDialog dan Tabs tetap mengatur interaksi aksesibel. Tidak ada JavaScript DaisyUI, state tema di localStorage, dark mode otomatis, route demo produksi, atau perubahan database untuk styling.

Plugin resmi berada di `src/app/globals.css`, setelah satu import Tailwind dan import `tw-animate-css`. Daftar `include` membatasi output ke komponen yang dipakai. Tema `sim-murid` adalah default light, juga dinyatakan pada HTML server sehingga tidak membutuhkan inisialisasi client.

## Token

Palet runtime berasal dari `@plugin "daisyui/theme"`. Alias lama `--primary`, `--foreground`, `--card`, dan token semantik menunjuk tema ini, sehingga modul lama dan komponen DaisyUI memiliki satu sumber warna.

| Token DaisyUI | Nilai / penggunaan |
|---|---|
| base-100 | #FFFFFF, permukaan |
| base-200 | #F7F9FC, halaman |
| base-300 | #DAE3EC, garis dekoratif |
| base-content / neutral | #15243A, teks |
| primary | #125E64, aksi utama |
| secondary | #E8F0F2, aksi sekunder dengan teks base-content |
| accent | #28597D, aksen identitas |
| info | #1E40AF |
| success | #166534 |
| warning | #854D0E |
| error | #B91C1C |

Primary/accent/neutral/status memiliki content putih. Status lembut menggunakan latar semantik dan teks gelap berpasangan. Jangan menggunakan warna saja: sertakan teks/ikon. `--input: #7B8D9E` adalah garis kontrol kontras, berbeda dari garis dekoratif. `--border-color` adalah alias warna garis lama; **`--border` dicadangkan untuk ketebalan DaisyUI (1px)**. Jangan menulis warna ke `--border`.

Radius field .65rem, box 1rem. Font sistem Arial/Helvetica; body 16px, metadata 12–14px, heading halaman 24–30px. Spacing 4/8px; gutter 16/24/32px. Jangan mengunci tinggi teks atau memotong identitas penting.

## Kontrak komponen

| Elemen | Presentasi | Perilaku yang dipertahankan |
|---|---|---|
| Button | btn-primary; btn-error untuk destruktif; btn-secondary untuk secondary/legacy outline | Props, Slot/asChild, ref, native disabled, aria-busy, event dan tipe submit |
| Input / textarea | input / textarea, satu lebar container | type, ID, name, ref, controlled/uncontrolled, constraint dan FormData |
| FloatingLabel / Field | Adapter label native dalam flow; child memakai input/textarea | Label panjang dapat wrap, reset/autofill/date tidak bergantung state salinan |
| Select / pilihan | Native select; checkbox/radio primary; file-input | Keyboard/OS picker, value, required, disabled dan validasi caller |
| Card | card bg-base-100; layout header/content existing | Tidak mengubah semantik/hierarki atau wrapper form |
| Dialog / konfirmasi | modal-box pada Radix, overlay dan ukuran viewport existing | Trap/restore focus, Escape, dirty draft, closeDisabled, konfirmasi eksplisit |
| Status | alert-soft semantik, ikon dan live region existing | Error role alert; lainnya status; uncertain tidak disamakan dengan sukses |
| TableRegion | table table-zebra pada tabel native, scroll lokal bernama | caption/scope, semua kolom, keyboard scroll, angka tabular, sortir/filter caller |
| Tabs | tabs tabs-box / tab + Radix data-state | Keyboard, state dan validasi perpindahan existing |
| Guidance | collapse dengan details/summary native | Penjelasan opsional disembunyikan; aturan wajib tetap terlihat |
| Koleksi | fieldset, badge-soft, Button dan pagination bersama | Query/URL, hitungan, slicing, scope dan reset filter tetap di caller |
| Loading | skeleton DaisyUI, spinner aria-busy dan status berlabel | Tidak membuat angka/status palsu; reduced motion |

`outline` tetap menjadi API kompatibilitas untuk pemanggil lama, tetapi tampil sebagai tombol sekunder solid. Tidak menambah variant ghost/link. Warna/style dari caller boleh menyesuaikan hierarki tanpa mengubah semantik.

Floating label sengaja memakai adapter existing, bukan posisi absolut label bawaan yang berisiko bertabrakan dengan teks panjang dan zoom. Radix memakai `modal-box` tanpa wrapper `.modal`: nonaktifkan opacity/scale tertutup bawaan pada box, pertahankan transform posisi Radix. Padding dialog dibagi header/body; konfirmasi tetap memiliki padding sendiri. Native details kompleks tetap native; tidak menambahkan collapse-content ke banyak sibling yang dapat saling menumpuk.

## Shell dan halaman

Navbar ringkas, sidebar desktop 264px mulai 1024px, drawer Radix pada layar kecil. Sidebar/drawer tetap navigasi utama; jangan menambah navigasi antarmodul duplikat di konten. Menu berasal dari capability server; penyaringan tampilan bukan otorisasi.

Permukaan opaque, border/shadow ringan, tanpa lapisan kaca yang bersaing dengan DaisyUI. Konten maksimum 1440px. Footer memuat pemasangan PWA. Kebijakan standalone non-admin dan pengecualian admin dari server tetap berlaku. Pencarian sidebar mengembalikan fokus serta seluruh field ke wilayah terlihat pada layar pendek.

Judul → aksi → filter → konten → pagination. Penjelasan opsional memakai Guidance. Jangan menyembunyikan konsekuensi transaksi, error, aturan bisnis atau informasi izin yang diperlukan.

## Responsivitas dan aksesibilitas

Baseline target 320/390/768/1024/1280/1440px, landscape dan teks 200/400%. Scroll vertikal normal, scroll horizontal hanya region tabel/reader. Min-width:0 dan wrapping pada container/label; dialog memakai batas 100dvh dan body scroll internal. Target kontrol minimal 44px; checkbox/radio memiliki area label sentuh.

Focus-visible 2px + offset; disabled dan busy jelas. Pending mencegah submit ganda di controller caller. Reduced motion, forced colors, native form label dan live region tetap ada. Pengujian otomatis tidak sama dengan sertifikasi WCAG atau UAT pembaca layar.

## Pemeliharaan

Jalankan npm ci, typecheck, lint, audit:deadcode, check dan browser suite relevan. Browser fixture terisolasi tidak masuk app routes, tidak menulis produksi atau mengaktifkan penyedia eksternal. Perbarui inventaris bila menambah kontrol/route. Laporan membedakan pass, kegagalan baseline, dan belum diuji.

Migrasi ini menggantikan bahasa visual shadcn/Plass sebelumnya; laporan historis tetap menjadi catatan waktu, bukan otoritas styling runtime. API, Auth, capability, Zod, database/RLS, rumus, ekspor dan domain service tetap otoritas fungsional.
