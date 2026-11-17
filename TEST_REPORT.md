# MANAM.in Test Report & Verification Checklist

## Automated & Build Verification (Executed)
- **TypeScript (`tsc --noEmit`)**: Passed with 0 errors across `src/` and `api/`.
- **Production Bundle (`vite build`)**: Passed with 0 errors.
- **Firestore Security Rules Lint (`npx eslint firestore.rules`)**: Passed with 0 errors and 0 warnings (`@firebase/eslint-plugin-security-rules`).
- **Firestore Rules Deployment (`fax.DeployRules`)**: Deployed to provisioned Firestore instance.
- **API Handler Security Checks (`tsx` smoke suite)**:
  - `GET /api/health` -> `200 {"ok":true}`
  - `GET /api/cron/daily` without `CRON_SECRET` -> `401 {"error":"Unauthorized"}`
  - `GET /api/cron/daily` with wrong bearer secret -> `401 {"error":"Unauthorized"}`
  - `POST /api/contributions/confirm` without Bearer token -> `401 {"error":"Missing Authorization bearer token"}`
  - `POST /api/contributions/confirm` cross-origin request -> `403 {"error":"Cross-origin request rejected"}`
  - `POST /api/super/erase-wedding` without Bearer token -> `401 {"error":"Missing Authorization bearer token"}`

---

## Section 12 Acceptance Checklist (Live Environment & Browser Matrix)

Complete these checks after configuring `FIREBASE_SERVICE_ACCOUNT_JSON`, `CRON_SECRET`, and `manam.in` Authorized Domains in Vercel + Firebase:

| # | Requirement | Enforcement Layer | Verification Status |
| --- | --- | --- | --- |
| 1 | Only `jbackup025@gmail.com` (`email_verified: true`) opens `/super` and calls `/api/super/*`; forged/missing tokens rejected | `firestore.rules`, `api/_lib/firebaseAdmin.ts`, `SuperAdminPage.tsx` | Automated API unauthenticated check passed; verify live Google sign-in with non-admin & admin accounts after setting `FIREBASE_SERVICE_ACCOUNT_JSON` |
| 2 | Invited couple admin accesses only their own wedding; cross-slug `/api` or Firestore calls denied | `isWeddingAdmin(slug)`, `requireWeddingAccess()`, `CoupleAdminPage.tsx` | Rules linted & deployed; verify with 2 test Google accounts across 2 slugs in staging |
| 3 | Guests cannot list/read `rsvps`, `contributions`, or `auditLogs`, nor edit another guest's RSVP or `public/progress` | `firestore.rules` (`allow list: if isSuperAdmin() || isWeddingAdmin(slug)`, `public/progress` `allow write: if false`) | Enforced in deployed `firestore.rules` and `firestore.rules.test.ts` Dirty Dozen cases |
| 4 | Suspended or expired wedding blocks public site reads & public writes | `isWeddingPubliclyActive(slug)` checking `status == 'ACTIVE' && expiresAt > request.time` | Enforced in deployed `firestore.rules` + graceful `"This invitation is not available"` screen |
| 5 | Payment confirmed once (idempotent); totals stay exact after reversal or deletion | Firestore `runTransaction` in `/api/contributions/confirm`, `/reverse`, `/delete` | Transaction logic implemented; verify end-to-end with staging `FIREBASE_SERVICE_ACCOUNT_JSON` |
| 6 | Two weddings with different themes and UPI accounts remain fully isolated | Isolated `weddings/{slug}/public/site` and `weddings/{slug}/*` subcollections | Verified by isolated document paths and `isValidSlug` rules |
| 7 | Erase & Reset leaves zero documents, is safe to run twice, and reserves slug | `POST /api/super/erase-wedding` + `reservedSlugs/{slug}` tombstone | Idempotent batch deletion + post-erase count check implemented; verify on staging wedding |
| 8 | Cron endpoint rejects calls without exact `CRON_SECRET` | `crypto.timingSafeEqual` in `api/cron/daily.ts` | Automated check passed (`401` on missing/wrong secret) |
| 9 | Google sign-in (`signInWithPopup`) works on `manam.in` across Desktop Chrome, Android Chrome, iPhone Safari | Firebase Authorized Domains + CSP headers in `vercel.json` | Pending live domain test on `manam.in` (see `README.md` for optional `/__/auth/` rewrite if needed) |
| 10 | RSVP & Moi flows responsive at `360px`, `390px`, `412px`, tablet, `1280px`, `1920px` | Mobile-first Tailwind layout, `44px` touch targets, adaptive QR / mobile UPI deep links | Verify visually across viewport breakpoints in browser dev tools & mobile devices |
