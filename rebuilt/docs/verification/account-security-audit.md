# Audit Keamanan Akun — 24 Oktober 2026

## Lingkup dan alur yang diperiksa

Halaman `/account/security` → principal server dan registry sesi → `app_security_state` → SecurityPanel → `/api/auth/security` → konfirmasi password saat ini → pembatasan percobaan → operasi password/pertanyaan → status terbaru. Dibaca pula shell/sidebar, proxy/gate, validator bersama, hashing jawaban, migrasi security/onboarding, dan spesifikasi M01. Tidak ada perubahan database, role, urutan onboarding, kekuatan password, normalisasi jawaban, atau kontrak API yang digunakan modul lain.

## Temuan dan perbaikan

| Temuan | Penyebab | Perbaikan |
|---|---|---|
| Sesi kedaluwarsa bisa tampil sebagai kegagalan koneksi | Client membaca JSON sebelum memeriksa 401 | Tangani 401 sebelum parsing; redirect login tetap konsisten |
| Respons terlambat dapat menavigasi halaman lain | Tidak ada cleanup/guard setelah unmount | Guard lifecycle sebelum state update dan navigasi |
| Klik sangat cepat dapat mengirim dua perintah | Pengunci hanya React state, belum berubah pada event yang sama | Ref lock sinkron dibagi antarform dan refresh |
| Status form dapat tertinggal setelah refresh | Local state hanya mengambil props awal; key hanya gate dan kode pertanyaan | Key mencakup seluruh snapshot; GET ulang memvalidasi snapshot |
| Pertanyaan tersimpan dapat dilaporkan gagal | Read lanjutan gagal setelah write terkonfirmasi | API mempertahankan acknowledgement; client meminta sinkronisasi bila state belum valid |
| Hasil ambigu dapat dikirim ulang tanpa pemeriksaan | Tidak ada state pemulihan setelah network/503/409/HTTP200 tanpa state | Blokir mutasi sampai GET berhasil; pertahankan draft dan tidak retry otomatis |
| Error halaman tidak punya retry | Catch server menelan kegagalan layanan/redirect | Biarkan error boundary menangani outage; loading dan retry khusus halaman |
| Cookie refresh hilang pada GET401/503 | Respons error tidak menyalin cookie jar | Semua jalur GET memakai responder yang sama |
| Batas body memakai jumlah karakter dan membaca seluruh body | `request.text()` dan `length` bukan byte | Pakai pembaca streaming `readBounded` existing, maksimal8192 byte |
| Feedback validasi tidak terhubung ke kolom | Satu pesan generik, beberapa pesan default Inggris | Pesan Indonesia, path field, aria-invalid/describedby dan fokus summary |
| Label proses pada dua form tidak jelas | Satu boolean busy dipakai semua tombol | Action aktif memiliki label proses spesifik, pengunci tetap bersama |
| Risiko overflow teks/aksi dan kontrol kecil | Username tidak wrapping eksplisit, input pendek, tombol nowrap | min-w-0/w-full, wrapping, input/touch44px, padding responsif dan heading semantik |

Kondisi gate password/profil/pertanyaan/email/survei/peran/ready mendapat petunjuk khusus; navigasi halaman lain tetap melalui sidebar. Logout tetap tersedia. Perubahan password tetap mencabut sesi sebelum mengubah provider dan hanya finalisasi operasi yang benar diterima. Boolean RPC harus benar-benar `true`; respons truthy yang tidak sesuai ditolak. Tidak ada secret disimpan ke storage browser atau dikirim dalam hasil API.

## Berkas dan alasan

- `src/app/account/security/{page,security-panel,error,loading}.tsx`: lifecycle, feedback, retry, layout dan aksesibilitas.
- `src/app/api/auth/security/route.ts`: byte bound, cookie, acknowledgement dan hasil write/read terpisah.
- `src/lib/auth/security-validation.ts`: pesan lokal serta path error tanpa mengubah aturan bisnis.
- `tests/account-security.test.mjs`: actual page/route modules dengan batas Auth/provider/RPC terisolasi; cek origin, sesi, body, gate, password lama, rate, transisi password dan outage.
- `tests/ui/account-security-{fixture.tsx,navigation-shim.ts}` dan `scripts/verify-account-security.mjs`: actual panel/shell/loading/error dengan HTTP sintetis; bukan halaman replika.
- `package.json`: tes baru masuk `test:security`/`check`, browser script terpisah.
- `docs/design-system/MASTER.md`: aturan konsisten untuk form keamanan.

## Bukti verifikasi

- `npm ci`: lulus.
- `npm run test:security`:13 tes lulus (2 validasi/hash,4 database terisolasi,7 page/API).
- `npm run check`: lulus,523 tes dalam60 kelompok; TypeScript, ESLint tanpa warning, replay43 migrasi/14 tipe tabel, dan production build.
- Sesudah perbaikan acknowledgement akhir,7 tes page/API dan lint semua berkas terkait dijalankan ulang: lulus. Build memeriksa TypeScript kode final.
- Browser final menggunakan CSS production build terbaru:80 pemeriksaan lulus,7 pemeriksaan axe tanpa pelanggaran terdeteksi dan0 JavaScript page errors. Hasil: `account-security/results.json`.
- Screenshot desktop/mobile diperiksa secara visual. Gulir vertikal normal dipertahankan; tidak ditemukan overflow horizontal atau kontrol keluar viewport pada ukuran yang diuji.

Browser fixture memakai komponen aplikasi dan CSS production build, server HTTP lokal, Playwright Chromium, serta axe WCAG2A/AA dan2.1AA. Skenario mencakup320/390/768/1440px dan844x390 landscape, username panjang, seluruh gate, input kosong/konfirmasi salah, sukses, network/malformed/503/429/401, hasil password sebagian, klik ganda/lintasform, unmount, fokus, keyboard, sentuhan, resize/orientasi, loading dan retry. Halaman ini tidak memiliki daftar/pagination atau modal: skenario data banyak digantikan stress teks panjang dan seluruh varian status.

Gulir vertikal normal untuk formulir panjang tetap diizinkan; tidak disembunyikan dengan overflow-hidden. Tidak ada klaim halaman harus muat satu layar. Pengujian tidak memakai password atau akun produksi nyata, tidak mengganti password pengguna produksi, dan tidak menguji pengiriman OTP nyata (bukan alur halaman ini). Batas provider diuji melalui mock; fungsi SQL dijalankan pada database terisolasi hasil replay seluruh migrasi.
