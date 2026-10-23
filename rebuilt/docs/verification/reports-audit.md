# Audit Rapor dan favicon — 23 Oktober 2026

## A. Temuan dan alur

Dibaca sebelum mengubah: LearningPanel lengkap dan dependencies, LearningPage, learning API/server/validation/print, shared Dialog/TableRegion/confirmed mutation, layout/WorkspaceShell, M11, kebijakan D01/D10/ACADEMIC-1.0, report snapshots/draft/learning read/write dan override singleton terbaru. Alur: verified principal/session → onboarding/survey gate → scoped RPC → draft atau immutable snapshot → filter/selection/table/PDF. Publish memakai UUID/revision → atomic DB validation/audit → scoped readback → feedback.

- Generic snapshot menerima struktur rapor tak lengkap dan duplikasi siswa akibat beberapa role. Draf null dapat tampak sebagai Terbit. Belum ada validasi identitas/periode/class scope dan konflik baris.
- Pilihan kosong berarti seluruh daftar pada publish; gagal/unknown acknowledgement atau gagal readback belum dibedakan dengan aman, dan read/write tidak memiliki lock bersama.
- Pilihan jenis rapor hanya memengaruhi PDF, tabel tetap gabungan; tanda `*` pada nilai belum lengkap kurang jelas. Unduhan navigasi langsung ke API tidak memberi loading/error feedback.
- Semua siswa/tabel dirender sekaligus tanpa pencarian/status/pagination; nama panjang, viewport sempit dan modal konfirmasi memerlukan wrapping serta scroll lokal.
- PDF wrapping memakai ukuran font 10 untuk judul 15 dan tidak memecah identitas panjang tanpa spasi.
- Root app belum memiliki favicon. Workspace memakai ikon sekolah dengan identitas teal.

## B. Perbaikan

ReportsPanel khusus menggantikan cabang Rapor generik tanpa duplikasi. Filter kelas/tahun ajaran dan semester dipisah dari scope data yang berhasil dimuat; request gagal mempertahankan snapshot sebelumnya. Pencarian nama/username, filter status, pagination 10 siswa, pilihan halaman/clear, jumlah pilihan dan ringkasan status. Status Draf siap terbit / belum lengkap / Tidak tersedia / Terbit jelas. Nilai null berbeda dengan 0, rumus D01 tetap PH20/ATS30/ASAS50 dan Praktik terpisah. Jenis rapor yang sama digunakan tabel dan PDF melalui helper bersama.

Schema memvalidasi safe revision, identitas student/class/semester/status/komponen; duplikasi identik digabung, konflik ditolak sebagai upstream unavailable. Capability canPublish tetap dari verified RPC; server tidak mengambil caller dari client. Tidak ada migrasi, perubahan backend/RBAC/RLS/enrollment/rumus atau penimpaan arsip D10.

Penerbitan memerlukan pilihan eksplisit 1–500 draf lengkap dan modal konfirmasi identitas/komponen; published/incomplete/unavailable tidak ditawarkan sebagai siap. Synchronous lock read/download/write, timeout dan unmount cleanup. Confirmed mutation mempertahankan result/message legacy serta menambah code/data; endpoint tanpa query tetap didukung dengan scope command. Filter eksplisit yang berbeda ditolak sebelum RPC. Success hanya setelah known ack dan readback menunjukkan revision terbaru serta seluruh target sudah terbit. Unknown/network/malformed/readback failures memblokir blind retry dan meminta reload. Backend tetap final authority terhadap stale/idempotency/role/komponen dan immutable snapshot.

Download melalui fetch/blob dengan loading/error/success, explicit selection, no-store dan revokeObjectURL; pilihan asing/duplikat ditolak, hasil kosong 404. PDF server-only; helper predikat kecil dipisah agar pdf-lib tidak masuk bundle Rapor client. PDF wrapping mempertimbangkan ukuran font dan memecah token panjang. Favicon SVG sekolah teal via Next app/icon.svg convention, tanpa aset eksternal.

UI memakai token dan komponen existing. Tabel scroll lokal berlabel dan keyboard focusable; teks panjang wrapping; modal bounded/scroll penuh, focus trap/return/Escape dan kontrol pending/uncertain. Gulir vertikal konten yang panjang adalah perilaku normal, bukan menutup overflow dengan hidden.

## C. File final

- src/app/icon.svg: favicon sekolah sesuai brand.
- src/app/account/learning/[module]/reports-panel.tsx: UI, state, filter, modal, PDF dan confirmed publish.
- src/app/account/learning/[module]/panel.tsx: dispatch dan hapus cabang Rapor lama.
- src/app/account/learning/[module]/page.tsx: outage Rapor ke retry boundary.
- src/lib/learning/reports.ts: schema, status, dedup dan value mapping.
- src/lib/learning/server.ts: scope/validasi read, upstream failures.
- src/app/api/learning/[module]/route.ts: ack/readback/publish scope dan PDF selection.
- src/lib/learning/grade.ts + print.ts: shared predikat, PDF values dan wrapping.
- src/app/globals.css: scoped responsive dialog.
- tests/reports.test.mjs + tests/grades.test.mjs: route/server/schema/compatibility/PDF tests.
- tests/ui/reports* + scripts/verify-reports.mjs: actual component browser harness, synthetic records/API boundaries.
- tests/ui/academic-fixture.tsx + scripts/verify-academic.mjs: metadata Rapor baru, assertion periode tetap.
- package.json: scripts dan check integration.
- docs/design-system/MASTER.md + docs/verification/reports*: pedoman/audit/hasil QA.

## D. Validasi

`npm ci` dan rangkaian `npm run check` lulus **388/388 tes / 46 kelompok runner**, termasuk **19 tes Rapor** dan integrasi learning/database existing (rumus D01, Praktik 0/100, izin role, incomplete/published, idempotency, stale, immutable archive). TypeScript, ESLint, types 14 tabel hasil replay migrasi dan production build lulus. Setelah perbaikan browser pada CSS/akses keyboard, typecheck/lint/build diulang pada kode final. Audit deadcode tidak menemukan unreachable source; diff check lulus.

Browser Rapor final lulus **62 pemeriksaan / 7 axe runs**; regresi akademik **41 pemeriksaan / 6 axe runs**. Tidak ada violation atau uncaught JavaScript error pada skenario teruji. Viewport 320×740, 768×1024, 1440×900 dan landscape740×320; data kosong/35 siswa, read-only, pencarian/pagination, Praktik0, null draft, jenis rapor, publish confirmation/ack, modal footer/focus trap/Escape/return, sentuhan checkbox, double-click satu request, PDF success/error, loading lock/failed read mempertahankan data, network/malformed/stale memblokir retry. Screenshot final diperiksa visual; nama panjang dan tombol/table wrapping tidak membuat page overflow. Daftar modal scrollable diberi focus keyboard setelah axe menemukannya. Tombol unduh memakai label visual ringkas dan accessible name siswa. Favicon HTTP200 `image/svg+xml` sesuai brand.

Bukti: reports/check-results.json, browser-results.json, favicon-results.json, academic-regression/browser-results.json. Batas command/selected PDF tetap500; unduh semua kelas existing di atas500 tetap lewat scope tanpa daftar ID panjang. Batas katalog backend existing2000 people tetap; tidak ada pemotongan publish diam-diam. Tidak ada akun, data siswa, penerbitan rapor atau mutasi database produksi yang digunakan untuk QA. Browser memakai komponen/shell sebenarnya dengan HTTP dan sesi sintetis; integrasi SQL memakai migrasi aktual di PGlite. Batas ini tidak setara uji CRUD terautentikasi setiap role pada perangkat fisik atau manual screen reader.
