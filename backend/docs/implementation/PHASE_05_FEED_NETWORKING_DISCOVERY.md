# Phase 5 — Feed, networking and discovery

**Status:** Implemented in the working tree on `nahid_dev`; **not committed and not pushed** at
the time this report was written. **Source of truth:** the source files listed below,
`docs/API.md`, the OpenAPI route modules, and the Vitest suite.

## 1. Phase objective

Implement the Phase 5 scope from `BACKEND_PROMPT.md`: posts and feed (including likes and
comments), the connection state machine, follow/unfollow, and discovery of approved public
profiles plus suggestions — while reusing Phase 4 for OPEN loan-request discovery. No messaging,
no Phase 6+ functionality, no schema changes.

## 2. Implemented features

- Create/edit/soft-delete user-authored `UPDATE` and `MILESTONE` posts; system-owned
  `LOAN_REQUEST` and `REPAYMENT` posts are read-only to clients.
- Like/unlike posts and create/edit/soft-delete comments; comments and posts use `deletedAt`.
- Public recent-post list and a personalized `/feed` combining own posts, followed authors,
  accepted connections and recent OPEN loan-request posts, newest first, cursor-paginated,
  with author mini-profiles, verified badges, like/comment counts and `likedByMe`.
- Connections: send (optional message), list incoming/outgoing/all with status filter, accept,
  decline, cancel pending and remove accepted.
- Follow/unfollow and paginated followers/following lists.
- Public discovery of APPROVED owners and investors with text/location/category/amount/tenure/
  trust filters and explicit sorts; suggestions derived from the session user's own profile.
- Thin route handlers, service-layer business logic, strict Zod validators, OpenAPI registration
  and API/flow documentation updates.

## 3. Files created and modified

Created — validators and services:

- `src/server/validators/discovery.ts`
- `src/server/services/social-shared.ts`
- `src/server/services/post.ts`
- `src/server/services/connection.ts`
- `src/server/services/follow.ts`
- `src/server/services/discovery.ts`

Created — route handlers:

- `src/app/api/v1/feed/route.ts`
- `src/app/api/v1/posts/route.ts`
- `src/app/api/v1/posts/[id]/route.ts`
- `src/app/api/v1/posts/[id]/like/route.ts`
- `src/app/api/v1/posts/[id]/comments/route.ts`
- `src/app/api/v1/posts/[id]/comments/[commentId]/route.ts`
- `src/app/api/v1/connections/route.ts`
- `src/app/api/v1/connections/[id]/route.ts`
- `src/app/api/v1/connections/[id]/accept/route.ts`
- `src/app/api/v1/connections/[id]/decline/route.ts`
- `src/app/api/v1/follows/route.ts`
- `src/app/api/v1/follows/[userId]/route.ts`
- `src/app/api/v1/me/followers/route.ts`
- `src/app/api/v1/me/following/route.ts`
- `src/app/api/v1/businesses/route.ts`
- `src/app/api/v1/investors/route.ts`
- `src/app/api/v1/suggestions/businesses/route.ts`
- `src/app/api/v1/suggestions/investors/route.ts`

Created — OpenAPI modules and tests:

- `src/server/openapi/routes/social.ts`
- `src/server/openapi/routes/discovery.ts`
- `src/server/services/post.test.ts`
- `src/server/services/connection.test.ts`
- `src/server/services/follow.test.ts`
- `src/server/services/discovery.test.ts`
- `src/server/validators/social-discovery.test.ts`

Modified:

- `src/server/validators/social.ts` (Phase 5 input and response allow-lists)
- `src/server/validators/index.ts` (export discovery validators)
- `src/server/auth/proxy-policy.ts`, `src/proxy.ts` (protect feed/connections/follows/suggestions)
- `src/server/openapi/schemas.ts`, `src/server/openapi/config.ts`,
  `src/server/openapi/routes/index.ts`, `src/server/openapi/openapi.test.ts`
- `src/server/auth/proxy-policy.test.ts`
- `docs/API.md`, `docs/USER_FLOWS.md`, `docs/implementation/README.md`

## 4. Database models and migrations involved

- Uses the existing Phase 1 models unchanged: `Post`, `Comment`, `Like`, `Follow`, `Connection`,
  `User`, `BusinessProfile`, `InvestorProfile`, `UserVerification` and `LoanRequest`.
- No Prisma schema change and **no migration required**. No `prisma db push`, reset or migration
  command was run. The DB constraints already enforce `Like(postId,userId)` and
  `Follow(followerId,followeeId)` uniqueness plus a self-connection CHECK on `Connection`.
- Soft deletion reuses the existing `deletedAt` columns on `Post` and `Comment`; `Connection`
  and `Follow` rows are physically deleted on cancel/remove because the schema has no
  `deletedAt` for them.
- No `Block` model changes: block/unblock is Phase 9 and was explicitly skipped.

## 5. API endpoints, methods, authentication and authorization

| Method | Path | Authentication | Authorization |
|---|---|---|---|
| GET | `/api/v1/feed` | Session | OWNER or INVESTOR |
| GET | `/api/v1/posts` | Optional session | Public; anonymous sees `likedByMe: false` |
| POST | `/api/v1/posts` | Session | OWNER or INVESTOR; author is the session user |
| GET | `/api/v1/posts/{id}` | Optional session | Public, non-deleted only |
| PATCH / DELETE | `/api/v1/posts/{id}` | Session | Author only; user-created posts only |
| POST / DELETE | `/api/v1/posts/{id}/like` | Session | OWNER or INVESTOR |
| GET | `/api/v1/posts/{id}/comments` | Optional session | Public, non-deleted comments only |
| POST | `/api/v1/posts/{id}/comments` | Session | Author is the session user |
| PATCH / DELETE | `/api/v1/posts/{id}/comments/{commentId}` | Session | Comment author only |
| POST / GET | `/api/v1/connections` | Session | OWNER or INVESTOR; users are session-derived |
| POST | `/api/v1/connections/{id}/accept` | Session | Addressee only; PENDING only |
| POST | `/api/v1/connections/{id}/decline` | Session | Addressee only; PENDING only |
| DELETE | `/api/v1/connections/{id}` | Session | Requester cancels PENDING; either party removes ACCEPTED |
| POST | `/api/v1/follows` | Session | OWNER or INVESTOR; follower is the session user |
| DELETE | `/api/v1/follows/{userId}` | Session | Actor's own follow only |
| GET | `/api/v1/me/followers`, `/api/v1/me/following` | Session | OWNER or INVESTOR; actor-scoped |
| GET | `/api/v1/businesses`, `/api/v1/investors` | None (public) | APPROVED, active profiles only |
| GET | `/api/v1/suggestions/businesses` | Session | INVESTOR only; derived from investor profile |
| GET | `/api/v1/suggestions/investors` | Session | OWNER only; derived from owner profile + OPEN request |

All responses use `{ data, meta? }` and standard error codes (400/401/403/404/409/422). The
optimistic proxy now pre-filters `/api/v1/feed`, `/api/v1/connections`, `/api/v1/follows`,
`/api/v1/me/followers|following` (already under `/me`) and `/api/v1/suggestions`; public posts,
comments, businesses, investors and `/api/v1/loan-requests` remain public. Real role/ownership
checks live in the services and route guards.

## 6. Business rules and state transitions

Connections:

```text
PENDING → ACCEPTED | DECLINED      (addressee only, PENDING only)
PENDING → deleted                   (requester cancels)
ACCEPTED → deleted                  (either party removes)
DECLINED → (read-only history)
```

- No self-connections (CHECK constraint plus service check); duplicate and reciprocal requests
  return 409; P2002 races are mapped to 409.
- Accepting or declining someone else's request returns 403; responding to a non-PENDING record
  returns 409.

Posts, likes and comments:

- Only `UPDATE`/`MILESTONE` are client-creatable. Editing/deleting a post requires authorship
  and a user-created type; system posts return 403. Post deletion soft-deletes its live comments
  in a single `$transaction`.
- Duplicate likes return 409; unlike without a like returns 404; duplicate follows return 409.
- Comments are authored from the session; only the author can edit/soft-delete; deleted comments
  are excluded from lists and counts.
- Targets for follow/connect must be active, non-admin and not the actor.

Discovery:

- Only active OWNER/INVESTOR profiles with an APPROVED verification of the matching type appear.
- `minAmountBdt`, `maxAmountBdt`, `maxTenureDays` constrain the owner's OPEN loan request.
- `category` for investors matches `preferredCategories` via `has`; amount filters require the
  lending ranges to overlap. `q` is case-insensitive ILIKE; `location` matches district OR city.
- Suggestions use only the session profile. Investors need preferred categories, lending range
  and location; owners need their business category/location and OPEN request amount. Missing
  profile returns 422.
- OPEN loan-request discovery is not duplicated: `GET /api/v1/loan-requests` remains canonical.
- Cursor pagination applies everywhere (default 20, max 50; `meta.nextCursor`/`hasMore`).

## 7. Validation and security measures

- Strict Zod schemas reject `authorId`, `userId`, `requesterId`, `status`, `verified` and any other
  unknown input key; services re-parse inputs for defense in depth.
- Author/follower/requester ids always come from the Better Auth session, never the request body.
- Verification badges are computed from `UserVerification` with status `APPROVED`; no client flag
  is trusted. Only APPROVED profiles are discoverable.
- Public projections are explicit allow-lists. No email, phone, user id in author cards,
  verification documents, review notes or internal fields are returned. Strict response schemas
  in tests fail when private keys are added.
- Role checks via `assertRole`, target checks via `requirePublicTarget`, and ownership checks in
  every mutation. ADMIN accounts are never valid connection/follow targets and cannot use these
  OWNER/INVESTOR-only endpoints.
- `deletedAt` filters apply to posts, comments, likes targets and feed entries. Multi-table
  writes (post+comments) use `prisma.$transaction`.
- Proxy prefixes were extended and covered by tests; real authorization is still enforced at
  the route/service layer even when a request carries a session cookie.

## 8. Tests and verification results

- `src/server/services/post.test.ts` — 14 tests: role restrictions, system-post protection,
  ownership, soft deletion, likes/unlikes, comment ownership, pagination cursors, feed
  composition, `likedByMe` and author sanitization.
- `src/server/services/connection.test.ts` — 13 tests: self/duplicate requests, target
  validation, accept/decline state machine, addressee-only responses, cancel/remove permissions,
  direction/status filters and pagination.
- `src/server/services/follow.test.ts` — 8 tests: follow target validation, duplicates, unfollow
  ownership, followers/following queries and private-data exclusion.
- `src/server/services/discovery.test.ts` — 7 tests: approved-only queries, filters, sorting,
  suggestion profile derivation, role restrictions and pagination.
- `src/server/validators/social-discovery.test.ts` — 8 tests: post type restrictions, strict
  inputs, numeric query coercion, invalid ranges and response allow-lists rejecting private keys.
- OpenAPI and proxy-policy tests extended for Phase 5 paths.
- Full verification run: `pnpm lint` (0 errors), `pnpm typecheck` (pass), `pnpm test`
  (335 tests / 29 files, all pass), `pnpm build` (all Phase 5 routes present in Next route table),
  `git diff --check` (clean).

## 9. Known limitations or incomplete work

- **Real end-to-end business workflow testing was NOT performed.** The automated suite uses fake
  Prisma clients via service dependency injection; no live Postgres/Mailpit API sequence was run.
- Block/unblock is intentionally skipped (Phase 9 per `BACKEND_PROMPT.md`, confirmed with the
  user); no block enforcement exists in feed/connection/follow services yet.
- Messaging is not implemented (Phase 6). The "existing offer between two users" messaging
  exception therefore has no Phase 5 surface.
- Amount sorting on business discovery is intentionally omitted because Prisma cannot order a
  User query by a to-many `LoanRequest` value; use `GET /api/v1/loan-requests?sort=amountAsc|
  amountDesc` instead. Amount *filtering* on businesses is supported.
- Discovery text search uses `ILIKE` contains, not Postgres full-text ranking; this is the
  deliberately simple approach requested in `BACKEND_PROMPT.md`.
- No rate limiting specific to Phase 5 writes was added; auth/OTP/message rate limiting is
  handled by the existing infrastructure (messaging has no endpoint yet).
- Phase 4 and Phase 5 changes remain uncommitted and must be reviewed before release.

## 10. Dependencies on other phases

- Depends on Phase 1 models (`Post`, `Comment`, `Like`, `Follow`, `Connection`, `User`,
  `BusinessProfile`, `InvestorProfile`, `UserVerification`, `LoanRequest`), Phase 2 session/role
  guards and error envelope, Phase 3 public profile projections, and Phase 4 auto-created
  `LOAN_REQUEST` posts and the public OPEN-request endpoint.
- Phase 6 messaging will reuse ACCEPTED connections and must additionally check blocks once
  Phase 9 adds them.
- Phase 7 offers will move requests `OPEN → IN_DISCUSSION` and Phase 8 will create `REPAYMENT`
  posts; both post types are already recognized as system-owned by Phase 5.
