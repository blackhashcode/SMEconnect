# SME Connect — Production Backend

Next.js 16 (App Router, TypeScript strict) + PostgreSQL 16 + Prisma 7 + Better Auth + Zod + Vitest.

## Architecture

```text
src/
├── app/api/
│   ├── auth/[...all]/route.ts   # Better Auth handler
│   └── v1/**/route.ts           # Thin route handlers (parse → validate → service → envelope)
├── lib/
│   ├── finance.ts               # Exact whole-BDT flat-interest & schedule math
│   ├── trust-score.ts           # 0–100 deterministic trust score formula
│   └── pagination.ts            # Base64url cursor pagination
└── server/
    ├── auth/                    # Better Auth config & requireActor/requireRole guards
    ├── services/                # All domain business logic & atomic transactions
    ├── validators/              # Zod schemas
    ├── storage/                 # StorageProvider interface + safe LocalStorageProvider
    ├── notifications/           # In-app notifications + Nodemailer SMTP (Mailpit locally)
    ├── audit.ts                 # Immutable compliance audit trail
    ├── env.ts                   # Zod-validated lazy environment loader
    ├── logger.ts                # Structured JSON logger with secret redaction
    ├── rate-limit.ts            # Bounded rate limiter (Redis-ready interface)
    ├── db.ts                    # Lazy PrismaPg client singleton
    └── errors.ts                # AppError classes → standard { error: { code, message, details } }
```

## Local Setup

1. Copy `.env.example` to `.env` and fill in `BETTER_AUTH_SECRET` (`openssl rand -base64 32`).
2. Start PostgreSQL 16 + Mailpit:
   ```bash
   docker compose up -d
   ```
3. Install dependencies, migrate, seed, and start:
   ```bash
   pnpm install
   pnpm db:migrate
   pnpm db:seed
   pnpm dev
   ```
4. Quality gates:
   ```bash
   pnpm lint && pnpm typecheck && pnpm test && pnpm build
   ```

## Demo Seed Accounts (`prisma/seed.ts`)

| Role | Email |
| --- | --- |
| Admin | `admin@demo.smeconnect.bd` |
| Business Owner | `nusrat@demo.smeconnect.bd` |
| Investor | `rafiq@demo.smeconnect.bd` |

## Going Live Checklist

- **Database:** Point `DATABASE_URL` at managed PostgreSQL (Neon, Supabase, RDS, or Railway) and run `prisma migrate deploy` in your release pipeline.
- **Auth Secrets:** Set a cryptographically random 32+ byte `BETTER_AUTH_SECRET`, and set `BETTER_AUTH_URL` and `APP_URL` to your HTTPS production domains.
- **File Storage:** Implement a Cloudinary/S3 `StorageProvider` in `src/server/storage/` and serve private KYC documents only via short-lived signed URLs after owner/admin authorization.
- **Email & SMS:** Replace Mailpit SMTP (`SMTP_HOST`/`SMTP_PORT`/`SMTP_USER`/`SMTP_PASSWORD`) with a transactional provider (Resend, Postmark, or SES).
- **Rate Limiting:** Back `src/server/rate-limit.ts` with Redis (e.g. Upstash) when running multiple instances.
- **Scheduled Jobs:** Run overdue detection (`detectOverdueRepayments`) and stale offer cleanup (`expireStaleOffers`) on a recurring cron schedule.
