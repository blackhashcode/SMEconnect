# SME Connect — frontend

The Next.js web app. It holds no data of its own: every page reads from and writes to the
backend in [`../backend/`](../backend/) through `/api/v1`. Run the commands below from this
`frontend/` folder, with the backend already running (see the root
[README](../README.md)).

## Tech stack

Next.js 16 (App Router, Turbopack), React 19, TypeScript, Tailwind CSS 3, lucide-react.
API types are generated from the backend's OpenAPI document with `openapi-typescript`.

## Getting started

Requires Node.js 22.12+.

```bash
npm ci
npm run dev        # http://localhost:3000, backend expected on http://localhost:4000
```

Configuration is optional; see [`.env.example`](.env.example) (`BACKEND_URL`).

| Script | What it does |
| --- | --- |
| `npm run dev` | Development server |
| `npm run build` / `npm run start` | Production build / serve it |
| `npm run typecheck` | TypeScript check |
| `npm run api:types` | Regenerate `src/lib/backend/schema.d.ts` from the running backend |

## How it talks to the backend

- **Browser → backend:** `next.config.mjs` rewrites `/api/v1/*` to `BACKEND_URL`, so the
  Better Auth session cookie is first-party. Client components use
  [`src/lib/client-api.ts`](src/lib/client-api.ts).
- **Server Components → backend:** [`src/lib/backend/server.ts`](src/lib/backend/server.ts)
  calls the backend directly and forwards the visitor's cookie.
- **Types:** responses are typed from the generated OpenAPI schema, and
  [`src/lib/backend/mappers.ts`](src/lib/backend/mappers.ts) turns API objects into the
  shapes the UI components display.
- [`src/proxy.ts`](src/proxy.ts) sends visitors without a session cookie to `/login`; the
  `(app)` layout then confirms the session with the backend.
- Images are compressed in the browser before upload
  ([`src/lib/image-compress.ts`](src/lib/image-compress.ts)); the backend re-checks type and size.

## Project structure

```
src/
  app/
    (public)/     Landing (ISR), /login, /signup, /verify-email
    (app)/        Member pages behind login, sharing one header/footer layout
  components/
    auth/         Login, email verification, form fields, session context, logout
    ui/           Primitives: Button, Card, Tabs, Badge, Avatar, Photo, ...
    layout/       AppHeader, UserMenu, PublicHeader, MobileTabBar, Footer, BrandLogo
    domain/       Feature components: LoanCard, OfferBuilder, MessagesWorkspace, ...
    admin/        Admin panel navigation, tables and action buttons
  data/           Shared UI types, navigation, the site's photos (images.ts)
  lib/            API clients, mappers, formatting, session helpers
  proxy.ts        Redirects logged-out visitors to /login
public/images/    Photos of real Bangladeshi small businesses used by the site
tailwind.config.ts  Design tokens
```

## Screens

| Route | Screen |
| --- | --- |
| `/` | Landing page |
| `/login`, `/signup`, `/verify-email` | Sign in or sign up (email or Google), email code |
| `/onboarding` | Profile photo (or a blank one), profile details and verification documents |
| `/feed`, `/explore` | Home feed; search businesses, investors and loan requests |
| `/businesses/[id]`, `/investors/[id]` | Public profiles |
| `/loans/new` | Create and publish a loan request (owner) |
| `/loan-requests/[id]/offer` | Make an offer (investor) |
| `/offers/[id]` | Review, counter, accept or decline an offer |
| `/loans/[id]` | Agreement, repayment schedule and payments |
| `/messages`, `/notifications` | Conversations; notification centre |
| `/business-dashboard`, `/investor-dashboard` | Role dashboards |
| `/admin` | Admin overview: platform numbers, what needs attention, latest activity |
| `/admin/users`, `/admin/users/[id]` | Search members; full profile, documents, activity; suspend, reactivate, sign out everywhere |
| `/admin/verification` | Verification queue |
| `/admin/loans` | Every loan request (pause, reopen, cancel with a reason) and every agreed loan |
| `/admin/reports` | Reports with the reported content; resolve, remove, suspend or dismiss |
| `/admin/content` | Posts and comments; remove |
| `/admin/activity` | Activity log of sign-ups, sign-ins, lending steps and admin actions |
