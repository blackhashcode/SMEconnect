# Bot-user performance test

**Date:** 24 Nov 2026 · **Script:** `backend/scripts/bots.mjs` (`pnpm bots`)

## What the bots do

Simulated members use the site at the same time, each with random pauses ("think time")
between steps, the way real people click around:

| Bot | Journey |
| --- | --- |
| Business owner | Sign up → read the code from the email → upload a photo → fill in the profile → upload NID and sales proof → wait for admin approval → publish a loan request → keep checking notifications, answer offers (counter or reject) and reply to messages |
| Investor | Same sign-up and verification → browse the feed, loan requests (with and without category filters) and business search → open a request and the owner's profile → make an offer → message the owner → check offers and notifications. Repeats 4 times. |
| Visitor (not signed in) | Landing page, loan requests, businesses, investors, one request and its owner's profile, login and sign-up pages. Repeats 5 times. |
| Admin | Signs in, approves every bot's verification, reads stats and the activity log |

Each bot gets its own IP address, so per-IP rate limits apply per bot, as they would for real users.

## Setup

- **Production builds** of both apps (`next build` + `next start`), not the slower dev servers
- Backend and frontend on one Windows laptop, PostgreSQL 16 in Docker, Mailpit for email
- Every request timed by the client; latency below is end to end, in milliseconds

## Results

| Run | Bots (owners / investors / visitors) | Server settings | Requests | Throughput | p50 | p95 | p99 | Errors |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| 1 | 10 / 10 / 30 | defaults (pool 5, 4 threads) | 1,929 in 21.9 s | 88 req/s | 83 ms | 714 ms | 2,631 ms | **0** |
| 2 | 10 / 10 / 30 | pool 15, 16 threads | 1,919 in 12.8 s | 150 req/s | 11 ms | 153 ms | 751 ms | **0** |
| 3 | 20 / 20 / 80 | pool 15, 16 threads | 4,815 in 15.5 s | 311 req/s | 47 ms | 308 ms | 713 ms | **0** |

Every journey finished in every run: no 5xx responses, no network errors, no unexpected 429s.

### Slowest endpoints (run 2)

| Endpoint | p50 | p95 | Why |
| --- | --- | --- | --- |
| `POST /auth/sign-up/email` | 1,163 ms | 1,415 ms | Password hashing (scrypt) is deliberately slow, plus sending the code email |
| `POST /auth/email-otp/verify-email` | 306 ms | 414 ms | Checks the hashed code and creates the session |
| `GET /loan-requests` | 9 ms | 153 ms | Public list with owner details and verified badges |
| `GET /businesses`, `GET /investors` | 8–9 ms | 102–105 ms | Public discovery with filters |
| Landing page (frontend) | 4–9 ms | 94–291 ms | Pre-rendered and refreshed in the background (ISR) |

## What we learned and changed

1. **The database pool was the bottleneck.** With 5 connections per server, requests queued
   whenever 30+ bots hit the API together (p95 714 ms). Raising it to 15 cut p95 to 153 ms
   and nearly doubled throughput. **Changed:** the default `DATABASE_POOL_MAX` is now 10, and
   the deployment guide uses 10 with Neon's pooled connection string.
2. **Sign-up slowed down when many people joined at once.** Node hashes passwords on a small
   thread pool (4 threads), so 20 simultaneous sign-ups waited their turn (~2.9 s). Setting
   `UV_THREADPOOL_SIZE=16` brought it down to ~1.2 s. **Changed:** documented in
   `backend/.env.example` and the deployment guide.
3. **Security held up under load.** Better Auth rejected the bots' requests until they sent a
   trusted `Origin` header (CSRF protection), and rate limits never blocked a legitimate bot.
4. **Cached pages are effectively free.** The landing page answered in single-digit
   milliseconds; on Vercel the CDN serves it and the public API lists (`s-maxage`), so most
   anonymous traffic never reaches the server.

## How this maps to hosting

On Vercel each region runs as many backend instances as traffic needs, each with its own
pool, and Neon's pooler shares the database connections between them. One local process
handled 311 requests per second, far more than a new marketplace's early traffic, so the
free tiers are enough for launch. Sign-up time is bound by password hashing (a security
feature), not by the database.

## Run it yourself

```bash
cd backend
pnpm build && pnpm start                       # API on :4000 (or use pnpm dev)
cd ../frontend && npm run build && npm start   # web on :3000
cd ../backend && pnpm bots                     # 8 owners, 8 investors, 20 visitors
BOTS_OWNERS=20 BOTS_INVESTORS=20 BOTS_VISITORS=80 pnpm bots
```

It creates real accounts (`bot.*@example.com`), so only run it against a local or throwaway
database, never production.
