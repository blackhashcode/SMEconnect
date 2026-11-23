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
pnpm dev                      # http://localhost:3000
```

Use `pnpm db:reset` instead of `db:migrate` + `db:seed` when you want a completely fresh
local database. Never use `prisma db push` for shared database changes.

## Environment variables

| Variable | Purpose |
|---|---|
| `DATABASE_URL` | PostgreSQL connection string. Works with local Docker, Neon, Supabase or Railway unchanged. |
| `BETTER_AUTH_SECRET` | Secret used by Better Auth. Generate with `openssl rand -base64 32`. |
| `BETTER_AUTH_URL` | Canonical backend origin used by auth callbacks. |
| `BETTER_AUTH_TRUSTED_ORIGINS` | Comma-separated extra frontend origins allowed by Better Auth. |
| `APP_URL` | Public origin used in generated docs and links. |
| `API_DOCS_ENABLED` | Leave empty for local-only docs; set `true` or `false` explicitly in production. |
| `NEXT_ALLOWED_DEV_ORIGINS` | Extra hostnames allowed by the Next.js dev server. |
| `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASSWORD` | SMTP delivery. Defaults point at local Mailpit. |
| `EMAIL_FROM` | Sender address used by the email layer. |
| `OTP_DELIVERY_PROVIDER` | `email` (Mailpit locally) or `console` (metadata only, never the OTP). |
| `MESSAGE_RATE_LIMIT_MAX`, `MESSAGE_RATE_LIMIT_WINDOW_SECONDS` | In-process message-send limiter (per authenticated user). |
| `STORAGE_PROVIDER` | `local` today; the abstraction allows S3/Cloudinary later. |
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
| `OWNER` | `fahimbinimam@gmail.com` | Personalized demo account — Fahim's Home Kitchen. This is the only account using this address. |
| `OWNER` | `owner02@smeconnect.local` | Nusrat's Home Kitchen — food, Dhanmondi, Dhaka. |
| `OWNER` | `owner03@smeconnect.local` | Deshi Threads — fashion, Chattogram. |
| `INVESTOR` | `investor01@smeconnect.local` | Rafiq Ahmed — ৳20,000–৳1,00,000, food & fashion. |
| `ADMIN` | `admin@smeconnect.local` | Created only by the seed. |

The full credential list is printed after every `pnpm db:seed`. All other identities are
fictional; no admin or investor uses the personal identity.

## Security notes

- Passwords are hashed with Better Auth's password helper; the seed never stores plaintext.
- Auth routes and email OTPs are rate limited by Better Auth/the OTP service. Message sends use
  the in-process limiter above. Use a shared store before running multiple API instances.
- All client-authored text is sanitized by shared Zod schemas before reaching services.
- Private files require an authenticated owner, loan counterparty or admin; the authorization
  check runs before storage is read.
- Verification documents and repayment proofs are private. Public profiles and posts expose
  only allow-listed fields.

## Going live

Change all of the following before a public deployment:

1. **Database:** set a managed `DATABASE_URL`, run `pnpm prisma migrate deploy`, enable TLS,
   back up regularly, and never run the demo seed or `db:reset` against production.
2. **Storage:** implement/select a cloud `StorageProvider`, set `STORAGE_PROVIDER` and its
   credentials via environment variables, and keep private objects behind the same
   authorization rules. Do not rely on the local `UPLOAD_DIR` filesystem.
3. **Email/SMS:** replace Mailpit with a real SMTP provider (and set `EMAIL_FROM`), choose the
   production `OTP_DELIVERY_PROVIDER`, and add a real SMS gateway for phone OTP if that flow
   is enabled for users.
4. **Auth:** set a strong `BETTER_AUTH_SECRET`, canonical `BETTER_AUTH_URL`,
   `BETTER_AUTH_TRUSTED_ORIGINS` and `APP_URL`; enforce HTTPS so Better Auth cookies are
   `Secure`. Leave `API_DOCS_ENABLED` empty or set it to `false`.
5. **Cron jobs:** schedule `pnpm job:overdue` (for example every 15 minutes) and
   `pnpm job:reminders` (for example daily) with retries and monitoring. The Next.js app does
   not run these automatically.
6. **Rate limiting:** move the message limiter to a shared store (Redis or equivalent) when
   more than one API instance serves traffic.
7. **Demo data:** delete or reset the seeded database before accepting real users. Never use
   the demo password or personal demo address in production.

See `docs/API.md` for the full endpoint contract and `docs/USER_FLOWS.md` for client flows.
