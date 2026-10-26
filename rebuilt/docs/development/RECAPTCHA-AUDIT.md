# reCAPTCHA audit

Baseline main: `2228bfa66395c0ac577abdfd7d9a948bc054b231`; branch `fix/recaptcha-audit`.

Scope: Login page/form/widget, shared script loader, configuration/public projection, request schema, login route/rate limit ordering, SiteVerify request/response, existing server/browser regression coverage. Compared callbacks and token semantics with official Google display/verify documentation.

## Findings and changes

1. A late Google dependency callback after load failure/timeout could call a deleted global function. Failed loads now retain a harmless, self-removing callback. A browser regression invokes it after script failure and checks Login remains disabled. Retry and cleanup behavior retained.
2. SiteVerify size limit was checked only after buffering the whole response. Read bytes incrementally, cancel beyond 16 KiB and release the reader lock. Decode UTF-8 strictly; transport and decode failure return safe unavailable status before credential lookup. Streaming tests prove cancellation and no credential checks.
3. Hostname regex accepted labels ending in hyphens and labels exceeding 63 characters. Validate each DNS label while retaining exact allowlist matching, lowercase normalization, localhost and valid hyphens. Invalid configuration continues to fail closed.

No changes to credentials, cookies, RBAC, session claims, rate limit policy, activation flag, secrets, database or dependencies. No production mutations. Google remains authoritative for token expiry and single use; no fabricated challenge timestamp expiry rule.

## Validation

- `npm run test:login`: 25 passed, 0 failed.
- `npm run typecheck`: passed.
- `npm run lint`: passed.
- `npm run build`: passed.
- Login browser suite: 213 checks, 16 axe scans, no issues or uncaught JavaScript errors. Includes load failure/late callback, retry, expiry, rejected credentials/fresh token, success, configuration unavailable, mobile/desktop/landscape and text scaling.
- `git diff --check`: passed.

Provider script and SiteVerify responses are synthetic in tests. No real Google challenge solved, no production login attempted, no claim of live provider acceptance or exhaustive absence of bugs. Real v2/domain/provider UAT and physical-device testing remain outside these automated checks. Work not merged/deployed.

References: https://developers.google.com/recaptcha/docs/display ; https://developers.google.com/recaptcha/docs/verify
