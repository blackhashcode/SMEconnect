# SMEconnect

SME Connect is a LinkedIn-style professional network for verified Bangladeshi small businesses. Investors **connect** with verified shop owners, send direct **loan offers**, negotiate terms, confirm agreements, and track repayments. It is a direct lending network, not crowdfunding.

## Architecture

SMEconnect uses a clean two-app architecture aligned on one canonical **`/api/v1`** contract ([docs/API.md](docs/API.md)):

```text
SMEconnect/
├── frontend/          Next.js 16 web app (UI, proxy, /api/v1 client, ESLint, Vitest)
│   └── mock-api/      Local Express 5 + SQLite stand-in implementing /api/v1 (no Docker needed)
├── backend/           Production backend (Next.js 16 Route Handlers + Prisma 7 + PostgreSQL 16 + Better Auth)
├── docs/
│   └── API.md         Single canonical /api/v1 API contract
└── .github/workflows/ CI pipeline (lint, typecheck, test, build for both apps)
```

The browser talks only to `/api/*` on the frontend origin; Next.js proxies `/api/*` to `API_URL` (default `http://localhost:4000` for `mock-api/`, or point `API_URL` at `backend/` for PostgreSQL + Better Auth).

## Quick Start (Local, No Docker Required)

Requires Node.js 20.9+.

```bash
cd frontend
npm install   # installs web app and mock-api
npm run dev   # web on http://localhost:3000, /api/v1 mock API on http://localhost:4000
```

Quality checks:
```bash
cd frontend
npm run lint && npm run typecheck && npm test
```

## Production Backend (PostgreSQL + Prisma 7 + Better Auth)

See [backend/README.md](backend/README.md) and [backend/AGENTS.md](backend/AGENTS.md):

```bash
cd backend
cp .env.example .env
docker compose up -d
pnpm install && pnpm db:migrate && pnpm db:seed
pnpm dev
```

Quality checks:
```bash
cd backend
pnpm lint && pnpm typecheck && pnpm test && pnpm build
```
