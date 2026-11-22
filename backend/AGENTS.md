# AGENTS.md — SME Connect (Backend)

This file gives the coding agent standing context for every session. Read it fully
before making changes. Keep it up to date when architecture or rules change.

## 1. What we are building

**SME Connect** is a LinkedIn-style professional network that connects small online
business owners in Bangladesh (shops already running on Facebook, Instagram,
WhatsApp, etc.) with individual investors who give them growth loans.

- It is a **networking + lending** platform: an investor discovers a verified shop,
  connects, chats, and makes a loan **offer**; the owner accepts, counters or rejects.
- It is **NOT crowdfunding**. No "back ৳1,000", no syndicates, no pooled escrow.
  One accepted offer funds one loan request.
- Only businesses that are **already running** can request loans (proof of sales required).

Hackathon theme: TSUNAGU ("to connect"). The connection between invisible online
businesses and willing lenders is the core of the product.

## 2. Roles

| Role | Can do |
|---|---|
| `OWNER` (business owner) | Business profile, verification, loan requests, posts, accept/counter/reject offers, mark repayments paid |
| `INVESTOR` | Investor profile, verification, discover businesses, connect, message, send offers, confirm repayments received |
| `ADMIN` | Approve/reject verifications, moderate posts/profiles, handle reports/disputes, view analytics |

A user has exactly one role, chosen at sign-up. Admins are created via seed/script only.

## 3. Tech stack (do not change without asking)

- **Next.js 16 (App Router) + TypeScript (strict)** — one app for frontend + backend
- **Route Handlers** (`src/app/api/**/route.ts`) for the HTTP API
- **Server Actions** allowed for simple form mutations, but they must call the same service layer
- **PostgreSQL 16** (Docker locally) + **Prisma ORM**
- **Better Auth** for authentication (email/password, sessions, roles). Do NOT use NextAuth/Auth.js.
- **Zod** for all input validation
- **Mailpit** (Docker) catches emails locally (OTP / verification / notifications)
- File uploads via a storage abstraction (`local` now, `cloudinary`/`s3` later)
- Package manager: **pnpm**

Always check the current official docs for Next.js 16, Prisma and Better Auth before
writing setup code — APIs change. Note: Next.js 16 uses `proxy.ts` (not `middleware.ts`)
and requires a named `proxy` export or default export.

## 4. Architecture rules

```
src/
  app/
    api/                 # Route Handlers — THIN: parse → validate → call service → respond
  server/
    services/            # ALL business logic lives here (loans, offers, repayments, feed…)
    validators/          # Zod schemas (shared with frontend forms)
    auth/                # Better Auth config + getSession / requireRole helpers
    storage/             # StorageProvider interface + local implementation
    notifications/       # createNotification + email sending
    db.ts                # single Prisma client instance
    errors.ts            # AppError classes + error → HTTP mapping
  lib/                   # shared utils (money formatting, dates, pagination)
prisma/
  schema.prisma
  seed.ts
docs/
  API.md                 # API contract for the frontend team — keep updated
```

- Route handlers never contain business logic or Prisma queries directly.
- Services never read `Request`/`Response`; they receive typed inputs + the acting user.
- Every write that touches more than one table uses `prisma.$transaction`.
- Every endpoint checks **authentication**, **role** and **ownership** (a user can only
  modify their own resources). Admin bypasses ownership where specified.
- Never trust client-sent `userId`, `role`, `status` or amounts computed server-side.

## 5. API conventions

- Base path: `/api/v1/...`
- JSON responses: success → `{ data, meta? }`; error → `{ error: { code, message, details? } }`
- Status codes: 200/201, 400 validation, 401 unauthenticated, 403 forbidden,
  404 not found, 409 invalid state transition / conflict, 422 business rule violation
- Pagination: cursor-based (`?cursor=&limit=`), default limit 20, max 50
- Dates in ISO 8601 UTC. Frontend formats to Asia/Dhaka.
- **Money**: integers in **BDT (whole taka)**, never floats. Field names end in `Bdt`
  (e.g. `amountBdt`). Store interest rates as `interestRatePct` `Decimal(5,2)` (e.g. 14.50).
- After adding/changing any endpoint, update `docs/API.md`.

## 6. Domain rules (state machines)

**Verification**: `PENDING → APPROVED | REJECTED` (admin only). Rejected users may resubmit.
Only `APPROVED` owners can publish loan requests. Only `APPROVED` investors can send offers.

**LoanRequest**: `DRAFT → OPEN → IN_DISCUSSION → FUNDED → REPAYING → COMPLETED`
plus `PAUSED` (from OPEN/IN_DISCUSSION, back to OPEN) and `CANCELLED` (from DRAFT/OPEN/IN_DISCUSSION/PAUSED).
- First offer received moves OPEN → IN_DISCUSSION.
- An owner may have only ONE request in OPEN/IN_DISCUSSION/FUNDED/REPAYING at a time.

**Offer**: `PENDING → ACCEPTED | REJECTED | COUNTERED | WITHDRAWN | EXPIRED`
- A counter-offer creates a new Offer linked by `parentOfferId`; the old one becomes `COUNTERED`.
- Accepting an offer (in one transaction): offer → ACCEPTED, all other pending offers on
  the request → REJECTED, request → FUNDED, create `Loan` + `Agreement` (pending both confirmations).
- When both parties confirm the agreement → generate repayment schedule, request → REPAYING.

**Loan / Repayment**:
- Simple flat interest: `totalRepayable = principal + principal × rate% × (tenureDays / 365)`, rounded to whole taka.
- Installments split evenly by frequency (WEEKLY / BIWEEKLY / MONTHLY); last one absorbs rounding.
- Repayment: `UPCOMING → MARKED_PAID (by owner) → CONFIRMED (by investor)`; `OVERDUE` if past due and not paid.
- All installments CONFIRMED → loan + request → COMPLETED; both parties may now leave a review.

**Connections**: `PENDING → ACCEPTED | DECLINED`. Messaging requires an ACCEPTED connection
(or an existing offer between the two users).

**Trust score** (0–100, recomputed on events): verification + on-time repayments +
completed loans + average rating − overdue count. Keep the formula in one function.

## 7. Security & quality

- Hash passwords via Better Auth defaults; never log secrets, OTPs, NID numbers.
- Rate-limit auth, OTP and message endpoints.
- Uploads: allow only images/PDF, max 5 MB, randomized filenames, never serve
  verification documents publicly (owner/admin only).
- Sanitize user-generated text (posts, comments, messages).
- Soft-delete for posts/comments/messages (`deletedAt`).

## 8. Deployment readiness (build this in from day one)

- All config via environment variables (see `.env.example`); no hardcoded URLs/secrets.
- Storage behind `StorageProvider` so switching to Cloudinary/S3 is one env change.
- Email behind a single `sendEmail` function (Mailpit SMTP locally, real provider later).
- Prisma migrations committed; never use `db push` for shared changes.
- App must work with any Postgres URL (Neon/Supabase/Railway) unchanged.

## 9. Commands

```bash
docker compose up -d          # Postgres + Mailpit (UI: http://localhost:8025)
pnpm install
pnpm prisma migrate dev       # apply migrations
pnpm prisma db seed           # mock data
pnpm dev                      # http://localhost:3000
pnpm prisma studio            # browse DB
pnpm lint && pnpm typecheck && pnpm test
```

## 10. Working style for the agent

- Work in the phases defined in `BACKEND_PROMPT.md`; stop after each phase with a short summary.
- Before large changes, propose the plan first.
- Write tests (Vitest) for services with business rules: offers, loan acceptance,
  repayment schedule, state transitions, permissions.
- Keep mock/seed data consistent (same numbers everywhere).
- When unsure about a product rule, ask instead of guessing.
- Do not touch frontend UI components unless asked; the frontend team consumes `docs/API.md`.

<!-- BEGIN:nextjs-agent-rules -->

## This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->
