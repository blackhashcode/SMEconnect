# Phase 0 — Setup

**Status:** Implemented. Primary commit: `e3cca58` (`backend init`).
**Source of truth:** repository files and `git show --stat e3cca58`.

## 1. Phase objective

Bring up a locally running Next.js 16 (App Router, TypeScript strict) backend with the
project folder layout from `AGENTS.md`, environment-driven configuration, the shared
error/response/pagination plumbing, and a health endpoint that reports PostgreSQL
connectivity. Phase 0 also installs the pinned stack (pnpm, Prisma, Better Auth, Zod,
Nodemailer, Vitest).

## 2. Implemented features

- Backend application skeleton: Next.js App Router with `src/`, strict TypeScript, ESLint,
  Vitest and pnpm workspace/lockfile.
- Local infrastructure via Docker Compose: PostgreSQL 16 and Mailpit (email catcher).
- `.env.example` with all configuration knobs; `prisma7.config.ts` for Prisma config.
- Single shared Prisma client in `src/server/db.ts`.
- `AppError` hierarchy and a single error → HTTP mapping (`toErrorPayload`), plus
  `{ data, meta? }` / `{ error: { code, message, details? } }` response helpers.
- Cursor pagination helper with `DEFAULT_PAGE_LIMIT = 20`, `MAX_PAGE_LIMIT = 50`,
  `encodeCursor`/`decodeCursor`.
- Initial Better Auth instance and auth guards (`getSession`, `requireSession`,
  `requireRole`) — these were expanded in Phase 2.
- `GET /api/v1/health` backed by a service that checks database connectivity.
- `pnpm` scripts: `dev`, `build`, `lint`, `typecheck`, `test`, `db:generate`, `db:migrate`,
  `db:seed`, `db:reset`, `db:studio`.

## 3. Files created and modified

Created in `e3cca58`:

- Config/tooling: `.env.example`, `.gitignore`, `docker-compose.yml`, `eslint.config.mjs`,
  `next.config.ts`, `package.json`, `pnpm-lock.yaml`, `pnpm-workspace.yaml`,
  `prisma7.config.ts`, `tsconfig.json`, `vitest.config.mts`
- Project docs/guides added at this point: `AGENTS.md`, `BACKEND_PROMPT.md`, `docs/API.md`
- Prisma placeholders: `prisma/schema.prisma`, `prisma/seed.ts`
- App shell: `src/app/layout.tsx`, `src/app/page.tsx`, `src/app/api/v1/health/route.ts`
- Shared backend: `src/server/db.ts`, `src/server/errors.ts`, `src/server/errors.test.ts`,
  `src/server/http/response.ts`, `src/server/services/health.ts`
- Pagination: `src/lib/pagination.ts`, `src/lib/pagination.test.ts`
- Auth seeds: `src/server/auth/index.ts`, `src/server/auth/roles.ts`, `src/server/auth/guards.ts`

## 4. Database models and migrations involved

- No domain models existed yet: `prisma/schema.prisma` was an 8-line placeholder and
  `prisma/seed.ts` an 8-line stub.
- No migration was created in Phase 0. The initial migration belongs to Phase 1
  (`20261123170000_init`).
- Docker Compose provides the local PostgreSQL and Mailpit containers; `.env.example`
  defines how the app reaches them. No hardcoded connection strings in source.

## 5. API endpoints, methods, authentication and authorization

| Method | Path | Authentication | Authorization |
|---|---|---|---|
| GET | `/api/v1/health` | None (public) | None |

`GET /api/v1/health` returns `{ data: { status, database, timestamp } }` with 200 when the
database answers, or 503 with `DATABASE_UNAVAILABLE` when it does not. No other API
endpoints were implemented in this phase; auth was configuration and helpers only.

## 6. Business rules and state transitions

No domain state machines were introduced. Conventions fixed here and reused everywhere:

- All success responses use `{ data, meta? }`; all handled errors use
  `{ error: { code, message, details? } }`.
- Cursor pagination defaults to 20 items and caps at 50.
- Timestamps are ISO 8601 UTC; money is whole-integer BDT; rates are `Decimal(5,2)`.
- Unknown/internal exceptions map to 500 `INTERNAL_ERROR` without leaking messages or stacks.

## 7. Validation and security measures

- Strict TypeScript, ESLint and Zod are installed from the start.
- Environment variables gate secrets: `DATABASE_URL`, auth secrets and URLs come from the
  environment (see `.env.example`), not from source.
- Errors never leak internal details (`toErrorPayload` fallback).
- Auth was not yet enforcing sessions at routes; the proxy prefilter and role guards arrived
  in Phase 2.

## 8. Tests and verification results

- Unit tests added in this phase: `src/lib/pagination.test.ts`, `src/server/errors.test.ts`.
- **Current** repository-wide verification (after all implemented phases) passes:
  `pnpm lint`, `pnpm typecheck`, `pnpm test` (271 tests / 24 files), `pnpm build`,
  `git diff --check`.
- **Not verifiable from repository:** the exact lint/typecheck/test command output produced
  at the end of Phase 0. Only the committed code and test files survive; no per-phase CI log
  or report was stored.

## 9. Known limitations or incomplete work

- Only the health endpoint existed; no authentication, profiles or lending endpoints.
- Prisma schema and seed were placeholders; no migration was applied.
- No verification, storage, notification or OpenAPI/Swagger work yet (Swagger was added
  between Phases 1 and 2, commit `c6aadae`).
- No mock/seed dataset (owned by Phase 11 in `BACKEND_PROMPT.md`).

## 10. Dependencies on other phases

- Phase 1 consumes the Prisma setup, shared validators convention and pagination helper.
- Phase 2 expands the initial Better Auth instance and the `requireSession`/`requireRole`
  helpers created here.
- Every later phase uses the response/error envelope and pagination defaults fixed here.
