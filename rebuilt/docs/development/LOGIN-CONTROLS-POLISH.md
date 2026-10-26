# Login controls polish

Branch: `feat/login-password-captcha-polish`; baseline main `67025a2166e122231006025f0433238dc75b75eb`.

- `login-form.tsx`: move visibility toggle inside password input wrapper; preserve accessible name, pressed state, keyboard operation and password handling.
- `login.module.css`: reserve input space for an absolute 44px toggle, add hover/focus states.
- `recaptcha-widget.tsx`: semantic panel, official compact Google control centered, readable status icons and full-width retry control. Google iframe and server verification remain unchanged.

Validation: TypeScript, lint, 22 Login tests and production build passed. Login browser suite: 212 checks, 16 axe scans, no issues; responsive views include 320px, tablet, desktop, landscape and text scaling. Provider is mocked in browser tests; real Google challenge acceptance is not claimed. No API, dependency, environment or database changes. Not published or merged.
