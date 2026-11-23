# SME Connect backend

Next.js 16 App Router backend for SME Connect: a networking + lending platform for
Bangladeshi online businesses and individual investors. The API lives under `/api/v1`;
interactive docs live at `/docs` and the generated OpenAPI JSON at `/api/docs`.

## Requirements

- Node.js 22+
- pnpm 10+
- Docker (for local PostgreSQL 16 and Mailpit)

## Local setup

```bash
docker compose up -d          # Postgres + Mailpit (Mailpit UI: http://localhost:8025)
cp .env.example .env          # then review the values
pnpm install
pnpm db:migrate               # apply committed migrations
pnpm db:seed                  # deterministic demo data; no emails are sent
pnpm dev                      # http://localhost:4000 (the frontend runs on :3000)
```

If port 5432 is already taken, set `POSTGRES_PORT` (e.g. `5433`) in `.env` and use the same
port in `DATABASE_URL`.

Use `pnpm db:reset` instead of `db:migrate` + `db:seed` when you want a completely fresh
local database. Never use `prisma db push` for shared database changes.

## Environment variables

| Variable | Purpose |
|---|---|
| `DATABASE_URL` | PostgreSQL connection string. Works with local Docker, Neon, Supabase or Railway unchanged. |
| `DIRECT_URL` | Optional direct connection for Prisma CLI (migrations); the app always uses `DATABASE_URL`. |
| `DATABASE_POOL_MAX` | Connections per instance (default 5). Keep small on serverless and use a pooled URL. |
| `POSTGRES_PORT` | Host port for the Docker Postgres container (default 5432). |
| `BETTER_AUTH_SECRET` | Secret used by Better Auth. Generate with `openssl rand -base64 32`. |
| `BETTER_AUTH_URL` | Canonical backend origin used by auth callbacks. |
| `BETTER_AUTH_TRUSTED_ORIGINS` | Comma-separated frontend origins allowed by Better Auth (the frontend URL). |
| `APP_URL` | Public origin used in generated docs and links. |
| `API_DOCS_ENABLED` | Leave empty for local-only docs; set `true` or `false` explicitly in production. |
| `NEXT_ALLOWED_DEV_ORIGINS` | Extra hostnames allowed by the Next.js dev server. |
| `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASSWORD` | SMTP delivery. Defaults point at local Mailpit. |
| `EMAIL_FROM` | Sender address used by the email layer. |
| `OTP_DELIVERY_PROVIDER` | `email` (Mailpit locally) or `console` (metadata only, never the OTP). |
| `RATE_LIMIT_STORE` | `memory` (one process) or `database` (shared across instances; use in production). Applies to auth, messages and uploads. |
| `MESSAGE_RATE_LIMIT_MAX`, `MESSAGE_RATE_LIMIT_WINDOW_SECONDS` | Message-send limit per authenticated user. |
| `STORAGE_PROVIDER` | `local` (disk, dev only) or `database` (Postgres; works on serverless). |
| `UPLOAD_DIR` | Local upload directory. Private files are never served publicly. |
| `SEED_DEMO_PASSWORD` | Optional demo password override. The default is `Password123!`. |
| `SEED_ADMIN_EMAIL` | Optional admin demo email override. |
| `SEED_PERSONAL_EMAIL` | Optional personalized OWNER demo email override. |
| `SEED_ANCHOR_DATE` | Optional fixed ISO timestamp used to derive all relative demo dates. |

## Scripts

| Script | Description |
|---|---|
| `pnpm dev` | Start the Next.js development server. |
| `pnpm build` | Generate Prisma Client and build for production. |
| `pnpm start` | Start the production build. |
| `pnpm lint` | ESLint. |
| `pnpm typecheck` | TypeScript type check. |
| `pnpm test` | Vitest unit and service tests. |
| `pnpm smoke` | End-to-end journey against a running API and Mailpit (`SMOKE_BASE_URL`, `SMOKE_MAILPIT_URL`). |
| `pnpm vercel-build` | What Vercel runs: generate client, apply migrations, build. |
| `pnpm db:migrate` | Create and apply a development migration. |
| `pnpm db:seed` | Re-run the deterministic demo seed (idempotent). |
| `pnpm db:reset` | Reset the database, migrate and seed. |
| `pnpm db:studio` | Browse the database with Prisma Studio. |
| `pnpm job:overdue` | Mark unpaid installments past due. Run on a schedule. |
| `pnpm job:reminders` | Send due/overdue repayment reminder emails. Run on a schedule. |

## Demo accounts

The seed is deterministic, idempotent and FK-valid. It creates one admin, ten owners and
six investors, with every loan-request status, a counter-offer chain, active and completed
loans, mixed repayment states, posts, comments, likes, connections, messages, reviews,
notifications and moderation records. It writes directly to Postgres and **never sends
email**.

The default password for every demo account is `Password123!`. If `SEED_DEMO_PASSWORD` is
set, the seed prints that it used the configured password but never prints the secret.

| Role | Email | Notes |
|---|---|---|
| `OWNER` | `owner01@smeconnect.local` | Fahim's Home Kitchen. Set `SEED_PERSONAL_EMAIL` in your local `.env` to use your own address instead. |
| `OWNER` | `owner02@smeconnect.local` | Nusrat's Home Kitchen — food, Dhanmondi, Dhaka. |
| `OWNER` | `owner03@smeconnect.local` | Deshi Threads — fashion, Chattogram. |
| `INVESTOR` | `investor01@smeconnect.local` | Rafiq Ahmed — ৳20,000–৳1,00,000, food & fashion. |
| `ADMIN` | `admin@smeconnect.local` | Created only by the seed. |

The full credential list is printed after every `pnpm db:seed`. All other identities are
fictional; no admin or investor uses the personal identity.

## Security notes

- Passwords are hashed with Better Auth's password helper; the seed never stores plaintext.
- Auth, OTP, message and upload endpoints are rate limited. With `RATE_LIMIT_STORE=database`
  the counters live in Postgres, so the limits hold across serverless instances.
- Uploads are capped at 5 MB and identified by their magic bytes (JPEG, PNG, WebP, PDF); a file
  whose content doesn't match its declared type is rejected.
- Session tokens are stripped from auth JSON responses; the session lives only in the httpOnly cookie.
- Security headers (HSTS, `X-Frame-Options: DENY`, `nosniff`, Referrer and Permissions policies)
  are set on every response. Unexpected errors return a request ID and log the details server-side only.
- All client-authored text is sanitized by shared Zod schemas before reaching services.
- Private files require an authenticated owner, loan counterparty or admin; the authorization
  check runs before storage is read.
- Verification documents and repayment proofs are private. Public profiles and posts expose
  only allow-listed fields.

## Going live

The step-by-step free-tier deployment (Vercel + Neon, Brevo email, GitHub Actions for the
scheduled jobs) is in [`../docs/DEPLOYMENT.md`](../docs/DEPLOYMENT.md). Never run the demo seed
or `db:reset` against production.

See `docs/API.md` for the endpoint contract and `docs/USER_FLOWS.md` for client flows.
