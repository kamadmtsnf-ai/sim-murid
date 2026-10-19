# Tahap 10 — Profil sekolah dan master data

## Cakupan dan sumber

Mengikuti matriks Tahap 01: M17-F01/F02/F03 dan M04-F07, bukan nomor fase makro dalam dokumen induk. Teks lama halaman /foundation yang menyebut Tahap10 manajemen pengguna dikoreksi agar selaras dengan matriks; CRUD akun massal/direktori tetap belum tersedia dan tidak diklaim selesai.

Sumber GAS: getSchoolProfile/saveSchoolProfile/_buildAlamatGabungan_ (5701–5843), getMapelData/saveMapel/updateMapel/deleteMapel (3928 dst), getHafalanData/saveHafalan/updateHafalan/deleteHafalan (5155 dst), saveHariLiburBatchRange (4880), CRUD hari libur (4004/4320). uploadFileToDrive duplikat lama diganti adapter khusus logo, bukan upload dokumen umum.

## Perilaku tersedia

- /account/settings dan tautan dari akun Admin; empat bagian pengaturan.
- Profil singleton: nama, kepala, NIP, telepon, NPSN, jalan dan ID/nama provinsi/kabupaten/kecamatan/desa. NIP/NPSN/HP/kode wilayah tetap teks. Semua field disimpan, termasuk telepon/NPSN yang sempat tidak dipersist helper GAS. Wilayah diisi manual; lookup wilayah eksternal tidak ditambahkan.
- Kop memakai nama/alamat gabungan/logo yang tersimpan; schoolAddress dan snapshot menjadi kontrak bagi keluaran tahap berikutnya. Belum ada klaim semua PDF modul mendatang sudah terhubung.
- Dua slot logo publik: sekolah/koperasi; unggah/ganti/hapus. PNG/JPEG/WebP maksimal2MiB, dimensi4096, tanpa animasi; decode dan re-encode PNG maksimal1024 melalui sharp, metadata dihapus. SVG/HTML/MIME palsu ditolak. Bucket school-assets hanya PNG dan2MiB; tidak dipakai untuk dokumen siswa dan tidak diberi policy tulis client.
- Master mapel/hafalan: tambah, edit nama, nonaktifkan dan aktifkan kembali. UUID/code stabil; menghapus berarti nonaktifkan untuk menjaga histori. Nama duplikat ditolak tanpa membedakan huruf besar/kecil. Mapel menolak koma sesuai sumber; titik koma hafalan menjadi koma. Urutan mapel baru bertambah; kode acak stabil bukan nomor indeks array.
- Hari libur: tambah satu hari/rentang inklusif maksimal366hari, edit satu tanggal, hapus. Tanggal ISO1900–2200 tervalidasi; rentang terbalik/tanggal tak nyata ditolak. Rentang melewati tanggal yang sudah ada tanpa mengganti keterangannya. Hasil menampilkan jumlah tambah/lewat. Penyimpanan date menggantikan variasi header spreadsheet; importer legacy masa mendatang wajib memetakan header melalui staging.

## Integritas dan keamanan

API /api/settings dan /api/settings/logo membaca caller dari sesi server dan memerlukan settings.manage/Admin ready. DB mengulang pemeriksaan session/onboarding/role terkini. RPC hanya service_role, SECURITY INVOKER, search_path kosong. Tabel private tambahan RLS tanpa grant client. Tidak ada bypass onboarding, perubahan role pengguna, password atau email_verified. Semua mutasi database dan audit satu transaksi.

Revision singleton dengan row lock menolak stale writes antartab/operator. Request UUID menyimpan hasil idempoten; replay tidak menggandakan audit. Kegagalan unique rollback seluruh subtransaksi, termasuk revisi.

Logo: path acak server, bukan nama/path kiriman client. Berkas distage pada antrean durable sebelum upload. Kegagalan metadata yang pasti ditolak membersihkan berkas; hasil RPC yang ambigu tidak menghapus berkas yang mungkin sudah terpasang. GC menunggu1jam, menghindari path yang masih direferensikan, maksimal20berkas per mutasi berikutnya. Tidak ada cron GC pada tahap ini; jika tidak ada mutasi lagi, antrean menunggu. Kegagalan penghapusan tetap diantrekan. Pemeriksaan inventory Storage untuk berkas lama menjadi pekerjaan operasi Tahap29. Tidak menjanjikan transaksi atomik lintas Postgres/Storage.

## Bukti pengujian

- 80 test lokal lulus:70regresi dan10baru (4validator/gambar,6integrasi PostgreSQL).
- Typecheck, ESLint, drift snapshot, replay10migrasi dan build produksi bersih lulus. Cache Turbopack lama gagal restore; dipindahkan keluar proyek, build ulang bersih berhasil.
- Lima smoke HTTP build lulus; tidak setara pengujian visual/hidrasi.
- Supabase aktual: app_settings_read/write diuji dalam transaksi yang di-ROLLBACK: Admin ready, tambah/rename/nonaktif master, stable code, replay, stale, profil/identitas teks, metadata logo, rentang leap-year/dedup, role freshness dan grant RPC. Data uji/sesi/profil/audit seluruhnya rollback; tidak menimpa data sekolah atau akun produksi.
- Bucket aktual terkonfirmasi public=true, PNG saja,2097152bytes. Tidak ada unggahan Storage berautentikasi, screenshot browser atau positive HTTP Admin yang diklaim teruji. Tes negatif HTTP produksi dicatat setelah deployment.
- Advisory keamanan sebelum/sesudah tetap satu kelompok INFO private RLS tanpa policy client dan WARN lama leaked-password protection. Tidak mengubah paket. Rujukan: https://supabase.com/docs/guides/auth/password-security#password-strength-and-leaked-password-protection .

## Penerapan

Migrasi lokal 20261019155240_school_settings.sql dibuat CLI. apply_migration konektor dua kali gagal Invalid/expired requestState tanpa mengubah schema. Fallback menjalankan SQL migration dan catatan supabase_migrations.schema_migrations dalam satu transaksi; versi/nama/bucket diperiksa setelah commit. Cloud.types dihasilkan ulang dari proyek qpzoukkhdxpmbtkcqemj. Total30tabel public/private aplikasi tetap RLS. Akun/sesi permanen tidak dibuat untuk tes.

Gmail SMTP telah dibuktikan pengguna melalui endpoint diagnostik: active=true,deliveryVerified=false. Ini membuktikan autentikasi SMTP; inbox/OTP produksi belum dibuktikan dan terpisah dari penerimaan Tahap10.


## Hasil deployment produksi

Commit a344657cc16ddcb15c49558bf50223df45c2f6f0, deployment dpl_8WUn7TCtEwZ6hER8zdWx3vw6KJfB READY dan alias sim-muridv2.vercel.app. Tujuh pemeriksaan aplikasi HTTP lulus: health stage10, GET/POST settings anonim401, lintas-origin403, unggahlogo anonim401/lintas-origin403, halaman settings redirect login307. Dua pemeriksaan langsung Supabase lulus: RPC anonim401 dan unggah Storage anonim400 ditolak. Runtime logs error/fatal tidak ditemukan dalam jendela10menit yang diperiksa; ini bukan bukti seluruh alur Admin telah diuji.

Transaksi cloud juga diulang dengan SET LOCAL ROLE service_role setelah setup ephemeral, dan lulus; seluruh data di-ROLLBACK. Tidak ada profil/sesi test permanen tersisa. Lihat stage-10-live.json.
