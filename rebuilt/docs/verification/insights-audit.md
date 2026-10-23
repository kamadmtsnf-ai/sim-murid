# Audit Hasil Survei — 23 Oktober 2026

Baseline main `46b6d925886f60d18dc669ebab1e4d6247c429d9`; branch `fix/insights-openai-audit`.

## Analisis dan batas perubahan

Dibaca page/dispatcher/InsightsPanel, server reader, validasi, API services/AI, export, schema analisis, AES-GCM, RPC read/write/admin/AI dan override terakhir, spesifikasi Survei dan keputusan akademik, serta tes services/production/Survei/akademik. Tidak mengganti autentikasi, bank pertanyaan, perhitungan Likert, threshold privasi peer, hak pengelola, atau aturan rencana aksi.

Alur: sesi terverifikasi dan gate survei wajib → RPC berizin → katalog periode bertarget dari RPC Survei existing → metadata aman tanpa jawaban responden → scope hasil sesuai filter → mutasi UUID/revisi → acknowledgement dikenal → pembacaan balik periode/isi yang sama. Catatan dan rencana tidak dinyatakan berhasil hanya karena HTTP 200.

## Temuan dan perbaikan

| Masalah | Perbaikan |
| --- | --- |
| Request filter tidak terkunci; hasil lama dapat diasosiasikan dengan periode baru | Workspace khusus, lock sinkron, timeout, scope terkonfirmasi, blok saat gagal dan pemulihan eksplisit |
| Hasil personal tidak memiliki katalog periode; metadata tahun ajaran/semester hilang | Proyeksi katalog Survei berizin, cek revisi sama, tanpa meneruskan respons pribadi; periode asing ditolak |
| Analisis AI menghilangkan filter role/quality setelah refresh | Reload mempertahankan scope; perbedaan scope draft/applied memblokir tindakan |
| Klik ganda dapat memicu beberapa panggilan AI | Lock sinkron dan feedback sedang diproses; timeout, tanpa retry otomatis |
| Rencana selalu dimulai dari tiga baris kosong | Isi tersimpan dan jumlah poin dimuat kembali; keyed form per periode, guard perubahan belum disimpan, batas H+30 mengikuti tanggal server |
| Catatan/status uncontrolled dapat membawa nilai periode sebelumnya | Key berdasarkan periode/isi/status dan remount saat scope terkonfirmasi berubah |
| Acknowledgement mutasi insights tidak divalidasi/readback | API mengonfirmasi code, scope, isi catatan, seluruh item rencana atau status sebelum success |
| Ekspor insights hanya berisi katalog periode | CSV/XLSX/PDF memuat progres, agregat, esai, peer, rencana dan analisis berizin dari scope; harus memilih periode; batas 10.000 baris dan mitigasi formula existing |
| Daftar panjang dan JSON AI sulit dibaca | Disclosure responden dengan pagination 20, kartu dan kontrol responsif, hasil AI semantik, teks wrap, tabel scroll lokal existing |
| Penyedia ChatGPT tidak tersedia | OpenAI Responses API melalui server; admin mengisi model/API key, AES-GCM existing, JSON Schema strict, `store:false`, validasi Zod akhir |
| Ukuran respons provider diperiksa setelah seluruh body dibaca | Batas streaming 250.000 byte untuk semua provider; respons incomplete/refusal/malformed gagal aman |
| Invalidasi satu penyedia menghapus cache penyedia lain | SQL menambahkan predicate scope provider; running tetap tidak dihapus |
| Completion pada ID/status yang tidak ada mengaku tersimpan | RPC mengembalikan not_found; kegagalan persistensi tidak ditandai sebagai kegagalan provider yang dapat menimpa hasil |

## Berkas dan alasan

- `src/app/account/services/[module]/insights.tsx`: scope, form, plan existing, pagination, responsive dan hasil AI.
- `insights-workspace.tsx`, `panel.tsx`, `page.tsx`: controller khusus dan pemulihan error boundary existing; generic insights dead path dihapus.
- `src/app/api/services/[module]/route.ts`: acknowledgement/readback insights dan filter yang tetap sesuai command.
- `src/lib/services/server.ts`: katalog aman berdasarkan targeting existing dan metadata akademik.
- `src/lib/services/export.ts`: hasil aktual berizin diekspor.
- `src/lib/services/providers.ts`, API `services/ai`: OpenAI dan penguatan kegagalan/batas respons.
- `supabase/migrations/20261023093953_insights_openai.sql`: constraint provider tambahan dan perbaikan cache/completion; tidak memodifikasi data operasional atau membuka grant/RLS.
- Tes services/Survei/database/provider dan fixture/script browser: regresi perilaku aktual.
- `package.json`: provider tests masuk `check`; jumlah migrasi pada foundation test diperbarui menjadi 39.

## Penggunaan OpenAI

Admin: Hasil Survei → Konfigurasi penyedia AI → OpenAI (ChatGPT) → model yang tersedia pada akun dan API key → Simpan terenkripsi. Pilih periode dan penyedia untuk analisis. Minimal lima esai, sampling maksimal 150 esai dengan batas 1.500 karakter tetap berlaku. Analisis AI mencakup seluruh periode; filter role/quality berlaku pada hasil terfilter, bukan sampling/cache AI. Tidak menambahkan model default yang belum tentu tersedia pada akun.

Referensi implementasi: https://developers.openai.com/api/docs/guides/structured-outputs . OpenAI digunakan melalui API server; kunci tidak disimpan dalam source, snapshot klien atau log aktivitas.

## Batas bukti

Tes provider menggunakan HTTP mock dengan input sintetis; belum menjalankan panggilan OpenAI berbayar/key nyata. Pengujian browser memakai komponen aplikasi asli dengan boundary HTTP sintetis, bukan akun produksi. Perangkat fisik dan screen reader manual belum diuji. Scrolling vertikal normal diperlukan untuk laporan panjang. Cache running tidak diulang otomatis jika proses terputus; operator perlu memeriksa hasil terlebih dahulu. Esai tetap data pengguna: output model dapat memerlukan peninjauan manusia.

Advisor produksi sebelum migrasi menunjukkan INFO RLS tanpa policy pada tabel private yang memang hanya diakses server dan WARN konfigurasi leaked-password protection existing. Tidak mengubah arsitektur autentikasi dalam pekerjaan ini. Referensi advisor: https://supabase.com/docs/guides/database-linter?lint=0008_rls_enabled_no_policy dan https://supabase.com/docs/guides/auth/password-security#password-strength-and-leaked-password-protection .

## Hasil verifikasi yang dijalankan

- `npm run check`: lulus, 443 tes dalam 50 kelompok runner; TypeScript, lint nol warning, tipe database 14 tabel public dan production build berhasil.
- `scripts/verify-insights.mjs`: 28 pemeriksaan berhasil, 3 audit axe (320/768/1440), tanpa pageerror JavaScript. Termasuk plan empat poin tersimpan, klik ganda, filter setelah AI, catatan terkonfirmasi, pagination, kegagalan 503 dan recovery, keyboard, resize/orientasi serta mengosongkan periode.
- `scripts/verify-academic.mjs`: 41 pemeriksaan dan 6 audit axe berhasil; regresi label/rentang tahun ajaran dan semester.
- `npm run audit:deadcode`: 130 entry, 191 source files, unreachable kosong.
- Screenshot desktop/mobile diperiksa. Mock 503 sengaja digunakan pada skenario kegagalan, bukan gangguan produksi.

Tidak menyatakan seluruh kemungkinan bug atau seluruh perangkat telah diuji; batas pengujian nyata tetap sebagaimana bagian di atas.

Migrasi provider/cache telah diterapkan ke project produksi `sim-muridv2`; verifikasi SQL sesudahnya mengonfirmasi provider `openai`, invalidasi berdasarkan scope dan completion not_found. Fungsi tetap SECURITY INVOKER dengan search_path kosong, anon/authenticated tidak diberi EXECUTE dan service_role tetap memiliki akses. Penyesuaian jumlah poin existing diuji dari empat ke tiga setelah konfirmasi agar fitur pengurangan tetap tersedia.
