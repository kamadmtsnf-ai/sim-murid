# Audit Sidebar, Navbar dan Footer

25 Oktober 2026 WIB. Baseline main `83e6b95170331b8768efd221fd856d07f47b5cf8`; branch `fix/workspace-navigation-shell`.

## A. Temuan dan hubungan kode

Dibaca sebelum perubahan: WorkspaceShell beserta context/ref/effect/listener, CSS shell/drawer/responsive/global, account layout, account-navigation/filter/current item, NavigationIcon, AcademicContextProvider/Summary/storage, FormNavigationGuard dan leave guards, Dialog/fokus, ContextualHelp serta verifikasi navigasi/formulir existing. Shell menerima principal dan daftar menu yang sudah disaring server; pencarian hanya menyaring daftar tersebut. Tidak ada CRUD pada shell. Logout tetap form POST existing; preferensi akademik/draf survei dibersihkan melalui handler existing setelah guard mengizinkan pengiriman.

Temuan:

1. `workspace-content` memakai min-height sisa viewport dengan asumsi tinggi navbar/footer tetap. AcademicSummary dan wrapping dapat menambah tinggi navbar, sehingga halaman pendek berpotensi mendapat scroll ekstra dan footer tidak mengikuti ruang tersedia secara tepat.
2. Drawer/search tidak otomatis direset ketika usePathname berubah dari luar klik sidebar (misalnya Back/Forward), sehingga modal dapat menutupi halaman baru dan query lama terbawa.
3. Listener breakpoint hanya menangani perubahan setelah terpasang; perlu memeriksa media query saat pemasangan untuk menutup celah resize/open berdekatan.
4. Menu kosong selalu dianggap pencarian gagal. navigationUnavailable hanya terlihat pada dashboard, sehingga shell halaman lain kurang memberi penjelasan status menu. Null access snapshot dapat juga berasal dari pengaturan keamanan yang belum lengkap; pesan tidak boleh menjanjikan reload pasti memperbaiki semua kondisi.
5. Navbar generik tidak menunjukkan lokasi aktif; breadcrumb detail biodata belum dibedakan dari daftar. Tombol drawer/search belum terhubung ke target aktual dengan aria-controls.
6. Nama kosong menghasilkan avatar kosong, dan slice(0,1) dapat memecah karakter surrogate. Nama panjang di navbar belum memiliki tooltip lengkap/teks alternatif mobile.
7. Pada desktop pendek, baris brand/search/pengguna dapat menyisakan terlalu sedikit ruang navigasi. Auto-scroll active item juga harus menjaga header pencarian yang sedang fokus agar tidak tergeser keluar area.

## B. Perbaikan dan file

- `src/components/workspace-shell.tsx`: state drawer/query dimiliki oleh pathname dan disesuaikan secara kondisional sebelum commit rute baru; callback setter stabil. Effect media query memeriksa kondisi awal dan cleanup listener tetap. Active-item scrolling tidak menggeser fokus header. Menu kosong/search kosong dan status menu dipisahkan. Navbar menampilkan lokasi, breadcrumb mengenali detail biodata, identitas punya fallback Unicode yang aman. Footer memakai paragraf dan landmark berlabel, tanpa link navigasi baru.
- `src/app/globals.css`: body workspace menjadi flex column dengan content flex-grow; footer mengikuti konten tanpa overlay dan tanpa min-height konten berdasarkan asumsi tinggi header. Sidebar pendek menggulir seluruh isi supaya Logout tetap terjangkau. Aturan lama diedit langsung, bukan menumpuk ulang aturan layout yang berkonflik. Identitas teal, density, sidebar desktop dan drawer mobile dipertahankan.
- `src/components/ui/dialog.tsx`: prop opsional contentId diteruskan hanya bila tersedia, agar ID otomatis Radix pada modal lain tidak tertimpa undefined; dipakai untuk relasi aria-controls tombol menu. API caller lain tetap kompatibel.
- `tests/ui/navigation-fixture.tsx`, `shell-navigation-shim.ts`, `scripts/verify-navigation.mjs`: pathname test kini mengikuti popstate, bukan nilai konstan. Ditambahkan skenario rute eksternal/Back, footer pendek dengan academic summary, konten panjang, menu kosong/status tidak terverifikasi, karakter Unicode, nama kosong, dan fokus pencarian pada sidebar pendek. Fixture tetap terisolasi; tidak mengganti router produksi.

## C. Kode final

Implementasi langsung di WorkspaceShell, stylesheet existing dan shared Dialog. Tidak menambah sistem navigasi kedua, penyimpanan menu, endpoint atau otorisasi client. accountNavigation/navigationFor dan pemeriksaan proxy/page/API/RPC tidak diubah. AcademicSummary tetap preferensi tampilan, bukan perubahan filter atau cakupan data otomatis.

## D. Verifikasi aktual

- `npm ci` dan `npm run check` lokal lulus: 705 tes, TypeScript, lint, tipe database dan production build. Lint akhir sesudah format juga lulus. CI PR menjalankan ulang suite pada commit final.
- Navigasi browser: 66 pemeriksaan, 14 scan axe, tujuh peran; pencarian alias/spasi/case, clear/Escape/fokus, target sentuh, drawer keyboard, resize desktop, viewport320/390/768/1440, landscape844×390 dan layar568×260. Rute eksternal serta Back menutup drawer/reset query dan memperbarui breadcrumb. Tidak ada error JavaScript atau overflow horizontal pada skenario tersebut.
- Footer halaman pendek diuji pada320×700/1440×900 dengan academic summary aktif: tetap dalam viewport, tanpa scroll vertikal paksa. Konten panjang: footer berada setelah konten, bukan overlay. Sidebar desktop1440×320: Logout terjangkau dan fokus search tidak digulir keluar area setelah clear.
- Kompatibilitas Dialog: ID otomatis trigger/content pada pemakaian default tetap cocok pada empat viewport; drawer memakai ID eksplisit sendiri. Dua belas varian CSS modal dan kontrol busy/fokus tetap lulus.
- Regresi FormNavigationGuard: 50 pemeriksaan/4axe lulus, termasuk draf, pending/uncertain, konfirmasi pembatalan, logout dan navigasi yang diizinkan. Test Back menguji sinkronisasi shell, bukan klaim tambahan bahwa semua interaksi browser Back dengan draf telah mendapat UAT nyata.
- Hasil di `docs/verification/workspace-shell/`. Penguji awal perlu dikoreksi karena shim pathname lama konstan dan tombol pembuka sengaja aria-hidden oleh Radix saat drawer terbuka; kemudian skenario dijalankan ulang hingga lulus.

Tidak membaca/mengubah akun produksi, database, role, session registry atau API. Browser QA memakai komponen asli dengan boundary router terisolasi, bukan sesi produksi. UAT perangkat fisik belum dilakukan. Scroll alami untuk halaman/menu panjang tetap diperlukan; tujuan adalah tidak ada clipping/overlap dan tidak ada scrollbar tambahan pada halaman pendek.
