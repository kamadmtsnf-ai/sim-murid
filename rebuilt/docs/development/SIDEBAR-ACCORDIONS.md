# Sidebar group accordions

Branch `feat/sidebar-group-accordions`, baseline main `04beffbab5bca514e0ad0edd5fe703354c5cff8a`.

Each permitted navigation group has a keyboard-accessible heading button with aria-expanded and a unique aria-controls panel. All groups default collapsed, including the active-page group. Multiple groups may expand independently. State is shared between desktop and drawer during this shell session; no browser persistence. Existing active links and role-filtered navigation are preserved.

Search temporarily defaults matching groups open, with independent search expansion state; clearing it restores browsing expansion. Hidden groups do not expose links to keyboard or screen readers. Active-link scroll skips hidden links, preventing scroll jumps to collapsed content. Touch targets are at least 44px; long labels wrap.

Files: workspace-shell.tsx (state and markup), globals.css (header/toggle styles), verify-navigation.mjs (--accordion-only targeted browser regression), verification results.

Validation: TypeScript, lint, 6 UI tests, production build passed. Browser --accordion-only: 52 checks, 3 axe scans, no JavaScript errors. Viewports 320/768/1440; default collapse, Enter/Space, independent expansion, search restoration, role restrictions and horizontal overflow checked. Initial browser harness used desktop search label on mobile; corrected the selector and reran successfully. No API/Auth/database or dependency changes. Not merged/deployed.

The older default navigation suite assumes expanded group links; it has not been rerun for this change. Use --accordion-only for the recorded checks. Physical-device and assistive-technology user testing not performed.

## Pembaruan L05

Accordion PR74 sudah dirilis. L05 menambahkan marker halaman aktif dan memperbaiki collapse search yang terbawa saat query identik diulang. Suite legacy navigation kini menyiapkan kelompok opened secara eksplisit dan telah dijalankan ulang: 66 checks/14 axe; suite collapsed/wayfinding 91/6. Lihat L05-SIDEBAR-WAYFINDING.md untuk baseline/batas; paragraf verifikasi di atas adalah snapshot historis PR74.
