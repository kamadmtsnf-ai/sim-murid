# Audit Bantuan Akun — 22 Oktober 2026

Baseline: main `5ab8f37c59072afcff3d3da9c9e530640e8b6dbb`. Branch: `fix/recovery-audit`. Lingkup: `/recovery`, `/recovery/email`, kedua API publik terkait, serta komponen/loading/tes. Tidak ada perubahan database, dependency aplikasi, RBAC, atau kebijakan bisnis.

## A. Temuan dan penyebab

1. Form HTML tanpa method/action eksplisit melakukan GET sebelum hydration atau ketika JavaScript tidak aktif. Jawaban keamanan, OTP, atau password berpotensi masuk URL. Reproduksi baseline memakai jawaban sintetis dan intersepsi navigasi; tidak ada kredensial nyata.
2. Pengunci state React masih menerima dua submit sinkron. Tidak ada timeout atau pengabaian respons terlambat setelah unmount.
3. Reset email menganggap setiap respons HTTP sukses sebagai reset berhasil, tanpa memeriksa destination. Navigasi replace + refresh juga tidak memiliki tautan fallback.
4. Respons consume OTP yang hilang bisa sudah melakukan commit. Flag `started` baru disetel setelah respons, sehingga error memberi instruksi mencoba lagi seolah kode belum digunakan.
5. Kedua API membaca seluruh body sebelum membatasi ukurannya; batas karakter tidak mengukur byte UTF-8. Kesalahan stream berada di luar penanganan error.
6. Min-content dropdown pertanyaan menyebabkan overflow pada pembesaran teks. Target skip link tidak dapat difokuskan; username mobile dapat berubah kapitalisasi. Status belum membedakan error/sukses dan tidak memindahkan fokus.
7. Pilihan pertanyaan yang panjang sulit dibaca pada mobile; setelah pembatasan lebar, teks lengkap tetap perlu tersedia di luar dropdown native.

Baseline server: 10 tes, 8 lulus/2 gagal. Baseline browser: 127 pemeriksaan, 19 temuan, 4 axe views. Temuan ini bukan jumlah bug unik: pemeriksaan overflow berulang mencakup viewport/kontrol berbeda. Bukti JSON menyimpan ukuran dan native GET sintetis.

## B. Perbaikan dan peta alur

### Bantuan petugas

Form → schema bersama (username persis, jenis password/session, manual/question) → Origin + body maksimal 4096 byte → limiter IP + username → lookup privat → verifikasi hash jawaban (bila dipilih) → antrean permintaan → respons 202 generik. Jawaban keamanan tetap bukan bukti tunggal pemulihan. User tidak dikenal, jawaban salah, dan anggaran username tetap tidak membocorkan keberadaan akun. Antrean, persetujuan petugas, evidence/current-password, deduplikasi dan pencabutan sesi existing tidak diubah.

Form memakai pengunci ref sinkron dan state bersama. Permintaan diterima menampilkan langkah menghubungi petugas dan tombol eksplisit untuk permintaan lain. Error 4xx mempertahankan isian. Gangguan jaringan/timeout/5xx/kontrak respons tidak valid masuk state tidak pasti, bukan sukses atau retry otomatis.

### Pemulihan email

Username → Origin + body maksimal 8192 byte → limiter → identitas kontak terverifikasi → reserve/delivery → challenge UUID generik 202. Browser hanya berpindah tahap setelah kontrak tersebut valid. Kode → schema, kekuatan/konfirmasi password → binding username/challenge/purpose → konsumsi OTP → perubahan Auth → finalisasi nonce → destination tetap `/login?password=changed`. Flag ketidakpastian disetel sebelum consume sehingga transport error diperlakukan aman. Reset berhasil memerlukan HTTP 200 dan destination yang persis sesuai kontrak, dengan tautan native jika router gagal.

TTL 600 detik, cooldown 60 detik, 5 kirim/hari WIB, 5 percobaan, OTP hashed sekali pakai, pembatalan saat kontak berubah, dan revocation sesi tetap ditangani SQL existing. Tidak ada pengiriman ulang otomatis. Tombol kode baru meninggalkan challenge lama pada UI; server tetap menentukan cooldown dan keabsahan kode.

### UI dan aksesibilitas

Shell, CSS module, feedback, dan hook pengiriman dipakai bersama kedua halaman; Card/Button/Status dan token existing dipertahankan. Fokus skip link, error/sukses, dan tahap OTP diperjelas. Username tidak diubah kapitalisasinya. Pertanyaan lengkap ditampilkan sebagai deskripsi dropdown. Form memiliki POST eksplisit; tanpa JavaScript form disembunyikan dan bantuan langsung ke petugas ditampilkan. Metadata halaman dan skeleton loading ditambahkan. Tidak ada penyimpanan password/jawaban/OTP ke localStorage/sessionStorage.

Scroll vertikal dokumen sengaja tersedia pada layar pendek dan teks besar. Perbaikan menghindari horizontal overflow dan kontrol terpotong, bukan menyembunyikan konten agar muat dalam satu layar.

## C. Kode final dan alasan file berubah

| File | Tujuan |
| --- | --- |
| `src/app/recovery/page.tsx`, `email/page.tsx` | Shell konsisten, metadata, keterangan alur dan navigasi bantuan |
| `src/app/recovery/recovery-form.tsx`, `email/recovery-form.tsx` | Validasi, lock, state sukses/tidak pasti, tahap OTP dan fallback navigasi |
| `src/app/recovery/use-recovery-submission.ts` | Satu implementasi pengiriman, timeout, fokus, kontrak respons, dan pengabaian respons setelah unmount |
| `src/app/recovery/recovery-shell.tsx`, `recovery-feedback.tsx`, `recovery.module.css`, `loading.tsx` | Komponen presentasi reusable, no-JS fallback, aksesibilitas dan responsive |
| `src/app/api/auth/recovery/route.ts`, `email-recovery/route.ts` | Helper body bounded existing dan penanganan consume tidak pasti |
| `tests/recovery-routes.test.mjs` | Tes route aktual dengan SDK boundary sintetis; tanpa request provider nyata |
| `tests/ui/recovery-fixture.tsx`, `scripts/verify-recovery.mjs` (menggunakan navigation shim Login existing) | Browser produksi lokal dan komponen aktual dengan intersepsi hasil jaringan |
| `package.json` | Tes route pemulihan masuk full check; perintah browser tersendiri |
| `docs/design-system/MASTER.md`, laporan ini dan JSON terkait | Aturan interaksi serta bukti sebelum/sesudah |

## D. Validasi dan batas bukti

Final: 228 tes aplikasi lulus, termasuk 10 tes route pemulihan. TypeScript/lint/build dan snapshot 14 public table lulus. Browser Bantuan Akun: 199 pemeriksaan, 9 axe views, nol temuan; regresi Login: 173 pemeriksaan, 12 axe views. Enam smoke check lulus; audit 157 source files tidak menemukan unreachable file. Setelah full check, fixture delivery diperkuat dan seluruh 10 tes route dijalankan ulang, lulus.

Hasil final tercatat dalam `recovery/automated-results.json` dan `recovery/browser-results.json`. Pengujian mencakup kedua jalur, username bertanda minus/nol awal/case, manual/question, jenis sesi/password, body multibyte/stream gagal, Origin, limiter, binding OTP, update/finalisasi gagal, kontrak reset salah, submit ganda, error, sukses, timeout, unmount, konfirmasi password, resend, keyboard/fokus, tanpa JavaScript, loading, forced colors, viewport 320–1440 px dan landscape 812×240 serta teks 200%/400%. Screenshot mobile/desktop ditinjau visual. Tes database recovery/email existing dijalankan kembali melalui full check, termasuk limit, replay, revocation, dan pembatasan akses.

Tes sukses/gagal provider memakai SDK boundary sintetis dan browser memakai komponen aktual dengan respons terkontrol. Tidak mengirim email nyata, mengganti password nyata, atau memutasi akun produksi. Tidak mengklaim SMTP/provider produksi dan semua role telah diuji end-to-end. Ketidakpastian lintas Auth/database tetap ditangani sesuai kontrak existing; tidak ada jaminan transaksi atomik lintas layanan. Pemeriksaan loading melalui fixture komponen aktual, bukan pengaturan latency provider produksi.
