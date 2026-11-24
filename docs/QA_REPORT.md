# QA report — backend review, integration and hardening

**Branch:** `tausif_dev` · **Date:** 24 Nov 2026 (two rounds)

## Summary

| Area | Result |
| --- | --- |
| Backend unit and service tests (Vitest) | **All pass** (round 2 adds 17 for admin oversight, audit log and Google role handling) |
| Backend typecheck and ESLint | Pass |
| End-to-end journey, direct to backend (`pnpm smoke`) | **121 / 121 pass** (67 in round 1) |
| Same journey through the frontend proxy (`:3000/api/v1`) | **Pass** |
| Bot-user load test (`pnpm bots`, up to 120 simultaneous users) | **0 errors**, 311 req/s, p95 308 ms (see [PERFORMANCE_TEST.md](PERFORMANCE_TEST.md)) |
| Frontend typecheck and production build | Pass |
| Backend production build | Pass |
| Frontend ↔ backend connection | **Was not connected** (frontend ran on a mock Express/SQLite API). Now fully connected; mock removed. |

The backend from `nahid_dev` is well structured: strict Zod schemas on every input,
role and ownership guards in services, partial unique indexes for business rules,
private files behind authorization checks, and a deterministic seed. The issues below
were found while reviewing it, running its tests, and exercising it end to end.

## Findings and fixes

Severity: **High** = breaks a core flow or exposes data · **Medium** = wrong behaviour,
fails in production, or weakens a control · **Low** = hygiene or performance.

| # | Severity | Finding | Fix | Verified by |
| --- | --- | --- | --- | --- |
| 1 | High | Frontend was not using the backend at all: it ran against `frontend/mock-api` (Express + SQLite) with a different API contract. | Frontend rewritten against `/api/v1`, typed from the backend's OpenAPI document; same-origin proxy keeps the auth cookie first-party; mock API and mock data deleted. | Smoke via proxy 67/67; every page rendered with seeded data |
| 2 | High | Messaging failed with a 500 for some pairs of users: the `conversation_ordered_participants` check used the database's locale collation, while the app orders IDs bytewise, so mixed-case IDs violated the constraint. | Migration `20261124000100` makes the check use `COLLATE "C"`, matching the app's ordering. | Smoke messaging steps; messaging tests |
| 3 | High | Uploads trusted the client's declared MIME type, so any file could be stored as "image/png". | Magic-byte detection (JPEG, PNG, WebP, PDF); mismatched or unknown content rejected; 5 MB cap checked before reading the body. | New spoofing tests; smoke upload steps |
| 4 | High | Session token returned in auth JSON responses (readable by page scripts, defeating httpOnly). | Auth route strips `token` from JSON bodies; the session lives only in the httpOnly cookie. | Smoke sign-in checks |
| 5 | High | Personal email address committed in `.env.example`, README, docs and the seed default. | Replaced with `owner01@smeconnect.local`; personal address only via local `.env`. | Repo search |
| 6 | Medium | No upload endpoint existed, so verification documents and avatars couldn't be uploaded from a client. | `POST /api/v1/uploads` (authenticated, rate limited, size-checked). | Smoke upload → verification flow |
| 7 | High | Explore/discovery crashed with a 500 whenever a profile filter (category, district, search text) was used: the query mixed `isNot: null` with field filters, which Prisma rejects. | Filters wrapped in `profile: { is: { AND: [...] } }`. | Updated discovery tests; smoke filter checks |
| 8 | Medium | Rate limits were in process memory: on serverless each instance has its own counter, so limits barely apply. | `RATE_LIMIT_STORE=database`: Better Auth limits and app limits (messages, uploads) stored in Postgres with an atomic upsert. | Rate-limit tests; smoke 429 check |
| 9 | Medium | Behind Vercel's proxy, rate limits keyed on the proxy's IP. | Better Auth reads `x-vercel-forwarded-for` / `x-forwarded-for` / `x-real-ip`. | Typecheck; config review |
| 10 | Medium | Local-disk storage can't work on serverless (read-only, ephemeral disk). | `STORAGE_PROVIDER=database` stores files in Postgres behind the same visibility rules. | Smoke upload + private-file access |
| 11 | Medium | Unique/foreign-key/not-found database errors surfaced as 500. | Prisma `P2002`/`P2003` → 409 `CONFLICT`, `P2025` → 404. | Error-mapping tests |
| 12 | Medium | Unexpected errors gave no way to trace them. | 5xx responses carry a `requestId` (and `X-Request-Id`); details logged as structured JSON server-side only. | Manual error check |
| 13 | Medium | No security headers; `X-Powered-By` exposed. | HSTS, `X-Frame-Options: DENY`, `nosniff`, Referrer-Policy, Permissions-Policy; powered-by header off. | Response header check |
| 14 | Medium | Phone numbers accepted in any shape, so the same number could be stored differently. | Bangladeshi mobile regex `^(?:\+?88)?(01[3-9]\d{8})$`; spaces/dashes stripped, stored as `+8801…`. | New validator tests |
| 15 | Low | Public loan-request responses omitted the owner's ID, so clients couldn't link to the owner's profile. | Owner `id` added to the public shape. | Loan tests |
| 16 | Low | Seed referenced remote image URLs. | Seed uses images shipped in `frontend/public/images`. | Seed tests |
| 17 | Low | Missing indexes on `session.userId` and `account.userId` (used on every session lookup by user). | Indexes added (migration `20261124000000`). | Migration applied |
| 18 | Low | Unbounded database pool per instance would exhaust free-tier connection limits on serverless. | `DATABASE_POOL_MAX` (default 10 after the bot test), idle timeout 10 s. | Bot load test |
| 19 | Low | Public read endpoints were never cached. | `Cache-Control: public, s-maxage, stale-while-revalidate` on public lists/profiles (CDN caches, users get instant responses). | Smoke cache-header check |
| 20 | Low | Docker Postgres fixed to host port 5432, clashing with a local Postgres install. | `POSTGRES_PORT` override. | Local run |

## Round 2: launch preparation

| # | Area | Change |
| --- | --- | --- |
| 21 | Content | Replaced every AI-generated Stitch image with real photos of Bangladeshi small businesses (compressed, ~1.3 MB total for 9 photos). Removed the Stitch exports and remaining references. Businesses without a cover get a category-matched photo. |
| 22 | Content | Removed every invented figure from the site ("2,400+ verified businesses", "18,000+ investors", "৳42 Cr", 4.9 stars, "64 districts", a scripted chat). Replaced them with how verification, document privacy, two-sided agreements, repayment confirmation and moderation actually work, plus an honest "good to know" (we don't hold money, loans carry risk). |
| 23 | Data | Removed the 1,700-line demo dataset and the demo-login buttons. `pnpm db:seed` now creates only the first admin from environment variables. |
| 24 | UI | Business profile: stat values overflowed their cards, the name crowded the cover, the description appeared twice, and "Connect with Md." used an honorific as the first name. All fixed (compact ৳ amounts, wrapping, `firstName()` helper used app-wide). |
| 25 | Onboarding | New Step 1, Profile photo: upload one, or choose a blank photo (initials). Upload errors are now shown instead of failing silently. |
| 26 | Admin | Full admin panel: overview, member search and detail (documents, activity, IP addresses), suspend (also signs the member out), reactivate, sign out everywhere, loan-request moderation with a reason the owner is notified of, agreed-loan oversight, reports with the reported content, post/comment removal, activity log. |
| 27 | Security | Append-only `audit_log`: sign-ups, sign-ins (with IP and browser), lending steps and every admin action. Logging can never block the action it records. |
| 28 | Auth | Google sign-in (Better Auth social provider), hidden until configured. The role chosen on sign-up is carried in a short-lived cookie (never ADMIN). New Google members can switch role until they save a profile. Same-email accounts are linked. |
| 29 | Performance | Bot test showed the 5-connection pool and Node's 4 hashing threads were bottlenecks. Default pool is now 10; `UV_THREADPOOL_SIZE=16` documented. p95 714 → 153 ms at the same load. |
| 30 | Admin / security | Verification documents downloaded instead of opening, and a resubmission after rejection overwrote the earlier documents and decision. Documents now open in an in-panel viewer (served `inline` with a strict CSP); every submission and its review is kept in a new `verification_submission` table (backfilled); each time an admin opens a private document it's logged as `admin.document_viewed`. |
| 31 | Performance | Live site slow (API 1.2–2.1 s): Vercel functions ran in Washington DC (`iad1`) while the database is in Singapore, so every query crossed the Pacific. `vercel.json` now pins functions to `sin1`. Profile sidebars use 30 s cached public lists; reveal animations no longer hide content for long if JavaScript loads slowly. |
| 32 | Connections | 409 on Connect: requests could never be accepted (no accept UI), so they stayed pending forever. Added Accept/Decline (profile, tray, My network page), connecting back accepts their request, resending returns the existing request, declined requests can be re-sent, plus `GET /connections/with/{userId}` for button state. |
| 33 | Messaging | DMs required an accepted connection, which was impossible. Owner↔investor pairs can now message directly; same-type members still need a connection; blocks and rate limits still apply. |
| 34 | Notifications | No notifications for connection requests, acceptances or messages; the bell only updated on reload and had no tray. Added those notifications (one per unread chat), a live bell with a dropdown tray, bottom-left pop-ups for new notifications, and reading a chat clears its notification. |
| 35 | UI | Header search did nothing (now searches Explore); "Request sent" withdrew the request on a single click (now a separate Withdraw button); broken profile photos now fall back to initials. |
| 36 | Feed | Posts, likes, comments and follows existed only in the API. The feed now opens on a Posts tab with a composer (Update / Milestone, photos), likes, comments and delete; profiles show a member's posts and a Follow button. Confirmed repayments publish a REPAYMENT post (no amounts). Posts accept the site's own uploaded photos. |
| 37 | Reputation | No way to leave reviews: both sides of a completed loan can now rate each other from the loan page. Profiles show a lending history (loans, totals, on-time rate, each loan) from a new `GET /profiles/{userId}/lending-history`. |
| 38 | Safety | No block or report options: profiles have Report / Block (and Unblock), posts and comments can be reported, and conversations have Report. |
| 39 | Profiles | Owners couldn't share monthly sales: onboarding now has monthly sales range, orders per month, running since, growth story and more shop links. Saving highlights and scrolls to empty required fields. Fixed a server error when only some profile fields were updated (upsert required every field). |
| 40 | Explore | "More filters" did nothing: it now opens location, trust score, verified-only, loan amount, tenure, repayment frequency and sort filters. Investors can view and connect with other investors as well as businesses. |
| 41 | Admin | Admins can change roles (grant or remove admin access; not their own; one admin always remains), edit any member's profile, restore removed posts and comments, reopen cancelled loan requests, and confirm instalments on an investor's behalf. All logged. |

## Scalability and performance measures

| Concern | What's in place |
| --- | --- |
| Caching | CDN caching of public API responses (#19); landing page uses ISR (rebuilt at most once a minute); Next.js image cache |
| Load balancing | Vercel routes every request to auto-scaled serverless instances, so there's no single server to balance. Everything that must be shared (rate limits, files, sessions) is in Postgres, so instances are stateless. |
| Database | Indexed filters done in SQL, paginated list endpoints, pooled connections sized for serverless (#17, #18) |
| Images and data | Browser compresses photos before upload; Next.js serves AVIF/WebP sized to the display; responses are gzip/brotli-compressed by Vercel |
| Memory | No in-process state or caches that grow per instance; uploads streamed with a size cap before reading |
| Security | Items 3–5, 8–14 above, plus Better Auth email OTP, httpOnly `Secure` cookies, Zod validation on every input |
| Regex | Used where a pattern is the right tool (phone numbers, plus the existing email/slug validators). File types are checked by magic bytes instead, which a regex on the filename can't do safely. |

## Code cleanup

- Removed `frontend/mock-api/`, nine mock data files, unused components (`LoanOfferModal`,
  `FilterBar`, `Modal`, `ReviewNegotiation`, `AgreementActions`), helper scripts and 57 unused images.
- Removed the obsolete mock API contract `docs/API.md` (the backend's `backend/docs/API.md`
  and the live OpenAPI document are the contract).
- AI-assistant prompt files and phase notes are now ignored and kept local only.
- One root `.gitignore` covering dependencies, builds, secrets, uploads, logs and editor files.
- GitHub Actions: CI on every push; scheduled repayment jobs.

## Known limitations

- **Phone OTP** has no SMS gateway yet; codes go by email.
- **Photo rights:** some of the supplied photos look like press or stock images (one filename
  mentions Shutterstock, another The Daily Star). Confirm you have permission to use them on
  a public site, or swap them via `frontend/public/images` and `src/data/images.ts`.
- **Files in Postgres** are fine at demo scale, but Neon's free tier has 0.5 GB. Move to an
  object store (Cloudflare R2 or Cloudinary, both free tiers) through the existing
  `StorageProvider` interface if uploads grow.
- **Cold starts:** Neon's free tier sleeps after 5 minutes idle; the first request after that
  takes about a second longer.
- **No browser-automation tests** for the frontend. The smoke script covers the full API
  journey through the frontend proxy, and every page was checked manually.
- The local development database still holds the old demo members and smoke/bot test
  records, whose demo photos no longer exist. `pnpm db:reset` gives an empty database with
  just the admin. Production starts empty.

## How to reproduce

```bash
cd backend && pnpm typecheck && pnpm lint && pnpm test
cd backend && pnpm smoke                                             # API + Mailpit running
cd backend && SMOKE_BASE_URL=http://localhost:3000 pnpm smoke        # through the frontend
cd frontend && npm run typecheck && npm run build
```
