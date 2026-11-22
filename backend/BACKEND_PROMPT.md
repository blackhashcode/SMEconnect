# SME Connect — Backend Build Prompt (paste into OpenCode)

> Before starting: put `AGENTS.md`, `docker-compose.yml` and `.env.example` in the
> project root. Copy `.env.example` to `.env`. Then paste everything below the line.

---

You are the backend engineer for **SME Connect**. Read `AGENTS.md` in the project root
first — it defines the product, roles, stack, architecture, conventions and domain rules.
Follow it strictly. If anything here conflicts with `AGENTS.md`, ask me.

## Goal

Build a complete, locally-running backend inside our Next.js 16 (App Router, TypeScript)
project using PostgreSQL + Prisma + Better Auth + Zod, covering every functional
requirement below, with seed data and API documentation so the frontend team can
integrate. It must be deployment-ready (env-driven config, swappable storage/email),
but we run it locally for now.

## How to work

Work in **phases**. At the end of each phase: run lint, typecheck and tests, then give
me a short summary (what was built, endpoints added, anything I need to decide) and
**wait for my "continue"**. Propose the plan for a phase before writing large amounts of code.

---

## Phase 0 — Setup

1. If no Next.js app exists, create one (Next.js 16, TypeScript strict, App Router,
   `src/` dir, pnpm, ESLint). If it exists, integrate without breaking the frontend.
2. Install: `prisma`, `@prisma/client`, `better-auth`, `zod`, `nodemailer`, `vitest`
   (+ anything else needed — justify additions).
3. Create the folder structure from `AGENTS.md` §4.
4. `docker compose up -d` (Postgres + Mailpit). Configure `DATABASE_URL`.
5. Add scripts: `dev`, `build`, `lint`, `typecheck`, `test`, `db:migrate`, `db:seed`,
   `db:reset`, `db:studio`.
6. Create `src/server/errors.ts` (AppError + HTTP mapping), a response helper,
   pagination helper, and `requireSession()` / `requireRole()` helpers.
7. Add `GET /api/v1/health` returning DB connectivity status.

## Phase 1 — Data model (Prisma schema)

Design `prisma/schema.prisma` with these models (add fields you judge necessary;
use enums for all statuses; add indexes for frequent filters):

- **User** — id, name, email (unique), phone (unique, optional), phoneVerified,
  emailVerified, role (`OWNER | INVESTOR | ADMIN`), avatarUrl, status (`ACTIVE | SUSPENDED`),
  timestamps. Plus Better Auth's required tables (session, account, verification).
- **BusinessProfile** (1:1 owner) — shopName, slug, category, description, location
  (district/city), platformLinks (facebook, instagram, whatsapp, website), runningSince,
  monthlyOrdersRange, monthlySalesRangeBdt, growthStory, logoUrl, coverUrl, trustScore.
- **ProductImage** — businessProfileId, url, caption, order.
- **InvestorProfile** (1:1 investor) — bio, minLendBdt, maxLendBdt, preferredCategories,
  preferredTenureDays, preferredRatePctMin/Max, location, trustScore.
- **Verification** — userId, type (`OWNER | INVESTOR`), status (`PENDING | APPROVED | REJECTED`),
  idDocumentUrl, salesProofUrls[], shopLinks, reviewerId, reviewNote, timestamps.
- **LoanRequest** — ownerId, amountBdt, purpose, fundUsage, tenureDays,
  repaymentFrequency (`WEEKLY | BIWEEKLY | MONTHLY`), proposedRatePct, proofUrls[],
  status (per AGENTS.md §6), publishedAt.
- **Offer** — loanRequestId, investorId, amountBdt, interestRatePct, tenureDays,
  repaymentFrequency, message, status, parentOfferId (counter-offers), proposedBy
  (`OWNER | INVESTOR`), expiresAt.
- **Loan** — loanRequestId (unique), offerId (unique), ownerId, investorId, principalBdt,
  interestRatePct, tenureDays, repaymentFrequency, totalRepayableBdt, status
  (`PENDING_AGREEMENT | ACTIVE | COMPLETED | DEFAULTED`), startDate.
- **Agreement** — loanId, termsSnapshot (JSON), ownerConfirmedAt, investorConfirmedAt.
- **Repayment** — loanId, installmentNo, dueDate, amountBdt, status
  (`UPCOMING | MARKED_PAID | CONFIRMED | OVERDUE`), markedPaidAt, confirmedAt, note, proofUrl.
- **Post** — authorId, type (`UPDATE | MILESTONE | LOAN_REQUEST | REPAYMENT`), content,
  imageUrls[], loanRequestId?, deletedAt.
- **Comment**, **Like** (unique per user+post), **Follow** (unique follower+followee).
- **Connection** — requesterId, addresseeId, status (`PENDING | ACCEPTED | DECLINED`), message.
- **Conversation** (two participants, unique pair) and **Message** — senderId, body,
  readAt, deletedAt.
- **Notification** — userId, type, title, body, link, data (JSON), readAt.
- **Review** — loanId, reviewerId, revieweeId, rating (1–5), comment (one per side per loan).
- **Report** — reporterId, targetType (`USER | POST | COMMENT | MESSAGE`), targetId,
  reason, status (`OPEN | RESOLVED | DISMISSED`), resolutionNote, handledById.
- **Block** — blockerId, blockedId.

Run the first migration. Show me an ER summary of the relations.

## Phase 2 — Auth, roles & verification  (FR 1, 2)

- Better Auth: email/password sign-up with **role selection** (OWNER/INVESTOR), login,
  logout, password reset, email verification (emails go to Mailpit).
- Phone OTP: implement a local OTP flow (6 digits, 5-minute expiry, hashed, rate-limited);
  in dev, send via email/console behind a `sendOtp` interface so an SMS provider can
  be plugged in later.
- `proxy.ts` protection for app routes; role-based guards on API routes.
- Verification: submit (`POST /api/v1/verifications`, with uploads), view own status,
  resubmit after rejection. Admin approve/reject with note → notify user.
- Storage provider (`local` → `/uploads` outside `public/`; serve via an authorized
  route for private docs, public route for avatars/product images).

## Phase 3 — Profiles  (FR 3, 4)

- Owner: create/update business profile, upload logo/cover/product images, public
  profile by slug (includes active loan request, repayment track record, trust score,
  reviews, verified badge).
- Investor: create/update investor profile, public profile (lending history summary,
  reviews, verified badge).
- `GET /api/v1/me` returns user + role + profile + verification status + unread counts.

## Phase 4 — Loan requests  (FR 5)

- Create (DRAFT), edit, publish (OPEN — requires APPROVED verification and complete
  profile), pause/resume, cancel. Enforce the one-active-request rule.
- Publishing auto-creates a `LOAN_REQUEST` feed post.
- List own requests with status; public detail endpoint.

## Phase 5 — Feed, networking & discovery  (FR 6, 7)

- Posts: create (UPDATE/MILESTONE with images), edit, soft delete; like/unlike;
  comment (create/delete); follow/unfollow.
- Feed: `GET /api/v1/feed` — posts from followed users + connections + recent loan
  requests, newest first, cursor pagination, includes author mini-profile, verified
  badge, like/comment counts and `likedByMe`.
- Connections: send (with optional message), accept, decline, list, remove.
- Search/explore: `GET /api/v1/businesses?q=&category=&location=&minAmount=&maxAmount=&verified=&minRating=&tenure=&cursor=`
  and `GET /api/v1/investors?...`. Use Postgres full-text or `ILIKE` — keep it simple.
- Suggestions: `GET /api/v1/suggestions/businesses` for investors (match preferred
  categories, lending range, location), `GET /api/v1/suggestions/investors` for owners.

## Phase 6 — Messaging  (FR 8)

- Conversations list (last message, unread count), message thread (cursor pagination),
  send message, mark read, soft delete own message.
- Allowed only between users with an ACCEPTED connection or an existing offer; blocked
  users cannot message each other.
- Real-time: implement polling-friendly endpoints (`?after=<messageId>`) now; structure
  the code so Socket.io or a hosted realtime service can be added later.

## Phase 7 — Offers & agreement  (FR 9)

- Investor sends offer on an OPEN/IN_DISCUSSION request (amount, rate, tenure, frequency,
  message). One pending offer per investor per request.
- Owner: accept / reject / counter. Investor: accept / reject / counter a counter,
  or withdraw. Offers expire after 7 days (check lazily on read + a cleanup function).
- Accept flow exactly as in AGENTS.md §6 (single transaction).
- Agreement: `GET` summary (terms snapshot, both parties, schedule preview);
  `POST .../confirm` by each party. When both confirm → loan ACTIVE, schedule generated,
  request REPAYING, notifications + a feed post.

## Phase 8 — Repayment tracking  (FR 10)

- Schedule generation per AGENTS.md §6 (unit-test this thoroughly: rounding, frequencies, dates).
- Owner marks an installment paid (optional note/proof upload); investor confirms receipt.
- Overdue detection function (run on read + a script `pnpm job:overdue` we can cron later).
- Reminders: notification + email 2 days before due and on overdue (`pnpm job:reminders`).
- Loan detail endpoint with full history; completion flow when all installments CONFIRMED.

## Phase 9 — Reputation, notifications & dashboards  (FR 11, 12, 13)

- Reviews after loan COMPLETED (one per side), shown on profiles.
- Trust score function (AGENTS.md §6), recomputed on verification, repayment, review events.
- Report (user/post/comment/message) and block/unblock.
- Notifications: created for new offer, counter, acceptance, agreement confirmation,
  message, connection request/accept, verification result, repayment due/overdue/marked/confirmed,
  new comment/like. Endpoints: list (cursor), unread count, mark one/all read.
  Email for important ones (offers, agreement, repayments, verification).
- Dashboards:
  - `GET /api/v1/dashboard/owner` — active request, offers received, current loan,
    next due date + amount, repayment progress %, trust score.
  - `GET /api/v1/dashboard/investor` — total lent, active loans, repaid to date,
    expected returns, portfolio list with status (On track / Due soon / Overdue / Completed).

## Phase 10 — Admin  (FR 14)

- Verification queue (filter by status), approve/reject with note.
- Moderation: list/remove posts & comments, suspend/unsuspend users.
- Reports: list, resolve/dismiss with note.
- Analytics: `GET /api/v1/admin/stats` — users by role, verified counts, requests by
  status, loans funded (count + ৳ total), repayment on-time rate, active disputes.

## Phase 11 — Seed data, docs & hardening

- `prisma/seed.ts` with **consistent** Bangladeshi mock data:
  1 admin (`admin@smeconnect.local`), ~10 owners (e.g. "Nusrat's Home Kitchen" — food,
  Dhanmondi, Dhaka; "Deshi Threads" — clothing, Chattogram; "Mati Crafts" — handicrafts,
  Sylhet; plus cosmetics, gadgets, home décor, etc.), ~6 investors (e.g. "Rafiq Ahmed",
  lends ৳20,000–৳1,00,000, food & fashion), loan requests in every status, offers incl.
  a counter-offer chain, one active loan with mixed repayment states, one completed loan
  with reviews, posts/likes/comments, connections, a conversation, notifications, and one
  open report. All demo passwords: `Password123!` — print the demo logins at the end.
- `docs/API.md`: every endpoint — method, path, role, request body, response example,
  error codes. Group by module.
- Tests (Vitest): offer accept transaction, counter-offer chain, one-active-request rule,
  schedule generation, repayment state transitions, permission checks (owner can't
  confirm own repayment, investor can't edit others' offers, etc.).
- Add rate limiting (auth, OTP, messages), input sanitization, consistent error format.
- Write `README.md`: setup steps, env vars, scripts, demo accounts, and a
  **"Going live" section** listing exactly what to change (hosted Postgres URL,
  storage provider, email/SMS provider, auth secrets/URLs, cron jobs).

## Functional requirements checklist (all must be covered)

1. Registration & authentication (role choice, email/phone verification, login/logout/reset, RBAC)
2. Verification & trust (ID + shop links + sales proof, admin review, Verified badge)
3. Business owner profile
4. Investor profile
5. Loan requests (create/edit/pause/cancel, status lifecycle)
6. Feed & networking (posts, likes, comments, follow, connections)
7. Discovery & search (filters + suggestions)
8. Messaging (1:1, connection-gated)
9. Loan offers & agreement (offer/counter/accept/reject, dual confirmation)
10. Repayment tracking (schedule, mark paid/confirm, reminders, history)
11. Reputation (reviews, trust score, report/block)
12. Notifications (in-app + email)
13. Dashboards (owner + investor)
14. Admin panel (verifications, moderation, reports, analytics)

## Definition of done

- `docker compose up -d && pnpm db:reset && pnpm dev` gives a working API with seed data.
- `pnpm lint`, `pnpm typecheck`, `pnpm test` all pass.
- Every checklist item has endpoints listed in `docs/API.md`.
- No secrets in code; `.env.example` complete; README "Going live" section written.

Start with **Phase 0**: show me your plan, then proceed.
