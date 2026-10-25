# P12 — AI terkontrol

25 Oktober 2026 WIB. Baseline main `593dd9dae7a0ddc3edea3c484b684b403bdda90d` (PR59). Branch `feat/controlled-ai-p12`.

PR implementasi: [#60](https://github.com/kamadmtsnf-ai/sim-murid/pull/60).

## Audit dan dampak

Adapter OpenAI Responses, Anthropic Messages dan Gemini existing dipertahankan; tidak memasang SDK/provider baru atau mengganti model pengguna. Pembacaan services, survei final, agregat/tren deterministik dan rencana aksi Kepala tetap mengikuti kontrak existing. D01/D02/D03/D10 tidak berubah.

Celah: konfigurasi provider langsung memungkinkan panggilan tanpa allowlist/kuota harian; batas input maksimum lama 150×1500 karakter; esai dapat berisi identitas; usage provider disimpan sebagai objek opaque; refusal bercampur output valid dapat lolos; hasil sukses belum dibedakan dari persetujuan manusia; timeout UI dapat diikuti panggilan lain tanpa pemeriksaan hasil.

## Implementasi

- `ai-controls.ts`: aktivasi server fail-closed, daftar pasangan provider:model, batas harian1–20, input JSON24.000 karakter, output2.048 token, redaksi literal identitas responden sampel serta email/URL/UUID/nomor dan allowlist metadata usage.
- `providers.ts`: memakai kontrol input/output, tetap satu fetch tanpa retry/failover; refusal/incomplete ditolak, hasil redaksi ulang, kutipan hanya yang terdapat pada sampel. Tidak menganggap output terstruktur sebagai kebenaran fakta. Tidak merender HTML model.
- API AI: consent eksplisit sebelum prepare, model allowlist, reserve atomik sebelum network, metadata policy/scope/sample/review, kegagalan aman tanpa payload/secret. Cache existing tidak memanggil provider dan tidak memakai kuota baru. Konfigurasi terenkripsi/invalidate masih tersedia saat analisis dinonaktifkan.
- Migrasi additive `20261025031124_controlled_ai_p12.sql`: tabel privat reservasi dan RPC `app_ai_reserve`, RLS, invoker/search_path kosong, EXECUTE service_role saja, principal manager tervalidasi, advisory transaction lock global. Maks20 reservasi/hari WIB, jeda60detik lintas pengguna/penyedia/periode. Reservasi berdasarkan analysis UUID tidak dapat diulang. Tidak dihapus bersama cache dan tidak direfund ketika gagal/timeout. Identitas untuk redaksi hanya milik responden pada sampel deterministik maksimal150esai.
- UI: cakupan sampel seluruh periode berbeda dari filter layar, persetujuan data/biaya, label draf/sumber/hash/kontrol, hasil lama ditandai metadata tidak tersedia. Salin rekomendasi hanya setelah acknowledgement lokal; tidak pernah mengisi/menyimpan rencana otomatis. Invalidasi memerlukan konfirmasi biaya dan tidak mengembalikan kuota. Respons5xx/network/malformed mengunci aksi AI sampai pemeriksaan lewat reload eksplisit.

## Batas dan gerbang

Kode belum berarti AI berbayar aktif. Default `AI_ANALYSIS_ENABLED` tidak diset membuat panggilan ditolak; hasil lama dan konfigurasi tetap dapat diakses. Migrasi yang belum diterapkan membuat reserve gagal tertutup sebelum network. Aktivasi environment dan anggaran provider memerlukan keputusan pemilik, tidak dilakukan sebagai efek pengujian. Batas request/token bukan batas uang: input token bergantung tokenizer dan harga model; tidak mengklaim jumlah rupiah maksimum atau tagihan nyata. Konfigurasikan limit/billing provider secara terpisah sebelum aktivasi.

Redaksi berbasis kamus/pola dapat melewatkan nama pihak ketiga, alamat atau narasi pengenal dan dapat menyunting kata umum. Tidak menjamin anonimitas atau mengubah jawaban survei sumber. Peninjauan data dan kebijakan pengiriman eksternal tetap wajib. Legacy hasil tersimpan tidak ditulis ulang atau disertifikasi P12. `store:false` OpenAI bukan janji zero retention untuk semua layanan/provider.

Review checkbox adalah acknowledgement lokal untuk menyalin draf, bukan approval resmi tersimpan, bukan keputusan akademik/keuangan/akses. UAT manusia P11, target/restore/load P10 dan D10 masih terbuka. Tidak ada panggilan provider nyata, tagihan, pengiriman pesan, perubahan env atau data produksi dalam tes.

## Verifikasi

`npm ci`, typecheck, lint dan production build lulus. Pipeline lengkap lulus684tes/75kelompok; setelah itu satu kasus kamus redaksi ditambahkan dan suite kontrol8kasus diulang lulus (685kasus unik terverifikasi). Provider5kasus diulang lulus. Browser komponen aktual dengan CSS build terbaru:53checks/4axe, tanpa pageerror, empat viewport dan landscape. `git diff --check` lulus. Tes HTTP/provider menggunakan stub; DB menggunakan PGlite dan registry sesi sintetis, bukan Supabase Auth nyata. Konkurensi PGlite adalah antrean satu koneksi; advisory lock tetap perlu uji managed staging P10.

## Sumber primer yang diperiksa

- https://developers.openai.com/api/docs/guides/structured-outputs — schema tidak menggantikan penanganan refusal/incomplete.
- https://developers.openai.com/api/docs/guides/your-data — store:false tidak sama dengan zero retention.
- https://supabase.com/docs/guides/database/functions — invoker, schema qualification dan revoke/grant EXECUTE.
- Changelog Supabase25September2026 PostgreSQL17.11: tidak memakai ltree/btree_gist atau legacy cipher SQL baru. Enkripsi existing Node AES-GCM tetap.

## Aktivasi database

Migrasi kuota diterapkan pada `sim-muridv2` (`qpzoukkhdxpmbtkcqemj`), cloud version `20261025032055`. SHA256 SQL `8136b1b7f4c8adaf65e84dd8b52318be5604bbc68361e4da90bd950c8c5bcfd4`. Fingerprint MD5 body RPC lokal/cloud sama `a92755a56ec4a132a4f1c2d0c963bac8`. RLS/index, invoker/search_path, service_role-only EXECUTE dan grant SELECT/INSERT tanpa UPDATE/DELETE terverifikasi; sesi tidak sah denied. Tidak menjalankan reserve dengan akun nyata, menambah sampel produksi, memanggil provider atau mengubah env.

Advisory security tetap kelompok INFO private RLS tanpa policy dan WARN leaked-password protection existing; performance INFO unused index termasuk indeks baru yang belum mendapat traffic. Bukan klaim tidak ada advisory: [RLS private](https://supabase.com/docs/guides/database/database-linter?lint=0008_rls_enabled_no_policy), [password protection](https://supabase.com/docs/guides/auth/password-security#password-strength-and-leaked-password-protection), [unused index](https://supabase.com/docs/guides/database/database-linter?lint=0005_unused_index). Tidak mengubah konfigurasi Auth incidental.

Kode/QA dan kuota cloud selesai; aktivasi provider berbayar, uji managed concurrency, penilaian kualitas model dan penerimaan manusia tetap belum dilakukan.
