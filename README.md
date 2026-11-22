# SMEconnect

SME Connect is a LinkedIn-style professional network for verified Bangladeshi small
businesses. Investors **connect** with shop owners and make direct **loan offers**,
negotiate terms and track repayments. It is a lending network, not crowdfunding.

## Repository layout

```
SMEconnect/
├── frontend/      Next.js web app (UI, design references, image scripts)
│   └── mock-api/  Stand-in Express + SQLite API the UI runs against for now
├── backend/       Production backend (Next.js API routes + Prisma); see backend/AGENTS.md
└── docs/
    └── API.md     API contract between the front end and the backend
```

## Quick start (front end)

Requires Node.js 20.9 or later.

```bash
cd frontend
npm ci        # installs the web app and the mock API
npm run dev   # web on http://localhost:3000, mock API on http://localhost:4000
```

See [frontend/README.md](frontend/README.md) for demo accounts, scripts and structure, and
[backend/](backend/) for the backend setup.

## Front end and backend

The front end talks only to `/api/*`, which Next.js forwards to `API_URL`
(default `http://localhost:4000`, the mock API). Once the backend implements the contract
in [docs/API.md](docs/API.md), point `API_URL` at it and retire `frontend/mock-api/`.
