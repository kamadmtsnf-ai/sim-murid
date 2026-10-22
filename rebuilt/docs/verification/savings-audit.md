# Audit Tabungan — 22 Oktober 2026 (Asia/Jakarta)

## A. Temuan

- Panel generik belum memulihkan jenis transaksi, nominal, rekening, dan pilihan biaya dari slip lama secara utuh. Biaya Rp0 tidak membuktikan bahwa flag penerapan biaya false. Koreksi berpotensi mengganti pilihan biaya tanpa disadari.
- Pratinjau biaya tidak terikat dengan pasangan nominal/flag terkini. Tarif lama tidak dipulihkan dengan benar pada form koreksi, termasuk status nonaktif dan alasan perubahan.
- POST tabungan lama hanya mengembalikan result/message; UI belum mensyaratkan snapshot tervalidasi sebelum sukses. Snapshot upstream generik belum memeriksa hubungan saldo, delta, fee/cash, reversals dan angka aman.
- Katalog rekening input ikut berisiko menyempit ketika filter riwayat berubah; rekening baru perlu tersedia tanpa reload. Ringkasan generik memakai label domain lain; nominal/ringkasan/tren bersih perlu konteks rupiah dan nilai negatif.
- Pengiriman slip mengeklaim antrean sebelum menyiapkan PDF; kegagalan persiapan dapat meninggalkan status sending walau belum ada percobaan SMTP. Hasil RPC pencatatan akhir tidak diperiksa sehingga UI dapat menerima status sent saat pencatatannya gagal.
- Status antrean email mentah tidak memberi panduan hasil ambigu; slip HTML belum memiliki viewport/wrapping untuk nama tanpa spasi. Ekspor belum mencantumkan biaya dan tunai diterima.

## B. Perbaikan

Membaca panel, fee helper, parser/server, route operasi, quote/slip, formatter ekspor/PDF, hooks/Dialog/TableRegion, spesifikasi dan seluruh SQL ledger/fee/slip/read yang relevan sebelum perubahan. Alur: principal terverifikasi → RPC scoped → snapshot → filter/tabel/rekening; modal → schema → mutation UUID+revision → write RPC atomik → read snapshot → render; penarikan → quote RPC → immutable slip → queue/prepare/claim/SMTP/complete. Backend tetap otoritas saldo, akses dan biaya.

- SavingsPanel khusus menggunakan tokens, Button/Dialog/TableRegion dan confirmed mutation existing. Dispatcher lama kini hanya mendelegasikan kelima modul, tanpa fungsi generik duplikat.
- Modal rekening/transaksi/tarif terpisah; koreksi mempertahankan rekening asal dan memuat flag biaya dari immutable slip yang cocok dengan ID/rekening/nominal. Gagal baca biaya memblokir simpan koreksi; void tetap hanya membutuhkan alasan. Nominal/date/reason terkontrol, batas hari ini, kelipatan Rp1.000. Tarif memulihkan minimum/maksimum/persentase/aktif dan meminta alasan saat perubahan.
- Quote tetap dihitung server, diverifikasi gross = fee + cash dan flag cocok, hanya terlihat untuk pasangan nominal/flag saat ini. Tidak ada kalkulasi tarif baru di browser. Flag true dengan fee nol tetap true.
- Snapshot/filter khusus memeriksa safe integer, rentang efektif maksimal 366 hari, relasi ledger, row reversal/read-only dan fee/cash. POST mempertahankan result/message serta menambah code/data. Acknowledgement tak dikenal/readback rusak tidak dianggap berhasil. Konflik/hasil tak pasti mempertahankan draf, mencegah retry buta dan meminta reload. Semua route tetap menggunakan auth/session/survey/origin/RBAC existing.
- Katalog input awal terpisah dari filter. Setelah membuka rekening, API membaca katalog tanpa filter dengan principal/session sama dan revision identik, menambahkan catalogAccounts pada extra snapshot. UI menyegarkan katalog tanpa menyempitkan filter tampilan; bila revision berubah, hasil dilaporkan tak pasti. Tidak memperluas izin atau mengubah kontrak lama.
- Daftar rekening memakai search/pagination lokal; ledger punya kolom kontekstual/status pembalik/biaya/tunai dan pagination server. Ringkasan rupiah dan tren bersih mempertahankan nilai negatif. Ekspor menambah saldo sebelum/biaya/tunai bila tersedia; PDF tabungan membungkus teks berdasar lebar font.
- Persiapan slip/PDF sebelum claim; transport ditutup dan kegagalan konstruksi masuk klasifikasi kegagalan. Complete RPC diverifikasi sebelum melaporkan status; kegagalan menghasilkan 503 ambiguous. UI memisahkan cek status dari kirim, lock sinkron, timeout/abort, label status Indonesia dan blokir pengiriman ulang saat sending/ambiguous. Tidak mengirim email sungguhan selama audit.
- Dialog menjaga dirty/pending dismissal dan focus return/fallback. Kontrol 44px, min-width 0, text wrapping, tabel scroll lokal, modal max viewport dengan footer terjangkau. Slip HTML menambah viewport, heading dan wrapping; escaping/CSP tetap dipertahankan.

Tidak ada migrasi/database, perubahan role/auth, rumus FEE-1.0, kategori S/G/N, ledger append-only, sumber data atau API/RPC yang dihapus. Saldo didebit sebesar gross sekali; cash = gross − fee. Deposito harian unik, reversal/koreksi, nonnegative balance dan idempotency tetap dijaga SQL existing.

## C. File final

| File | Alasan |
| --- | --- |
| src/app/account/operations/[module]/savings-panel.tsx | UI, katalog/filter, modal, ledger, quote, koreksi/void |
| src/app/account/operations/[module]/panel.tsx | Dispatcher khusus, hapus panel generik terakhir |
| src/app/account/operations/[module]/fees.tsx | SlipActions, status/timeout/uncertainty |
| src/app/account/operations/[module]/page.tsx | Outage tabungan memakai retry boundary |
| src/lib/operations/savings.ts | Snapshot, filter, quote, delivery schemas dan label |
| src/lib/operations/validation.ts | Precision/reason tarif sesuai SQL |
| src/lib/operations/server.ts | Validasi upstream tabungan |
| src/lib/operations/export.ts | Fee/cash/saldo sebelum dan wrapping PDF |
| src/app/api/operations/[module]/route.ts | Validasi filter, confirmed write/read, katalog rekening |
| src/app/api/slips/quote/route.ts | Validasi input dan output quote |
| src/app/api/slips/[id]/route.ts | Persiapan sebelum claim, verifikasi complete, slip HTML mobile |
| src/app/globals.css | CSS scoped tabungan |
| tests/savings.test.mjs | Actual schema/route/export/slip dengan boundaries sintetis |
| tests/duty.test.mjs | Savings kini confirmed, menolak snapshot malformed |
| tests/ui/savings-fixture.tsx + savings-navigation-shim.ts | Fixture actual UI/shell |
| scripts/verify-savings.mjs | Browser/axe/geometry/interaksi |
| package.json | Savings suites dan integrasi check |
| docs/design-system/MASTER.md + docs/verification/savings* | Pedoman, audit dan bukti QA |

## D. Validasi

`npm ci` dan final `npm run check` lulus **336/336 tes / 43 kelompok runner**: TypeScript, ESLint tanpa warning, unit/route/integrasi database, generated types 14 tabel dan production build. Suite baru berisi **15 tes Savings**, termasuk quote, konfirmasi write/readback, ledger/fee/cash validation, auth/origin/survey, PDF/XLSX serta slip prep/complete/HTML. Tidak ada unreachable source pada audit graph; `git diff --check` lulus.

Browser Tabungan lulus **47 pemeriksaan / 6 axe runs**, tanpa violation aksesibilitas, uncaught JavaScript error atau horizontal page overflow dalam skenario teruji. Regresi Iuran Komite lulus **86 pemeriksaan / 6 axe runs**. Bukti machine-readable ada di savings/browser-results.json, committee-regression.json dan check-results.json.

Cakupan browser: 320/375/768/1440 piksel; normal/kosong/50 transaksi/79 rekening/baca-saja/loading/error; signed trend; modal transaksi dan perubahan orientasi 768×375 dengan submit terjangkau; quote/stale amount; account creation/catalog refresh; original applied true dengan fee nol; rekening koreksi terkunci; note/tarif/aktif/alasan prefill; search/pagination/empty; filter scope; Escape/return focus/fallback focus/dirty dismissal; nominal step; insufficient/uncertain/draft retention; reversal-aware actions; void; read error preserves snapshot; email ambiguous blocks blind retry. Screenshot desktop/mobile diperiksa visual, hanya hasil JSON yang dikomit.

Integrasi database existing memverifikasi kategori rekening terpisah dari role, setoran harian unik, nominal kelipatan Rp1.000, nonnegative balance/overdraft, append-only reversal/koreksi setelah pengeluaran, idempotency/revision, manager/head/owner/parent scope, role revocation dan RLS; fee bracket overlap/half-up, gross debit sekali, immutable slip dan deduplikasi recipient terverifikasi. Tidak menambah atau mengganti kebijakan SQL.

Kendala harness yang diperbaiki: select native memakai accessible name dengan isi option; intercept wildcard slip semula menangkap quote sehingga dialihkan ke handler quote. Kedua kegagalan terjadi pada fixture pengujian, diperbaiki sebelum suite final lulus. Diagnostic failure/PNG tidak dikomit. Dependency QA terpisah dari aplikasi.

Batas: fixture browser/API dan SMTP sintetis, bukan authenticated production CRUD setiap role, perangkat fisik, manual screen reader atau penerimaan pesan pada inbox nyata. PGlite menguji migrasi/kontrak tanpa ekstensi native pg-safeupdate; test predicate safeupdate existing tetap dijalankan. Katalog profil awal dibatasi 2.000 sesuai backend existing. Permission/revision dinamis tetap diperiksa saat write. Gulir vertikal halaman/modal dan gulir lokal tabel adalah perilaku normal; tidak menyembunyikan konten dengan overflow hidden global. Tidak mengklaim semua kemungkinan bug telah hilang.
