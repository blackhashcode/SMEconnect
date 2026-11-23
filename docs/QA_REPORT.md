# QA report — backend review, integration and hardening

**Branch:** `tausif_dev` (merged with `main` at `29d3576`) · **Date:** 24 Nov 2026

## Summary

| Area | Result |
| --- | --- |
| Backend unit and service tests (Vitest) | **578 / 578 pass** |
| Backend typecheck and ESLint | Pass |
| End-to-end journey, direct to backend (`pnpm smoke`) | **67 / 67 pass** |
| Same journey through the frontend proxy (`:3000/api/v1`) | **67 / 67 pass** |
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
| 18 | Low | Unbounded database pool per instance would exhaust free-tier connection limits on serverless. | `DATABASE_POOL_MAX` (default 5), idle timeout 10 s. | Config review |
| 19 | Low | Public read endpoints were never cached. | `Cache-Control: public, s-maxage, stale-while-revalidate` on public lists/profiles (CDN caches, users get instant responses). | Smoke cache-header check |
| 20 | Low | Docker Postgres fixed to host port 5432, clashing with a local Postgres install. | `POSTGRES_PORT` override. | Local run |

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

- **Phone OTP** has no SMS gateway yet; codes go by email (fine for a showcase).
- **Files in Postgres** are fine at demo scale, but Neon's free tier has 0.5 GB. Move to an
  object store (Cloudflare R2 or Cloudinary, both free tiers) through the existing
  `StorageProvider` interface if uploads grow.
- **Cold starts:** Neon's free tier sleeps after 5 minutes idle; the first request after that
  takes about a second longer.
- **No browser-automation tests** for the frontend. The smoke script covers the full API
  journey through the frontend proxy, and every page was checked manually.
- The local development database holds smoke-test records (for example "Smoke Bakery");
  `pnpm db:reset` gives a clean seed.

## How to reproduce

```bash
cd backend && pnpm typecheck && pnpm lint && pnpm test
cd backend && pnpm smoke                                             # API + Mailpit running
cd backend && SMOKE_BASE_URL=http://localhost:3000 pnpm smoke        # through the frontend
cd frontend && npm run typecheck && npm run build
```
