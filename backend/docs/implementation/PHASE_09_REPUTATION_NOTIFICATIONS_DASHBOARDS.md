# Phase 9 — Reputation, notifications and dashboards

**Status:** Implemented in the working tree on `nahid_dev`; **not committed and not pushed** at
the time this report was written. **Source of truth:** the files listed below, `docs/API.md`,
`docs/USER_FLOWS.md`, the generated OpenAPI document and the Vitest suite.

## 1. Phase objective

Implement the Phase 9 scope from `BACKEND_PROMPT.md` for the backend only: post-loan reviews,
the single trust-score function with the required recompute triggers, user reports, block/unblock,
notification inbox endpoints, and owner/investor dashboards. Existing Phase 0–8 work was preserved.
No frontend code, no Phase 10/11 features, no new dependency, no Prisma schema change and no
migration were introduced.

## 2. Implemented features

- 14 route-handler operations across 11 new paths, all thin: parse/validate → call service → respond.
- Strict Zod request/response schemas for reviews, reports, notifications, blocks and dashboards,
  all exported through `src/server/validators/index.ts`.
- One server-owned trust-score function with verification, repayment, completion, rating and
  overdue factors; persisted to the existing role profile columns and recomputed transactionally.
- Review eligibility: one review per side, only for loan participants, only after `COMPLETED`. The
  reviewee is derived from the loan and cannot be chosen by the client.
- Report creation for users, posts, comments and messages, with reporter scoping and an admin-wide
  list queue. Admin resolution is intentionally deferred to Phase 10.
- Blocking in either direction severs follows and connections in one transaction; existing message
  guards still apply, and authenticated suggestions exclude blocked users.
- Notification list (`?unread=`), unread count, mark-one and mark-all endpoints, all scoped by the
  session user with cursor pagination.
- Role-specific dashboards with server-derived request/offer/loan/repayment metrics, recent
  notifications, activity counts, per-loan portfolio health and a clamped trust score.
- Reuse of all notification events and important-event emails already emitted by Phases 2, 5, 6, 7
  and 8 through the shared sendEmail abstraction; no new email path was added.
- Proxy pre-filter updates, OpenAPI tags/schemas/routes with validated examples, unit tests and
  user-facing documentation updates.

## 3. Files created and modified

Created:

- `src/server/services/trust-score.ts`, `trust-score.test.ts`
- `src/server/services/reviews.ts`, `reviews.test.ts`
- `src/server/services/notifications.ts`, `notifications.test.ts`
- `src/server/services/blocks.ts`, `blocks.test.ts`
- `src/server/services/reports.ts`, `reports.test.ts`
- `src/server/services/dashboards.ts`, `dashboards.test.ts`
- `src/server/validators/notification.ts`, `block.ts`, `dashboard.ts`
- `src/app/api/v1/reviews/route.ts`, `src/app/api/v1/reviews/[reviewId]/route.ts`
- `src/app/api/v1/reports/route.ts`
- `src/app/api/v1/notifications/route.ts`, `unread-count/route.ts`, `read-all/route.ts`,
  `[notificationId]/read/route.ts`
- `src/app/api/v1/blocks/route.ts`, `src/app/api/v1/blocks/[userId]/route.ts`
- `src/app/api/v1/dashboard/owner/route.ts`, `dashboard/investor/route.ts`
- `src/server/openapi/routes/phase9.ts`
- `docs/implementation/PHASE_09_REPUTATION_NOTIFICATIONS_DASHBOARDS.md`

Modified:

- `src/server/validators/social.ts` (review/report request and response schemas; review list query)
- `src/server/validators/index.ts`
- `src/server/services/verification.ts` (recompute trust on verification decisions)
- `src/server/services/repayments.ts` (recompute trust on confirmation and overdue detection)
- `src/server/services/follow.ts`, `connection.ts`, `discovery.ts` (block consistency)
- `src/server/services/repayment-fake.ts`, `verification.test.ts`, `follow.test.ts`,
  `connection.test.ts` (test doubles extended for new dependencies)
- `src/server/auth/proxy-policy.ts`, `proxy-policy.test.ts`, `src/proxy.ts`
- `src/server/openapi/config.ts`, `schemas.ts`, `routes/index.ts`, `openapi.test.ts`
- `docs/API.md`, `docs/USER_FLOWS.md`, `docs/implementation/README.md`

## 4. Database models and migrations involved

- Uses existing Phase 1 models unchanged: `User`, `UserVerification`, `BusinessProfile`,
  `InvestorProfile`, `Loan`, `LoanRequest`, `Repayment`, `Review`, `Notification`, `Report`,
  `Block`, `Follow`, `Connection`, `Post`, `Comment`, `Message` and `Conversation`.
- **No Prisma schema change and no migration were required.** No `prisma migrate`, `db push`,
  reset or seed command was run.
- Reused constraints and fields: `Review.loanId/reviewerId` uniqueness for one review per side,
  `Block` uniqueness for a blocker/blocked pair, `Notification` indexes on `(userId, readAt)` and
  `(userId, createdAt)`, partial unique active-request constraint, and existing `trustScore` Int
  columns on role profiles.
- Multi-table writes use `prisma.$transaction`: review + trust recompute, block + follow/connection
  deletion, verification notification + trust recompute, repayment confirmation + trust recompute,
  and overdue recomputation for affected participants.

## 5. API endpoints, methods, authentication and authorization

| Method | Path | Authorization |
|---|---|---|
| GET | `/api/v1/reviews?userId=&cursor=&limit=` | public |
| GET | `/api/v1/reviews/{reviewId}` | public |
| POST | `/api/v1/reviews` | `OWNER` or `INVESTOR` |
| GET | `/api/v1/reports?status=&cursor=&limit=` | session; own reports, or all for `ADMIN` |
| POST | `/api/v1/reports` | `OWNER` or `INVESTOR` |
| GET | `/api/v1/notifications?unread=&cursor=&limit=` | session |
| GET | `/api/v1/notifications/unread-count` | session |
| PATCH | `/api/v1/notifications/{notificationId}/read` | session; owner only |
| PATCH | `/api/v1/notifications/read-all` | session; own rows only |
| GET | `/api/v1/blocks?cursor=&limit=` | `OWNER` or `INVESTOR` |
| POST | `/api/v1/blocks` | `OWNER` or `INVESTOR` |
| DELETE | `/api/v1/blocks/{userId}` | blocker only |
| GET | `/api/v1/dashboard/owner` | `OWNER` |
| GET | `/api/v1/dashboard/investor` | `INVESTOR` |

All lists use `?cursor=&limit=` (default 20, max 50). Success bodies are `{ data, meta? }`;
errors are `{ error: { code, message, details? } }`. Unknown query keys are rejected. Review reads
are public like profiles, but review writes have their own role guard; `/api/v1/reviews` was
therefore left out of the optimistic protected prefix list.

## 6. Business rules and state transitions

- **Review:** loan must be `COMPLETED`; actor must be an owner or investor of that loan; the
  derived counterparty must match `revieweeId`; one review per `(loanId, reviewerId)` including
  concurrent duplicates (409). Non-participants get 404 so loan existence is not leaked.
- **Trust score:** `verified +25`; on-time confirmed repayments `+5` each, max `30`; completed
  loans `+10` each, max `25`; average received rating `× 20 / 5` rounded; overdue installments
  `−5` each, max `−25`; final value clamped to integer `0–100`. A confirmation counts as on time
  only when `confirmedAt <= dueDate`.
- **Recompute triggers:** verification decision, repayment confirmation, `markOverdueRepayments()`
  and review creation. Each recomputation runs inside the triggering transaction.
- **Report:** one open report per reporter/target (409); target must exist and, for soft-deletable
  content, not be deleted (404); reports start `OPEN`; `ADMIN` may filter by status but resolution
  endpoints remain Phase 10.
- **Block:** self-block and duplicate block return 409; target must be an active non-admin user
  (404); blocking is mutual for social features; follows and connections in either direction are
  deleted in the same transaction; unblocking removes only the actor's own block.
- **Notification:** all reads/mutations are scoped to `actor.id`; marking one is idempotent and
  keeps the first `readAt`; another user's notification is indistinguishable from a missing one.
- **Dashboards:** all numbers are derived from the database for the session user. Owner shows the
  single active `OPEN`/`IN_DISCUSSION`/`FUNDED`/`REPAYING` request, received-offer counts, most
  recent non-completed loan, `nextDue` and `progressPct`. Investor shows submitted offers,
  active/completed loans, lent/repaid/expected BDT, overall progress, earliest due and per-loan
  `ON_TRACK`/`DUE_SOON`/`OVERDUE`/`COMPLETED` health.

## 7. Validation and security measures

- Every request body/query uses strict Zod allow-lists; actor ids, roles, statuses, trust scores,
  notification owners, report reporters and dashboard metrics are never taken from the client.
- Route guards call `requireSession()`/`requireRole()`; services repeat role, ownership and
  participant checks, so a valid session on its own is not enough.
- Review and block cards reuse the existing safe public author projection: no email, phone, NID,
  verification documents or private file URLs.
- Existing block guards were added to follow and connection creation, and authenticated discovery
  suggestions exclude blocked users in either direction. Public discovery has no session actor and
  was deliberately left unfiltered.
- Multi-table writes use transactions; unique-constraint violations are mapped to 409 so concurrent
  duplicate reviews/blocks/reports cannot create inconsistent rows.
- Optimistic proxy pre-filtering covers reports, notifications, blocks and dashboards; real guards
  still enforce session, role and ownership. The Next.js 16 matcher was kept in sync.
- No secrets, OTPs, NID numbers or SMTP details are logged. Notifications created by earlier phases
  continue to use the single `sendEmail` abstraction; failures remain best-effort.

## 8. Tests and verification results

- `pnpm lint` — passed (no ESLint findings).
- `pnpm typecheck` — passed (`tsc --noEmit`).
- `pnpm test` — passed: **483 tests in 46 files**.
- `pnpm build` — passed; Next.js 16 production build compiled and listed all new Phase 9 routes.
- `git diff --check` — passed (no whitespace errors).

Automated Phase 9 coverage includes: review eligibility, participant and role restrictions, forged
reviewee rejection, duplicate and concurrent duplicate handling, rating validation, report target
validation and reporter/admin scoping, trust-score boundaries/caps/on-time logic and persisted
recompute calls, notification ownership/read idempotency and cursor pagination, block discovery and
follow/connection severing, dashboard schema conformance and aggregate accuracy, proxy policy, and
OpenAPI path registration with examples parsed against their response schemas. Existing tests were
extended for trust recomputation and block guards.

## 9. Known limitations or incomplete work

- Admin report resolution, profile/post moderation and analytics remain Phase 10 work.
- Notification deletion is intentionally absent from the Phase 9 contract; the inbox supports list,
  count and read operations only.
- `NotificationType` has no review-specific value, so creating a review updates trust but does not
  emit an in-app notification or email. Reports and blocks likewise do not emit notifications.
- Public discovery endpoints remain unfiltered by viewer because they have no session actor; only
  authenticated suggestions respect blocks.
- Important-event emails are inherited from earlier phases; no new email template was added for
  Phase 9 events.
- Dashboard due/health derivation marks a past-due unpaid installment `OVERDUE` on reads even if the
  cron job has not persisted it yet; this mirrors the Phase 8 behavior.
- **No live end-to-end business workflow was performed** against a running Postgres/Mailpit stack.
  Verification was automated fake-DB/service tests, static checks and a production build only.
- No commit or push was made; all Phase 9 changes remain in the working tree for review.

## 10. Dependencies on other phases

- Builds on the Phase 1 relational model, Phase 2 auth/guards and verification, Phase 3 public
  profile projections, Phase 4 loan requests, Phase 5 feed/networking/pagination helpers, Phase 6
  messaging block guards, Phase 7 offers/agreements and Phase 8 repayments/notification emails.
- Trust recomputation reuses `Notification` and `Repayment` events from earlier phases rather than
  introducing a separate event table.
- Leaves Phase 10 admin moderation and hardening untouched.
