# Phase 11 — Seed data, final docs & hardening

## 1. Phase objective

Finish the backend deliverables without adding product features: provide deterministic demo
data, make the API documentation final and exact, harden the existing routes, and add focused
test coverage. Preserve Phases 0–10, make no schema or migration change, and keep the work
backend-only.

## 2. Implemented features

- **Deterministic seed data:** `src/server/seed/demo-data.ts` builds the full dataset from a
  fixed anchor date and deterministic UUID-shaped file identifiers.
- **Idempotent seed runner:** `prisma/seed.ts` hashes `SEED_DEMO_PASSWORD` with Better Auth's
  password helper and upserts every row inside one transaction in FK-safe order.
- **Personalized demo identity:** exactly one OWNER uses `fahimbinimam@gmail.com` and
  `Md. Fahim Bin Imam Nahid`. Approved variations (`Fahim Bin Imam`, `Md. Fahim`, `Nahid`,
  `Fahim Bin Imam Nahid`) appear naturally in that owner's business profile, posts, comments,
  connection message, chat, notifications and reviews. No admin or investor uses that identity.
- **Complete demo domain:** 1 admin, 10 owners, 6 investors; all eight loan-request statuses;
  all six offer statuses including a three-step counter chain; funded, repaying and completed
  loans; agreements; mixed repayment states; posts, comments, likes, follows, connections,
  conversations, messages and a per-user message deletion; reviews, reports, notifications and
  blocks.
- **Final docs:** new backend `README.md`, complete `docs/API.md`, corrected `docs/USER_FLOWS.md`,
  updated implementation index, and OpenAPI admin response schemas wrapped in the standard
  `{ data, meta? }` success envelope.
- **Hardening:** per-user message-send rate limit, shared text sanitizer, upload size rejection
  before multipart buffering, private-file authorization before storage reads, repayment-proof
  access for loan parties, proxy matcher synchronized with the protected-prefix policy, and
  rate-limit/sanitization documentation.

## 3. Files created and modified

| File | Change |
|---|---|
| `src/server/seed/demo-data.ts` | New deterministic dataset builder, env configuration and exported row types. |
| `src/server/seed/demo-data.test.ts` | New dataset invariant, personalization, relationship and unique-constraint tests. |
| `prisma/seed.ts` | Replaced stub with hashing, collision guard, FK-safe transactional upserts, trust-score recomputation and login output. |
| `.env.example` | Added `SEED_DEMO_PASSWORD`, `SEED_ADMIN_EMAIL`, `SEED_PERSONAL_EMAIL`, `SEED_ANCHOR_DATE`, message rate-limit variables. |
| `README.md` | New backend setup, scripts, environment, demo accounts, security and Going-live guide. |
| `docs/API.md` | Added rate limiting/sanitization and upload/private-file hardening; removed stale phase status wording. |
| `docs/USER_FLOWS.md` | Marked Phases 0–11 complete, removed stale "not implemented" notes, added Phase 11 section. |
| `docs/implementation/README.md` | Phase 11 report index update. |
| `src/lib/sanitize.ts` | New shared plain-text sanitizer (markup/script/style removal, control characters, CRLF, blank lines). |
| `src/server/validators/common.ts` | Text schemas now sanitize before validation; `message.ts` reuses the shared helper. |
| `src/server/rate-limit.ts`, `src/server/rate-limit.test.ts` | New in-process sliding-window limiter and tests. |
| `src/app/api/v1/conversations/[id]/messages/route.ts` | Message-send rate-limit guard. |
| `src/server/storage/upload.ts`, `src/app/api/v1/uploads/route.ts` | Early `Content-Length` rejection and parsed-file size check. |
| `src/server/storage/authorization.ts` | Repayment-proof access for loan parties. |
| `src/app/api/v1/files/[visibility]/[fileId]/route.ts` | Authorize private files before reading storage. |
| `src/proxy.ts`, `src/server/auth/proxy-policy.test.ts` | Matcher/policy synchronization test and missing offer/agreement/loan/feed matchers. |
| `src/server/openapi/schemas.ts`, `src/server/openapi/routes/admin.ts`, `src/server/openapi/openapi.test.ts` | Admin success envelopes and exact API.md ↔ OpenAPI contract test. |
| Existing route/service/validator tests | Extended for message rate limiting, private-file proofs, sanitization and proxy policy. |

## 4. Database models and migrations involved

No Prisma schema, migration or enum change was made. The seed writes to all existing domain
tables: `User`, `Account`, `UserVerification`, `BusinessProfile`, `ProductImage`,
`InvestorProfile`, `LoanRequest`, `Offer`, `Loan`, `Agreement`, `Repayment`, `Post`, `Comment`,
`Like`, `Follow`, `Connection`, `Conversation`, `Message`, `MessageDeletion`, `Notification`,
`Review`, `Report` and `Block`. It respects the partial unique indexes for one active request
per owner and one pending offer per investor per request, plus all listed unique, ordered-range
and FK constraints.

## 5. API endpoints, methods, authentication and authorization

Phase 11 adds no endpoint. Hardening affects these existing routes:

- `POST /api/v1/conversations/{id}/messages` — authenticated OWNER/INVESTOR plus 30/60s
  per-user rate limit by default.
- `POST /api/v1/uploads` — authenticated; reject `Content-Length` above 5 MB plus multipart
  boundary before buffering, then re-check `File.size`.
- `GET /api/v1/files/private/{fileId}` — authenticated before any storage read; verification
  owner, loan party (for repayment proofs) or ADMIN only.
- `GET /api/v1/admin/*` OpenAPI operations — successful responses documented as
  `{ data, meta? }`, matching the implementation.

`docs/API.md` now covers the complete implemented route set. A test compares every
method/path table row and heading with the generated OpenAPI document in both directions, so
undocumented or nonexistent endpoints fail the suite.

## 6. Business rules and state transitions

The seed dataset demonstrates each declared state machine without invoking services:

- Verification: `PENDING`, `APPROVED` and `REJECTED` for both owner and investor roles.
- Loan requests: all eight statuses; at most one of `OPEN`, `IN_DISCUSSION`, `FUNDED` or
  `REPAYING` per owner.
- Offers: all six statuses; `off_disc_01 → off_disc_02 → off_disc_03` links a counter chain
  with alternating `INVESTOR`/`OWNER` proposers and no duplicate pending investor/request pair.
- Loans: `PENDING_AGREEMENT` (no schedule yet), `ACTIVE` (four mixed repayment states) and
  `COMPLETED` (all installments confirmed, two mutual reviews).
- Loan totals and installment sums use the same `buildRepaymentSchedule` helper as production.
- Suspension is represented on one owner and one investor; protected-route enforcement was
  already added in Phase 10.

## 7. Validation and security measures

- `SEED_DEMO_PASSWORD` is length-checked; admin/personal emails are normalized, must differ and
  the anchor must be a valid ISO timestamp.
- The seed stores only a Better Auth hash, refuses to overwrite non-demo users that already
  own a seed email or phone, and never sends email.
- Deterministic SHA-256-derived UUIDs keep all public/private file URLs valid under the
  storage validators.
- Client text is sanitized by shared Zod transforms before services; script/style blocks,
  markup, control characters and excessive blank lines are removed.
- Message rate-limit rules are env-configurable and return 429 with
  `details.retryAfterSeconds`. The limiter is in-process and documented as needing a shared
  store for multi-instance production.
- Unknown query keys, client-sent identity/role/status fields and oversized pagination remain
  rejected by the existing strict validators; errors keep the standard safe envelope.

## 8. Tests and verification results

Commands run from `backend/` on 2026-11-23:

| Command | Result |
|---|---|
| `pnpm lint` | Passed, no warnings. |
| `pnpm typecheck` | Passed. |
| `pnpm test` | 568 tests in 54 files passed. |
| `pnpm build` | Passed (`prisma generate && next build`, 41 static pages). |
| `git diff --check` | Passed, no whitespace errors. |
| `pnpm exec prisma migrate deploy` (temporary DB) | Applied `20261123170000_init`. |
| `pnpm db:seed` (temporary DB) | Passed twice with identical output; idempotent. |
| `SEED_DEMO_PASSWORD=… pnpm db:seed` | Passed; custom secret not printed and password hash changed. |
| Seed SQL inspection | 17 users, 17 accounts, 16 verifications, 10 businesses, 6 investors, 8 requests, 10 offers, 3 loans, 3 agreements, 7 repayments, 12 posts, 4 comments, 5 likes, 3 connections, 1 conversation, 3 messages, 14 notifications, 2 reviews, 3 reports, 1 block; personal email appears once on an OWNER with a 161-character hash. |
| Temporary DB cleanup | `smeconnect_seed_check` dropped; original `smeconnect` DB still has its 3 pre-existing users. |

The live seed was run only against a disposable database because the existing dev database
already contains a non-demo account with `fahimbinimam@gmail.com`; that account was not touched.

## 9. Known limitations or incomplete work

- The message rate limiter uses process memory. Multiple API replicas need a shared store
  before production traffic.
- No payment gateway, audit table or moderation notification type was added; those would need
  approval and possibly a migration.
- Seeding a database containing a foreign user with a seed email/phone fails deliberately
  rather than overwriting that user. Use a fresh database or change the `SEED_*` overrides.
- No commits or pushes were made. Phase 9, Phase 10 and Phase 11 remain uncommitted on
  `nahid_dev`.

## 10. Dependencies on other phases

Phase 11 relies on the Phase 0 setup and migration, Phase 1 schema, Phase 2 Better Auth helpers,
Phase 7 schedule helper and agreement service, Phase 9 trust-score recomputation, and Phase 10
admin/suspension model. It completes the documentation and hardening checklist for Phases 0–10;
no later phase is required for this work to be reviewable.
