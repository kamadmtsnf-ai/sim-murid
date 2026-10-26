# L04 — Feedback dan kepastian penyimpanan

Tanggal 26 Oktober 2026 (WIB). Baseline main `f29fb335118ec9b2a22b04be659c01fd742b4a85` (PR78/L03). Branch `feat/l04-save-feedback`.

## Analisis dampak dan temuan

Dibaca roadmap L04, kontrak P04/P66, MutationFeedback/Status, mutation-result, useDomainMutation, write/navigation guard, pemanggil 11 domain dan suite formulir/modal. Aturan bisnis D01/D02/D03 dan D10 tetap. Auth, email, profil, buku, impor/provisioning dan survei memiliki controller khusus; tidak diganti dengan retry generik.

Fondasi sudah mencegah submit ganda, memeriksa acknowledgement/revisi dan mempertahankan lock pada respons ambigu. Gap yang ditangani:

1. Petunjuk error generik tidak membedakan duplicate, insufficient, overlap, rate_limited, stale, request_conflict dan akses. Pengguna perlu tindakan berikutnya yang sesuai bukti protokol.
2. Props tone pada MutationFeedback dapat menimpa warna yang berasal dari fase. Ini kelemahan API komponen/potensi feedback menyesatkan, bukan klaim insiden pengguna produksi. Kini tipe menolak tone dan runtime menetapkan tone terakhir dari phase.
3. HTTP408 dengan kode korektif sebelumnya dapat digolongkan error dan membuka pengiriman baru, padahal request timeout tidak membuktikan server belum menyimpan. Kini uncertain untuk confirmed mutations; lock dan draft dipertahankan. Status noninteger/NaN juga defensif menjadi uncertain.
4. Judul blocked “Tindakan dihentikan” dapat memberi kesan hasil pasti batal; diganti “Periksa sebelum melanjutkan”. Petunjuk uncertain tidak lagi meminta pengguna mencatat/menyalin isian yang mungkin sensitif; jelaskan risiko kehilangan draft saat reload.

## Implementasi

- `mutationGuidance` pada `mutation-result.ts` menerima fase, kode hasil dan HTTP status; tidak membaca/mencocokkan teks pesan dan tidak menyimpan isi command.
- Hook memakai satu transition yang memperbarui fase, pesan dan hint bersama. 401/403 tetap ditangani sebelum parse JSON; referensi laporan 5xx tetap disunting sesuai validator existing. fail/clear tidak membuka retained lock.
- 11 panel meneruskan hint: kelas/tahun ajaran, jadwal KBM/piket siswa, guru piket, absensi, mentoring, komite, tabungan, nilai/KKM, rapor, kenaikan/ijazah dan poin siswa.
- Pesan server tetap konteks domain; hint menambahkan langkah berikutnya. Success tetap memerlukan acknowledgement/revisi yang sesuai. Tidak menambahkan auto-retry atau unlock setelah GET biasa.
- Tombol pemeriksaan/reload domain tetap milik caller. Tidak menambah endpoint baru atau tombol replay universal.

| Fase/bukti | Tindakan pengguna yang dijelaskan | Lock |
|---|---|---|
| pending | Tunggu, jangan kirim ulang atau meninggalkan proses | Aktif |
| success | Perubahan terkonfirmasi; periksa hasil terbaru | Mengikuti sukses existing |
| invalid/incomplete | Koreksi atau lengkapi isian | Koreksi diizinkan setelah penolakan eksplisit |
| duplicate | Periksa apakah data sudah tercatat sebelum membuat data berbeda | Sesuai explicit rejection |
| overlap/invalid_membership/class_in_use | Periksa waktu, kelas, anggota atau keterkaitan | Sesuai explicit rejection |
| insufficient | Periksa saldo/jumlah dan nominal | Sesuai explicit rejection |
| rate_limited/429 | Tunggu sesuai layanan, jangan tekan berulang | Tidak auto-retry; server tetap otoritas limit |
| archived | Pilih data yang masih dapat diubah; jangan menimpa arsip | Sesuai existing rejection |
| stale/request_conflict/not_found | Periksa versi, hasil sebelumnya atau referensi terbaru | Tetap diblokir |
| 401/403 | Periksa sesi atau role/tugas/cakupan | Tetap diblokir |
| timeout408/network/5xx/ack atau revision invalid | Hasil belum pasti; periksa status tanpa replay | Tetap diblokir |

Tidak menambah persistence draft, mencatat password/OTP/jawaban/nominal transaksi, mengubah idempotensi UUID, mengirim email/AI, memutasi data produksi, API/RPC/schema, permission atau dependensi. Migrasi tidak diperlukan. Controller khusus tetap mempertahankan kontrak pemulihan masing-masing.

## Verifikasi

- `npm run check`: exit0; 747 tes/79 kelompok, TypeScript, lint, DB type replay dan production build lulus.
- `test:forms`: 5 tes; status timeout/invalid, advice kode/fase dan larangan petunjuk copy/retry ambigu.
- Lint diulang setelah penyesuaian harness: exit0.
- Browser formulir: 87 checks/7 axe, tanpa page error. Termasuk satu request pada double-submit, invalid draft tidak dikirim, HTTP408/network/5xx/malformed/noack tidak false-success, draft tetap, fail/clear tidak unlock, GET inspeksi tidak replay, unmount mengabaikan respons terlambat, sidebar/logout pending/dirty dan timeout.
- Browser modal: 16 skenario (4 viewport dan 12 varian domain), 4 axe, tanpa page error/overflow. Forced tone success dari fixture tidak dapat membuat uncertain hijau; error tetap alert, fokus dan draft dipertahankan.
- Harness formulir kini membuka kelompok sidebar secara eksplisit sebelum menguji navigasi, sesuai accordion default collapsed PR74. Tidak mengubah perilaku sidebar untuk meluluskan tes.
- Fixture API/provider sintetis dan database replay terisolasi. Tidak menggantikan UAT manusia, koneksi mobile fisik atau pengukuran kebingungan/waktu tugas. L02 tetap terbuka.

Typecheck awal menemukan tuple expected-word test belum readonly; diperbaiki tanpa mengendurkan TypeScript strict, lalu check lengkap diulang lulus.

## File berubah dan alasan

- `src/lib/forms/mutation-result.ts`: outcome konservatif408 + advice berbasis protokol.
- `src/lib/education/use-mutation.ts`: hint mengikuti transition hasil.
- `src/components/feedback/mutation-feedback.tsx`: tone otoritatif dan wording aman.
- 11 panel pemanggil: gunakan hint dari hook tanpa mengubah command/success callback.
- `tests/mutation-result.test.ts`: regresi kontrak.
- `tests/ui/{forms,modal-feedback}-fixture.tsx`: komponen actual dan uji runtime tone override.
- `scripts/verify-{forms,modal-feedback}.mjs`: regresi error guidance/408 dan accordion setup.
- MASTER, roadmap dan verification JSON: bukti/status/batas yang sebenarnya.

## Rilis, risiko dan rollback

User mengizinkan PR/merge setelah CI lulus; tidak ada migrasi. Status PR/merge/Production dicatat pada PR setelah tersedia; laporan ini snapshot sebelum rilis. Rollback cukup revert UI/helper, tanpa perubahan data.

Petunjuk membantu pengguna mengambil langkah, bukan bukti tambahan hasil transaksi. Menekan reload masih dapat menghilangkan draft; guard dan peringatan dipertahankan. Batas percobaan tetap di server. Pengujian manusia L02 dan metrik sebelum/sesudah belum tersedia. L05–L11 tidak dijalankan dalam tahap ini.
