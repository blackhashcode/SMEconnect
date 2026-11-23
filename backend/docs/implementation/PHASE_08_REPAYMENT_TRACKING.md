# Phase 8 — Repayment tracking

**Status:** Implemented in the working tree on `nahid_dev`; **not committed and not pushed** at
the time this report was written. **Source of truth:** the source files listed below,
`docs/API.md`, `docs/USER_FLOWS.md`, OpenAPI registration and the Vitest suite.

## 1. Phase objective

Implement the Phase 8 scope from `BACKEND_PROMPT.md`: participant-only repayment list/detail APIs,
owner mark-paid, investor confirmation, loan detail with full schedule/history, overdue detection,
cron-friendly overdue and reminder jobs, and atomic completion when every installment is confirmed.
No frontend work, no Phase 9 features, no payment gateway, no Prisma schema/migration change and no
new dependency were introduced. Existing Phase 4–7 work was preserved.

## 2. Implemented features

- Five thin route handlers: repayment list, repayment detail, mark-paid, confirm and loan detail.
- Participant-only reads and actions backed by the session actor, the role guard and the loan's
  stored `ownerId`/`investorId`.
- Strict Zod inputs: the repayment id stays in the URL; mark-paid accepts only an optional sanitized
  plain-text note and an internal private file URL; confirmation accepts no fields.
- Explicit Zod response allow-lists for repayment records, history events, progress totals and full
  loan detail. No private account, verification or document data is exposed.
- Server-derived installment state: `UPCOMING → MARKED_PAID → CONFIRMED`, with overdue derived on
  reads and persisted by `pnpm job:overdue` without breaking the paid/confirmed path.
- Conditional Prisma `updateMany` operations inside transactions for mark, confirm and completion,
  making duplicate and concurrent requests duplicate-safe.
- Atomic final completion: the loan is claimed only when it is `ACTIVE` and has no unconfirmed
  repayment, then the loan request moves `REPAYING → COMPLETED`.
- Notifications written inside repayment transactions; best-effort email rendered after commit so
  SMTP failures cannot roll back committed state.
- Reminder job with database-backed idempotency via deterministic `Notification` ids and a
  `PENDING`/`SENT` email status in the notification's JSON data.
- Proxy protection, OpenAPI components/routes, Vitest coverage and user-facing documentation.

## 3. Files created and modified

Created:

- `src/server/services/repayments.ts`
- `src/server/services/repayments.test.ts`
- `src/server/services/repayment-fake.ts`
- `src/server/services/repayment-reminders.ts`
- `src/server/services/repayment-reminders.test.ts`
- `src/server/notifications/templates/repayment.ts`
- `src/server/validators/repayment.test.ts`
- `src/app/api/v1/repayments/route.ts`
- `src/app/api/v1/repayments/[repaymentId]/route.ts`
- `src/app/api/v1/repayments/[repaymentId]/mark-paid/route.ts`
- `src/app/api/v1/repayments/[repaymentId]/confirm/route.ts`
- `src/app/api/v1/loans/[loanId]/route.ts`
- `src/app/api/v1/repayments.route.test.ts`
- `src/jobs/overdue.ts`
- `src/jobs/reminders.ts`
- `src/server/openapi/routes/repayments.ts`
- `docs/implementation/PHASE_08_REPAYMENT_TRACKING.md`

Modified:

- `src/server/validators/repayment.ts` (replaced placeholder mark/confirm schemas with the full
  Phase 8 request/response contract)
- `src/server/openapi/schemas.ts`
- `src/server/openapi/routes/index.ts`
- `src/server/openapi/openapi.test.ts`
- `src/server/auth/proxy-policy.ts`
- `src/server/auth/proxy-policy.test.ts`
- `package.json` (added `job:overdue` and `job:reminders` scripts using the existing `tsx`)
- `docs/API.md`
- `docs/USER_FLOWS.md`
- `docs/implementation/README.md`

## 4. Database models and migrations involved

- Uses the existing Phase 1 models unchanged: `Loan`, `Agreement`, `Repayment`, `LoanRequest`,
  `Notification`, `User` and `UserVerification`.
- **No Prisma schema change and no migration required.** No `prisma migrate`, `db push` or reset
  command was run.
- Reused constraints and fields: `Repayment` uniqueness on `(loanId, installmentNo)`, the
  `RepaymentStatus` enum (`UPCOMING`, `MARKED_PAID`, `CONFIRMED`, `OVERDUE`), the
  `REPAYMENT_*` `NotificationType` values and `Loan`/`LoanRequest` status enums.
- Reminder idempotency uses existing `Notification.id`, `Notification.data` and the primary-key
  uniqueness constraint; no new table or column was needed.

## 5. API endpoints, methods, authentication and authorization

All endpoints require an authenticated session and an `OWNER` or `INVESTOR` role with an `APPROVED`
verification for that role. Non-participants receive 404; a participant using the wrong role for a
mutation receives 403; admins have no bypass. Responses use `{ data, meta? }` / `{ error }`.

| Method | Path | Authorization |
|---|---|---|
| GET | `/api/v1/repayments` | Either loan party; optional `loanId` is verified before use |
| GET | `/api/v1/repayments/{repaymentId}` | Owner or investor of that repayment's loan only |
| POST | `/api/v1/repayments/{repaymentId}/mark-paid` | Loan owner only |
| POST | `/api/v1/repayments/{repaymentId}/confirm` | Loan investor only |
| GET | `/api/v1/loans/{loanId}` | Owner or investor of the loan only |

Lists use `?cursor=&limit=` (default 20, max 50) and optionally `?loanId=`. Unknown query keys
return 400. Mark-paid accepts `{ "note"?, "proofUrl"? }`; confirmation has no request body.
`proofUrl` must match the internal `/api/v1/files/private/...` storage shape.

## 6. Business rules and state transitions

- Repayment lifecycle is `UPCOMING → MARKED_PAID → CONFIRMED`. Only `UPCOMING` or `OVERDUE` can be
  marked paid; only `MARKED_PAID` can be confirmed. Duplicate and out-of-order actions return 409.
- `OVERDUE` is derived on every read when a non-paid installment's due date has passed, and
  `pnpm job:overdue` conditionally persists past-due `UPCOMING` rows as `OVERDUE`. It never touches
  `MARKED_PAID` or `CONFIRMED`, so an overdue installment can still be marked paid normally.
- Mark-paid conditionally claims a row with `status IN (UPCOMING, OVERDUE)`, `markedPaidAt = null`
  and `confirmedAt = null`, then stamps `markedPaidAt`, the sanitized note and optional private
  proof. Confirm conditionally claims `status = MARKED_PAID`, `markedPaidAt != null` and
  `confirmedAt = null`, then stamps `confirmedAt`.
- The final confirmation conditionally claims the `ACTIVE` loan with
  `repayments: { none: { status: { not: "CONFIRMED" } } }`, then transitions the request
  `REPAYING → COMPLETED`. The relation predicate and status guards make concurrent completion
  duplicate-safe.
- Amounts and due dates are read from the Phase 7 generated schedule; no client input changes them.
  All BDT values are whole-taka integers and the loan detail schedule sums to `totalRepayableBdt`.
- Payment history is reconstructed from server-owned timestamps: `SCHEDULED` at creation,
  `OVERDUE` at the due date when applicable, `MARKED_PAID` at `markedPaidAt` and `CONFIRMED` at
  `confirmedAt`.

## 7. Validation and security measures

- Strict Zod objects reject client-supplied status, payer/confirmer identity, amounts, due dates and
  repayment ids. Confirmation accepts no fields at all.
- Notes reuse the messaging plain-text sanitizer and reject empty output. Proof URLs are restricted
  to the existing private storage URL shape.
- Route guards require authentication and role; services repeat role, verification, participant and
  ownership checks on every read and mutation.
- Response projections are explicit allow-lists. Party cards reuse the public profile card and
  never include email, phone, NID or verification documents.
- Notifications are written inside the same transaction as the state change. Email is sent after
  commit through the shared sender; delivery failures are logged with only event/loan/repayment ids
  and never roll back state or leak SMTP details.
- Reminders use deterministic notification ids in the database. `SENT` rows are skipped; a failed
  email deletes the `PENDING` claim so a later cron run can retry.
- Optimistic proxy pre-filtering covers `/api/v1/repayments/*` and `/api/v1/loans/*`; real session,
  role, verification and participant checks still run in guards/services.

## 8. Jobs

- `pnpm job:overdue` — loads `.env`, calls `markOverdueRepayments()` and reports the number of
  installments persisted as `OVERDUE`.
- `pnpm job:reminders` — loads `.env`, calls `runRepaymentReminders()` and reports due/overdue
  notification counts plus skipped/failed counts. Due reminders cover installments due within two
  days; overdue reminders cover past-due/unpaid rows. Both loan parties are notified by default.

## 9. Tests and verification results

- `pnpm lint` — passed (no ESLint findings).
- `pnpm typecheck` — passed (`tsc --noEmit`).
- `pnpm test` — passed: **434 tests in 40 files**.
- `pnpm build` — passed; Next.js 16.4.6 production build compiled and listed all new
  `/api/v1/repayments/*` and `/api/v1/loans/[loanId]` routes.
- `git diff --check` — passed (no whitespace errors).

Automated Phase 8 coverage includes: participant-only reads/actions, role mismatch, loan ownership,
mark/confirm transitions, duplicate and invalid transitions, overdue derivation and persistence,
atomic completion, concurrent duplicate confirmations and completion, notification writes, email
failure isolation, reminder idempotency and retry, strict body/filter validation, thin route
delegation, standard error envelopes, OpenAPI registration, and schedule/amount consistency against
the Phase 7 builder.

## 10. Known limitations or incomplete work

- No real payment gateway was integrated; mark-paid is a trust-based record confirmed by the
  investor.
- Email remains best-effort. SMTP configuration is required for real delivery; locally Mailpit is
  the intended sink.
- Reminder delivery state lives in `Notification.data` because no dedicated idempotency table was
  required. A `SENT` row is never retried unless it is removed manually.
- The job functions are designed for cron but no scheduler configuration was added to the repo.
- **No live end-to-end business workflow was performed** against a running Postgres/Mailpit stack;
  verification was automated fake-DB/service tests plus static checks and production build only.
- No commit or push was made; all Phase 8 changes remain in the working tree for review.

## 11. Dependencies on other phases

- Reuses the Phase 1 lending/notification tables, Phase 2 auth/session guards, Phase 3 public
  profile projections, Phase 4 loan requests, Phase 5/6 shared pagination and response helpers, and
  the Phase 7 `Repayment` rows and `buildRepaymentSchedule()` output.
- Leaves Phase 9 features (reviews, trust score, notification list endpoints, dashboards, reports,
  block/unblock) untouched and unimplemented.
