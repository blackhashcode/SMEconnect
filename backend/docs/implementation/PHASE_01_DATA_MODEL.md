# Phase 1 — Data model (Prisma schema)

**Status:** Implemented. Primary commit: `74daca5` (`db connect`).
**Source of truth:** `prisma/schema.prisma`, `docs/DATABASE.md`,
`prisma/migrations/20261123170000_init/migration.sql`, `git show --stat 74daca5`.

## 1. Phase objective

Design the full relational model for SME Connect: users and Better Auth tables, verification,
profiles, the entire lending lifecycle, feed/networking, messaging, reputation, reports and
admin state — with enums, indexes, constraints and a first migration. The model must support
all later phases without schema rewrites.

## 2. Implemented features

- Complete `prisma/schema.prisma` (653 lines at this commit) with all domain models and enums
  listed in `BACKEND_PROMPT.md` Phase 1, plus Better Auth's `User`, `Session`, `Account` and
  `Verification` tables.
- First migration `prisma/migrations/20261123170000_init/migration.sql` (764 lines) and
  `migration_lock.toml`.
- Domain/Zod validator modules shared by later services and OpenAPI generation:
  common primitives, enums, user, auth-adjacent domain inputs, verification, profile,
  loan, offer, repayment, social, message, health.
- `docs/DATABASE.md` with an ER diagram, schema decisions, naming deviations, delete
  behavior, constraint/index notes, transaction notes and migration verification results.
- Naming decisions documented there: `User.image` used as avatar, `UserVerification`
  separated from Better Auth's short-lived `Verification`, `monthlySalesMinBdt`/
  `monthlySalesMaxBdt` instead of a parsed range string, `district` + `city` instead of a
  free-form location, `ProductImage.position` instead of `order`, and `MessageDeletion` for
  per-user message hiding.

## 3. Files created and modified

Created/modified in `74daca5`:

- `prisma/schema.prisma` (expanded from the Phase 0 placeholder)
- `prisma/migrations/20261123170000_init/migration.sql`
- `prisma/migrations/migration_lock.toml`
- `docs/DATABASE.md` (new), `docs/API.md` (updated)
- Validators: `src/server/validators/common.ts`, `enums.ts`, `index.ts`, `user.ts`,
  `verification.ts`, `profile.ts`, `loan.ts`, `offer.ts`, `repayment.ts`, `social.ts`,
  `message.ts`
- Validator tests: `common.test.ts`, `domain.test.ts`, `schema-contract.test.ts`

## 4. Database models and migrations involved

- **Auth:** `User`, `Session`, `Account`, `Verification`
- **Credibility:** `UserVerification`
- **Profiles:** `BusinessProfile`, `ProductImage`, `InvestorProfile`
- **Lending:** `LoanRequest`, `Offer`, `Loan`, `Agreement`, `Repayment`
- **Feed & networking:** `Post`, `Comment`, `Like`, `Follow`, `Connection`,
  `Conversation`, `Message`, `MessageDeletion`
- **Reputation & admin:** `Notification`, `Review`, `Report`, `Block`
- 15 PostgreSQL enum types, including `LoanRequestStatus`, `OfferStatus`, `LoanStatus`,
  `RepaymentStatus`, `PostType`, `VerificationStatus`, `RepaymentFrequency`.
- Money fields are `Int` BDT (`...Bdt`); rates are `Decimal(5,2)` (`...Pct`).
- Unique constraints cover emails, phone, profile owner links, slug, image position,
  repayment number, likes, follows, connection pairs, reviews per loan side, reports and
  blocks.
- Partial unique indexes (Prisma `partialIndexes` preview):
  - `loan_request_one_active_per_owner` on `OPEN | IN_DISCUSSION | FUNDED | REPAYING`
  - `offer_one_pending_per_investor_per_request` on `PENDING`
- Raw CHECK constraints preserved in the migration: rating 1–5, positive money fields,
  rate ranges 0–100, ordered monthly sales / investor lending and rate ranges, no
  self-follow/self-connect/self-block, ordered conversation participants.
- Migration: `20261123170000_init`. `docs/DATABASE.md` records that it was generated and
  reviewed, applied to a temporary `smeconnect_migration_check` database for verification
  (25 tables, 15 enums, 41 FKs, 84 indexes, 16 CHECK constraints, 2 partial unique indexes),
  and that that temporary database was dropped. The development database was **not**
  modified during Phase 1.
  **Not verifiable from repository:** whether the migration has since been applied in any
  particular developer environment; run `pnpm prisma migrate status` to check.

## 5. API endpoints, methods, authentication and authorization

No HTTP endpoints were added in this phase. Phase 1 delivered the schema, migration and
validators only; `docs/API.md` was updated to point at `docs/DATABASE.md` for the data model.
Authorization rules are expressed in the model (user-owned resources, reviewer/handler
references, `RESTRICT` on financial participants) and enforced later in services.

## 6. Business rules and state transitions

The enums encode the state machines later enforced in the service layer:

- Verification: `PENDING → APPROVED | REJECTED`.
- Loan request: `DRAFT`, `OPEN`, `IN_DISCUSSION`, `FUNDED`, `REPAYING`, `COMPLETED`,
  `PAUSED`, `CANCELLED`; one active request per owner via partial unique index.
- Offer: `PENDING`, `ACCEPTED`, `REJECTED`, `COUNTERED`, `WITHDRAWN`, `EXPIRED`; one pending
  offer per investor per request; `parentOfferId` models counter-offers.
- Loan: `PENDING_AGREEMENT`, `ACTIVE`, `COMPLETED`, `DEFAULTED`.
- Repayment: `UPCOMING`, `MARKED_PAID`, `CONFIRMED`, `OVERDUE`.
- Connection: `PENDING`, `ACCEPTED`, `DECLINED`.

The service-layer transition rules for loan requests are implemented in Phase 4; no
transition logic existed in Phase 1.

## 7. Validation and security measures

- Zod 4 schemas are the single source of validation truth; `schema-contract.test.ts` checks
  that enum schemas match the Prisma enums.
- Input primitives centralize email/URL/date/amount/rate/tenure rules
  (`src/server/validators/common.ts`); `MAX_BDT` mirrors PostgreSQL `INTEGER`.
- Database CHECK constraints mirror Zod rules so invalid money/rates cannot be inserted by
  any writer, not only API callers.
- Delete behavior: `CASCADE` for owned social/auth children, `RESTRICT` for financial
  participants, `SET NULL` for optional reviewer/handler/post links to preserve history.

## 8. Tests and verification results

- Tests added: `common.test.ts`, `domain.test.ts`, `schema-contract.test.ts`.
- Migration was verified in a temporary Postgres database as recorded in `docs/DATABASE.md`
  (counts table above). `pnpm prisma migrate status` reportedly showed the migration as
  unapplied at that time.
- **Current** repository-wide verification passes: `pnpm lint`, `pnpm typecheck`,
  `pnpm test` (271 tests / 24 files), `pnpm build`, `git diff --check`.
- **Not verifiable from repository:** the exact command output at the end of Phase 1.

## 9. Known limitations or incomplete work

- No API endpoints, services, seed data or admin scripts in this phase.
- No shadow database URL in `prisma7.config.ts`; a hosted environment may need one.
- Raw CHECK constraints are not visible to Prisma introspection; future schema changes must
  preserve them manually.
- `prisma/seed.ts` remained a stub (Phase 11 owns the mock dataset).

## 10. Dependencies on other phases

- Phase 2 uses the `User.role`, `User.status` and `UserVerification` models plus the shared
  validator primitives.
- Phase 3 uses `BusinessProfile`, `ProductImage` and `InvestorProfile`.
- Phase 4 uses `LoanRequest` and `Post`, and relies directly on
  `loan_request_one_active_per_owner` for concurrency safety.
- Phases 5–11 use the remaining models already created here; no schema change should be
  needed for them.
