# Audit Hak akses saya — 24 Oktober 2026

## Alur dan lingkup

Dibaca: halaman, endpoint GET, helper otorisasi, schema, principal/session gate, AccountLayout/WorkspaceShell/sidebar, katalog peran/penugasan, aturan izin/RLS dan snapshot terakhir, spesifikasi M01 serta keputusan bisnis. Halaman tetap read-only. Tidak ditambahkan editor peran, perubahan izin, CRUD, atau modal yang tidak diperlukan.

Alur: caller terverifikasi → gate ready → RPC `app_access_context` memakai client pengguna → cocokkan user_id → metadata kelas yang dirujuk melalui SELECT dengan RLS yang sama → tampilan peran/penugasan dan jenis izin → pencarian/filter/pagination lokal → GET ulang bila diperlukan. `requireCapability`, RPC pemeriksa izin, policy RLS, masa berlaku penugasan dan mekanisme autentikasi tetap dipertahankan.

## Temuan dan perbaikan

| Temuan | Penyebab | Perbaikan |
|---|---|---|
| Cakupan seluruh data tidak jelas | Scope all diberi teks generik sesuai tanggung jawab | Label Seluruh data dengan penjelasan tetap terbatas pada layanan/izin yang disebutkan |
| Beberapa kelas tidak bisa dibedakan | class_id diabaikan ketika merender | Nama kelas, tingkat dan pasangan tahun ajaran, dibaca hanya dalam cakupan RLS pengguna; fallback rujukan kelas tidak memperluas izin |
| Tidak menampilkan peran/penugasan yang menjelaskan izin | Snapshot hanya dipakai untuk daftar grants | Ringkasan peran/jenis izin dan disclosure penugasan aktif, deduplikasi tuple identik untuk presentasi |
| Baris sejenis berulang tanpa hierarki | Setiap grant dirender sendiri dan memakai index key | Kelompok per capability, simpan setiap scope/kelas berbeda, key stabil |
| Label domain kurang jelas/kurang tahan kode baru | Poin siswa bernama SPK dan parsing capability hanya dua segmen | Label layanan Indonesia dan fallback utuh untuk kode baru/bertingkat; Wali kelas memakai helper label existing |
| Invalid session dapat diarahkan ke security | Null gate disamakan dengan gate belum ready | Bedakan401/login dari403/onboarding; unknown upstream menjadi error layanan |
| Cookie refresh hilang ketika gate/error | Respons403/503 dibuat di luar responder penyalin cookie | Seluruh jalur endpoint memakai satu responder private/no-store dan cookie jar |
| Kegagalan layanan tidak bisa dicoba ulang dari halaman | Catch server menampilkan pesan statis | Error boundary khusus dengan retry dan loading khusus |
| Tidak ada cara memeriksa perubahan izin | Data SSR statis sampai reload browser | GET refresh terkontrol, lock sinkron, timeout, feedback; state terbaru mengganti grants/peran, cache dinonaktifkan |
| State lama/identitas tidak sesuai dapat dipakai sebagai ringkasan | Tidak ada pencocokan context.user_id dengan principal | Cocokkan user pada server sebelum metadata, serta pada client sebelum menerima refresh |
| Respons401 non-JSON dan respons setelah unmount | Parsing sebelum status; tanpa guard lifecycle client | Tangani401 sebelum JSON dan abaikan respons setelah unmount |
| Daftar kosong dan hasil filter kosong tidak dibedakan | Daftar kosong tidak punya pesan | Empty state terpisah, reset filter, counter dan pagination10 jenis izin |
| Risiko overflow/kontrol kecil | Daftar flex dan teks tanpa batas lebar/wrapping | Card satu kolom, min-w-0, wrapping, padding responsif, kontrol44px, daftar penugasan scroll lokal dengan keyboard |
| Filter select perlu nama aksesibel yang tepat | Label membungkus select sehingga dapat mencakup teks opsi | Label htmlFor terpisah dari kontrol native |

Ringkasan menghitung jenis izin unik dan kelas dengan scope class yang eksplisit (Cakupan kelas tertentu), bukan jumlah semua kelas pada izin global. Pencarian dan filter tidak mengubah izin. Grup mempertahankan scope own/all/class yang berbeda; metadata kosong tidak membuat scope kelas menjadi global atau menghapus grant. Nama kelas yang tidak tersedia memakai rujukan aslinya. Tahun ajaran diformat memakai helper existing, misalnya2026/2027.

## Keputusan implementasi

- Schema dasar `accessSchema` dipindah ke modul pure dan diekspor ulang dari path lama; bentuk dan pemeriksaan `loadAccessContext`/`requireCapability` tetap sama. Validator tampilan menolak scope class tanpa class_id atau scope nonclass dengan ID yang bertentangan.
- Metadata menggunakan client authenticated yang sama, hanya ID dari snapshot; batch100, timeout5detik. Tidak memakai service role untuk melewati RLS. Kegagalan nama kelas menjadi peringatan metadata, bukan pencabutan izin palsu atau logout.
- Peran/penugasan menggunakan helper label existing; penambahan satu label homeroom_teacher agar konsisten sebagai Wali kelas.
- Key SSR berdasarkan isi semantik yang terurut; perubahan role/grants diperbarui, urutan array yang berubah saja tidak mereset panel. Tidak ada localStorage, token atau pemberian izin di client.
- Hasil refresh gagal tetap diberi label data terakhir; fungsi layanan tetap memeriksa izin di server. Tidak ada auto retry atau polling tambahan.

## Berkas berubah

- `src/app/account/access/{page,access-panel,error,loading}.tsx`: server flow, panel, state, filter, aksesibilitas, layout dan retry.
- `src/app/api/auth/access/route.ts`: cookie, gate/session, identity dan response aman.
- `src/lib/auth/{access-validation,access-page,access-view}.ts`: schema bersama, metadata RLS dan fungsi presentasi murni.
- `src/lib/auth/authorization.ts`: konsumsi/re-export schema tanpa mengubah kebijakan otorisasi.
- `src/lib/education/directory.ts`: label Wali kelas pada helper yang digunakan bersama.
- `tests/access-page.test.mjs`: route/page/helper aktual dengan boundary Auth/RPC/query terisolasi.
- `tests/database/authorization.test.mjs`: tambah konteks semua7peran, dua scope kelas, query nama melalui RLS dan pencabutan penugasan segera berlaku.
- `tests/ui/access-{fixture.tsx,navigation-shim.ts}` dan `scripts/verify-access.mjs`: komponen aktual/shell/loading/error dengan HTTP sintetis.
- `package.json`: test khusus menjadi bagian test:authorization dan rangkaian check; script browser terpisah.
- Dokumentasi design system dan bukti QA.

## Verifikasi

- npm ci lulus; tidak ada dependency/lockfile yang diubah.
- Seluruh543 tes unik dalam62kelompok lulus. Semua perintah pada rangkaian check dijalankan berurutan dengan exit code tercatat, termasuk TypeScript, ESLint, database type check dan production build.
- Tes khusus:9 SQL otorisasi dan8 page/API/presentasi, lulus. SQL dijalankan pada replay43 migrasi terisolasi; tipe14 tabel public cocok.
- Setelah penyempurnaan label UI, lint berkas terkait dan build/TypeScript dijalankan ulang dan lulus.
- Browser rilis menggunakan CSS build bersih terbaru:104 pemeriksaan lulus,8 pemeriksaan axe tanpa pelanggaran terdeteksi,0 JavaScript page errors. Screenshot normal/stress desktop dan mobile diperiksa secara visual.
- Build inkremental lokal sempat gagal membuka persistence cache Turbopack (`invalid digit found in string`). Folder `.next` hasil kompilasi dipindahkan keluar repo, kemudian build bersih/TypeScript kode final lulus exit0. Ini bukan perubahan/kegagalan database aplikasi.
- Hasil terstruktur: `access/results.json` dan `access/checks.json`.

Browser fixture menggunakan panel, shell, loading/error aplikasi aktual, CSS production build, Playwright Chromium dan axe WCAG2A/AA/2.1AA. Skenario:320/390/768/1440px dan844x390 landscape, teks panjang,137 jenis izin, pagination10, pencarian/filter gabungan/reset, peran7jenis, dua kelas, metadata gagal, data kosong, network/503/malformed/foreign identity/401/403, klik ganda, perubahan grants/peran, unmount, keyboard/touch, resize/orientasi, loading dan retry.

Tidak menjalankan login produksi atau mengubah peran pengguna nyata. Boundary SDK Auth/PostgREST dimock; SQL izin/RLS dan query kelas aktual diverifikasi pada database terisolasi. Tidak ada migrasi, perubahan policy, atau pengubahan database produksi. Gulir vertikal normal untuk daftar panjang tetap tersedia; tidak disembunyikan untuk menutupi overflow.
