# SME Connect Backend API (`/api/v1`)

> The canonical API contract shared between `frontend/` and `backend/` lives in **[`../../docs/API.md`](../../docs/API.md)**.

All backend route handlers live under `src/app/api/v1/**/route.ts` (plus Better Auth at `src/app/api/auth/[...all]/route.ts`) and strictly follow the thin-handler architecture defined in `backend/AGENTS.md`:

```text
Route Handler (parse + Zod validate + auth guard)
  └──► Service Layer (business rules + prisma.$transaction + audit log + notifications)
         └──► Prisma ORM (PostgreSQL 16)
```

See [../../docs/API.md](../../docs/API.md) for full request/response envelopes, error codes, domain state machines, and the complete endpoint table.
