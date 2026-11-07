# Modernize SiM-Murid UI with DaisyUI while preserving interaction contracts

Target branch: main. Head: design/daisyui-modernization-20261107. Intended state: ready after current-head CI passes, then merge as authorized by owner.

The application previously mixed custom component styling, glass surfaces and local native-control utilities. This change establishes DaisyUI 5.7.50 as the visual foundation across shared primitives, the workspace shell and module controls, using a light-only SiM-Murid theme. Existing Radix behavior, floating labels, PWA policy, state, validation and server authorization remain in place.

The migration covers 23 page entries and dynamic module panels. 271 native control declarations in 43 files adopt DaisyUI classes. AST comparison against main confirms that 594 native/component control declarations retain all non-styling attributes. The sidebar search focus remains fully reachable in short viewports. A legacy border-color token was renamed to avoid colliding with DaisyUI's border-width variable.

Validation: npm ci, typecheck, lint, audit:deadcode, npm run check (792 tests across 83 groups, database type replay and production build), and final build/lint passed. 33 browser suites passed with 3,118 checks and 333 axe scans, including actual local Home and Login pages. Six representative component viewport widths, short landscape, keyboard, dialog focus and enlarged text are covered.

All five previously blocked browser suites now pass after updating the test drivers to interact explicitly with the real Radix confirmation dialogs. They add 299 checks and 32 axe scans, for 38 passing browser suites, 3,417 checks and 365 axe scans overall. The Points inactive catalog payload is verified unchanged. Survey pending-write logout is explicitly blocked before confirmation, then allowed after save completes. No runtime business logic was modified to make old tests pass. Production-account/device UAT remains outside the automated test scope.

CSS output increases by approximately 11.7KB gzip; the DaisyUI component include list limits generated styling. No added client JavaScript dependency, API/database/RLS/schema changes, production deployment or migration.

See rebuilt/docs/verification/daisyui-modernization.md and rebuilt/docs/design-system/MASTER.md for the component/page matrix, evidence and remaining limitations. The owner authorized merging once the current-head checks pass.
