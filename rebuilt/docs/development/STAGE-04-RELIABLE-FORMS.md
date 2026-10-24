# P04 — Keandalan formulir dan penyimpanan

Tanggal: 24 Oktober 2026 (WIB). Baseline `main`: `b863285991bb811a6b4b4257343bcb168085c93c`. Branch `feat/reliable-forms-p04`.

PR implementasi: [#48](https://github.com/kamadmtsnf-ai/sim-murid/pull/48). Status: implementasi dan verifikasi P04 selesai; hasil merge dapat diperiksa melalui PR.

## Analisis dan perubahan

Ditinjau hook mutasi beserta 11 pemakainya, controller khusus, shell/logout, kontrak command/snapshot, dispatcher API dan RPC idempotensi/revisi existing. D01–D03, ACADEMIC-1.0, RBAC, sesi, ledger, validasi server dan arsip D10 dipertahankan. Tidak ada migrasi atau perubahan database.

Temuan: hook menerima snapshot HTTP sukses tanpa memastikan acknowledgement/revisi; `fail()` bisa mengubah tampilan uncertain menjadi error meskipun lock tetap aktif; request tidak dibatalkan saat unmount; sebagian formulir hanya mencegah tab ditutup, bukan navigasi sidebar. Listener logout survei pada capture menghentikan autosave sebelum pengguna bisa membatalkan logout. Dirty flag tunggal pada Hasil Survei tidak membedakan formulir yang disimpan dan yang masih berubah.

Implementasi:

- `mutation-result.ts`: kontrak sukses `code=saved`, acknowledgement nested konsisten bila ada, snapshot tervalidasi dan revisi safe integer meningkat. Snapshot terbaru saja bukan bukti mutasi tertentu berhasil; acknowledgement domain tetap wajib.
- `use-mutation.ts`: lock sinkron, validasi sebelum HTTP, batas 30 detik, abort saat unmount, satu UUID per pengiriman, tanpa retry otomatis. HTTP 401/403 ditangani sebelum JSON. Hanya penolakan bisnis eksplisit yang membuka koreksi; unknown/stale/not_found/request_conflict memblokir. Timeout, jaringan putus, 5xx, body/ack/revisi tidak valid menjadi uncertain. `fail/clear` tidak bisa menghapus lock tersebut. Nilai form dibersihkan hanya oleh callback sukses existing.
- API Kelas/Jadwal menambahkan `code=saved` setelah RPC sukses dan readback; GET dan payload POST tetap kompatibel.
- `leave-guard.ts` mengadaptasi handler unload existing menjadi probe cancelable. `use-write-guard.ts` memaparkan boolean pending/dirty milik controller, tanpa mengambil atau menyimpan isian.
- `FormNavigationGuard` pada shell memblokir sidebar/link akun dan logout ketika proses aktif; meminta konfirmasi saat ada isian belum disimpan/hasil belum pasti. Pesan dapat difokuskan, wrapping dan responsif. Native beforeunload tetap tersedia. Cancel tidak menjalankan pembersihan draf logout.
- Controller khusus tetap memakai acknowledgement, readback, versi dan recovery masing-masing. Profil memakai timeout baca/tulis. Survei mempertahankan autosave setelah logout dibatalkan, form periode mendapat dirty guard. Hasil Survei melacak dirty per form sehingga menyimpan satu catatan tidak membersihkan tanda rencana lain.

## Matriks kontrak dan pemulihan

| Area | Bukti sukses dan konkurensi existing | Perilaku P04 / pemulihan |
|---|---|---|
| Kelas, tahun ajaran, jadwal KBM/piket | UUID request + education_state revision; RPC mencatat hasil idempoten; GET scoped setelah saved | Shared hook memeriksa ack/revisi; dirty modal/batch dipertahankan; muat ulang/periksa keadaan setelah hasil ambigu, tanpa replay otomatis |
| Piket guru, absensi, bimbingan | RPC operasi dengan command tervalidasi, request/revision, readback scoped dan audit | Lock pengiriman dan feedback bersama; aturan duplicate/overlap/correction tetap; batch independen tidak dibersihkan ketika koreksi lain gagal |
| Komite, tabungan | Request/revisi dan RPC ledger/waiver/slip; readback operasi dan katalog rekening | Tidak ada retry/penyimpanan draf finansial generik. Penolakan insufficient dapat dikoreksi; ambiguous harus diperiksa melalui data domain |
| Nilai/KKM, rapor, kenaikan/ijazah | Learning request/revisi; Rapor membuktikan publikasi siswa, kenaikan memakai promotionConfirmed; arsip final existing | Shared envelope diperketat; PH20/ATS30/ASAS50 dan Praktik terpisah tetap; tidak membuka arsip D10 |
| Poin siswa | Service request/revisi, acknowledgement dan snapshot scoped | Shared hook menjaga pending/uncertain, arsip bulan dan validasi katalog tetap |
| Profil pribadi | updated_at presisi dan konfirmasi kesamaan konten/readback | Controller khusus dipertahankan; timeout 30 detik; dirty/pending terlindungi pada sidebar/logout |
| Biodata/dokumen, buku | Revisi/ID dokumen, prepare-upload-commit, private storage dan readback khusus | Tidak mengganti protokol unggah atau menyimpan berkas di draft umum; blok perpindahan selama proses |
| Relasi keluarga, pengaturan | Request/revisi dan pembuktian singleton/konten; dirty set existing | Adapter pending dan handler dirty existing; konfigurasi rahasia tidak disalin ke cache |
| Tambah pengguna | Provisioning bertahap; requestId dan payload tetap untuk retry identik yang memang didukung API | Tidak mengganti idempotensi provisioning dengan retry UUID baru; pending/dirty guard; password hanya memori form |
| Keamanan, email, sesi, pemulihan | Controller khusus, acknowledgement/versi/sesi/cooldown/readback | Tidak memindahkan secret/OTP atau mengganti gate autentikasi; guard hanya menanyakan boolean proses/isian |
| Survei | Response revision, main/peer version, account+period+instrument drafts, final lock | Draf selektif existing tetap, konflik/readback/final lock tidak digeneralisasi; cancelled logout tidak menghentikan autosave |
| Hasil Survei/AI, pekerjaan | Controller readback/filter/revision dan provider/job status khusus | Dirty per form/pending guard; tidak memanggil penyedia berbayar atau mengirim pesan saat pengujian |

## Penyimpanan draf dan batas

Draf persisten hanya memakai rancangan Survei existing yang scoped akun/periode/instrumen. Form lain mempertahankan isian dalam memori saat request gagal dan meminta konfirmasi sebelum perpindahan. Password, OTP, jawaban keamanan, API key, transaksi dan dokumen tidak masuk cache generik.

Guard mencakup link akun/sidebar, logout dan native beforeunload. Tidak memodifikasi internal history Next.js atau menjamin pemulihan semua form setelah crash/tab ditutup; tombol Back browser SPA dan perubahan route programatik tetap perlu rancangan router-specific jika diperluas. Native unload dibatasi kebijakan browser. Pembatalan fetch bukan bukti server rollback; hasil ambigu tidak dianggap gagal tersimpan dan tidak otomatis diulang. GET umum tidak membuka lock mutasi atau mengasumsikan revisi meningkat membuktikan request tertentu.

## Verifikasi

Hasil aktual, file dan batas bukti dicatat pada `../verification/forms/README.md`. Browser memakai komponen nyata dengan HTTP sintetis, SQL existing diuji terisolasi. Tidak mengklaim UAT akun produksi, pengiriman email nyata atau panggilan AI berbayar. P05 berikutnya: penerapan navigasi/UI antarmodul.
