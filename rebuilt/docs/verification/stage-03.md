# Tahap 3 — Fondasi Proyek Rebuilt SiM-Murid

Status: **SELESAI untuk ruang lingkup fondasi proyek**. Versi kode 0.3.0, 19 Oktober 2026. Belum merupakan aplikasi operasional dan belum dideploy.

## Hasil konkret

- Proyek Next.js App Router dengan src/, TypeScript strict, noUncheckedIndexedAccess, exactOptionalPropertyTypes dan alias @/*.
- Tailwind CSS v4 melalui PostCSS; tokens desain hijau kebiruan/navy, komponen Button/Card/Badge shadcn/ui dari sumber resmi melalui pemasangan manual. Sumber dan lisensi tercantum dalam proyek.
- Zod untuk DTO pagination dan validasi konfigurasi publik; kontrak Result/error bersama. Tidak memakai parser env sebagai klaim koneksi database.
- Registry 17 modul dengan status planned dan direktori domain yang merujuk matriks. Tidak ada service/repository palsu atau data siswa contoh yang dianggap implementasi.
- Snapshot kebijakan D01 PH20/ATS30/ASAS50 dan Praktik terpisah; D02 fee ribuan terdekat; D03 esai wajib backend dan peer opsional. D10 tetap open.
- Rootlayout lang=id, metadata, skiplink, halaman beranda/foundation, errorboundary/404, endpoint /api/health (liveness saja).
- package-lock.json dan dependensi langsung versi eksak; .nvmrc24, .env.example tanpa rahasia, .gitignore, petunjuk kerja AGENTS.md dan README.
- Salinan dokumen dasar serta Tahap 1/2 sebagai acuan; struktur service/repository/permissions disiapkan sebagai pedoman, belum implementasi domain.

## Versi yang benar-benar dipasang

| Paket | Versi |
|---|---|
| class-variance-authority | 0.7.1 |
| clsx | 2.1.1 |
| lucide-react | 1.59.0 |
| next | 16.4.2 |
| radix-ui | 1.8.1 |
| react | 19.3.1 |
| react-dom | 19.3.1 |
| tailwind-merge | 3.7.0 |
| tw-animate-css | 1.4.0 |
| zod | 4.6.7 |
| @tailwindcss/postcss | 4.3.3 |
| @types/node | 24.19.2 |
| @types/react | 19.3.0 |
| @types/react-dom | 19.3.0 |
| eslint | 9.39.5 |
| eslint-config-next | 16.4.2 |
| postcss | 8.5.31 |
| tailwindcss | 4.3.3 |
| typescript | 6.0.3 |

Runtime verifikasi: Node.js24.19.0 dan npm11.9.0. npm ci --ignore-scripts berhasil memasang451 paket dari lockfile; build tidak membutuhkan kredensial layanan eksternal. Pengguna dapat menjalankan npm ci sesuai README. Tidak menyertakan node_modules atau hasil build dalam paket sumber.

## Hasil pemeriksaan aktual

| Pemeriksaan | Hasil |
|---|---|
| Lockfile vs package manifest dan pinning dependensi | Lulus; seluruh versi langsung eksak |
| npm run typecheck | Lulus; route types dihasilkan dan tsc tanpa error |
| npm run lint | Lulus, exit 0 dan nol warning setelah perbaikan konfigurasi PostCSS |
| npm run test:foundation | Lulus 2 tes; pagination dari input tidak dipercaya dan environment malformed/non-HTTPS |
| npm run build | Lulus; Next.js 16.4.2 Turbopack; typecheck internal dan prerender selesai |
| npm run test:smoke | Lulus 5 kelompok pemeriksaan HTTP pada production server lokal |

Rincian smoke: /200,lang=id,mainlandmark,linkfoundation dan X-Powered-By tidak ada; asetCSS hasilTailwind200 dengan utilityaplikasi; /foundation200; route tidakada404dengan halamankhusus; /api/health200JSONliveness dan Cache-Control:no-store. Server test dimatikan setelah tes. Log build dan smoke ada pada docs/verification.

Dua kekurangan yang ditemukan saat pengerjaan sudah dikoreksi: anonymous default export PostCSS memicu warninglint; pola regex skripHTTP tidakvalid saat flagunicode. Pemeriksaan terkait diulang dan berhasil. Pemeriksaan bukan audit keamanan penuh, bukan uji seluruh 125 fitur, bukan hasil uji beban60–132pengguna, dan bukan UATproduksi.

## Review komponen React

Halaman menggunakan Server Components; errorboundary menjadi Client Component sesuai kebutuhannya. Komponen tidak mendeklarasikan komponen bersarang dalam render, tidak menggunakan effect untuk state turunan, tidak memuat data privat atau secret, dan tidak memakai dangerouslySetInnerHTML. Tautan semantik melalui Link/Button asChild; ikon dekoratif aria-hidden; main/heading dan focus terlihat disediakan. Belum ada inspeksi browser visual, keyboard end-to-end, hydration atau perangkat mobile nyata; jangan menganggap pemeriksaan HTTP menggantikannya.

## Cara menjalankan setelah ekstrak

Paket memiliki satu folder sim-murid/. Masuk folder tersebut dan gunakan Node.js24.x:

```bash
npm ci
npm run typecheck
npm run lint
npm run test:foundation
npm run dev
```

Buka http://localhost:3000. Untuk hasil produksi:

```bash
npm run build
npm run test:smoke
npm run start
```

test:smoke menjalankan server sendiri pada 127.0.0.1:3274; pastikan port itu kosong. npm run start menggunakan port 3000 secara default. Pada PowerShell gunakan npm.cmd bila npm.ps1 diblokir kebijakan eksekusi.

## Ruang lingkup berikutnya

Tahap 4: database Supabase, migrasi, konvensi data dan pemilihan lingkungan. Tahap 5: login. Tahap 7: izin/RLS. Paket ini tidak memasang SDK/client Supabase karena koneksi dan skema memang bukan lingkupTahap 3; envtemplate/parser publik disiapkan untuk integrasi berikutnya. Tidak ada project Supabase/Vercel dibuat, tidak ada deploy/push GitHub, tidak ada akun atau data produksi yang diakses.

Semua fitur domain pada matriksTahap1 tetapBELUM. Selesainya fondasi tidak mengubah statusfitur menjadiTERUJI. D10 pembaruan KKM/arsip harus diselesaikan sebelum rilis fitur nilai terkait, tanpa menghalangi databasefondasi.

## Isi dan integritas paket

Paket berisi kode, konfigurasi, lockfile, tests, scripts, acuan, dokumentasi keputusan dan buktipemeriksaan. .next,node_modules,.env.local,.git dan credential tidak disertakan. SOURCE_MANIFEST.json mencatat SHA-256 untuk setiapfile yang dipaketkan kecualidirinya sendiri; manifest bukan tanda tangan kriptografis.

Rujukan resmi yang diperiksa: https://nextjs.org/docs/app/getting-started/installation, https://tailwindcss.com/docs/installation/framework-guides/nextjs, https://ui.shadcn.com/docs/installation/manual, https://zod.dev/ .
