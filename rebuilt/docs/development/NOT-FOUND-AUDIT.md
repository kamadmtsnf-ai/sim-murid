# Audit dan refactoring halaman tidak ditemukan

25 Oktober 2026 WIB. Baseline `main`: `8a370edcd2b67237974fcd3f63ff63de20fdadd3`; branch `fix/not-found-page`.

## A. Temuan dan analisis dampak

Seluruh alur relevan dibaca sebelum perubahan: `app/not-found.tsx`, RootLayout (bahasa, metadata, skip link), `globals.css` (warna, body, focus, reduced motion), Button/Slot/Link, account layout, proxy dan page-policy, pemanggilan `notFound()` pada route modul, konfigurasi Next dan build. Halaman ini statis: tidak ada CRUD, form, tabel, pagination, modal, state, listener, fetch, integrasi GAS/API atau loading data. Tidak menambahkan alur tersebut secara artifisial.

1. Target skip link `main-content` belum memiliki `tabIndex=-1`; fokus programatis/keyboard tidak eksplisit. Tambahkan target focusable dengan label dari heading.
2. Gutter hanya horizontal dan ruang/tipografi belum dikelompokkan. Di layar pendek/zoom, ruang atas-bawah kurang nyaman. Gunakan padding vertikal dan layout yang dapat tumbuh, tanpa fixed height atau overflow hidden.
3. Button reusable memakai whitespace-nowrap. Di viewport sempit/zoom tinggi, label berpotensi melebar. Override lokal w-full/max-w-full/whitespace-normal serta span min-w-0; tidak mengubah Button global.
4. Pesan pemulihan belum menjelaskan tindak lanjut bila tautan internal berulang kali gagal. Tambahkan arahan singkat ke admin, tanpa kontak palsu, URL mentah atau echo query.

Tidak ditemukan kebutuhan perubahan data, autentikasi, API, database atau role. Route akun tidak dikenal tetap ditolak oleh kebijakan keamanan (403); jangan melemahkan izin demi mengubahnya menjadi 404. Audit ini tidak mengklaim semua route penolakan memiliki tampilan identik.

## B. Perbaikan dan file

- `src/app/not-found.tsx`: hierarki kode 404/heading/pesan/action; kartu semantik, ikon Lucide dekoratif, token existing, wrap lokal, target skip link. Tautan existing ke `/` dipertahankan dengan prefetch=false; tidak memakai history.back yang dapat mengarah ke situs lain atau buntu pada tab baru. Tanpa JS tambahan, listener, backend lookup atau animasi baru.
- `scripts/verify-not-found.mjs`, `package.json`: verifikasi terhadap production Next server asli yang dijalankan oleh skrip; tidak menggunakan fixture HTML/API. Memeriksa HTTP404, heading/main tunggal, skip focus, keyboard, target sentuh, recovery link ke Beranda asli, orientasi, text zoom200%, reflow dan axe. Server dihentikan sesudah pengujian. Host dibatasi ke localhost.
- `docs/verification/not-found/results.json`: hasil pengujian terstruktur; dokumen ini menyimpan temuan, alasan dan batas bukti.

## C. Kode final

Implementasi terintegrasi di `src/app/not-found.tsx`; tidak ada komponen/formulir duplikat. Framework, routing bisnis dan RBAC dipertahankan.

## D. Verifikasi

- npm ci, TypeScript, lint dan production build lulus.
- Browser Chromium pada production server lokal: 320×568,390×844,768×1024,1440×900,932×430,160×568; masing-masing respons404, satu main/heading, fokus skip link, recovery ke Beranda, tanpa overflow horizontal, orientasi bertukar, dan enam scan axe tanpa pelanggaran. Pengujian text zoom200% juga lulus.
- Pengujian tambahan tanpa JavaScript membuktikan halaman404 dan tautan Beranda tetap bekerja. Tidak ada error JavaScript terdeteksi.
- Pada viewport pendek atau zoom tinggi, scroll vertikal alami dipertahankan agar seluruh konten/tombol tetap terjangkau; tidak mengklaim semua konten harus muat dalam satu layar pada setiap ukuran.
- Kondisi data kosong/banyak, validasi/pengiriman formulir dan perubahan state async tidak berlaku untuk halaman statis ini. Halaman tidak meminta data akun, sehingga tidak menambah risiko kebocoran atau race data.
- CI PR menjalankan suite regresi penuh sebelum merge. Batas: browser/perangkat fisik lain dan UAT manusia belum dijalankan; tidak menyatakan sertifikasi aksesibilitas menyeluruh.
