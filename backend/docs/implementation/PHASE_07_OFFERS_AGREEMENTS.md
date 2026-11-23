# Phase 7 — Offers and agreements

**Status:** Implemented in the working tree on `nahid_dev`; **not committed and not pushed** at
the time this report was written. **Source of truth:** the source files listed below,
`docs/API.md`, `docs/USER_FLOWS.md`, OpenAPI registration and the Vitest suite.

## 1. Phase objective

Implement the Phase 7 scope from `BACKEND_PROMPT.md`: create, list, inspect, withdraw, reject,
counter and accept offers; enforce the offer state machine and seven-day expiry; make acceptance
atomic; then expose an agreement summary and per-party confirmation flow that activates the loan,
writes the repayment schedule, moves the request to `REPAYING`, notifies both parties and adds a
feed post. No frontend work, no Phase 8 repayment endpoints, no Prisma migration and no new
dependencies were introduced.

## 2. Implemented features

- Ten thin route handlers under `/api/v1/offers` and `/api/v1/agreements`; all business logic is in
  services.
- Strict Zod inputs for offer terms, counters, filters and action payloads; explicit Zod response
  allow-lists for offers, parties, agreement terms and schedule previews.
- Offer lifecycle: `PENDING → ACCEPTED | REJECTED | COUNTERED | WITHDRAWN | EXPIRED`, with
  proposer/counterparty enforcement and one live pending offer per investor per request.
- Server-derived identity and seven-day expiry. Expired pending rows are reported as `EXPIRED` on
  reads and can be persisted by the exported `expireOffers()` cleanup function; no cron endpoint was
  added.
- Counter-offers: the parent becomes `COUNTERED`, a linked `PENDING` offer is created with
  `parentOfferId`, the investor identity is inherited and `proposedBy` comes from the session role.
- Atomic acceptance: conditionally claims the pending offer, rejects siblings, creates the `Loan`
  and `Agreement`, sets the request `FUNDED`, and notifies both parties in one transaction.
- Agreement detail with immutable terms snapshot, both public party cards, confirmation timestamps
  and a deterministic schedule preview.
- Dual confirmation: each party confirms once. The second confirmation atomically activates the
  loan, writes whole-taka `Repayment` rows, transitions the request to `REPAYING`, creates two
  `AGREEMENT_CONFIRMED` notifications and one owner `MILESTONE` feed post.
- Shared BigInt-based flat-interest calculation and installment builder with 7/14/30-day intervals
  and last-installment rounding absorption.
- Optimistic proxy protection, OpenAPI components/routes, tests and user-facing documentation.

## 3. Files created and modified

Created:

- `src/server/validators/offer.ts` (expanded with strict Phase 7 input and response schemas)
- `src/server/services/lending-shared.ts`
- `src/server/services/offers.ts`
- `src/server/services/offers.test.ts`
- `src/server/services/agreements.ts`
- `src/server/services/agreements.test.ts`
- `src/server/services/repayment-schedule.ts`
- `src/server/services/repayment-schedule.test.ts`
- `src/app/api/v1/offers/route.ts`
- `src/app/api/v1/offers/received/route.ts`
- `src/app/api/v1/offers/submitted/route.ts`
- `src/app/api/v1/offers/[offerId]/route.ts`
- `src/app/api/v1/offers/[offerId]/withdraw/route.ts`
- `src/app/api/v1/offers/[offerId]/reject/route.ts`
- `src/app/api/v1/offers/[offerId]/counter/route.ts`
- `src/app/api/v1/offers/[offerId]/accept/route.ts`
- `src/app/api/v1/agreements/[agreementId]/route.ts`
- `src/app/api/v1/agreements/[agreementId]/confirm/route.ts`
- `src/app/api/v1/offers.route.test.ts`
- `src/server/openapi/routes/offers.ts`
- `docs/implementation/PHASE_07_OFFERS_AGREEMENTS.md`

Modified:

- `src/server/validators/domain.test.ts` (counter schema now accepts terms only)
- `src/server/services/social-shared.ts` (`verifiedUserIds` accepts the narrower db projection)
- `src/server/auth/proxy-policy.ts`, `src/server/auth/proxy-policy.test.ts`
- `src/server/openapi/schemas.ts`, `src/server/openapi/routes/index.ts`,
  `src/server/openapi/openapi.test.ts`
- `docs/API.md`, `docs/USER_FLOWS.md`, `docs/implementation/README.md`

`src/server/validators/offer.ts` existed with earlier placeholder schemas and was replaced with the
Phase 7 contract; the file appears in both the created and modified lists because it is new to this
phase's behavior but not new to the repository.

## 4. Database models and migrations involved

- Uses the existing Phase 1 models unchanged: `Offer`, `Loan`, `Agreement`, `Repayment`,
  `LoanRequest`, `User`, `UserVerification`, `Notification` and `Post`.
- No Prisma schema change and **no migration required**. No `prisma migrate`, `db push` or reset
  command was run.
- Existing constraints are relied on rather than recreated:
  `offer_one_pending_per_investor_per_request` is a partial unique index on
  `(loanRequestId, investorId)` where status is `PENDING`; `Loan.loanRequestId` and `Loan.offerId`
  are unique; `Repayment` has `(loanId, installmentNo)` uniqueness.
- Unique violations are translated to the project's standard 409/422 errors instead of leaking
  database errors.

## 5. API endpoints, methods, authentication and authorization

Every endpoint requires an `OWNER` or `INVESTOR` Better Auth session unless noted, plus the
actor's own verified role where required. Responses use `{ data, meta? }` / `{ error }`.

| Method | Path | Authorization |
|---|---|---|
| POST | `/api/v1/offers` | Approved INVESTOR; not the request owner; request `OPEN`/`IN_DISCUSSION` |
| GET | `/api/v1/offers/received` | Approved OWNER; only offers on their own requests |
| GET | `/api/v1/offers/submitted` | Approved INVESTOR; only their own offers |
| GET | `/api/v1/offers/{offerId}` | Either loan party; no admin bypass |
| POST | `/api/v1/offers/{offerId}/withdraw` | Proposer of a pending offer only |
| POST | `/api/v1/offers/{offerId}/reject` | Counterparty of a pending offer only |
| POST | `/api/v1/offers/{offerId}/counter` | Counterparty of a pending offer only |
| POST | `/api/v1/offers/{offerId}/accept` | Counterparty of a pending offer only |
| GET | `/api/v1/agreements/{agreementId}` | Owner or investor of the loan only |
| POST | `/api/v1/agreements/{agreementId}/confirm` | Owner or investor of the loan, once each |

List endpoints use `?cursor=&limit=` (default 20, max 50) and an optional `?loanRequestId=`. The
agreement identifier, not the loan identifier, is used in the agreement path.

## 6. Business rules and state transitions

### Offers

- Only an approved INVESTOR may submit an offer, never on their own request. The request must be
  `OPEN` or `IN_DISCUSSION`; creating or countering an offer conditionally moves it to
  `IN_DISCUSSION`.
- One live pending offer per investor per request. An expired pending row is marked `EXPIRED`
  before a replacement is inserted, and a unique-race maps to a business-rule/conflict error.
- Terms are positive whole-taka `amountBdt`, `interestRatePct` 0–100 with at most two decimals,
  `tenureDays` 1–3650, `repaymentFrequency` `WEEKLY|BIWEEKLY|MONTHLY`, and an optional plain-text
  `message` of at most 5000 characters.
- `expiresAt` is always `now + 7 days` on the server. Reads compute an effective `EXPIRED` status
  lazily; `expireOffers()` persists the transition for future scheduled cleanup.
- Withdraw belongs to the proposer; reject, counter and accept belong to the counterparty. Any
  action on a non-pending or expired offer returns 409.
- A counter marks its parent `COUNTERED`, creates a linked offer with `parentOfferId`, inherits the
  investor from the parent and derives the new `proposedBy` from the acting role.
- Accepting runs in one `prisma.$transaction`: revalidate the stored offer, conditionally claim it
  as `ACCEPTED`, reject pending siblings, check for an existing loan, calculate the total, create
  `Loan` (`PENDING_AGREEMENT`) and `Agreement`, conditionally transition the request to `FUNDED`,
  then notify both parties. Conditional updates and existing unique constraints prevent duplicate
  or concurrent loan creation.

### Agreements and schedule

- The stored `termsSnapshot` is authoritative for display and schedule generation.
- The first confirmation only stamps `ownerConfirmedAt` or `investorConfirmedAt`. The second
  confirmation conditionally claims the remaining stamp and then, in the same transaction, sets
  the loan `ACTIVE` with `startDate`, writes all installments, moves the request `FUNDED →
  REPAYING`, notifies both parties and creates the owner feed post.
- Flat interest: `totalRepayable = principal + round(principal × rate% × tenureDays / 365)` in whole
  taka, with BigInt half-up rounding.
- Installments use 7/14/30-day intervals for weekly/biweekly/monthly plans. Every installment
  except the last is the floor share; the last absorbs the rounding remainder so the stored
  amounts sum exactly to `totalRepayableBdt`.
- For the documented ৳50,000 / 14.50% / 90-day example, the total is ৳51,788; monthly amounts are
  ৳17,262, ৳17,262 and ৳17,264.

## 7. Validation and security measures

- Strict Zod objects reject unknown keys, including client-supplied `investorId`, `ownerId`,
  `proposedBy`, `status`, `expiresAt`, `parentOfferId`, calculated totals and loan state.
- Offer messages reuse the messaging plain-text sanitizer: HTML-like tags and control characters
  are removed, whitespace is normalized and empty output is rejected.
- Route guards require authentication and role; services repeat role checks and enforce
  verification, ownership, proposer/counterparty and participant rules. Non-participants receive
  404 rather than existence hints; admins have no bypass.
- Response projections are explicit allow-lists. Party cards expose only public profile fields;
  email, phone, NID and verification documents are never selected by these endpoints.
- Pagination uses shared cursor validation with default 20 and maximum 50. Unknown list query keys
  return 400.
- No secrets, OTPs, document numbers or message bodies are logged. Failures use the existing error
  envelope.
- Optimistic proxy pre-filtering covers `/api/v1/offers/*` and `/api/v1/agreements/*`; the real
  session, verification, role and ownership checks still run in guards/services.

## 8. Tests and verification results

- `pnpm vitest run src/server/services/repayment-schedule.test.ts src/server/services/offers.test.ts src/server/services/agreements.test.ts src/app/api/v1/offers.route.test.ts`
  — 4 files, 28 tests passed (rounding/frequencies, eligibility, ownership, all offer transitions,
  counter linking, concurrent acceptance, atomic loan/agreement creation, dual confirmation and
  thin-route delegation).
- `pnpm test` — 410 tests in 36 files passed.
- `pnpm lint` — passed (no ESLint findings).
- `pnpm typecheck` — passed (`tsc --noEmit`).
- `pnpm build` — passed; Next.js 16.4.6 production build compiled and listed all new
  `/api/v1/offers/*` and `/api/v1/agreements/*` routes.
- `git diff --check` — passed (no whitespace errors).

## 9. Known limitations or incomplete work

- The seven-day cleanup is an exported function only; no cron script or HTTP endpoint was added in
  this phase. Expiry is still reported correctly on reads.
- No real-time offer notifications: events are stored in `Notification`, but no email delivery was
  added here.
- Phase 8 repayment endpoints (mark paid, investor confirmation, overdue jobs/reminders, loan
  detail and completion) remain unimplemented. Only the shared schedule builder used by agreement
  activation exists now.
- No real Postgres/Mailpit end-to-end business workflow was executed; verification was automated
  fake-DB tests plus static checks only.
- Phase 4–6 changes were already present in the working tree; this phase did not revert, commit or
  push anything.

## 10. Dependencies on other phases

- Reuses the Phase 1 lending tables, Phase 2 auth/session guards, Phase 3 public profile
  projections, Phase 4 loan requests and the shared pagination/error/http helpers.
- Offer-based messaging eligibility from Phase 6 reads the same `Offer` table; Phase 7 does not
  change messaging behavior.
- The generated repayment rows are inputs for the planned Phase 8 repayment tracking flow, but no
  Phase 8 endpoint consumes them yet.
