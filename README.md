# SMEconnect

SME Connect is a LinkedIn-style professional network for verified Bangladeshi small
businesses. Investors **connect** with shop owners and make direct **loan offers**,
negotiate terms and track repayments. It is a lending network, not crowdfunding.

> **Status:** accounts, member profiles, loan requests, offers and negotiation, agreements
> and messaging are real, backed by a Node.js API and SQLite. Notifications and the admin
> verification panel still use mock data from [`src/data/`](src/data/).
>
> The API in `server/` is a working stand-in. The full API contract the front end relies
> on is in **[docs/API.md](docs/API.md)**; a replacement backend that follows it will work
> with the front end unchanged.

## Tech stack

- **Web:** [Next.js 16](https://nextjs.org/) (App Router, Turbopack), React 19, TypeScript, Tailwind CSS 3, lucide-react
- **API:** Node.js + [Express 5](https://expressjs.com/) + TypeScript (run with `tsx`), in [`server/`](server/)
- **Database:** SQLite via [sql.js](https://sql.js.org/) (WebAssembly, so no native build tools are needed)
- **Auth:** bcrypt password hashing, server-side sessions in an httpOnly cookie

## Getting started

Requires Node.js 20.9 or later.

```bash
npm ci        # installs the web app, then the API (via postinstall)
npm run dev   # starts both: web on http://localhost:3000, API on http://localhost:4000
```

On first start the API creates `server/data/smeconnect.db` and seeds it with the demo
members from `src/data/`. Go to http://localhost:3000/login and, in development, use
**Try a demo account** to sign in as an investor or a business owner. Demo emails are
`<id>@demo.smeconnect.bd` (for example `rafiq@demo.smeconnect.bd`); the shared demo
password is `SEED_PASSWORD` in [`server/src/config.ts`](server/src/config.ts). Or create
your own account at `/signup`.

To start over with a fresh database, stop the API, delete `server/data/`, and start it again.

| Script | What it does |
| --- | --- |
| `npm run dev` | Web app and API together |
| `npm run dev:web` / `npm run dev:api` | Just one of them |
| `npm run build` / `npm run start` | Production build / serve the web app |
| `npm run start:api` | Run the API without file watching |
| `npm run typecheck` | Type-check the web app and the API |
| `npm run seed` | Add any missing demo data to the database |
| `npm run fetch:images` | Download design images into `public/images/` |

Configuration is optional; see [`server/.env.example`](server/.env.example).

## How it fits together

```
Browser ──► Next.js (:3000) ──/api/* rewrite──► Express API (:4000) ──► SQLite file
                │
                └─ Server Components call the API directly, forwarding the session cookie
```

- The browser only ever talks to `:3000`. Next.js forwards `/api/*` to the API, so the
  session cookie is first-party and no CORS setup is needed.
- [`src/proxy.ts`](src/proxy.ts) sends visitors without a session cookie to `/login`.
  The `(app)` layout then confirms the session with the API on every request.
- Logging out deletes the session on the server, not just the cookie.

### API endpoints

See **[docs/API.md](docs/API.md)** for every endpoint, request and response shape, who
can call what, and how offer negotiation moves between states. In short:

- `/api/auth/*`: signup, login, logout, current member
- `/api/users`, `/api/businesses`: member directory and profiles
- `/api/loans`: loan requests (list, create, close), their offers and agreement
- `/api/offers`: offers sent and received, plus accept, decline, counter and withdraw
- `/api/threads`: one-to-one conversations, messages, read state and unread count

### Security notes

- Passwords are hashed with bcrypt; login errors don't reveal whether an email exists.
- Session tokens are random 256-bit values. Only their SHA-256 is stored, and they expire after 7 days.
- Cookies are `httpOnly` and `SameSite=Lax` (and `Secure` in production). Write
  endpoints only accept JSON, which blocks cross-site form posts.
- Login and signup are rate limited per IP and email. The limiter is in memory, so use
  a shared store such as Redis if you run more than one API process.

## Project structure

```
src/
  app/
    (public)/     Logged-out pages: landing, /login, /signup
    (app)/        Member pages behind login, sharing one header/footer layout
  components/
    auth/         Login form, form fields, session context, logout hook
    ui/           Generic primitives: Button, Card, Modal, Tabs, Badge, Avatar, Photo, ...
    layout/       AppHeader, UserMenu, PublicHeader, MobileTabBar, Footer, BrandLogo
    domain/       Feature components: LoanCard, OfferBuilder, MessagesWorkspace, ...
  data/           Mock data and shared types (also the database seed)
  lib/            API client, session helpers, cn class-name helper
  proxy.ts        Redirects logged-out visitors to /login
server/
  src/
    index.ts      Express app
    db.ts         SQLite schema and helpers
    auth.ts       Password hashing, sessions, rate limiting
    seed.ts       Loads src/data into the database
    views.ts      Turns database rows into the API response shapes
    messaging.ts  Opens conversations and posts messages (also used by offers)
    routes/       auth.ts, profiles.ts, loans.ts (requests, offers, agreements), messages.ts
  data/           SQLite database file (git-ignored, created on first run)
public/images/    All images, stored locally
stitch-export/    Original Stitch design exports (HTML + screenshots), reference only
scripts/          Helpers to export Stitch designs and download images
tailwind.config.ts  Single source of truth for design tokens
```

## Screens

| Route | Screen | Data |
| --- | --- | --- |
| `/` | Landing page | Mock |
| `/login` | Log in | API |
| `/signup` | Sign up and role selection | API |
| `/feed` | Home feed | API |
| `/explore` | Explore and search | API |
| `/businesses/[id]` | Business profile | API |
| `/investors/[id]` | Investor profile | API |
| `/messages` | Messages (polls for new messages every 4 s) | API |
| `/notifications` | Notifications center | Mock |
| `/business-dashboard` | Business owner dashboard | API |
| `/investor-dashboard` | Investor dashboard | API |
| `/loans/request/new` | Create loan request | API |
| `/loans/offers/new` | Create loan offer | API |
| `/loans/offers/[id]/review` | Review and negotiate an offer (both sides) | API |
| `/loans/[id]/agreement` | Loan agreement summary and confirmation | API |
| `/admin/verification` | Admin verification panel | Mock |

## Design references

The screens are rebuilt from Stitch designs kept in [`stitch-export/`](stitch-export/).
Those files are visual references only and are never copied into the app. Build rules
(shared theme, reusable components, mock data in `src/data`, wording) are in
[AGENTS.md](AGENTS.md).

`scripts/fetch-stitch.mjs` re-exports the designs. It reads the Stitch API key from a
local `opencode.json`, which is git-ignored and must never be committed.

## Not yet built

- Notifications and the admin verification queue in the API (still mock data)
- Repayment tracking after an agreement (schedules are shown, payments aren't recorded)
- Editing your profile, uploading photos and documents, password reset
- Tests
