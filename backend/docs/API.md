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
  404 not found, 409 conflict/invalid state, 422 business rule violation, 429 rate limited,
  503 dependency unavailable.

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

## Access control

- `src/proxy.ts` is an optimistic pre-filter for protected API prefixes. It rejects requests
  with no `better-auth.session_token` cookie before they reach a route. A present cookie is
  **not** trusted as a valid session.
- Every protected route still calls `requireSession()` / `requireRole()` and verifies
  ownership against the session user id. Clients cannot supply `userId`, `role`, `status`
  or verification state to alter authorization.
- Roles: `OWNER` and `INVESTOR` act on their own resources; `ADMIN` can review verifications
  and read private verification files. Admin bypass of ownership is always explicit.
- `requireVerifiedUser(...roles)` is the gate for future actions that require KYC approval.
  It checks `UserVerification.status === "APPROVED"` for the actor's role. Verification
  submission itself is deliberately available to unverified users.
- Public endpoints remain `/api/v1/health`, `/api/v1/auth/*`, `/api/docs`, `/docs`, public
  files, public profiles (`/api/v1/profiles/{userId}`), and the root page.

## Phone OTP

| Method | Path | Purpose |
|---|---|---|
| POST | `/api/v1/phone-otp/request` | Send a six-digit phone OTP to the current account |
| POST | `/api/v1/phone-otp/verify` | Verify the OTP and link the phone to the current account |

- Requires an authenticated session. The destination phone is normalized to a single
  E.164-like value and stored on the session user only after successful verification.
- Codes expire after 300 seconds. Only an HMAC hash is stored in the existing
  `Verification` table, together with an attempt counter; the plaintext OTP is never stored
  or logged.
- Three incorrect attempts invalidate the code. Resending is rate-limited to one code per
  60 seconds; 429 responses include `details.retryAfterSeconds`.
- Delivery goes through a `sendOtp` interface. Local default is email via the existing
  Mailpit/SMTP service using the account email; `OTP_DELIVERY_PROVIDER=console` logs only
  delivery metadata (never the OTP). The interface is ready for an SMS provider.

Request:

```json
{ "phone": "01712345678" }
```

Verify:

```json
{ "phone": "01712345678", "otp": "123456" }
```

## File storage

| Method | Path | Purpose |
|---|---|---|
| POST | `/api/v1/uploads` | Upload a file (multipart/form-data) |
| GET | `/api/v1/files/{visibility}/{fileId}` | Serve a stored file |

- Files are written under `UPLOAD_DIR` (default `./uploads`), outside `public/`, behind a
  `StorageProvider`. `STORAGE_PROVIDER=local` is the only implemented provider.
- Allowed types: JPEG, PNG, WebP and PDF. Maximum size: 5 MB. Filenames are randomized UUIDs
  with an extension derived from the MIME type; client filenames are ignored.
- `purpose` determines visibility: `ID_DOCUMENT` and `SALES_PROOF` are private;
  `AVATAR` and `PRODUCT_IMAGE` are public.
- The upload response contains a relative `url`. Private URLs are under
  `/api/v1/files/private/...` and are never exposed through a public static path.
- Public files are served without a session with immutable cache headers. Private files
  require the authenticated verification owner or an ADMIN; all other callers get 403.

Upload example (multipart fields):

```text
purpose=ID_DOCUMENT
file=<binary PDF>
```

```json
{
  "data": {
    "id": "2f8c1a54-6b7d-4c9e-9f31-0a2b3c4d5e6f.pdf",
    "url": "/api/v1/files/private/2f8c1a54-6b7d-4c9e-9f31-0a2b3c4d5e6f.pdf",
    "visibility": "private",
    "contentType": "application/pdf",
    "size": 20480
  }
}
```

## Verification

| Method | Path | Purpose |
|---|---|---|
| POST | `/api/v1/verifications` | Submit or resubmit verification documents |
| GET | `/api/v1/verifications/me` | Get the current user's verification (`data: null` if none) |
| GET | `/api/v1/admin/verifications` | ADMIN-only review queue (cursor paginated) |
| POST | `/api/v1/admin/verifications/{id}` | ADMIN-only approve/reject with a review note |

- The actor's role determines the verification type. Submitting a mismatched `type`, or as
  ADMIN, returns 403. `idDocumentUrl` and `salesProofUrls` must be internal private-file URLs
  returned by `/api/v1/uploads`; public/external URLs are rejected.
- Owners must provide at least one sales proof; investors need only an ID document.
- A pending or approved verification cannot be resubmitted (409). A rejected one is replaced
  and reset to `PENDING`, with reviewer fields cleared.
- Approval/rejection is ADMIN-only, allowed once from `PENDING`, and writes the decision plus
  a `VERIFICATION_RESULT` notification in one transaction. Rejection requires a review note.
  Verified status is then available to `requireVerifiedUser` for gated actions.

Submit example:

```json
{
  "type": "OWNER",
  "idDocumentUrl": "/api/v1/files/private/2f8c1a54-6b7d-4c9e-9f31-0a2b3c4d5e6f.pdf",
  "salesProofUrls": [
    "/api/v1/files/private/3a9d2b65-7c8e-4d0f-8a12-1b2c3d4e5f60.jpg"
  ],
  "shopLinks": ["https://www.facebook.com/shop/example"]
}
```

Review example:

```json
{ "status": "APPROVED", "reviewNote": "Documents checked" }
```

## Profiles

| Method | Path | Purpose |
|---|---|---|
| GET | `/api/v1/me` | Current account, role-specific profile, own verification state and unread counts |
| PATCH | `/api/v1/me` | Update account fields and create/update the role-specific profile |
| POST | `/api/v1/me/product-images` | Add a product image (OWNER only) |
| PATCH | `/api/v1/me/product-images/{id}` | Edit a product image (OWNER only) |
| DELETE | `/api/v1/me/product-images/{id}` | Delete a product image (OWNER only) |
| GET | `/api/v1/profiles/{userId}` | Public, sanitized OWNER or INVESTOR profile (no session) |

### My profile

- `GET /me` returns `{ user, profile, verification, unread }`. `profile` is the
  `BusinessProfile` for OWNERs (including product images) or the `InvestorProfile` for
  INVESTORs, and `null` when it has not been created yet. `verification` is the actor's own
  `{ type, status }` or `null`; `unread` contains notification and message counts.
- ADMINs receive `profile: null`, `verification: null` and cannot submit a `profile` object to
  `PATCH /me` (403), so they can never read or modify an owner/investor profile here.
- `PATCH /me` accepts only `name`, `image` and an optional `profile`. All objects are strict:
  `userId`, `role`, `status`, verification fields, `trustScore`, `ownerId` and client-computed
  amounts are rejected. Every write is addressed by the session user id.
- The server selects the profile schema from the session role. Sending investor fields as an
  OWNER (or vice versa) is a 400. A missing profile requires the full create payload; an
  existing profile accepts partial updates. Range invariants are re-checked after merging
  with stored values, and a duplicate slug returns 409. Account and profile writes happen in
  one transaction.
- Phone numbers are changed through the phone OTP flow (see above), not through `/me`.

Request (OWNER):

```json
{
  "name": "Nusrat Akter",
  "profile": {
    "shopName": "Nusrat's Home Kitchen",
    "slug": "nusrat-home-kitchen",
    "category": "Food",
    "district": "Dhaka",
    "city": "Dhanmondi",
    "logoUrl": "/api/v1/files/public/2f8c1a54-6b7d-4c9e-9f31-0a2b3c4d5e6f.jpg"
  }
}
```

Request (INVESTOR):

```json
{
  "profile": {
    "minLendBdt": 20000,
    "maxLendBdt": 100000,
    "preferredCategories": ["Food", "Handicrafts"],
    "preferredTenureDays": 90,
    "preferredRatePctMin": "10.00",
    "preferredRatePctMax": "16.00",
    "district": "Dhaka"
  }
}
```

- Image fields (`image`, `logoUrl`, `coverUrl`, product image `url`) accept HTTP(S) URLs or
  internal public upload URLs (`/api/v1/files/public/...`) from `POST /api/v1/uploads` with
  `purpose=AVATAR` or `PRODUCT_IMAGE`. Private verification URLs are rejected.
- Product images are managed only by the OWNER whose profile contains them; `position` is
  auto-appended when omitted, and a duplicate position returns 409.

### Public profile

- Returns `{ name, image, role, verified, profile }`. `verified` is a boolean derived from an
  `APPROVED` verification — no status history, documents or review notes are exposed.
- Account email, account phone, user/profile/image internal ids, verification records,
  reviewer ids and trust-related private fields are never returned.
- Public business profiles include the shop name, slug, category, description, location,
  owner-provided social links, operating details and public product images. Public investor
  profiles include the bio, location, preferred categories and preferred lending range.
- Returns 404 when the user does not exist, is suspended, is an ADMIN, or has no profile.

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
[`docs/DATABASE.md`](./DATABASE.md). All Phase 2 and Phase 3 endpoints reuse that schema
without Prisma changes: `UserVerification` stores KYC state, `Verification` stores phone OTP
challenges, `Notification` stores verification results, and `BusinessProfile`,
`InvestorProfile` and `ProductImage` store profile data.

## Modules (added in later phases)

Loan requests, feed/networking, discovery, messaging, offers & agreement, repayments,
dashboards/analytics, and the remaining admin moderation endpoints.
