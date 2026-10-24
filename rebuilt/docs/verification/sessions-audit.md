# Audit Sesi dan perangkat — 24 Oktober 2026

## Alur dan batas lingkup

Dibaca: halaman/panel, shell/sidebar/dialog, principal server, proxy dan refresh cookie, security gate, perintah/DTO, API list/revoke, fungsi registry sesi beserta migrasi terakhir, tes lama, spesifikasi M01 dan keputusan bisnis. Alur: principal server → gate ready → list sesi sendiri/Admin → identitas akun/sesi yang ditampilkan → konfirmasi → revoke RPC → acknowledgement → status terbaru atau login bila sesi sendiri dicabut.

Aturan satu sesi aktif, TTL1jam/168jam, pengecekan registry terhadap Auth session, kewenangan Admin, urutan onboarding dan batas20 riwayat dipertahankan. Tidak ada perubahan database, migrasi, konfigurasi Auth, atau pencabutan akun produksi untuk pengujian. Seluruh waktu tampilan WIB; label terakhir diperiksa tidak mengklaim aktivitas pengguna.

## Temuan dan perbaikan

| Masalah | Penyebab | Perbaikan |
|---|---|---|
| Respons pencarian lama dapat menimpa data terbaru | Abort saja tidak cukup setelah response/JSON selesai, tanpa nomor urut request | Generation guard sebelum/sesudah parsing; batalkan read lama saat target berganti |
| Polling berbenturan dengan pencabutan/konfirmasi | Refresh60detik dan visibility listener tetap aktif ketika mutasi berjalan | Hentikan read selama konfirmasi/mutasi; invalidasi read sebelum mutasi; followup read terarah |
| Salah mengartikan sesi kedaluwarsa sebagai gangguan jaringan | JSON dibaca sebelum401 | Redirect401 sebelum parsing; gate403 tetap menuju Keamanan akun |
| Pengiriman ganda dan respons setelah unmount | Pengunci hanya state busy, tanpa lifecycle guard mutasi | Ref lock sinkron dan guard mounted sebelum data/pesan/navigasi |
| Respons200 tanpa acknowledgement dianggap sukses | Client hanya memeriksa response.ok | Validator bersama revoked nonnegatif dan signed_out boolean; nol dijelaskan jujur |
| Hasil mutasi tidak pasti dapat dikirim ulang buta | Network error tidak memblokir aksi berikutnya | needsSync menonaktifkan pencabutan sampai list tervalidasi, tanpa retry mutasi otomatis |
| Pencabutan berhasil dapat dilaporkan gagal | Cleanup provider sesudah registry commit dapat throw | Pertahankan acknowledgement registry dan signed_out; API tetap mencabut melalui registry server |
| State tidak tersedia diarahkan ke security walau sesinya invalid | Null onboarding diperlakukan sama dengan gate belum ready | Bedakan401 invalid session dan403 gate; page mempertahankan redirect dan boundary outage |
| Tanggal rusak dapat menyebabkan RangeError saat render | DTO menerima string tanggal apa pun | Validasi ISO offset untuk ketiga waktu; ID duplikat ditolak; serverTime optional |
| Label aktif/tombol tertinggal sampai polling | Tidak ada derivasi waktu kedaluwarsa | Gunakan waktu server sebagai offset dan clock lokal; konfirmasi memeriksa kedaluwarsa lagi; backend tetap otoritatif |
| Konfirmasi tidak menjelaskan target/dampak | window.confirm generik | Dialog existing menampilkan akun/perangkat, dampak sesi sendiri dan scope seluruh akun termasuk di luar20 riwayat |
| Loading/error/empty tercampur | Semua data null ditampilkan sebagai menunggu | State terpisah, data terakhir diberi status belum tersinkron dan aksi dikunci; sukses read menghapus error lama |
| Username/label panjang dan kontrol mobile | Flex child/input tanpa min-width, teks tanpa wrapping, input kecil | Card satu kolom, min-w-0, wrap-anywhere, input/tombol44px, padding adaptif, dialog scroll terbatas viewport |
| Body UTF8 besar/terputus belum aman ditangani | request.text menghitung karakter dan membaca body penuh di luartry | readBounded existing menghitung byte streaming maksimal2048, error413/400 terarah |

Pencarian tetap exact tanpa trim/case folding/konversi angka; nol awal dan minus dipertahankan. Target mutasi berasal dari snapshot yang sedang ditampilkan, bukan draft input. API menolak username asing untuk non-Admin sebelum RPC; SQL tetap memeriksa sesi/role/ownership pada transaksi, termasuk perubahan role setelah halaman dimuat. Seluruh20 riwayat tetap tampil tanpa pagination yang tidak diperlukan. Gulir vertikal normal dipertahankan; tidak menyembunyikan konten dengan overflow-hidden.

## Berkas berubah

- `src/app/account/sessions/{page,session-panel,error,loading}.tsx`: alur request, status, dialog, layout, focus dan retry.
- `src/app/api/auth/sessions/route.ts`: bounded body, gate/session, identity, timestamp dan acknowledgement.
- `src/lib/auth/sessions.ts`: DTO waktu/ID, response revoke bersama, derivasi expiry yang dapat diuji.
- `src/components/ui/dialog.tsx`: prop opsional closeDisabled, defaultfalse; hanya dialog sesi memakainya ketika pencabutan diproses. Perilaku pemakai lain tetap sama.
- `tests/sessions-page.test.mjs`: actual page/API dengan batas Auth/RPC terisolasi.
- `tests/database/sessions.test.mjs`: fungsi SQL aktual; tambah batas/urutan20 data, parse DTO aktual dan tujuh peran.
- `tests/ui/sessions-{fixture.tsx,navigation-shim.ts}` dan `scripts/verify-sessions.mjs`: actual panel/shell/dialog/loading/error dengan HTTP lokal sintetis.
- `package.json`: tes page/API menjadi bagian test:sessions/check, browser command terpisah.
- `docs/design-system/MASTER.md` dan hasil browser: catatan penerapan/QA.

## Verifikasi

- npm ci dan TypeScript awal lulus.
- Tes API/page/DTO8 lulus; tes database6 lulus (fungsi aktual pada replay43 migrasi terisolasi).
- Seluruh533 tes unik/61 kelompok lulus:398 tes pada48 kelompok dalam rangkaian awal,135 tes pada13 kelompok sisa yang dijalankan terpisah. Modul Rapor19 tes juga diulang secara mandiri dan lulus (tidak dihitung ganda).
- Catatan runner: `npm run check` berhenti exit1 setelah398 tes, tanpa laporan subtes gagal; penyebab berhentinya runner tidak teridentifikasi. Karena itu tidak diklaim perintah gabungan tersebut lulus. Semua perintah tersisa dijalankan satu per satu dengan pencatatan exit code.
- TypeScript dan ESLint seluruh aplikasi lulus; lint ulang berkas UI/script terakhir juga lulus tanpa warning.
- `db:types:check` lulus:14 tabel public cocok dengan replay43 migrasi.
- Build awal gagal membuka persistence cache Turbopack lokal (`invalid digit found in string`). Folder hasil `.next` dipindahkan keluar repo, kemudian `npm run build` bersih lulus exit0, termasuk TypeScript kode final. Ini bukan kegagalan database aplikasi.
- Browser final memakai CSS build bersih terbaru:105 pemeriksaan lulus,13 pemeriksaan axe tanpa pelanggaran terdeteksi,0 JavaScript page errors. Termasuk jam perangkat berbeda24jam, expiry ketika dialog sudah terbuka, draft username berbeda dari target tersimpan, serta fokus hasil pencabutan.
- Hasil: `sessions/results.json` dan `sessions/checks.json`. Screenshot normal/stress desktop/mobile diperiksa secara visual; tidak ditemukan overflow horizontal atau kontrol keluar viewport pada ukuran yang diuji.

Browser memakai komponen aktual dan CSS hasil production build, Playwright Chromium serta axe WCAG2A/AA/2.1AA. Skenario:320/390/768/1440px,844x390 landscape,20 riwayat dan label panjang, kosong, peran biasa/Admin, pencarian nol-awal/minus, owner mismatch, request bertumpuk, dialog cancel/Escape/focus, revoke one/all/self/zero, klik ganda, network/503/malformed/401/403, read setelah write gagal, visibility polling, unmount, expiry dan jam perangkat salah, keyboard/touch, resize/orientasi, loading dan retry.

Tidak memakai akun produksi nyata. Batas SDK Auth diuji melalui mock, sedangkan otorisasi/revocation/expiry/role SQL dijalankan di database terisolasi. Tidak mengklaim pengujian browser sebagai login atau pencabutan sesi produksi end-to-end. Tidak menambah tabel, API kontrak yang memutus kompatibilitas, atau arsitektur autentikasi baru.
