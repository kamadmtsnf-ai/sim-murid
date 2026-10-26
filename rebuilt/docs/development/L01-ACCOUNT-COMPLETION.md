# L01 — Pusat penyelesaian akun

Tanggal: 26 Oktober 2026 (WIB). Baseline main: `277c495f514b6295e052d58ab4e1d5c3d50a186a`. Branch: `feat/l01-account-completion`.

Status: implementasi lokal; verifikasi otomatis dicatat di bawah. Belum merge/deploy, belum UAT manusia. L02–L11 tidak dijalankan; PWA tetap L06.

## Analisis dan dampak

Keamanan akun sudah memiliki gate server, formulir password/pertanyaan dan pengamanan mutasi. Email memiliki state RPC/OTP dan gate PR75. Sebelumnya panduan hanya menjelaskan gate saat ini; pengguna tidak melihat langkah wajib/opsional bersama-sama. Tidak perlu state database, route baru, perubahan role atau duplikasi formulir.

Implementasi menambah model presentasi murni dan komponen bersama pada SecurityPanel serta EmailPanel. Langkah: password wajib; biodata hanya student/applicant; pertanyaan keamanan; email wajib teacher dan opsional role lain. Pertanyaan yang tersimpan memakai question_code; status lain diturunkan konservatif dari gate; bukti email memakai RPC existing. Tidak mengubah otoritas security_state/onboarding_ready.

Ringkasan menampilkan hitungan langkah wajib, status teks, ikon, instruksi berikutnya dan nama menu sidebar. Tidak menambah tombol navigasi duplikat. Email tetap tersedia setelah password selesai tanpa menunggu biodata/pertanyaan. Bukti email hanya mengubah presentasi gate email-only; tidak dapat melewati gate lebih awal. Peran belum tersedia dijelaskan sebagai kebutuhan administrator, di luar hitungan langkah.

SecurityPage membaca email proof hanya setelah password/peran memungkinkan. Gangguan email tidak memblokir formulir keamanan; status yang tidak diketahui tidak dinyatakan terverifikasi. Panel dengan mutasi ambigu menampilkan instruksi pemeriksaan status, tanpa menyatakan progres lama pasti benar. Sumber halaman tetap dinamis dan identitas berasal dari sesi server; tidak menyimpan status onboarding/password/OTP di storage browser.

## File dan alasan

- `src/lib/auth/account-completion.ts`: proyeksi gate dan email proof menjadi langkah presentasi, tanpa logika otorisasi baru.
- `src/components/account/account-completion.tsx`: satu ringkasan semantik, wrapping, layout satu/dua kolom.
- `src/app/account/security/{page,security-panel}.tsx`: baca status email aman, tampilkan ringkasan mengikuti perubahan state formulir.
- `src/app/account/email/{page,email-panel}.tsx`: sertakan gate server dan tampilkan email proof mengikuti readback/ketidakpastian.
- `tests/account-completion.test.ts`: enam regresi gate/role/email dan hitungan wajib.
- `package.json`: tes baru dimasukkan ke `check`.
- `docs/development/ROADMAP-PROFESSIONAL-PWA.md`: rencana L01–L11 disalin ke repositori dari dokumen yang disetujui; status L01 dan tautan laporan ditambahkan.
- `docs/development/ROADMAP.md`: tautan siklus lanjutan; P01–P12 tetap terpisah.
- Bukti browser pada `docs/verification/l01-account-completion/`.

## Validasi dan batas

Enam tes model mencakup password/account_pending memblokir email; email tetap actionable pada profile_pending/security_question; email tidak melewati gate lebih awal; optional email tidak mengurangi completion; biodata perrole/saved question; teacher email berubah menarik kembali presentasi readiness.

Suite existing keamanan mencakup sesi/redirect/validasi server; suite email mencakup OTP, expiry, quota, ownership, sesi dicabut dan alur password-finish/new-session. Tidak memodifikasi migrasi/RPC/schema/kontrak Auth. Pengujian ini tidak menggunakan akun produksi atau mengirim email.

Browser SecurityPanel: 80 checks, 7 axe scans, tanpa JavaScript error. Cakupan responsif dan keyboard/interaction sesuai suite existing. UAT pengguna nyata, waktu onboarding dan tingkat keberhasilan belum tersedia; L01 tidak diklaim memenuhi target 95%. Perangkat fisik/pembaca layar manusia belum diuji. Tidak ada klaim 100% bebas bug.

Build awal lulus; rebuild sempat gagal akibat cache persistence Turbopack. `.next` dibersihkan dan build bersih dijalankan ulang. Pemeriksaan final: TypeScript, lint, 6 tes model, 13 tes keamanan, 19 tes verifikasi email serta production build dengan cache bersih lulus. Suite browser diulang pada kode final: 80 checks/7 axe, tanpa JavaScript error. Tes OTP dan sesi existing juga dijalankan; hasil perintah disimpan dalam catatan verifikasi.

## Kriteria dan tindak lanjut

- [x] Ringkasan langkah sesuai role dan gate existing.
- [x] Wajib/opsional serta status tidak diketahui eksplisit.
- [x] Email PR75 tidak diblokir oleh ringkasan.
- [x] Tidak mengubah gate/izin atau menyimpan data sensitif di browser.
- [x] Regresi model dan browser otomatis.
- [ ] UAT alur nyata bersama pengguna (L02).
- [ ] Baseline waktu, keberhasilan dan dropout per langkah (L02).
- [ ] PR, merge dan verifikasi Production sesuai instruksi berikutnya.

Rollback kode cukup mengembalikan komponen/proyeksi halaman; tidak ada migrasi atau perubahan data untuk dibatalkan.

## Status publikasi

Pembuatan branch/tree remote ditolak automatic approval review karena instruksi L01 belum dianggap sebagai izin publikasi eksplisit. Tidak ada PR/merge/deployment yang dibuat. Menunggu izin pengguna untuk memublikasikan branch feat/l01-account-completion dan draft PR; tidak mencoba jalur lain.
