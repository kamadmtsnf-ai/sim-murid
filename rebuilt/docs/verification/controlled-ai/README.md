# P12 — Bukti verifikasi

25 Oktober2026 WIB. `summary.json` memisahkan pipeline684kasus dari satu kasus tambahan (685unik), kuota cloud yang benar-benar diterapkan, dan aktivasi provider/UAT yang tidak dijalankan.

`browser.json`: komponen Hasil Survei/AI Review aktual, HTTP/clipboard sintetis, CSS production build terbaru;53checks/4axe pada320/390/768/1440danlandscape. Consent, duplicate submit, filter scope, review-before-copy, clipboard denied/success, no automatic plan write, uncertain lock, existing notes/plan/pagination/read failures teruji. Tidak ada JS pageerror. Bukan Auth/UAT pengguna nyata.

Tes provider memakai fetch stub: OpenAI/Anthropic/Gemini shape, limits/redaction/usage, refusal/malformed/oversize/incomplete/timeout/persistence. Tidak ada request berbayar. Tes database memakai PGlite, Auth stub/registry session dan role Postgres service_role aktual; bukan beban managed Postgres. Penolakan role/sesi, replay/cooldown/kuota, cache delete tanpa refund, pergantian hari WIB dan kamus sampel diuji.

Metadata cloud dibaca setelah apply: tabel/index/RLS, RPC invoker/search_path/EXECUTE, grant SELECT/INSERT tanpa UPDATE/DELETE, sesi tidak sah denied dan MD5 body cocok. Tidak melakukan reservasi atau uji provider dengan akun produksi. Advisory existing dan batas privasi/biaya tercatat pada laporan P12 serta `../../ai/CONTROLLED-AI.md`.
