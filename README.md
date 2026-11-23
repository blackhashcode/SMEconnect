# SMEconnect

SME Connect is a LinkedIn-style professional network for verified Bangladeshi small
businesses. Investors **connect** with shop owners and make direct **loan offers**,
negotiate terms and track repayments. It is a lending network, not crowdfunding.

## Repository layout

```
SMEconnect/
├── frontend/          Next.js web app (UI only; talks to the backend through /api/v1)
├── backend/           Next.js API (/api/v1), Better Auth, Prisma + PostgreSQL
│   └── docs/          API.md, DATABASE.md, USER_FLOWS.md
├── docs/
│   ├── QA_REPORT.md        Review findings, fixes and test results
│   ├── PERFORMANCE_TEST.md Bot-user load test and what it changed
│   ├── DEPLOYMENT.md       Free-tier hosting walkthrough (Vercel + Neon)
│   └── GOOGLE_AUTH.md      Turning on "Continue with Google"
└── .github/workflows/ CI and the scheduled repayment jobs
```

## How it fits together

```
Browser ──► frontend (:3000) ──/api/v1/* rewrite──► backend (:4000) ──► PostgreSQL
                │
                └─ Server Components call the backend directly, forwarding the session cookie
```

The browser only ever talks to the frontend. Next.js forwards `/api/v1/*` to
`BACKEND_URL`, so the auth cookie is first-party and no CORS setup is needed.

## Quick start

Requires Node.js 22.12+, pnpm 10+ (`npm i -g pnpm`) and Docker.

```bash
# 1. Backend: database, migrations, admin account, API on http://localhost:4000
cd backend
cp .env.example .env            # set BETTER_AUTH_SECRET, ADMIN_EMAIL, ADMIN_PASSWORD
docker compose up -d            # Postgres + Mailpit (emails at http://localhost:8025)
pnpm install
pnpm db:migrate
pnpm db:seed                    # creates the admin account only
pnpm dev

# 2. Frontend, in a second terminal: http://localhost:3000
cd frontend
npm ci
npm run dev
```

Create accounts at http://localhost:3000/signup (codes arrive in Mailpit), or sign in as
the admin from your `.env`. There is no demo data: the site shows only what real members add.

## Checks

| Where | Command | What it runs |
| --- | --- | --- |
| backend | `pnpm typecheck && pnpm lint && pnpm test` | Types, ESLint, unit and service tests |
| backend | `pnpm smoke` | End-to-end journey against a running API + Mailpit (86 checks) |
| backend | `pnpm bots` | Many simulated members at once; prints latency per endpoint |
| frontend | `npm run typecheck && npm run build` | Types and production build |

CI runs the same checks on every push. See [docs/QA_REPORT.md](docs/QA_REPORT.md) for the
latest results and [docs/DEPLOYMENT.md](docs/DEPLOYMENT.md) to put it online.
