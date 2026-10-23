# Audit Biodata dan dokumen — 23 Oktober 2026

## Lingkup dan alur

Acuan: spesifikasi M04, kebijakan bisnis yang disepakati, `rules.json` (87 field), migrasi profil/keluarga dan dokumen privat, schema/reader student, schema/inspector/GC documents, kedua halaman `/account/biodata` dan `/account/biodata/[id]`, panel, kedua API, serta komponen shell/button/card yang digunakan.

Halaman memverifikasi principal server, kemudian membaca biodata dan daftar dokumen secara paralel. Siswa/calon/alumni mengelola milik sendiri; Admin sesuai izin; Orang Tua terverifikasi hanya membaca anak terkait. RPC tetap memeriksa sesi, target, izin tulis, revision, dan request ID. Data ayah/ibu/wali/alamat dinormalisasi sesuai aturan existing; draf tidak diwajibkan lengkap. Kelengkapan hanya memakai dokumen berstatus ready.

Unggah: validasi metadata → prepare RPC → signed upload langsung ke bucket privat (tanpa upsert) → download server dan inspeksi isi → finalize RPC → snapshot baru. Ganti dokumen mempertahankan dokumen ready lama sampai pengganti lolos validasi. Hapus memakai status deleting yang dapat dilanjutkan bila Storage gagal; GC tetap durable. Preview/unduh memakai signed URL 60 detik. Tidak ada pemindahan berkas ke body request aplikasi atau URL publik.

## Temuan dan perbaikan

| Temuan / penyebab | Perbaikan |
| --- | --- |
| Setiap klik simpan membuat request ID baru; respons hilang sesudah commit membuat percobaan ulang berbenturan revision | ID tetap dipakai ulang untuk revision dan isi yang sama, mengikuti idempotensi RPC existing; klik ganda dikunci sinkron |
| Kegagalan setelah prepare, invalidasi, atau hapus parsial meninggalkan daftar/progres lama sampai reload seluruh halaman | Muat snapshot dokumen setelah kegagalan; pertahankan draf; blok perubahan dokumen jika rekonsiliasi status juga gagal |
| Reload seluruh halaman membuang isian; respons sukses tanpa payload lengkap dapat terlihat seperti berhasil | Refresh terkontrol dengan konfirmasi pembatalan draf, validasi snapshot dan target, tidak menghapus isian saat gagal |
| Kesalahan field di bagian lain ditampilkan sebagai pesan teknis tanpa menunjuk lokasinya | Pilih bagian field yang salah, fokus input, label eksplisit, aria-invalid dan keterangan error; simpan draf tetap diperbolehkan |
| Server membaca arrayBuffer sebelum memeriksa ukuran Blob; finalize juga mencoba metadata yang sudah obsolete | Cek ukuran sebelum alokasi byte; tolak finalize selain pending/ready dan hapus selain state yang didukung |
| Semua kegagalan baca halaman disamarkan sebagai masalah izin | AccessDenied mendapat penjelasan izin; gangguan layanan masuk error boundary dengan tombol coba lagi; UUID invalid menjadi not-found |
| Nama pengguna/berkas panjang, header preview, dan kontrol unggah berisiko melebar | min-width 0, wrapping, grid responsif, kontrol sentuh 44 px, viewport preview terbatas, gulir gambar hanya di area preview |
| Tidak ada perlindungan keluar halaman dengan draf; file input tetap terisi setelah sukses | beforeunload hanya ketika dirty dan dibersihkan saat unmount; file input dikosongkan tanpa mereset jenis dokumen |
| README modul masih menyatakan belum diimplementasikan | Ganti dengan peta implementasi, kontrak dan batas verifikasi aktual |

Tidak mengubah daftar field wajib, format dokumen, skema database, autentikasi, RBAC, API contract, aturan penyelesaian onboarding, ataupun perhitungan bisnis lain. Tidak menambahkan migrasi atau dependency runtime.

## File dan alasan

- `src/app/account/biodata/biodata-panel.tsx`: state, pemulihan, validasi/fokus, pratinjau dan layout.
- `src/lib/student/presentation.ts`: ekstraksi aturan pembagian/visibilitas existing untuk UI dan tes; bukan sumber aturan bisnis baru.
- `src/app/account/biodata/page.tsx`, `[id]/page.tsx`: pemisahan denied/outage, validasi ID, layout responsif.
- `src/app/account/biodata/loading.tsx`, `error.tsx`: loading dan error/retry lokal tanpa detail internal.
- `src/app/api/student-documents/[id]/route.ts`: pemeriksaan state dan ukuran sebelum inspeksi.
- `tests/biodata.test.mjs`: handler/page/helper aktual dengan boundary auth/Storage/RPC terisolasi, termasuk PDF nyata.
- `tests/ui/biodata-fixture.tsx`, `scripts/verify-biodata.mjs`: panel dan shell aktual dengan API/Storage sintetis; geometri, aksesibilitas dan interaksi.
- `package.json`: masukkan tes regresi ke check dan perintah browser khusus.
- Dokumentasi modul, design system, dan hasil JSON browser: bukti dan batas verifikasi.

## Verifikasi

- `npm ci`: berhasil.
- `npm run test:biodata`: 11 tes lulus; identitas server, CSRF, IDOR, read-only, normalisasi, stale/conflict, MIME, checksum PDF, partial delete dan state guard.
- `npm run check`: exit 0; 487 tes dalam 56 kelompok runner lulus, mencakup TypeScript, lint tanpa warning, seluruh unit/API/database integration, kesesuaian tipe DB, serta production build.
- `npm run test:biodata:browser`: exit 0; 66 pemeriksaan dan 11 scan axe lulus, tanpa pageerror JavaScript. Hasil akhir tersimpan di `biodata/results.json`; menggunakan Chromium, Playwright, axe dan CSS production aktual. Viewport 320/768/1440, landscape 844×390; keyboard, touch, data kosong/60 dokumen, long strings, dirty/cancel reload, network/401/403/409/503/malformed responses, retry ID, lock, upload/finalize recovery, delete recovery, preview PDF/gambar/zoom, download link, loading dan retry.
- `npm run audit:deadcode`: 139 entry, 200 source, tidak ada unreachable source menurut scanner.
- Pemeriksaan read-only Supabase produksi: bucket `student-documents` privat, batas 52428800 byte, MIME PDF/PNG/JPEG. Ketujuh RPC student/document yang diperiksa SECURITY INVOKER, execute anon/authenticated ditolak, service_role diizinkan.
- Security advisor tetap melaporkan informasi RLS tanpa policy pada tabel privat server-only dan warning leaked-password protection existing. Akses tabel privat tetap dicabut dari anon/authenticated. Konfigurasi keamanan global tersebut tidak diubah dalam audit halaman ini.
- Dokumentasi Storage/changelog Supabase ditinjau; deprecation cipher TLS lama tidak mengharuskan perubahan signed upload pada browser modern/Node 24 yang digunakan aplikasi.

## Batas dan risiko tersisa

Uji browser memakai API/Storage sintetis dan inspector API memakai PDF nyata; tidak mengunggah/menghapus dokumen identitas produksi untuk pengujian. Pengujian browser sesi produksi terautentikasi, perangkat fisik/iOS/Safari, kegagalan kuota Storage nyata, dan pemindaian malware berkas tidak dilakukan. Inspeksi format/checksum bukan antivirus. Ukuran 50 MiB tetap berpotensi membutuhkan waktu jaringan/validasi; tidak mengklaim performa pada semua koneksi.

Gulir vertikal halaman panjang serta gulir area gambar saat zoom adalah perilaku yang disengaja. Tidak ada klaim seluruh aplikasi bebas bug atau 100% produksi. Bukti merge/deployment dan smoke tanpa sesi ditambahkan pada deskripsi PR setelah rilis.
