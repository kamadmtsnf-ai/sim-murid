# Audit Guru Piket — 22 Oktober 2026 WIB

Basis main: dd6fb9e18a44c89cc9b7250a0d4594870e5c00c5 (PR19). Branch: fix/teacher-duty-audit.

## A. Temuan

1. Form jadwal mingguan selalu merender checkbox kosong, tanpa memuat teacher_duty_roster. Mengubah satu hal dapat menghapus hari lama saat penyimpanan replacement.
2. Pilihan konfirmasi utama/guru yang digantikan memakai seluruh guru, bukan guru dalam roster hari berjalan; banyak pilihan menghasilkan invalid dari SQL.
3. Form koreksi menawarkan unconfirm/cancel pada status yang tidak sesuai, termasuk catatan cancelled. SQL mengembalikan pending/cancelled menurut jenis; UI harus membatasi tindakan yang relevan dan catatan hari ini.
4. Filter generik “Siswa/pemilik” memfilter katalog people, sedangkan query riwayat Duty hanya memakai periode dan scope; kontrol tersebut tidak memfilter catatan seperti yang tersirat. SSR page juga tidak membaca query, sehingga reload/pagination/filter tidak mempunyai konteks yang dapat dipertahankan.
5. Save menampilkan message sukses sebelum refresh tervalidasi; hasil network/read tak pasti membuka lock untuk retry. Tidak ada timeout, draf/fokus modal atau blokir stale yang bertahan.
6. Snapshot operasi memakai record bebas dan revision/metadata numerik tanpa constraint. Malformed response pada operationsData.parse menjadi ZodError/400 alih-alih kegagalan upstream.
7. Tabel generik memuat kolom nominal/saldo dan uraian lintasmodul yang tidak relevan dengan Guru Piket. Hierarki roster/riwayat, feedback fokus, wrapping dan tampilan mobile perlu ditata.

## Analisis sebelum perubahan

Dibaca: OperationsPage, OperationsPanel dan fees helper yang diimpor, API operations route, educationContext/failure, server/command/filters/snapshot operations, export XLSX/PDF, shared mutation hook, Dialog/TableRegion/control/Button/WorkspaceShell/CSS; spesifikasi M08/U10 dan keputusan bisnis. SQL duty confirmation, app_operations_read/write, override singleton terbaru, app_duty_confirmed dan tes integrasi operasi/absensi ditelusuri. Tidak ada GAS pada alur ini.

Alur dipertahankan: principal/session terverifikasi → survey gate untuk API → filter/payload terbatas → app_operations_write. Operations_state dikunci, revision/request UUID diperiksa, kemudian app_duty_mutate memeriksa admin, guru aktif, roster/tugas, tanggal WIB dan status. Konfirmasi utama langsung confirmed; penunjukan pengganti pending dan harus dikonfirmasi terpisah. Unconfirm/cancel segera memengaruhi app_duty_confirmed dan akses absensi; izin tidak diwariskan ke hari berikutnya. Roster mengganti jadwal guru Senin–Sabtu dan assignTask tetap opsional. Audit/idempotency/RLS/invoker dan predicate singleton safeupdate tidak diubah.

## B. Perbaikan

- DutyPanel khusus memakai komponen dan token existing. Cabang Duty pada panel generik dihapus; exported OperationsPanel tetap mendelegasikan Duty bagi pemanggil lama. Alur non-Duty tetap menggunakan GenericOperationsPanel dengan logika existing.
- Jadwal perhari dan riwayat dipisahkan dengan Radix Tabs. Empat jenis form memakai Dialog existing, satu modal aktif. Piket lama diprefill, pergantian guru dan penutupan modal menghormati draf, fokus kembali ke pemicu, pending menolak dismissal.
- Pilihan utama/replacesId diambil dari guru aktif dalam roster hari ini; server tetap menentukan status tugas dan izin final. Self-substitution ditolak sebelum network. dutyActions membatasi status/tanggal/can_edit.
- Gunakan useDomainMutation confirmed dengan schema Duty: lock sinkron, timeout 30 detik, snapshot baru sebelum sukses/penutupan, error mempertahankan isian, stale/denied/hasil tak pasti meminta reload tanpa retry otomatis.
- Duty POST mempertahankan result/message, menambah code dan data snapshot. Modul lain tetap result/message saja. Malformed/unknown acknowledgement serta kegagalan read setelah write menjadi 503, tidak dianggap sukses atau salah isian.
- dutySnapshot memeriksa module, revision aman, metadata integer, roster hari 1–6, status/jenis/referensi dan duplikasi. operationsData mengubah malformed Duty menjadi kegagalan layanan; perilaku parser modul lain dipertahankan.
- Filter Duty dibatasi pada year/start/end/page. Blank dihapus, batas tanggal 2000–2100 serta rentang efektif (termasuk batas implisit tahun) divalidasi sebelum write. Page membaca query, memuat filter, mempertahankan tab history dan memberi reset filter pada query invalid. Reset memakai query relatif halaman yang sama agar tidak menduplikasi tujuan sidebar.
- Pesan Duty lebih relevan, kolom keuangan dihapus dari tampilannya. Roster dikelompokkan perhari, nama panjang wrap, tabel scroll lokal, modal tinggi maksimal 100dvh-32px dan tombol 44px.

Tidak ada migrasi, perubahan data produksi, privilege/RBAC/RLS, autentikasi, rumus keuangan/penilaian, aturan akademik atau dependency. Kontrak Duty bertambah field secara kompatibel; command, UUID dan result lama tetap tersedia. Tidak mengubah pengiriman reminder/job/outbox yang berada di layanan lain.

## C. File final

| File | Alasan |
| --- | --- |
| src/app/account/operations/[module]/duty-panel.tsx | UI dan state Guru Piket khusus, roster prefill, modal, history/filter/pagination/export links |
| src/app/account/operations/[module]/panel.tsx | Delegasi ke DutyPanel dan penghapusan cabang Duty lama; non-Duty dipertahankan |
| src/app/account/operations/[module]/page.tsx | SSR filter Duty, denied/outage, history/key/fokus serta reset query |
| src/lib/operations/duty.ts | Schema/filter/action/date labels dan pesan Duty yang dipakai bersama |
| src/lib/operations/server.ts | Validasi snapshot Duty dan klasifikasi upstream 503 |
| src/app/api/operations/[module]/route.ts | Pre-write Duty filters, acknowledgement, snapshot read-after-write; output modul lain tetap |
| src/app/globals.css | CSS scoped duty-panel/duty-dialog |
| tests/duty.test.mjs | Actual page/API/schema/export dengan Auth/SDK boundary sintetis |
| tests/ui/duty-fixture.tsx + duty-navigation-shim.ts | Fixture komponen nyata dan path navigasi; tidak menambah route aplikasi |
| scripts/verify-duty.mjs | Browser/axe/geometry/interaksi/touch/keyboard/timeout |
| package.json | Perintah Duty test/browser dan integrasi ke check |
| docs/design-system/MASTER.md | Pola Guru Piket yang konsisten |
| docs/verification/teacher-duty-audit.md + duty/*.json | Bukti dan batas verifikasi |

## D. Validasi

`npm run check` lulus: **293/293 tes**, 39 kelompok test runner; TypeScript, ESLint tanpa warning, integrasi database terisolasi, generated database types dan production build. `npm run test:duty` lulus **13/13**. `npm run audit:deadcode` tidak menemukan source unreachable; `git diff --check` lulus. Hasil mesin tercatat di duty/automated-results.json. Suite browser Guru Piket telah lulus **131 pemeriksaan / 9 axe runs**, nol pelanggaran, tanpa uncaught JavaScript error atau horizontal overflow pada skenario yang diuji.

Cakupan browser: normal/kosong/50 baris/60 guru/read-only/loading/error; viewport 320/375/768/1440, mobile pendek 320×568, landscape 812×375 dan resize desktop. Tiga modal input dan modal koreksi; footer dapat digulir ke viewport; fokus kembali/trap; keyboard Enter/Escape/Tab; prefill hari, dirty cancel/ganti guru, roster kosong, primary/appoint/confirm/unconfirm/cancel, self-substitution, pending close lock, invalid/duplicate/stale/denied/network/malformed/timeout, filter/history/pagination/export link.

Tes page/API/schema mencakup semua command dan identity server; filter invalid sebelum write, blank normalization GET/POST, auth/survey/Origin, konflik, unknown/malformed acknowledgement, read-after-write failure, respons non-Duty tetap, action status/tanggal, malformed snapshot, SSR filter/outage/redirect dan byte XLSX/PDF aktual. Suite database operasi menguji akses absensi, pembatalan segera, expiry esok, replay/stale, role/session dan RPC/table denial.

Kendala QA yang diselesaikan: cache Turbopack lama memerlukan pembersihan .next; executable Chromium sementara sempat terpotong/tidak executable sehingga diekstrak ulang dari paket yang sama. Harness resolver sempat memperlakukan direktori dependency PDF sebagai file; diperbaiki dengan isFile. Uji kebijakan sidebar menemukan reset link absolut; diganti reset query relatif tanpa mengubah/melonggarkan tes. Keberhasilan hanya dilaporkan untuk hasil final yang benar-benar lulus.

Batas: browser menggunakan fixture sintetis dan respons API terintersepsi; bukan akun/mutasi produksi tiap role atau perangkat fisik/pembaca layar manual. Integrasi database memakai lingkungan terisolasi/PGlite, bukan ekstensi C pg-safeupdate native. Gulir vertikal halaman/daftar/modal tetap normal; tidak menjanjikan aplikasi bebas seluruh bug pada kondisi yang belum diuji. Roster/tugas/daftar guru mengikuti scope dan batas katalog server existing; validasi tugas final tetap di database.
