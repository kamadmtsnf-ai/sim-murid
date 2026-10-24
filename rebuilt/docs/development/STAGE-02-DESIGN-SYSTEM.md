# P02 — Penyatuan design system dan pilot

Tanggal: 24 Oktober 2026 (WIB). Baseline main: `ec436f2b59215588a13e3019a423562a453c75b7`. Branch `feat/design-system-p02`.

PR implementasi: [#46](https://github.com/kamadmtsnf-ai/sim-murid/pull/46).

Status: selesai untuk kontrak komponen bersama dan kedua pilot. Rollout antarmodul tetap P05.

## Analisis dampak dan keputusan

P01/B01 menentukan Hak akses saya sebagai pilot read-only dan satu formulir mutasi. Dipilih Profil pribadi karena memiliki validasi per-field, readback, conflict, isian belum disimpan, dan hasil ambigu yang sudah teruji. Dibaca penuh panel/page/loading/error kedua pilot, helper/access/profile, API profile/access, komponen dasar, globals.css, MASTER, roadmap/P01 dan keputusan bisnis sebelum mengubah presentasi.

Identitas teal, gradasi Plass, font lokal, skala spacing dan token warna existing dipertahankan. Tidak menjalankan generator/rekomendasi baru atau memasang UI framework kedua. P02 menyempurnakan satu MASTER existing; dokumen ini hanya laporan implementasi dan rollout.

### Temuan

- Hak akses saya dan Profil pribadi masing-masing mendefinisikan style kontrol serta label/error/feedback serupa secara lokal.
- Filter/pagination/empty state belum memiliki kontrak presentasi bersama, walaupun slicing dan fokus setiap domain sudah benar.
- Status existing mendukung info/success/error, tetapi tidak ref untuk fokus, pending atau warning untuk hasil belum terkonfirmasi.
- Loading kedua pilot mengulang markup status/skeleton. Judul dialog panjang di portal tidak memperoleh aturan wrapping dari konten main.
- Button, Card, TableRegion, Dialog Radix serta token semantik sudah layak dipakai kembali; menggantinya akan membuat duplikasi.
- Uji stres menemukan utility whitespace-nowrap Button mengalahkan aturan wrapping pada layer components. Aturan khusus `.ds-actions` dipindah ke layer utilities dengan selector scoped; label panjang kemudian harus diuji ulang. Pagination ponsel menempatkan informasi halaman di atas dan dua tombol yang beralih baris berdasarkan ruang kontainer.

## Kontrak komponen dan migrasi

| Area | Sumber tunggal / keputusan | Kontrak yang dipertahankan |
|---|---|---|
| Warna/typography/spacing | `src/app/globals.css` dan MASTER existing | Tanpa warna/font baru; tambahan semantic ukuran kontrol/gap hanya di globals. |
| Tombol dan kartu | Button/Card existing | Variant, disabled, type dan aksi domain tetap. `.ds-actions` membolehkan label panjang wrap hanya pada area adopsi. |
| Formulir/filter | `ui/field.tsx`: Field, fieldControlClass, fieldDescriptionIds; `ui/collection-controls.tsx`: FilterBar | Label htmlFor terpisah dari select; hint/error punya ID stabil; caller tetap menentukan value, required, aria-invalid dan describedby. |
| Pagination | Pagination pada collection-controls | Nilai halaman one-based; slicing/fetch/fokus/total data tetap di caller. Tidak membuat fetch baru atau menggabungkan pagination server/client. |
| Feedback | Status existing diperluas additive | Info/success/error tetap; warning/pending baru; icon dekoratif, label teks dan live region. Ref dapat dipakai mengembalikan fokus. |
| Loading/empty | LoadingState/EmptyState pada content-state | Status memuat dan skeleton dekoratif; alasan kosong berbeda filter vs belum ada data. EmptyState dipakai di bawah heading section dengan h3. |
| Tabel | TableRegion existing | Region bernama dan focusable, caption/scope pada tabel caller; scroll lokal, tidak menyembunyikan kolom bisnis. |
| Dialog | Dialog Radix existing + min-width/wrapping | Focus trap/restore, Escape, lock close dan scroll viewport tetap. Tidak membuat modal baru untuk Profil. |

`domain-controls.tsx` tetap adapter legacy yang masih dipakai banyak modul. P05 memigrasikan caller secara bertahap setelah membaca contract masing-masing; tidak mengganti semua kontrol/pagination hanya melalui pencarian teks.

## Pilot dan batas perubahan

- **Hak akses saya:** Field/FilterBar/Pagination/EmptyState/Status bersama. Peran, assignment, scope own/class/all, pengelompokan izin, 10 jenis izin per halaman, filter lokal, refresh identity checks, lock, redirect, timeout dan fokus heading tidak berubah.
- **Profil pribadi:** Field dan style kontrol bersama, hint/error terhubung lewat helper, Status untuk pending/sukses/error. Form state, payload, timestamp mikrodetik, validasi Zod, dirty guard, konflik, pemeriksaan hasil ambigu dan API tetap.
- Loading/error kedua pilot memakai state yang konsisten. Skeleton aria-hidden dan status teks tersedia; error tetap tidak mengungkap detail internal.
- Galeri komponen berada pada fixture tes, bukan route publik aplikasi. Menguji primitive existing dengan teks panjang, tabel, dialog, field error, pagination dan reduced motion.
- Tidak ada perubahan API/server/schema/RLS/autentikasi/aturan bisnis, dependency atau lockfile. `package.json` hanya menambah perintah browser QA.

## Gerbang penerimaan

1. Kedua pilot pada 320/390/768/1440 px, landscape dan data panjang tidak menimbulkan horizontal overflow dokumen atau kontrol terpotong.
2. Filter/pagination/empty/loading/error serta status hasil simpan dapat dipahami dan diakses keyboard.
3. Label, hint dan error merujuk elemen yang ada; target kontrol minimal 44 px; error validasi tetap fokus ke field.
4. Dialog mempertahankan focus trap/restore, Escape dan scroll; tabel bisa diakses dengan keyboard pada area gulir lokal.
5. Seluruh tes domain/regresi dan TypeScript/lint/build yang dijalankan dicatat aktual; identitas/payload/otorisasi tetap.

## File dan alasan

| File/kelompok | Perubahan |
|---|---|
| `src/components/ui/{field,collection-controls,content-state}.tsx` | Komposisi presentasi bersama, tanpa state domain/fetch. |
| `src/components/ui/status.tsx` | Ekstensi kompatibel untuk warning/pending, ref/atribut dan wrapping. |
| `src/components/ui/dialog.tsx` | Wrapping/min-width di portal untuk judul/isi panjang. |
| `src/app/globals.css` | Token ukuran dan class ds-* yang scoped pada adopsi pilot. |
| `src/app/account/access/{access-panel,loading,error}.tsx` | Adopsi read-only tanpa mengubah refresh/filter/scope. |
| `src/app/account/profile/{profile-form,loading,error}.tsx` | Adopsi formulir tanpa mengubah mutasi/readback. |
| `scripts/verify-design-system.mjs`, `tests/ui/design-system-fixture.tsx` | Verifikasi kontrak reusable termasuk tabel/dialog dan field relationships. |
| `scripts/verify-personal-profile.mjs` | Tambahkan viewport 390 pada pengujian pilot existing. |
| `scripts/verify-schedules.mjs` | Tunggu pemulihan fokus Radix setelah unmount, bukan hanya dialog hidden, sebelum assertion fokus. |
| `package.json` | Perintah QA browser design system. |
| `docs/design-system/MASTER.md`, `docs/development/ROADMAP.md`, laporan dan JSON verifikasi P02 | Standar adopsi, bukti dan titik lanjut. |

## Verifikasi dan batas bukti

Hasil aktual disimpan pada `../verification/design-system/`; lihat `checks.json` dan hasil browser per suite. Screenshot diperiksa pada release CSS hasil build. Browser menggunakan komponen aplikasi asli, data sintetis dan boundary HTTP terisolasi. Tes API/SQL existing memeriksa auth/scope/validasi secara terisolasi; bukan UAT akun produksi atau pemanggilan provider sungguhan. Gulir vertikal normal tetap diperlukan.

Review React: komponen baru tidak melakukan fetching, menambah global listener, menduplikasi state domain, memasang dependency atau memindahkan otorisasi. Nilai turunan/pagination tetap dihitung caller. Ekstensi Status menjaga kompatibilitas API lama; reaksi field tetap pada handler existing. Penyatuan hook mutasi lintas domain menunggu P04.

Tahap berikutnya P03: konteks akademik global. Rollout seluruh modul menunggu P05; selesainya pilot P02 bukan klaim seluruh halaman sudah dimigrasikan.

## Hasil aktual

- `npm ci`, TypeScript, lint, seluruh 543 tes/62 kelompok runner dan drift tipe lulus. Dari 49 perintah check, 48 lulus dan build incremental gagal karena cache Turbopack. Build awal, build bersih pemulihan dan build release final lulus; kegagalan cache bukan error database aplikasi.
- Hak akses saya: 104 cek / 8 axe; Profil pribadi: 87 / 8; kontrak komponen: 54 / 9; Jadwal: 145 / 14; Notifikasi: 55 / 7. Total 445 pemeriksaan browser dan 46 audit axe lulus. Hasil final tidak menyertakan percobaan awal yang gagal.
- Screenshot mobile/desktop pilot dan galeri diperiksa. Tidak ditemukan overflow horizontal dokumen atau JavaScript pageerror pada skenario final. Tabel tetap mempunyai scroll lokal.
- Lint release lulus setelah penyesuaian pengujian fokus. UI/API/SQL tetap memakai batas pengujian terisolasi yang dijelaskan di atas.
