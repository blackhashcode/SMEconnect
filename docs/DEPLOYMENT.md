# Deploying SME Connect (free tier)

Everything below runs on free plans, with no credit card needed for the defaults.

| Piece | Service | Free tier limits worth knowing |
| --- | --- | --- |
| Database | **Neon** Postgres | 0.5 GB storage; sleeps after 5 min idle (about 1 s wake-up) |
| Frontend + backend | **Vercel**: one project, two services (`vercel.json`) | Hobby plan: serverless functions, 100 GB bandwidth/month |
| Email (sign-up codes, reminders) | **Brevo** SMTP | 300 emails/day |
| Scheduled jobs | **GitHub Actions** | Overdue check every 6 h, reminders daily |
| Uploaded files | Stored in Neon (`STORAGE_PROVIDER=database`) | Counts toward the 0.5 GB; fine for a showcase |

```
                       ┌─ /api/*  ──► backend service ──► Neon (pooled)
Browser ──► smeconnect.vercel.app                  ▲
                       └─ /*      ──► frontend service ─┘ (server pages call the backend
                                                           through the BACKEND_URL binding)
GitHub Actions (cron) ──► Neon directly
```

One Vercel project serves both apps on one domain. `vercel.json` routes `/api/*` to the backend
service and everything else to the frontend service. The frontend's server-side pages reach the
backend through a service binding that injects `BACKEND_URL`. The session cookie, Google sign-in
and the backend's trusted origin are all on that one domain, and no CORS setup is needed.

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

**Using the Neon CLI instead** (already done for this repo): `neon.ts` and `.neon` link the repo to
the project. `neon env pull` writes `DATABASE_URL` (pooled) and `DATABASE_URL_UNPOOLED` (direct)
to a git-ignored root `.env.local`. The backend accepts either `DIRECT_URL` or
`DATABASE_URL_UNPOOLED` for migrations, so on Vercel you can use Neon's names directly. To apply
migrations from your machine: load `.env.local` into the shell, then run
`pnpm exec prisma migrate deploy` in `backend/`.

## 2. Email: Brevo

1. Sign up at [brevo.com](https://www.brevo.com) (free plan).
2. **Senders, domains & dedicated IPs → Senders**: add and verify the address emails will
   come from (any address you own works; a custom domain improves deliverability).
3. **SMTP & API → SMTP**: generate an SMTP key. Note the login shown there.
   You'll use host `smtp-relay.brevo.com`, port `587`.

## 3. Vercel: one project, two services

The repo's `vercel.json` defines the project:

| Service | Folder | Public path | Notes |
| --- | --- | --- | --- |
| `backend` | `backend/` | `/api/*` | Build: `pnpm vercel-build` (Prisma client, `migrate deploy`, build) |
| `frontend` | `frontend/` | everything else | Binding `BACKEND_URL` → the backend's internal URL |

1. Sign in to [vercel.com](https://vercel.com) with GitHub → **Add New → Project** → import
   the repository. Leave **Root Directory** as the repository root; Vercel reads `vercel.json`
   and sets up both services. Name the project e.g. `smeconnect`.
2. **Settings → General → Node.js Version:** 22.x.
3. Environment variables (shared by both services). Use the project's real domain, e.g.
   `https://smeconnect.vercel.app`, for the three URL settings. **Don't set `BACKEND_URL`**:
   the binding injects it.

   | Variable | Value |
   | --- | --- |
   | `DATABASE_URL` | Neon **pooled** string |
   | `DIRECT_URL` (or `DATABASE_URL_UNPOOLED`) | Neon **direct** string |
   | `DATABASE_POOL_MAX` | `10` (see docs/PERFORMANCE_TEST.md) |
   | `UV_THREADPOOL_SIZE` | `16` (faster sign-ups under load) |
   | `BETTER_AUTH_SECRET` | the secret from step 0 |
   | `BETTER_AUTH_URL` | `https://smeconnect.vercel.app` (the project's domain) |
   | `APP_URL` | `https://smeconnect.vercel.app` (same domain) |
   | `BETTER_AUTH_TRUSTED_ORIGINS` | `https://smeconnect.vercel.app` (same domain) |
   | `STORAGE_PROVIDER` | `database` |
   | `RATE_LIMIT_STORE` | `database` |
   | `SMTP_HOST` | `smtp-relay.brevo.com` |
   | `SMTP_PORT` | `587` |
   | `SMTP_USER` | Brevo SMTP login |
   | `SMTP_PASSWORD` | Brevo SMTP key |
   | `EMAIL_FROM` | `SME Connect <your-verified-sender@example.com>` |
   | `OTP_DELIVERY_PROVIDER` | `email` |
   | `API_DOCS_ENABLED` | `false` |
   | `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET` | optional: turns on "Continue with Google" (see [GOOGLE_AUTH.md](GOOGLE_AUTH.md)) |

4. **Deploy.** Then check:
   - `https://<domain>/api/v1/health` reports the database as connected (backend service).
   - `https://<domain>/` shows the landing page (frontend service).
5. If Vercel gave you a different domain than you entered, update `BETTER_AUTH_URL`,
   `APP_URL` and `BETTER_AUTH_TRUSTED_ORIGINS` and redeploy (Deployments → ⋯ → Redeploy).

Locally nothing changes: run the backend on :4000 and the frontend on :3000, and the frontend's
own rewrite forwards `/api/v1/*` (or run `vercel dev` to emulate the services setup).

## 4. Scheduled jobs: GitHub Actions

Vercel doesn't run background jobs, so
[`.github/workflows/repayment-jobs.yml`](../.github/workflows/repayment-jobs.yml) does: it marks
overdue instalments every 6 hours and emails repayment reminders daily at 09:00 Bangladesh time.
It needs these repository secrets (**Settings → Secrets and variables → Actions → New repository
secret**), the same values as the Vercel project:

| Secret | Value | Needed for |
| --- | --- | --- |
| `DATABASE_URL` | Neon connection string | both jobs |
| `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASSWORD`, `EMAIL_FROM` | Brevo values | reminder emails |

Until they're added, each run finishes with a yellow warning saying what's missing, instead of
failing. Or add them from PowerShell with the GitHub CLI (each command asks you to paste the value):

```powershell
gh secret set DATABASE_URL --repo blackhashcode/SMEconnect
gh secret set SMTP_HOST --repo blackhashcode/SMEconnect
gh secret set SMTP_PORT --repo blackhashcode/SMEconnect
gh secret set SMTP_USER --repo blackhashcode/SMEconnect
gh secret set SMTP_PASSWORD --repo blackhashcode/SMEconnect
gh secret set EMAIL_FROM --repo blackhashcode/SMEconnect
```

Test it from **Actions → Repayment jobs → Run workflow**. Scheduled runs only start from the
default branch (`main`).

## 5. Create the admin account

The database starts empty: no demo members, loans or posts. Real people sign up through the
site. The only account you create by hand is the first administrator. Run this once from
your machine against Neon:

```powershell
cd backend
$env:DATABASE_URL = "<Neon direct string>"
$env:ADMIN_EMAIL = "you@yourdomain.com"
$env:ADMIN_PASSWORD = "<a long, unique password: 12+ characters>"
pnpm db:seed
Remove-Item Env:DATABASE_URL, Env:ADMIN_EMAIL, Env:ADMIN_PASSWORD
```

Sign in at `/login` with that email and password; you'll see **Admin** in the top bar. The
command is safe to re-run: it does nothing if the admin already exists. Keep the password
in a password manager.

## 6. Check the live site

- [ ] Landing page loads with the real photos and no made-up numbers
- [ ] Sign up with a real email → the code arrives (check spam) → verification works
- [ ] Log in, refresh: you stay logged in (the cookie is named `__Secure-better-auth.session_token`)
- [ ] Upload a profile photo (or choose a blank one) and a verification document; as admin, approve it
- [ ] Admin panel: Members, Loans, Reports, Content and Activity log all load; your sign-in shows in the log
- [ ] If Google is configured: sign up with Google as an investor, then sign in again from `/login`
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
| Activity log grows large | Archive `audit_log` rows older than a year (it's append-only and indexed by date) |
