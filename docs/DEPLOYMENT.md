# Deploying SME Connect (free tier)

Everything below runs on free plans, with no credit card needed for the defaults.

| Piece | Service | Free tier limits worth knowing |
| --- | --- | --- |
| Database | **Neon** Postgres | 0.5 GB storage; sleeps after 5 min idle (about 1 s wake-up) |
| Backend API | **Vercel** (project 1, root `backend/`) | Hobby plan: serverless functions, 100 GB bandwidth/month |
| Frontend | **Vercel** (project 2, root `frontend/`) | Same Hobby plan |
| Email (sign-up codes, reminders) | **Brevo** SMTP | 300 emails/day |
| Scheduled jobs | **GitHub Actions** | Overdue check every 6 h, reminders daily |
| Uploaded files | Stored in Neon (`STORAGE_PROVIDER=database`) | Counts toward the 0.5 GB; fine for a showcase |

```
Browser ──► frontend.vercel.app ──/api/v1/*──► backend.vercel.app ──► Neon (pooled)
                                                       ▲
                          GitHub Actions (cron) ───────┘ jobs connect to Neon directly
```

The browser only talks to the frontend; the frontend forwards `/api/v1/*` to the backend.
So the session cookie belongs to the frontend's domain, and no CORS setup is needed.

Vercel Hobby is for non-commercial projects, which suits a showcase. If this becomes a
real business, move to Vercel Pro or another host. The code doesn't depend on Vercel.

---

## 0. Before you start

- Push the code to GitHub (Vercel and Actions deploy from the repository).
- Make sure CI is green on the branch you'll deploy (Actions tab → **CI**).
- Generate an auth secret and keep it somewhere safe:
  ```bash
  openssl rand -base64 32
  ```
  (No openssl? `node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"`.)

## 1. Database: Neon

1. Sign up at [neon.tech](https://neon.tech) and create a project. Pick region
   **AWS Asia Pacific (Singapore)**, the closest to Bangladesh, and Postgres 16 or newer.
2. On the project dashboard, click **Connect** and copy two connection strings:
   - **Pooled** (host contains `-pooler`). This becomes `DATABASE_URL`.
   - **Direct** (turn off "Connection pooling"). This becomes `DIRECT_URL`; it's used only for migrations.
   Both should end in `?sslmode=require`.
3. Nothing else to do here: the backend's build applies the migrations automatically.

## 2. Email: Brevo

1. Sign up at [brevo.com](https://www.brevo.com) (free plan).
2. **Senders, domains & dedicated IPs → Senders**: add and verify the address emails will
   come from (any address you own works; a custom domain improves deliverability).
3. **SMTP & API → SMTP**: generate an SMTP key. Note the login shown there.
   You'll use host `smtp-relay.brevo.com`, port `587`.

## 3. Backend on Vercel

1. Sign in to [vercel.com](https://vercel.com) with GitHub → **Add New → Project** →
   import the repository.
2. Configure:
   - **Project name:** e.g. `smeconnect-api`
   - **Root Directory:** `backend`
   - **Framework preset:** Next.js (auto-detected)
   - **Build Command:** override with `pnpm vercel-build`
     (generates the Prisma client, runs `prisma migrate deploy`, then builds)
   - **Settings → General → Node.js Version:** 22.x
3. Environment variables (Production). Use your real URLs once you know them; you can
   redeploy after editing.

   | Variable | Value |
   | --- | --- |
   | `DATABASE_URL` | Neon **pooled** string |
   | `DIRECT_URL` | Neon **direct** string |
   | `DATABASE_POOL_MAX` | `3` |
   | `BETTER_AUTH_SECRET` | the secret from step 0 |
   | `BETTER_AUTH_URL` | `https://smeconnect-api.vercel.app` (this project's URL) |
   | `BETTER_AUTH_TRUSTED_ORIGINS` | `https://smeconnect.vercel.app` (the frontend's URL) |
   | `APP_URL` | `https://smeconnect.vercel.app` (the frontend's URL) |
   | `STORAGE_PROVIDER` | `database` |
   | `RATE_LIMIT_STORE` | `database` |
   | `SMTP_HOST` | `smtp-relay.brevo.com` |
   | `SMTP_PORT` | `587` |
   | `SMTP_USER` | Brevo SMTP login |
   | `SMTP_PASSWORD` | Brevo SMTP key |
   | `EMAIL_FROM` | `SME Connect <your-verified-sender@example.com>` |
   | `OTP_DELIVERY_PROVIDER` | `email` |
   | `API_DOCS_ENABLED` | `false` (or `true` if you want `/docs` public for the showcase) |

4. **Deploy.** When it finishes, open `https://<backend>/api/v1/loan-requests`; you should
   get JSON (an empty list on a fresh database).

## 4. Frontend on Vercel

1. **Add New → Project** → the same repository again.
2. Configure:
   - **Project name:** e.g. `smeconnect`
   - **Root Directory:** `frontend`
   - **Framework preset:** Next.js; default build command
   - **Node.js Version:** 22.x
3. Environment variables:

   | Variable | Value |
   | --- | --- |
   | `BACKEND_URL` | `https://smeconnect-api.vercel.app` (no trailing slash) |
   | `SHOW_DEMO_LOGIN` | `true` only if you seed demo data (step 6); otherwise leave it unset |
   | `SEED_DEMO_PASSWORD` | must match the backend seed password, if you set `SHOW_DEMO_LOGIN` |

4. **Deploy.** If the final URLs differ from what you put in the backend's
   `BETTER_AUTH_URL`, `BETTER_AUTH_TRUSTED_ORIGINS` or `APP_URL`, fix them there and
   redeploy the backend (Deployments → ⋯ → Redeploy).

## 5. Scheduled jobs: GitHub Actions

Vercel doesn't run background jobs, so
[`.github/workflows/repayment-jobs.yml`](../.github/workflows/repayment-jobs.yml) does.
In GitHub, go to **Settings → Secrets and variables → Actions** and add these repository
secrets: `DATABASE_URL` (use the Neon **direct** string), `SMTP_HOST`, `SMTP_PORT`,
`SMTP_USER`, `SMTP_PASSWORD`, `EMAIL_FROM`.

Test it from **Actions → Repayment jobs → Run workflow**. Scheduled workflows run only from
the default branch (`main`).

## 6. Demo data (optional, for a showcase)

A fresh database is empty. To fill it with the demo businesses, investors and loans, run
the seed once from your machine against Neon:

```powershell
cd backend
$env:DATABASE_URL = "<Neon direct string>"
$env:SEED_DEMO_PASSWORD = "<a password you choose>"
pnpm db:seed
Remove-Item Env:DATABASE_URL, Env:SEED_DEMO_PASSWORD
```

Then set `SHOW_DEMO_LOGIN=true` and the same `SEED_DEMO_PASSWORD` on the frontend project
and redeploy it. Never seed a database that holds real users. Before real users join,
reset to an empty database.

## 7. Check the live site

- [ ] Landing page loads; **Explore** shows businesses (with demo data)
- [ ] Sign up with a real email → the code arrives (check spam) → verification works
- [ ] Log in, refresh: you stay logged in (the cookie is named `__Secure-better-auth.session_token`)
- [ ] Upload a verification document; as admin, approve it
- [ ] Owner publishes a request → investor makes an offer → accept → agreement → record a repayment
- [ ] Send a message both ways
- [ ] Response headers on any page include `strict-transport-security` and `x-frame-options: DENY`
- [ ] Optionally, run the smoke test against the live API (it creates test records, so use
      a non-production database or a Neon branch):
      `SMOKE_BASE_URL=https://<frontend> pnpm smoke` (needs a reachable Mailpit, so it's mainly for staging)

## Updating

Push to `main`, and both Vercel projects redeploy automatically. Pull requests get preview
deployments. Schema changes ship as committed migrations (`pnpm db:migrate` locally);
`vercel-build` applies them on deploy. Never use `prisma db push` against Neon.

Tip: Neon **branches** give you a free copy of the database for previews or testing
migrations. Point a Vercel *Preview* environment's `DATABASE_URL`/`DIRECT_URL` at a branch.

## When you outgrow the free tier

| Symptom | Next step |
| --- | --- |
| Database near 0.5 GB because of uploads | Move files to Cloudflare R2 or Cloudinary (free tiers) by adding a `StorageProvider`; no route changes |
| Over 300 emails/day | Brevo paid plan, or Amazon SES |
| Rate-limit table hot under heavy traffic | Upstash Redis (free tier) as the limiter store |
| Cold starts noticeable | Neon paid plan (no auto-suspend) |
| Users need phone OTP | Add an SMS gateway (e.g. SSL Wireless, Twilio) behind `OTP_DELIVERY_PROVIDER=sms` |
