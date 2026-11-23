# SME Connect API contract

Base path: `/api/v1`

## Conventions

- Success: `{ "data": ..., "meta": ... }` (`meta` is optional). Better Auth endpoints under
  `/api/v1/auth/*` are the exception and keep Better Auth's native JSON bodies.
- Error: `{ "error": { "code": "...", "message": "...", "details": ... } }`. Better Auth
  endpoints return their native `{ "code": "...", "message": "..." }` error body instead.
- Cursor pagination: `?cursor=&limit=`, default limit 20, max 50.
- Dates are ISO 8601 UTC. Money is an integer number of BDT (whole taka) in fields ending in `Bdt`.
- Status codes: 200/201 success, 400 validation, 401 unauthenticated, 403 forbidden,
  404 not found, 409 conflict/invalid state, 422 business rule violation, 503 dependency unavailable.

## API documentation

- **Swagger UI:** `/docs` (local: `http://localhost:3000/docs`)
- **OpenAPI 3.1 JSON:** `/api/docs` (local: `http://localhost:3000/api/docs`)
- The JSON document is generated at runtime from the Zod schemas in `src/server/validators/`.
  There is no hand-maintained OpenAPI file to keep in sync.
- The server URL in the document is derived from the incoming request origin (or `APP_URL`),
  so Try it out always calls the host currently serving the docs.
- `/docs` embeds the generated document in the server-rendered page instead of asking the
  browser to fetch `/api/docs` again. The browser loads the pinned Swagger UI JavaScript and
  CSS from `/docs/assets/*`, served locally from the installed `swagger-ui-react` package.
- Swagger UI starts fully collapsed (`docExpansion: "none"`) and the remote schema validator,
  deep linking, URL config, authorization persistence and request snippets are disabled.
- Docs are enabled by default when `NODE_ENV` is not `production`. In production they are
  off unless `API_DOCS_ENABLED=true` is set explicitly.
- When opening the dev server through a LAN IP or tunnel, add its hostname to
  `NEXT_ALLOWED_DEV_ORIGINS` if it is not a local private IPv4 address (see `.env.example`).
- The documented session mechanism is the Better Auth cookie `better-auth.session_token`.
  No bearer token or custom auth header is invented.

### Adding a new endpoint to OpenAPI

1. Add or extend the request/response Zod schema in `src/server/validators/`.
2. Register reusable schemas in `src/server/openapi/schemas.ts` (`componentSchemas` or a
   response/parameter component). Use `.openapi({ description, example })` only for
   documentation metadata — validation rules stay in the validator.
3. Add the operation in `src/server/openapi/routes/<module>.ts` with its method, path,
   tag, request parameters/body, success response and relevant error responses from
   `STANDARD_ERROR_RESPONSES`.
4. Call the new `register...Route()` from `src/server/openapi/routes/index.ts`.
5. Add a tag to `API_TAGS` in `src/server/openapi/config.ts` when introducing a new module.
6. Update this document and extend `src/server/openapi/openapi.test.ts`.

Never register an endpoint that does not exist yet. Future modules are represented only by
tags, not by placeholder operations.

### Reusing existing Zod schemas

Import validators from `@/server/validators` and register them with the central registry:

```ts
registry.register("CreateLoanRequestRequest", createLoanRequestSchema);
```

The registered schema (or its generated `$ref`) can then be used for `request.body`,
`request.query`, `request.params` and response content. One validator definition remains
the single source of truth for both runtime validation and documentation.

### Testing endpoints with Swagger UI

1. Start the backend with `pnpm dev`.
2. Open `/docs` in the browser.
3. Expand the **Health** tag and `GET /api/v1/health`, click **Try it out**, then **Execute**.
   Expect `200` with `{ "data": { "status": "ok", "database": "connected", "timestamp": "…" } }`.
4. Status code, response headers and response body are displayed under **Execute**.
5. For a future authenticated endpoint, sign in through the app in the same browser first.
   Better Auth sets the httpOnly `better-auth.session_token` cookie and Swagger UI sends it
   automatically on same-origin requests.
6. Examples use placeholder values only. Never put real credentials, NIDs, phone numbers or
   environment secrets into OpenAPI examples.

## Authentication (Better Auth)

The Better Auth catch-all is mounted at `/api/v1/auth/[...all]` and delegates to the existing
`auth` instance. There are no hand-written auth endpoints. The documented session mechanism is
the httpOnly cookie `better-auth.session_token`; no bearer token is introduced.

### Endpoints

| Method | Path | Purpose |
|---|---|---|
| POST | `/api/v1/auth/sign-up/email` | Create an OWNER or INVESTOR account |
| POST | `/api/v1/auth/sign-in/email` | Sign in and receive the session cookie |
| POST | `/api/v1/auth/sign-out` | Clear the session cookie |
| GET | `/api/v1/auth/get-session` | Read the current session; returns `null` when unauthenticated |
| POST | `/api/v1/auth/update-user` | Update only `name` or `image` for the current user |
| POST | `/api/v1/auth/email-otp/send-verification-otp` | Send a verification or password-reset OTP by email |
| POST | `/api/v1/auth/email-otp/verify-email` | Verify email with the six-digit OTP |
| POST | `/api/v1/auth/email-otp/request-password-reset` | Send a password-reset OTP |
| POST | `/api/v1/auth/email-otp/reset-password` | Set a new password with the OTP |

### Signup and role protection

`POST /api/v1/auth/sign-up/email` requires:

```json
{
  "name": "Shamima Akter",
  "email": "owner@example.com",
  "password": "example-password",
  "signupRole": "OWNER"
}
```

`signupRole` accepts only `OWNER` or `INVESTOR`. `ADMIN` is rejected. The value is a transport-only
field: a request hook maps it onto the existing server-owned `role` column, discards any client-sent
`role`/`status`, and database hooks enforce the final values. No `signupRole` column is stored.
Clients may not set `role`, `status`, or `signupRole` through `POST /api/v1/auth/update-user`; those
fields are rejected or stripped. Successful password resets revoke existing sessions.

### Email verification and password reset

Email delivery uses the project's existing notification service and Mailpit locally. Both flows
use six-digit OTPs with a 300-second expiry:

1. `POST /api/v1/auth/email-otp/send-verification-otp` with
   `{ "email": "owner@example.com", "type": "email-verification" }`.
2. `POST /api/v1/auth/email-otp/verify-email` with `{ "email": "...", "otp": "123456" }`.
   This marks the email verified and sets a session cookie.

For password reset, use `type: "forget-password"` on the send endpoint, then post
`{ "email": "...", "otp": "123456", "password": "new-example-password" }` to
`/api/v1/auth/email-otp/reset-password`.

Token-based verification/reset paths are disabled; the OTP paths above are the supported flows.
OTP values are never logged.

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
[`docs/DATABASE.md`](./DATABASE.md). Phase 2 auth endpoints reuse that schema without
Prisma changes.

## Modules (added in later phases)

Profiles, KYC verification submission/admin review, loan requests, feed/networking,
discovery, messaging, offers & agreement, repayments, reputation/notifications/dashboards,
admin.
