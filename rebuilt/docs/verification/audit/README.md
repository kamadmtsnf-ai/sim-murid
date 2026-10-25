# Bukti P09

Sesudah pemulihan lingkungan, `npm ci` dan `npm run check` exit 0: **655 tes/70 kelompok**, TypeScript, lint, database types check dan production build. Lint diulang setelah penambahan script browser. Dependency/lockfile unchanged. Bukti sebelum reset tidak dipakai untuk menyatakan revisi pulihan lulus.

| Browser | Checks | axe |
|---|---:|---:|
| Audit | 191 | 21 |
| Rapor | 62 | 7 |
| Kenaikan/ijazah | 104 | 13 |
| Survei | 59 | 6 |
| Rekonsiliasi | 59 | 5 |
| Total | 475 | 52 |

Chromium 145, CSS build produksi dan komponen aktual pada HTTP fixture terisolasi. Audit: 320/390/768/1440 px, landscape/resize, keyboard trap/Escape/return focus, touch, pagination history/skor, empty/loading/error/offline/timeout, 401/403, malformed dan wrong-scope. Tidak ada JavaScript pageerror teridentifikasi. JSON menyimpan assertion aktual. Screenshot 320 px diperiksa visual.

SQL: seluruh 45 migrasi/80 tabel pada PGlite; 10 kasus P09 mencakup projection baru/historis, before/after nilai/KKM/pembatalan, zero/null/omitted scores, replay/stale, cursor timestamp sama, scope/grants service_role/anon/authenticated, revoked session, promotion immutable dan anti-truncate. 8 unit/API/readiness memeriksa query, identity server, timeout, private/no-store, malformed acknowledgement, prefix `fees/settings/books`, data sensitif dan availability fail-closed.

**Belum aktif di cloud.** Auto-review menolak kandidat migrasi pertama karena izin produksi konkret belum eksplisit. Tidak memakai execute_sql/CLI untuk mengakali penolakan. Sesudah pemulihan, CLI menghasilkan filename kandidat baru; candidate hash saat ini dan hash kandidat yang ditinjau dibedakan pada `schema-readiness.json`. Kandidat baru tidak dicoba ke produksi. Read-only metadata terbaru: reader/index belum ada, promotion immutable trigger 0, body writer masih baseline. UI gated; rekonsiliasi/ekspor lama tersedia.

Bukan UAT akun produksi, pengujian beban/concurrency multi-worker, atau simulasi restore. Alasan bebas tetap di transaksi sumber, tidak disalin ke audit. Before/after lengkap baru untuk nilai/KKM setelah migrasi; data yang tidak tercatat ditandai tidak tersedia. D10 masih terbuka. Advisory baseline existing: [private RLS INFO](https://supabase.com/docs/guides/database/database-linter?lint=0008_rls_enabled_no_policy), [unused indexes INFO](https://supabase.com/docs/guides/database/database-linter?lint=0005_unused_index), [leaked-password protection WARN](https://supabase.com/docs/guides/auth/password-security#password-strength-and-leaked-password-protection).
