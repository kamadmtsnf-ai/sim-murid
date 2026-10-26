# Audit Kesehatan Aplikasi dan favicon

27 Oktober2026 Asia/Jakarta. Baseline main8b890a603e0eb8bce1b532e5b6a46ae82218ce17 (PR85), branch fix/health-audit-favicon.

Status checkpoint: implementasi; verifikasi akhir sedang berjalan. Jangan menganggap CI/browser/build selesai sebelum bukti tersedia.

Alur: SSR force-dynamic → principal/admin/ready → servicesData jobs/reconciliation paralel → validasi sumber → whitelist agregat → UI. Refresh GET native /account/health. Tidak menambah CRUD, POST, modal, retry pekerjaan atau cache privat. Explicit denial menolak seluruh dashboard, timeout sumber tetap unknown.

Temuan/perbaikan: deadline8detik pada gate keamanan lewat parameter signal opsional yang kompatibel caller lama; availability/null/count yang bertentangan ditolak; summary memprioritaskan sumber gagal dan empty dibedakan dari unavailable; metrics responsive mengikuti ruang konten, cakupan detail memakai accordion native. Error boundary lokal memakai AccountError existing. Admin/RBAC dan whitelist tetap; OTP langsung bukan outbox, delivery/provider config bukan bukti inbox; backup/restore tetap belum terverifikasi.

SVG ikon sekolah sudah ada; fallback konvensional favicon.ico belum ada. Tambahkan ICO16/32/48 dari SVG existing memakai Sharp dan App Router convention, tanpa mengubah PWA/Apple icon. Generator disimpan; favicon HTTP/head wajib lulus sebelum merge.

Rencana QA: model/server/page/SDK adapter/ICO; browser synthetic actual component normal/empty/unknown/partial/large/providers/offset/loading/error, keyboard/refresh GET/fresh timestamp, reflow320–1440, text200/400, text-spacing, orientation/axe. npm ci/full check/typecheck/lint/database type replay/build dan CI. Hasil akhir akan memperbarui laporan ini.

Tidak mengubah SQL/schema/API/RBAC/provider/env. Tidak perlu migrasi. Tidak melakukan pengiriman, restore atau load produksi. Akun admin produksi, AT/perangkat fisik dan backup/restore nyata tidak diklaim. Rollback revert PR tanpa rollback data. PR rilis mencatat CI/merge/exact Production SHA.

Referensi: https://nextjs.org/docs/app/api-reference/file-conventions/metadata/app-icons ; https://supabase.com/docs/reference/javascript/using-modifiers-abortsignal . Changelog Supabase diperiksa sebelum memakai signal SDK.
