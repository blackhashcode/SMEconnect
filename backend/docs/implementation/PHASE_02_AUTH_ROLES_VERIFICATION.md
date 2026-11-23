# Phase 2 — Authentication, roles & verification

**Status:** Implemented. Primary history: `c6aadae` (Swagger/OpenAPI), `460d046`
(auth functions and email OTP), and the auth/verification/storage/OTP part of `072f2b5`
(`feat: complete auth, verification, storage and profile APIs`).
**Source of truth:** `src/server/auth/`, `src/server/otp/`, `src/server/verification*` files,
`src/server/storage/`, `src/proxy.ts`, `docs/API.md`.

## 1. Phase objective

Deliver Better Auth email/password authentication with OWNER/INVESTOR role selection,
email OTP verification, sessions and role guards; a local phone OTP flow; identity/business
verification submission and admin review; and a storage abstraction with authorized file
serving. Email lands in Mailpit locally. Swagger/OpenAPI documentation was added in the same
period (commit `c6aadae`).

## 2. Implemented features

- Better Auth catch-all mounted at `/api/v1/auth/[...all]`; no hand-rolled auth endpoints.
- Role selection via transport-only `signupRole` (`OWNER` | `INVESTOR`). `ADMIN` is rejected;
  client `role`/`status` are discarded by a request hook and database hooks.
- Email/password with `requireEmailVerification: true`, password 8–128 chars, 7-day session,
  1-day refresh age, cookie cache disabled, sessions revoked on password reset.
- Email OTP plugin: 6 digits, 300-second expiry, hashed storage, 3 allowed attempts,
  rotating resend. Token-based verification/reset paths are disabled; OTP paths are the
  supported flow. OTP email is rendered by project templates and sent through the single
  `sendEmail` service (Nodemailer SMTP → Mailpit locally).
- Phone OTP: 6 digits, 300-second expiry, HMAC-hashed in the existing `Verification` table,
  3 attempts, one code per 60 seconds, E.164-like normalization for Bangladeshi numbers,
  delivery through a `sendOtp` interface (local default: email to the account address;
  `console` provider prints metadata only, never the code).
- Authorization primitives: `assertRole`, `assertOwnership`, `assertVerified`,
  `verificationTypeForRole`, `requireSession`, `requireRole`, `requireOwnership`,
  `requireVerifiedUser`; `src/proxy.ts` pre-filters protected prefixes by session-cookie
  presence only.
- Verification: submit/resubmit, view own status, admin queue and admin approve/reject with
  note; a `VERIFICATION_RESULT` notification is written in the same transaction as the
  decision.
- Storage: `StorageProvider` interface, local implementation writing under `UPLOAD_DIR`
  outside `public/`, UUID filenames, allowed JPEG/PNG/WebP/PDF, 5 MB limit, private/public
  visibility from upload `purpose`, authorized private file route.
- OpenAPI/Swagger: generated document at `/api/docs`, UI at `/docs`, locally served assets,
  validator-derived schemas in `src/server/openapi/`, and an `openapi.test.ts` contract test.

## 3. Files created and modified

Auth and OTP (`460d046`, `072f2b5`):

- `src/app/api/v1/auth/[...all]/route.ts`, `route.test.ts`
- `src/server/auth/index.ts`, `constants.ts`, `signup-role.ts`, `signup-role.test.ts`,
  `policy.ts`, `policy.test.ts`, `proxy-policy.ts`, `proxy-policy.test.ts`, `guards.ts`
- `src/proxy.ts`
- `src/server/otp/service.ts`, `service.test.ts`, `delivery.ts`, `delivery.test.ts`
- `src/app/api/v1/phone-otp/request/route.ts`, `src/app/api/v1/phone-otp/verify/route.ts`
- `src/server/validators/auth.ts`, `phone-otp.ts`, `openapi-setup.test.ts` and the
  `import "@/server/openapi/setup"` header added across validators

Email and notifications:

- `src/server/notifications/email.ts`, `email.test.ts`, `smtp.ts`
- `src/server/notifications/auth-otp.ts`, `auth-otp.test.ts`,
  `templates/auth-otp.ts`, `templates/auth-otp.test.ts`, `templates/phone-otp.ts`

Verification and storage:

- `src/app/api/v1/verifications/route.ts`, `src/app/api/v1/verifications/me/route.ts`
- `src/app/api/v1/admin/verifications/route.ts`,
  `src/app/api/v1/admin/verifications/[id]/route.ts`
- `src/server/services/verification.ts`, `verification.test.ts`
- `src/server/storage/index.ts`, `types.ts`, `upload.ts`, `authorization.ts`,
  `authorization.test.ts`, `providers/local.ts`, `providers/local.test.ts`
- `src/app/api/v1/uploads/route.ts` (listed in OpenAPI; added in this period),
  `src/app/api/v1/files/[visibility]/[fileId]/route.ts`
- `src/server/validators/storage.ts`, `verification.ts`, `user.ts`
- `src/server/errors.ts`, `errors.test.ts` (additional domain error types)

Docs/OpenAPI (`c6aadae` and later):

- `src/app/api/docs/route.ts`, `src/app/docs/page.tsx`,
  `src/app/docs/SwaggerUIClient.tsx`, `src/app/docs/assets/[asset]/route.ts`,
  `src/app/docs/assets/[asset]/route.test.ts`
- `src/server/openapi/config.ts`, `document.ts`, `registry.ts`, `schemas.ts`, `setup.ts`,
  `routes/index.ts`, `routes/health.ts`, `routes/auth.ts`, `routes/phone-otp.ts`,
  `routes/storage.ts`, `routes/verification.ts`, `openapi.test.ts`
- `src/server/validators/health.ts`, `next.config.ts`, `package.json`, `.env.example`,
  `docs/API.md` (updated)

## 4. Database models and migrations involved

- Reused Phase 1 models without schema or migration changes.
- `User.emailVerified` (Better Auth), `User.role`, `User.status`;
  `Session` for 7-day sessions; `Verification` stores HMAC-hashed phone OTP challenges;
  `UserVerification` stores KYC state and reviewer fields; `Notification` stores
  verification results.
- No new Prisma migration in Phase 2.

## 5. API endpoints, methods, authentication and authorization

All auth endpoints keep **Better Auth's native JSON**, not the project's
`{ data }` envelope.

| Method | Path | Authentication | Authorization / notes |
|---|---|---|---|
| POST | `/api/v1/auth/sign-up/email` | Public | Requires `signupRole`: OWNER or INVESTOR; ADMIN rejected |
| POST | `/api/v1/auth/sign-in/email` | Public | Blocked until email verified |
| POST | `/api/v1/auth/sign-out` | Session | Clears session cookie |
| GET | `/api/v1/auth/get-session` | Public | Returns `{ session, user }` or `null` |
| POST | `/api/v1/auth/update-user` | Session | Only `name`/`image`; role/status stripped |
| POST | `/api/v1/auth/email-otp/send-verification-otp` | Public | `{ email, type: "email-verification" \| "forget-password" }` |
| POST | `/api/v1/auth/email-otp/verify-email` | Public | `{ email, otp }`; marks verified, sets cookie |
| POST | `/api/v1/auth/email-otp/request-password-reset` | Public | `{ email }` |
| POST | `/api/v1/auth/email-otp/reset-password` | Public | `{ email, otp, password }`; revokes sessions |
| POST | `/api/v1/phone-otp/request` | Session | Sends OTP to the current account |
| POST | `/api/v1/phone-otp/verify` | Session | Links phone after successful OTP |
| POST | `/api/v1/verifications` | Session | OWNER/INVESTOR; type must match role |
| GET | `/api/v1/verifications/me` | Session | Own verification or `data: null` |
| GET | `/api/v1/admin/verifications` | ADMIN | Cursor-paginated review queue |
| POST | `/api/v1/admin/verifications/{id}` | ADMIN | Approve/reject with review note |
| POST | `/api/v1/uploads` | Session | Multipart upload; purpose controls visibility |
| GET | `/api/v1/files/{visibility}/{fileId}` | Public for public files | Private files: owner or ADMIN only |
| GET | `/api/docs`, `/docs` | Public (dev by default) | Swagger UI / OpenAPI JSON |

Protected prefixes are `/api/v1/me`, `/api/v1/verifications`, `/api/v1/admin`,
`/api/v1/uploads`, `/api/v1/phone-otp`, `/api/v1/files/private`. The proxy only checks
that the `better-auth.session_token` cookie exists; the real session/role/ownership checks
run in route guards and services.

## 6. Business rules and state transitions

- Signup requires an explicit OWNER/INVESTOR choice; role and status are server-owned.
- Email must be verified before sign-in (`requireEmailVerification: true`).
- Verification: `PENDING → APPROVED | REJECTED` by ADMIN only; rejected records may be
  resubmitted (reset to `PENDING`, reviewer fields cleared); pending/approved resubmission
  returns 409. Rejection requires a review note.
- Owners must submit at least one sales proof; investors need only an ID document.
  Verification document URLs must be internal private upload URLs.
- Phone OTP: 300-second expiry, 3 wrong attempts invalidate, resend cooldown 60 seconds
  (429 with `details.retryAfterSeconds`).
- Email OTP: 300-second expiry, 3 attempts, rotate on resend, plugin rate limit 3 per 60
  seconds by default; sign-up limited to 5/60s and sign-in to 10/60s.
- Storage: only images/PDF up to 5 MB; randomized filenames; private documents never public.

## 7. Validation and security measures

- Zod schemas for all payloads; strict objects reject unknown/client-controlled fields.
- HMAC-hashed phone OTP with constant-time comparison; plaintext OTP never stored or logged.
- Email OTP stored hashed by the Better Auth plugin; OTP never logged by templates.
- Role/ownership checks in services; admin bypass is opt-in per call site.
- Single `sendEmail` abstraction and `sendOtp` interface keep provider swapping to config.
- Token-based verification/reset endpoints are disabled; only OTP flows are mounted.
- Swagger examples use placeholder values only.

## 8. Tests and verification results

Tests added in this phase include:

- `signup-role.test.ts`, `policy.test.ts`, `proxy-policy.test.ts`, `auth` catch-all `route.test.ts`
- `otp/service.test.ts`, `otp/delivery.test.ts`
- `notifications/email.test.ts`, `auth-otp.test.ts`, `templates/auth-otp.test.ts`
- `services/verification.test.ts`
- `storage/authorization.test.ts`, `storage/providers/local.test.ts`
- `openapi.test.ts` (expanded), `validators/openapi-setup.test.ts`

**Current** repository-wide verification passes: `pnpm lint`, `pnpm typecheck`,
`pnpm test` (271 tests / 24 files), `pnpm build`, `git diff --check`.
**Not verifiable from repository:** per-phase command output at the end of Phase 2.

## 9. Known limitations or incomplete work

- OTP delivery is local-only (Mailpit email or console metadata); no SMS provider.
- Rate limiting uses in-memory storage (Better Auth `storage: "memory"`), not shared across
  multiple instances.
- No password-reset UI flow documented for a frontend; only the API exists.
- Phone OTP verifies/links a phone but is not required for signup or verification submission.
- Admin users are still created by seed/script, not through signup.
- Swagger was added between Phases 1 and 2 rather than inside Phase 0; the work is complete
  but its commit sits earlier in history than the auth code.

## 10. Dependencies on other phases

- Builds on Phase 0 helpers and Phase 1 models/validators.
- Phase 3 reuses the session/role guards, upload endpoints and file visibility rules for
  profile images.
- Phase 4 uses `assertVerified`/`requireVerifiedUser` to gate publishing and the notification
  service for verification results.
- Later phases will add notification types, rate limiting for messages, and real SMS/email
  providers without changing these interfaces.
