# Phase 6 — Messaging

**Status:** Implemented in the working tree on `nahid_dev`; **not committed and not pushed** at
the time this report was written. **Source of truth:** the source files listed below,
`docs/API.md`, `docs/USER_FLOWS.md`, OpenAPI registration and the Vitest suite.

## 1. Phase objective

Implement the Phase 6 scope from `BACKEND_PROMPT.md`: create/list/read conversations, send/list/read
messages, mark-read, per-user soft deletion and polling-friendly message retrieval. Enforce the
`AGENTS.md` rules that messaging requires an accepted connection or an existing offer, blocked users
cannot message each other, only participants have access and the sender always comes from the
authenticated session. No schema change, no Phase 7+ work, no frontend work and no WebSockets.

## 2. Implemented features

- Idempotent conversation creation with lexicographically canonicalized participant ids, so a pair
  has exactly one conversation.
- Paginated conversation list and detail with safe participant cards, latest visible message and
  unread counts.
- Oldest-first message threads with standard opaque cursor pagination and an additional
  `?after=<messageId>` chronological anchor for ordinary HTTP polling.
- Send, detail, mark-read and per-user soft-delete endpoints with strict Zod validation and
  sanitized plain-text bodies.
- Eligibility from an accepted `Connection` **or** any `Offer` relationship, plus block checks in
  both directions. Both are enforced on create and on every conversation/message operation.
- Transactional message send: insert `Message` and touch `Conversation.updatedAt` together.
- Thin route handlers; all business rules live in `src/server/services/messaging.ts`.
- Validators, OpenAPI components/routes, proxy protection, tests and user-facing documentation.

## 3. Files created and modified

Created:

- `src/server/validators/messaging.test.ts`
- `src/server/services/messaging.ts`
- `src/server/services/messaging.test.ts`
- `src/app/api/v1/conversations/route.ts`
- `src/app/api/v1/conversations/[id]/route.ts`
- `src/app/api/v1/conversations/[id]/messages/route.ts`
- `src/app/api/v1/conversations/[id]/read/route.ts`
- `src/app/api/v1/messages/[messageId]/route.ts`
- `src/app/api/v1/messaging.route.test.ts`
- `src/server/openapi/routes/messaging.ts`
- `docs/implementation/PHASE_06_MESSAGING.md`

Modified:

- `src/server/validators/message.ts` (sanitization, body-only send input, polling query, response allow-lists)
- `src/server/validators/domain.test.ts` (body-only whitespace test)
- `src/server/auth/proxy-policy.ts`, `src/proxy.ts`, `src/server/auth/proxy-policy.test.ts`
- `src/server/openapi/schemas.ts`, `src/server/openapi/routes/index.ts`, `src/server/openapi/openapi.test.ts`
- `docs/API.md`, `docs/USER_FLOWS.md`, `docs/implementation/README.md`

## 4. Database models and migrations involved

- Uses the existing Phase 1 models unchanged: `Conversation`, `Message`, `MessageDeletion`,
  `Connection`, `Offer`, `Block`, `User`, `BusinessProfile`, `InvestorProfile` and
  `UserVerification`.
- No Prisma schema change and **no migration required**. No `prisma db push`, reset or migration
  command was run.
- `Conversation`'s existing `@@unique([participantOneId, participantTwoId])` is used with a
  canonicalized pair to prevent duplicates; `MessageDeletion`'s `@@unique([messageId, userId])`
  supports idempotent per-user hides with `upsert`.

## 5. API endpoints, methods, authentication and authorization

All endpoints require an `OWNER` or `INVESTOR` Better Auth session (route guard + service role
check) and respond with the standard `{ data, meta? }` / `{ error }` envelopes.

| Method | Path | Authorization |
|---|---|---|
| POST | `/api/v1/conversations` | Accepted connection or offer; no block; valid active non-admin target |
| GET | `/api/v1/conversations` | Actor's own eligible, unblocked conversations |
| GET | `/api/v1/conversations/{id}` | Participant only; eligible; not blocked |
| GET | `/api/v1/conversations/{id}/messages` | Participant only; eligible; not blocked |
| POST | `/api/v1/conversations/{id}/messages` | Participant only; eligible; not blocked; sender = session user |
| POST | `/api/v1/conversations/{id}/read` | Participant only; eligible; not blocked |
| GET | `/api/v1/messages/{messageId}` | Participant of the message's conversation; eligible; not blocked |
| DELETE | `/api/v1/messages/{messageId}` | Participant of the message's conversation; eligible; not blocked |

## 6. Business rules and state transitions

- Messaging eligibility: `Connection.status === "ACCEPTED"` in either direction **or** any `Offer`
  where the actor is the investor or the loan-request owner. Otherwise 422.
- A `Block` in either direction denies conversation/message access with 403; blocked pairs are also
  excluded from the conversation list. Block/unblock endpoints themselves remain Phase 9.
- Conversation participant ids are sorted before lookup/create. Repeating create returns the
  existing conversation; a unique-race (`P2002`) re-reads and returns the winner.
- Non-participants receive 404 rather than a hint that the conversation exists. Admins are denied
  by role (403) and are never valid messaging targets.
- `sendMessage` writes the sanitized body with `senderId = actor.id` and touches
  `Conversation.updatedAt` in one `prisma.$transaction`.
- `unreadCount` counts live, unread messages from the other participant that the caller has not
  deleted. Mark-read sets `readAt` on exactly those messages.
- `DELETE /messages/{id}` creates/updates a `MessageDeletion` for the caller only. It never sets the
  global `Message.deletedAt`; the other participant's view is unchanged. Globally deleted messages
  are hidden for everyone.
- Polling: `?after=<messageId>` resolves to that message's chronological position inside the
  conversation; combining it with `cursor` is a 400. No WebSockets or push were added.

## 7. Validation and security measures

- Strict Zod schemas reject unknown keys, including client-supplied user ids, roles, conversation
  ids in the send body, amounts or statuses.
- Message bodies are capped at 5000 raw characters; HTML-like tags and control characters are
  stripped, whitespace is trimmed and runs of blank lines are collapsed; empty results are rejected.
- Pagination defaults to 20 and caps at 50; cursors are decoded/validated by the shared helpers.
- Response schemas are explicit allow-lists. Participant cards expose only public profile fields;
  no email, phone, NID, verification document or private user record is returned.
- Message bodies are never logged. All failures use the existing error envelope and never expose
  internal error messages.
- Optimistic proxy pre-filtering covers `/api/v1/conversations/*` and `/api/v1/messages/*`; the real
  session, role, eligibility, block and participant checks still run in guards/services.

## 8. Tests and verification results

- `pnpm vitest run src/server/services/messaging.test.ts` — 21 passed (eligibility, offer fallback,
  block enforcement, canonical pairs, sender identity, role/participant checks, sanitization,
  pagination/polling, unread counts, per-user deletion).
- `pnpm vitest run src/server/validators/messaging.test.ts src/app/api/v1/messaging.route.test.ts`
  — 16 passed (input/response allow-lists, strict parsing, thin-route delegation and error envelope).
- `pnpm test` — 377 tests in 32 files passed.
- `pnpm lint` — passed (no ESLint findings).
- `pnpm typecheck` — passed (`tsc --noEmit`).
- `pnpm build` — passed; Next.js 16.4.6 production build compiled and listed all new
  `/api/v1/conversations/*` and `/api/v1/messages/*` routes.
- `git diff --check` — passed (no whitespace errors).

## 9. Known limitations or incomplete work

- No real-time delivery: clients poll `GET .../messages?after=<messageId>` over standard HTTP.
- No message notification emails/in-app notifications: notifications are Phase 9.
- Block/unblock management endpoints are Phase 9; this phase only enforces existing `Block` rows.
- No real Postgres/Mailpit end-to-end business workflow was executed; verification was automated
  tests plus static checks only.
- Phase 4/5 changes were already present in the working tree; this phase did not commit or push
  anything.

## 10. Dependencies on other phases

- Reuses Phase 1 models, Phase 2 auth/session guards, Phase 3 public profile projections, Phase 5
  accepted connections and shared pagination/error/http helpers.
- Offer-based eligibility reads Phase 7's existing `Offer` table but does not implement offer
  creation or lifecycle, which remain Phase 7.
