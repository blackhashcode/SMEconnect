# SME Connect API contract

Base path: `/api/v1`

## Conventions

- Success: `{ "data": ..., "meta": ... }` (`meta` is optional).
- Error: `{ "error": { "code": "...", "message": "...", "details": ... } }`.
- Cursor pagination: `?cursor=&limit=`, default limit 20, max 50.
- Dates are ISO 8601 UTC. Money is an integer number of BDT (whole taka) in fields ending in `Bdt`.
- Status codes: 200/201 success, 400 validation, 401 unauthenticated, 403 forbidden,
  404 not found, 409 conflict/invalid state, 422 business rule violation, 503 dependency unavailable.

## System

### `GET /api/v1/health`

Reports API and PostgreSQL connectivity. No authentication required.

**Success — 200**

```json
{
  "data": {
    "status": "ok",
    "database": "connected",
    "timestamp": "2026-11-22T18:00:00.000Z"
  }
}
```

**Database unavailable — 503**

```json
{
  "error": {
    "code": "DATABASE_UNAVAILABLE",
    "message": "Database connection failed"
  }
}
```

## Data model

The Phase 1 relational model, ER diagram and schema decisions are documented in
[`docs/DATABASE.md`](./DATABASE.md). No auth or business endpoints were added in
Phase 1.

## Modules (added in later phases)

Auth & verification, profiles, loan requests, feed/networking, discovery, messaging,
offers & agreement, repayments, reputation/notifications/dashboards, admin.
