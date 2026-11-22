# SMEconnect

SME Connect is a LinkedIn-style professional network for verified Bangladeshi small
businesses. Investors **connect** with shop owners and make direct **loan offers**,
negotiate terms and track repayments. It is a lending network, not crowdfunding.

> **Status:** front end only. There is no backend, database, API or authentication yet.
> All data is mock data from [`src/data/`](src/data/), so actions update the UI but
> nothing is persisted.

## Tech stack

- [Next.js 16](https://nextjs.org/) (App Router, Turbopack)
- React 19 + TypeScript
- Tailwind CSS 3
- [lucide-react](https://lucide.dev/) icons

## Getting started

Requires Node.js 20.9 or later.

```bash
npm ci        # install dependencies from the lockfile
npm run dev   # start the dev server at http://localhost:3000
```

Other scripts:

| Script | What it does |
| --- | --- |
| `npm run build` | Production build |
| `npm run start` | Serve the production build |
| `npm run typecheck` | Type-check with `tsc --noEmit` |
| `npm run fetch:images` | Download design images into `public/images/` |

## Project structure

```
src/
  app/            Routes (one folder per screen)
  components/
    ui/           Generic primitives: Button, Card, Modal, Tabs, Badge, ...
    layout/       AppHeader, PublicHeader, AppShell, Footer, BrandLogo
    domain/       Feature components: LoanCard, OfferBuilder, MessagesWorkspace, ...
  data/           Mock data and shared types (users, businesses, loans, offers, ...)
  lib/            Small utilities (cn class-name helper)
public/images/    All images, stored locally
stitch-export/    Original Stitch design exports (HTML + screenshots), reference only
scripts/          Helpers to export Stitch designs and download images
tailwind.config.ts  Single source of truth for design tokens
```

## Screens

| Route | Screen |
| --- | --- |
| `/` | Landing page |
| `/signup` | Sign up and role selection |
| `/feed` | Home feed |
| `/explore` | Explore and search |
| `/messages` | Messages and loan offers |
| `/notifications` | Notifications center |
| `/business-dashboard` | Business owner dashboard |
| `/investor-dashboard` | Investor dashboard |
| `/businesses/[id]` | Business profile |
| `/investors/[id]` | Investor profile |
| `/loans/request/new` | Create loan request |
| `/loans/offers/new` | Create loan offer |
| `/loans/offers/[id]/review` | Review and negotiate an offer |
| `/loans/[id]/agreement` | Loan agreement summary and confirmation |
| `/admin/verification` | Admin verification panel |

## Design references

The screens are rebuilt from Stitch designs kept in [`stitch-export/`](stitch-export/).
Those files are visual references only and are never copied into the app. Build rules
(shared theme, reusable components, mock data in `src/data`, wording) are in
[AGENTS.md](AGENTS.md).

`scripts/fetch-stitch.mjs` re-exports the designs. It reads the Stitch API key from a
local `opencode.json`, which is git-ignored and must never be committed.

## Not yet built

- Backend, database and API
- Authentication and real user accounts
- Tests
