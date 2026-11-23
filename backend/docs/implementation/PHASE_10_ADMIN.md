# Phase 10 — Admin

**Status:** Implemented in the working tree on `nahid_dev`; **not committed and not pushed** at
the time this report was written. **Source of truth:** the files listed below, `docs/API.md`,
`docs/USER_FLOWS.md`, the generated OpenAPI document and the Vitest suite.

## 1. Phase objective

Implement the Phase 10 scope from `BACKEND_PROMPT.md` for the backend only: admin verification
management, report moderation, user/content moderation and platform analytics. Existing Phase 0–9
work was preserved. No frontend file, no Phase 11 feature, no new dependency, no Prisma schema
change and no migration were introduced.

## 2. Implemented features

- 13 new route-handler operations across 13 new admin paths, plus one new `GET` operation on the
  existing `/api/v1/admin/verifications/{id}` path (14 admin operations total). All handlers are
  thin: `requireRole("ADMIN")` → parse/validate → call service → `ok(...)`.
- Strict Zod schemas for admin queries, report resolution, moderation actions and every response
  shape, all exported through `src/server/validators/index.ts`.
- Reused the Phase 2 verification queue and review transaction; added submission detail. Approval
  and rejection still write the `VERIFICATION_RESULT` notification and recompute trust score in the
  same transaction. Rejection still requires a note; resubmission rules are unchanged.
- Admin report list with `status`/`targetType` filters, report detail with a minimal target
  snapshot, and `resolve`/`dismiss` endpoints that derive status from the endpoint instead of
  trusting the client.
- Optional moderation action on resolve: `NONE`, `REMOVE_CONTENT` (posts/comments) or
  `SUSPEND_USER` (users). Multi-record actions use `prisma.$transaction`. Records are soft-deleted
  or retained; no loan/financial data is deleted.
- User directory/detail, suspension and reactivation through the existing `User.status` field.
  `requireSession()` now calls `assertActiveUser()`, so a suspended actor cannot use protected
  API routes. Existing target filters already exclude suspended users.
- Post/comment queues with `includeDeleted`/`postId` filters and soft-delete endpoints.
- `GET /api/v1/admin/stats` with batched `groupBy`/`aggregate`/`count` queries across all required
  domains; aggregate-only response with no personal or financial identifiers.
- OpenAPI schemas/routes/examples, user-facing docs and unit tests covering authorization,
  workflows, transitions, auditability and analytics.

## 3. Files created and modified

Created:

- `src/server/validators/admin.ts`
- `src/server/services/admin-users.ts`, `admin-reports.ts`, `admin-moderation.ts`,
  `admin-analytics.ts`
- `src/app/api/v1/admin/users/route.ts`, `users/[userId]/route.ts`,
  `users/[userId]/suspend/route.ts`, `users/[userId]/reactivate/route.ts`
- `src/app/api/v1/admin/reports/route.ts`, `reports/[reportId]/route.ts`,
  `reports/[reportId]/resolve/route.ts`, `reports/[reportId]/dismiss/route.ts`
- `src/app/api/v1/admin/posts/route.ts`, `posts/[postId]/route.ts`
- `src/app/api/v1/admin/comments/route.ts`, `comments/[commentId]/route.ts`
- `src/app/api/v1/admin/stats/route.ts`
- `src/server/openapi/routes/admin.ts`
- `src/server/auth/guards.test.ts`
- `src/server/services/admin-users.test.ts`, `admin-reports.test.ts`, `admin-moderation.test.ts`,
  `admin-analytics.test.ts`
- `docs/implementation/PHASE_10_ADMIN.md`

Modified:

- `src/server/validators/index.ts` (export admin validators)
- `src/server/validators/social.ts` (optional `targetType` on report list query)
- `src/server/services/reports.ts` (shared `targetType` filter, exported row/record helpers)
- `src/server/auth/policy.ts` (`UserStatus` and `assertActiveUser()`)
- `src/server/auth/guards.ts` (suspension check in `requireSession()`)
- `src/server/services/verification.ts` (`getVerificationForAdmin()`)
- `src/app/api/v1/admin/verifications/[id]/route.ts` (`GET` detail)
- `src/server/openapi/schemas.ts`, `routes/index.ts`, `routes/verification.ts`,
  `openapi.test.ts`
- `src/server/services/verification.test.ts` (detail and trust-integration coverage)
- `docs/API.md`, `docs/USER_FLOWS.md`, `docs/implementation/README.md`

## 4. Database models and migrations involved

- Uses existing Phase 1 models unchanged: `User`, `UserVerification`, `Report`, `Post`, `Comment`,
  `LoanRequest`, `Offer`, `Loan`, `Repayment`, `Review` and `Notification`.
- **No Prisma schema change and no migration were required.** No `prisma migrate`, `db push`,
  reset or seed command was run.
- Reused fields: `User.status/updatedAt`, `UserVerification.reviewerId/reviewNote/reviewedAt`,
  `Report.handledById/resolutionNote/status/updatedAt`, and `Post.deletedAt`/`Comment.deletedAt`.
- Multi-table writes use `prisma.$transaction`: report resolution with a moderation action, post
  soft-delete with its comments, and the existing verification review transaction.

## 5. API endpoints, methods, authentication and authorization

| Method | Path | Authorization |
|---|---|---|
| GET | `/api/v1/admin/verifications` | ADMIN |
| GET | `/api/v1/admin/verifications/{id}` | ADMIN |
| POST | `/api/v1/admin/verifications/{id}` | ADMIN |
| GET | `/api/v1/admin/users?status=&role=&cursor=&limit=` | ADMIN |
| GET | `/api/v1/admin/users/{userId}` | ADMIN |
| POST | `/api/v1/admin/users/{userId}/suspend` | ADMIN |
| POST | `/api/v1/admin/users/{userId}/reactivate` | ADMIN |
| GET | `/api/v1/admin/reports?status=&targetType=&cursor=&limit=` | ADMIN |
| GET | `/api/v1/admin/reports/{reportId}` | ADMIN |
| POST | `/api/v1/admin/reports/{reportId}/resolve` | ADMIN |
| POST | `/api/v1/admin/reports/{reportId}/dismiss` | ADMIN |
| GET | `/api/v1/admin/posts?includeDeleted=&cursor=&limit=` | ADMIN |
| DELETE | `/api/v1/admin/posts/{postId}` | ADMIN |
| GET | `/api/v1/admin/comments?postId=&includeDeleted=&cursor=&limit=` | ADMIN |
| DELETE | `/api/v1/admin/comments/{commentId}` | ADMIN |
| GET | `/api/v1/admin/stats` | ADMIN |

`OWNER` and `INVESTOR` sessions receive `403`; unauthenticated callers receive `401`. Role and
actor id come from the session, never the body or query string. Public signup remains restricted
to `OWNER`/`INVESTOR` by the existing Better Auth `signup-role` hook. Lists use cursor pagination
(default 20, max 50). All non-auth responses use `{ data, meta? }` and `{ error: { code, message,
details? } }`.

Request examples:

```json
POST /api/v1/admin/verifications/ver_123
{ "status": "REJECTED", "reviewNote": "Blurry ID document" }

POST /api/v1/admin/reports/rpt_123/resolve
{ "resolutionNote": "Prohibited content", "moderationAction": "REMOVE_CONTENT" }

POST /api/v1/admin/reports/rpt_124/dismiss
{ "resolutionNote": "False report" }
```

## 6. Business rules and state transitions

- **Verification:** `PENDING → APPROVED | REJECTED` from the existing Phase 2 service. Rejection
  requires a non-empty `reviewNote`; a decision on a non-pending row returns `409`. A rejected
  submission is replaced on resubmission and reset to `PENDING` with reviewer fields cleared.
- **Report:** `OPEN → RESOLVED` (`resolve`) or `OPEN → DISMISSED` (`dismiss`). Only `OPEN` reports
  are actionable; a second action returns `409`. Both require a non-empty `resolutionNote`. The
  client never supplies the resulting status.
- **Moderation action:** `moderationAction` defaults to `NONE`. `REMOVE_CONTENT` is valid only for
  `POST`/`COMMENT`; `SUSPEND_USER` only for `USER`. Invalid combinations return
  `422 BUSINESS_RULE_VIOLATION`; already removed content or already suspended users return `409`.
- **Content removal:** post → `deletedAt` on the post plus visible comments in one transaction;
  comment → `deletedAt` on that comment. Rows are never hard-deleted.
- **Suspension:** `ACTIVE → SUSPENDED → ACTIVE` through the existing enum. Self and admin targets
  are protected. Suspended actors are rejected by `assertActiveUser()` in `requireSession()`;
  public/discovery and existing service target filters exclude suspended users.
- **Analytics:** aggregate counts only. On-time rate counts confirmed repayments where
  `confirmedAt <= dueDate`; with zero confirmations the rate is `0`.

## 7. Validation and security measures

- Strict Zod objects reject unknown query/body keys; `includeDeleted` accepts only `"true"` or
  `"false"`, and path ids are validated with `idSchema` (max 64 characters).
- Service-layer `assertRole("ADMIN")` duplicates the route guard. Admin accounts cannot be
  suspended, and an admin cannot change their own status. Admin bypass of ordinary ownership is
  **not** granted to user-owned write routes; moderation uses separate admin functions.
- Response schemas are explicit allow-lists. Private verification documents are returned only by
  admin verification/user detail endpoints; analytics exposes no personal data.
- Verification decisions, report actions and suspension/reactivation preserve existing records;
  no business, loan, repayment, agreement or financial record is deleted as a moderation shortcut.
- No new notification or email type was invented: the existing verification notification and
  trust recomputation are preserved, and moderation actions emit no new message (see limitations).

## 8. Tests and verification results

New/updated Vitest coverage includes:

- ADMIN-only access plus explicit OWNER/INVESTOR rejection for every admin service.
- `requireSession()` rejection of suspended actors and unchanged ownership/admin-bypass semantics.
- Verification detail for admins, non-admin rejection, missing-row 404, and continued notification
  plus trust-score recomputation on review.
- Report detail target snapshots, required notes, `OPEN → RESOLVED/DISMISSED`, handler/note audit,
  duplicate-transition conflicts, invalid action/target combinations and protected suspensions.
- Post/comment soft-delete auditability, `includeDeleted`/`postId` filters and repeat conflicts.
- Suspend/reactivate transitions with self/admin/state protections.
- Analytics accuracy against known group/aggregate fixtures, strict response-schema validation, no
  personal data, and one aggregate call per metric group (no N+1).
- OpenAPI exact path/method enumeration, ADMIN session security and validated response examples.

Final commands executed: `pnpm lint`, `pnpm typecheck`, `pnpm test` (521 tests in 51 files),
`pnpm build` and `git diff --check`. All passed.

## 9. Known limitations or incomplete work

- No dedicated audit table exists for suspension actor/reason or content-removal actor. The
  auditable fields available today are `Report.handledById`, `Report.resolutionNote`,
  `Report.updatedAt`, `User.status/updatedAt`, verification reviewer fields and `deletedAt`.
- There is no `NotificationType` value for moderation/report/suspension, so no new in-app
  notification or email is emitted for these actions. Adding one would require a schema/migration
  change and was out of scope.
- Direct suspend/reactivate has no persisted reason field; reasons can be recorded in a report's
  resolution note when the action originates from a report.
- No real end-to-end business workflow against running Postgres/Mailpit was performed. Verification
  was automated tests, static checks and a production build. Phase 11 (seed dataset, final
  hardening and "going live" guide) remains intentionally unimplemented.

## 10. Dependencies on other phases

- Phase 1 schema supplies all reused fields and enums; no new migration is needed.
- Phase 2 supplies the verification queue/review transaction, notification event and trust
  recomputation trigger reused here.
- Phase 9 supplies `Report`, the shared report list, trust-score function, notification inbox and
  dashboards that analytics aggregate.
- Phase 11 is not required for these endpoints to compile and pass automated tests, but a seed
  ADMIN account and running Postgres/Mailpit are required for manual end-to-end QA.
