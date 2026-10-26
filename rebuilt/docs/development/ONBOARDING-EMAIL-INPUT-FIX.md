# First-login email entry fix

Branch `fix/onboarding-email-input`, baseline main `961439227f028d1bf183e0a35785956cd1925e7f`.

## Cause

After forced password replacement and a new login, an account may still have gate `security_question` (or `profile_pending`). Email state/reserve/consume RPCs only accepted `email_pending`/`ready`, so EmailPage rendered a blocking message instead of EmailPanel. The address API also depended on the general profile RPC, which had the same earlier-gate restriction. This was a server gate mismatch, not an input disabled-style bug.

## Fix

Migration `20261026011522_onboarding_email_contact.sql` permits self-service email state and OTP verification during `security_question`/`profile_pending` after mandatory password completion. Password and account-pending gates remain blocked. Recovery eligibility, daily/global budgets, HMAC, challenge ownership, single use and session checks remain unchanged. `app_security_state` and `app_onboarding_ready` are not modified: verifying email cannot skip mandatory questions/biodata.

New service-only invoker RPC `app_email_address` locks the caller's profile, validates session and exact expected prior email, and changes only contact_email. Changing it supersedes pending codes and clears old proof; unrelated profile fields cannot be changed. API uses the narrow RPC instead of broadening general profile access. Runtime RPC types and migration replay snapshot updated.

## Validation

- Email API/page tests: 14 passed.
- Email SQL tests including actual first-password-finish/new-session/contact-entry/send/consume sequence: 11 passed.
- Email all-role access tests: 5 passed.
- Security tests: 13 passed; recovery tests: 13 passed.
- TypeScript, lint, production build and schema replay/type check passed.
- Email browser suite: 87 checks, 10 axe scans, no JavaScript errors, including empty address entry/save and OTP controls. SMTP and real production credentials not used.

All DB writes in tests run in isolated PGlite migration replay; production inspection only read three function source hashes, no user records or secrets. No cloud schema changes, merge or deployment performed. Release must apply migration before deploying the API that calls the new RPC. Live Gmail delivery and real-user UAT remain unverified.
