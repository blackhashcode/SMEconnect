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
| GET | `/api/v1/auth-options` | Public: which sign-in methods are configured (`{ google }`) |
| PATCH | `/api/v1/me/role` | Switch OWNER ↔ INVESTOR while the account is still empty |
| POST | `/api/v1/auth/sign-out` | Clear the session cookie |
| GET | `/api/v1/auth/get-session` | Read the current session; returns `null` when unauthenticated |
| POST | `/api/v1/auth/update-user` | Update only `name` or `image` for the current user |
| POST | `/api/v1/auth/email-otp/send-verification-otp` | Send a verification or password-reset OTP by email |
| POST | `/api/v1/auth/email-otp/verify-email` | Verify email with the six-digit OTP |
| POST | `/api/v1/auth/email-otp/request-password-reset` | Send a password-reset OTP |
| POST | `/api/v1/auth/email-otp/reset-password` | Set a new password with the OTP |

Google sign-in (when `GOOGLE_CLIENT_ID`/`GOOGLE_CLIENT_SECRET` are set) uses Better Auth's
social flow: `POST /api/v1/auth/sign-in/social` with `{ "provider": "google", "callbackURL" }`
returns the Google URL, and Google redirects back to `<APP_URL>/api/v1/auth/callback/google`.
New Google accounts take their role from the short-lived `sme_signup_role` cookie (default
`OWNER`, switchable with `PATCH /api/v1/me/role` while the account is empty).

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
- `requireVerifiedUser(...roles)` is the gate for KYC-required actions such as publishing a
  loan request or sending an offer. It checks `UserVerification.status === "APPROVED"` for the
  actor's role. Verification submission itself is deliberately available to unverified users.
- Public endpoints remain `/api/v1/health`, `/api/v1/auth/*`, `/api/docs`, `/docs`, public
  files, public profiles (`/api/v1/profiles/{userId}`), public loan requests
  (`/api/v1/loan-requests*`), public review reads (`/api/v1/reviews*`) and the root page.
  Owner-scoped loan request paths under `/api/v1/me/loan-requests*`, the lending prefixes
  `/api/v1/repayments*`, `/api/v1/loans/*`, `/api/v1/offers*` and `/api/v1/agreements*`, and the
  reputation prefixes `/api/v1/reports*`, `/api/v1/notifications*`, `/api/v1/blocks*` and
  `/api/v1/dashboard/*`
  are protected by the same prefilter as the rest of the private API. Review writes have their
  own `requireRole` guard even though review reads are public.

## Rate limiting and input sanitization

- Better Auth rate-limits all `/api/v1/auth/*` routes (10 requests/10 seconds by default, with
  tighter sign-up and sign-in rules). Email OTP sends and verifications use the OTP service's
  cooldown and attempt limits.
- Message sends (`POST /api/v1/conversations/{id}/messages`) are limited per authenticated
  user to 30 requests per 60 seconds by default. Tune with `MESSAGE_RATE_LIMIT_MAX` and
  `MESSAGE_RATE_LIMIT_WINDOW_SECONDS`. Exceeding any limit returns 429 with
  `{ "error": { "code": "RATE_LIMITED", "message": "...", "details": { "retryAfterSeconds": 12 } } }`.
  The message limiter is in-process; use a shared store when running multiple API instances.
- Every client-authored text field (posts, comments, messages, offers, reviews, reports,
  profiles and notes) is trimmed of HTML-like markup and control characters by shared Zod
  schemas before it reaches a service. Stored content is plain text, never rendered as HTML.
- Unknown query keys and client-sent `userId`, `role`, `status` or server-computed amounts are
  rejected by strict validators. Pagination is capped at 50 items per page.

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
- Allowed types: JPEG, PNG, WebP and PDF. Maximum size: 5 MB. Oversized requests are rejected
  from the `Content-Length` header before the multipart body is buffered, and again from the
  parsed `File.size`. Filenames are randomized UUIDs with an extension derived from the MIME
  type; client filenames are ignored.
- `purpose` determines visibility: `ID_DOCUMENT` and `SALES_PROOF` are private;
  `AVATAR` and `PRODUCT_IMAGE` are public.
- The upload response contains a relative `url`. Private URLs are under
  `/api/v1/files/private/...` and are never exposed through a public static path.
- Files are served `inline` (shown in the browser, not downloaded) with a restrictive
  `Content-Security-Policy` and `X-Frame-Options: SAMEORIGIN`, so the admin panel can show
  them in its viewer. Only magic-byte-checked JPEG/PNG/WebP/PDF files are ever stored.
- Every time an ADMIN opens a private file, an `admin.document_viewed` entry is written to
  the activity log.
- Public files are served without a session with immutable cache headers. Private files are
  authorized before storage is read. They are readable only by the authenticated verification
  owner, a party to the loan whose repayment proof it is, or an ADMIN; all other callers get
  403. Randomized URLs are never treated as authorization by themselves.

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
| GET | `/api/v1/admin/verifications/{id}` | ADMIN-only submission detail with private documents |
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

## Loan requests

| Method | Path | Purpose |
|---|---|---|
| GET | `/api/v1/me/loan-requests` | Authenticated OWNER's own requests (all statuses), cursor-paginated |
| POST | `/api/v1/me/loan-requests` | Create a DRAFT request |
| GET | `/api/v1/me/loan-requests/{id}` | Own request detail (full owner-only fields) |
| PATCH | `/api/v1/me/loan-requests/{id}` | Edit a DRAFT or PAUSED request |
| POST | `/api/v1/me/loan-requests/{id}/publish` | DRAFT → OPEN |
| POST | `/api/v1/me/loan-requests/{id}/pause` | OPEN / IN_DISCUSSION → PAUSED |
| POST | `/api/v1/me/loan-requests/{id}/resume` | PAUSED → OPEN |
| POST | `/api/v1/me/loan-requests/{id}/cancel` | DRAFT / OPEN / IN_DISCUSSION / PAUSED → CANCELLED |
| GET | `/api/v1/loan-requests` | Public listing of OPEN requests (cursor pagination) |
| GET | `/api/v1/loan-requests/{id}` | Public detail of an OPEN request |

All owner-scoped paths sit under `/api/v1/me`, so they are session-protected and resolved
against the session user id. The two `/api/v1/loan-requests` paths are public.

### Creating and editing

- OWNER role only. `POST` creates a `DRAFT`; clients cannot send `ownerId`, `status`,
  `publishedAt`, `trustScore` or any other server-controlled field (strict Zod objects reject
  unknown keys). The rate is normalized to the `Decimal(5,2)` string Prisma expects.
- Fields: `amountBdt` (positive whole taka), `purpose`, `fundUsage`, `tenureDays` (1–3650),
  `repaymentFrequency` (`WEEKLY` | `BIWEEKLY` | `MONTHLY`), `proposedRatePct` (0–100, ≤2 dp)
  and up to 10 HTTP(S) `proofUrls`. No funding is calculated or promised at this stage.
- Only `DRAFT` and `PAUSED` requests are editable; attempts on other statuses return 409.

### State transitions

The service layer accepts only these transitions; anything else returns 409 `CONFLICT`.
Explicit actions are the only way to change status — arbitrary `status` updates are rejected.

```
DRAFT → OPEN | CANCELLED
OPEN → IN_DISCUSSION | PAUSED | CANCELLED
IN_DISCUSSION → PAUSED | CANCELLED      (first offer is a Phase 7 trigger; no route yet)
PAUSED → OPEN | CANCELLED
FUNDED / REPAYING / COMPLETED / CANCELLED → (terminal in this phase)
```

- `publish` requires an **APPROVED** OWNER verification (403 otherwise), a complete business
  profile and no other active request (422 otherwise). It sets `publishedAt` and creates a
  `LOAN_REQUEST` feed post in the same transaction.
- `resume` re-runs the same checks; `pause`/`cancel` hide the feed post via `deletedAt`.
- At most one request per OWNER may be `OPEN`, `IN_DISCUSSION`, `FUNDED` or `REPAYING`. This is
  checked in the service and backed by the existing partial unique index
  `loan_request_one_active_per_owner`; a concurrent publish that loses the race returns 422.
- Verification submission and profile management remain separate (see above). No offers,
  agreements, loans or repayments are implemented in this phase.

### Public listing and detail

- `GET /api/v1/loan-requests` returns only `OPEN` requests. Filters: `category`, `district`
  (case-insensitive exact matches on the owner's business profile), `minAmountBdt`,
  `maxAmountBdt`, `maxTenureDays`, `frequency`, and `sort` (`newest` | `amountAsc` |
  `amountDesc`). `cursor` + `limit` use the standard convention (default 20, max 50);
  `meta` contains `limit`, `nextCursor` and `hasMore`. Invalid or inverted filters return 400.
- `GET /api/v1/loan-requests/{id}` returns 404 unless the request is `OPEN`.
- Public responses contain only: request terms, `publishedAt`, `createdAt`, and an owner
  mini-profile (name, avatar, shop name/slug/category/location/logo, trust score, `verified`
  badge). They never include account email/phone, `ownerId`, proof URLs, verification records,
  internal image IDs or status history. `status` is omitted because public requests are OPEN.
- The owner-only endpoints return the full request including `status`, `proofUrls` and
  timestamps, but never another user's data.

Request example:

```json
{
  "amountBdt": 50000,
  "purpose": "Buy a second oven",
  "fundUsage": "Expand weekend meal prep capacity",
  "tenureDays": 90,
  "repaymentFrequency": "WEEKLY",
  "proposedRatePct": "14.5",
  "proofUrls": []
}
```

## Feed, posts, networking and discovery

### Feed and posts

| Method | Path | Purpose |
|---|---|---|
| GET | `/api/v1/feed` | Personalized feed (auth) — own posts, followed authors, accepted connections and OPEN loan-request posts |
| GET | `/api/v1/posts` | Public recent posts (optionally authenticated for `likedByMe`) |
| POST | `/api/v1/posts` | Create an `UPDATE` or `MILESTONE` post (auth) |
| GET | `/api/v1/posts/{id}` | Post detail |
| PATCH | `/api/v1/posts/{id}` | Edit own user-created post (auth) |
| DELETE | `/api/v1/posts/{id}` | Soft-delete own user-created post (auth) |
| POST | `/api/v1/posts/{id}/like` | Like a post (auth) |
| DELETE | `/api/v1/posts/{id}/like` | Unlike a post (auth) |
| GET | `/api/v1/posts/{id}/comments` | List comments (oldest first, cursor pagination) |
| POST | `/api/v1/posts/{id}/comments` | Add a comment (auth) |
| PATCH | `/api/v1/posts/{id}/comments/{commentId}` | Edit own comment (auth) |
| DELETE | `/api/v1/posts/{id}/comments/{commentId}` | Soft-delete own comment (auth) |

- All list endpoints use `?cursor=&limit=` (default 20, max 50) with `meta.limit`,
  `meta.nextCursor` and `meta.hasMore`. Feed/post lists accept an optional `type` filter.
- `POST /posts` accepts only `type: "UPDATE" | "MILESTONE"`, non-empty `content` (≤5000 chars)
  and up to 10 HTTP(S) image URLs. The author is always the session user; an `authorId` field
  is rejected. `LOAN_REQUEST` and `REPAYMENT` posts are system-owned: clients cannot create,
  edit or delete them (403).
- A post response contains `id`, `type`, `content`, `imageUrls`, `likeCount`, `commentCount`,
  `likedByMe`, an optional OPEN `loanRequest` summary, timestamps and a public `author` card
  (`name`, `image`, `role`, `verified`, `shopName`, `slug`, `category`). It never includes the
  author's user id, email, phone or verification documents.
- Duplicated likes return 409; unliking a post you have not liked returns 404.
- Comment create/edit accepts only `{ "content": "..." }`. Editing or deleting another user's
  comment returns 403. Deletes set `deletedAt`; deleted comments are omitted from lists and
  post comment counts. Deleting a post soft-deletes all of its live comments in one transaction.
- Anonymous callers may read posts/comments but see `likedByMe: false`.

Request examples:

```json
{ "type": "UPDATE", "content": "Fresh cookies today!", "imageUrls": [] }
```

```json
{ "content": "Congratulations on the new oven!" }
```

### Connections

| Method | Path | Purpose |
|---|---|---|
| POST | `/api/v1/connections` | Send a connection request with an optional message |
| GET | `/api/v1/connections` | List `incoming`, `outgoing` or `all` (default), optional `status` filter |
| GET | `/api/v1/connections/with/{userId}` | Your status with one member: none, outgoing, incoming, connected, declined or self |
| POST | `/api/v1/connections/{id}/accept` | Addressee only: PENDING → ACCEPTED |
| POST | `/api/v1/connections/{id}/decline` | Addressee only: PENDING → DECLINED |
| DELETE | `/api/v1/connections/{id}` | Requester cancels PENDING; either party removes ACCEPTED |

State machine: `PENDING → ACCEPTED | DECLINED`. Other transitions return 409. Self-connections,
duplicate and reciprocal requests return 422/409. Only the addressee may accept or decline (403);
only the requester may cancel a pending request. DECLINED records are read-only history. The
returned `user` is a safe public card with `direction` and `status`; no private fields.

```json
{ "addresseeId": "usr_456", "message": "I would like to know more about your shop." }
```

### Follows

| Method | Path | Purpose |
|---|---|---|
| POST | `/api/v1/follows` | Follow a user (auth) |
| DELETE | `/api/v1/follows/{userId}` | Unfollow a user (auth) |
| GET | `/api/v1/me/followers` | Paginated list of the actor's followers |
| GET | `/api/v1/me/following` | Paginated list of users the actor follows |

Targets must be active, non-admin, non-self accounts. Duplicate follows return 409; unfollowing
without an existing relationship returns 404. List entries use the same public user card.

```json
{ "followeeId": "usr_456" }
```

### Discovery

| Method | Path | Purpose |
|---|---|---|
| GET | `/api/v1/businesses` | Public search of APPROVED owner profiles |
| GET | `/api/v1/investors` | Public search of APPROVED investor profiles |
| GET | `/api/v1/suggestions/businesses` | INVESTOR-only matches from the investor's profile |
| GET | `/api/v1/suggestions/investors` | OWNER-only matches from the owner's profile and OPEN request |

`GET /api/v1/businesses` supports `q`, `category`, `location`, `district`, `city`,
`minAmountBdt`, `maxAmountBdt`, `maxTenureDays`, `minTrustScore` (0–100) and `sort`
(`newest` | `trustScore`). Amount/tenure filters constrain the owner's OPEN loan request.
`GET /api/v1/investors` supports `q`, `category`, `location`, `district`, `city`,
`minLendBdt`, `maxLendBdt`, `minTrustScore` and sort (`newest` | `trustScore` | `lendAsc` |
`lendDesc`). All query values are validated/coerced; inverted amount ranges and unsupported
sorts return 400.

Suggestions require no query parameters beyond pagination. They are derived entirely from the
session user's profile (preferred categories, lending range and location for investors; business
category, location and OPEN request amount for owners). Only APPROVED, active counterparties are
returned. Endpoints return 403 for the wrong role and 422 when the acting user has no profile.

Discovery responses are explicit allow-lists. They never contain email, phone, verification
records/documents, user ids other than the public profile id, or internal fields. To discover
OPEN loan requests themselves, reuse the Phase 4 `GET /api/v1/loan-requests` endpoint rather than
duplicating it here.

### Open loan-request discovery

No new endpoint was added. `GET /api/v1/loan-requests` remains the canonical public listing of
OPEN requests with category/location/amount/tenure filters, sorting and cursor pagination.

## Conversations and messaging

All endpoints below require an authenticated `OWNER` or `INVESTOR` session. The acting user is
always taken from the session; client-supplied `senderId`, `userId`, `role` or `conversationId`
fields are rejected by strict validation.

| Method | Path | Purpose |
|---|---|---|
| POST | `/api/v1/conversations` | Create or retrieve the conversation with another user |
| GET | `/api/v1/conversations` | List the actor's conversations (cursor pagination) |
| GET | `/api/v1/conversations/{id}` | Conversation detail with participant, latest message and unread count |
| GET | `/api/v1/conversations/{id}/messages` | List messages oldest-first; supports `?after=<messageId>` polling |
| POST | `/api/v1/conversations/{id}/messages` | Send a message |
| POST | `/api/v1/conversations/{id}/read` | Mark incoming messages in the conversation as read |
| GET | `/api/v1/messages/{messageId}` | Message detail (participants only) |
| DELETE | `/api/v1/messages/{messageId}` | Soft-delete the message from the caller's view |

A conversation may only be created when the two users have an **accepted connection** or an
**existing offer relationship** in either direction. A `Block` row in either direction denies
conversation and message access. Participant ids are canonicalized before lookup/creation, so a
pair has exactly one conversation; repeating `POST /conversations` returns the same record instead
of creating a duplicate. Only participants can read, send, mark read or delete inside a
conversation. If the relationship is later removed, conversation and message access is denied.

`GET /conversations` returns only eligible, unblocked conversations, newest activity first. Each
entry has `id`, a safe `participant` card (`id`, `name`, `image`, `role`, `verified`, `shopName`,
`slug`, `category`), a `lastMessage` summary (`null` when none is visible), `unreadCount` and
timestamps. It uses `?cursor=&limit=` (default 20, max 50). `unreadCount` counts only live incoming
messages that are unread and not deleted by the caller.

`GET /conversations/{id}/messages` is oldest-first and cursor-paginated. For standard HTTP polling,
pass `?after=<messageId>` to receive messages created strictly after that id; omit both `after` and
`cursor` for the first page. `after` is resolved against the conversation, so an id from another
thread returns 404. Do not combine `after` and `cursor` (400). There are **no WebSockets** and no
real-time push in this phase.

Message bodies are plain text: HTML-like tags and control characters are stripped, whitespace is
trimmed, excessive blank lines are collapsed and the raw input is capped at 5000 characters.
Empty/sanitized-away bodies return 400. The sender is always the session user and the recipient is
derived from the conversation's other participant.

`POST /conversations/{id}/read` sets `readAt` on every live, unread message sent by the other
participant and returns `{ conversationId, markedRead, unreadCount }`. Messages the caller has
deleted are ignored. `DELETE /messages/{messageId}` creates a `MessageDeletion` for the caller:
the message disappears only from that user's reads/counts and the operation is idempotent. It does
not set the global `Message.deletedAt`, so the other participant still sees the message. Globally
deleted messages (moderation) are omitted for everyone.

Request examples:

```json
{ "participantId": "usr_456" }
```

```json
{ "body": "Hello, I would like to know more about your shop." }
```

```bash
curl 'http://localhost:3000/api/v1/conversations/con_123/messages?after=msg_123&limit=20'
curl -X POST http://localhost:3000/api/v1/conversations/con_123/read
curl -X DELETE http://localhost:3000/api/v1/messages/msg_123
```

## Offers and agreements

All endpoints below require an authenticated `OWNER` or `INVESTOR` session. The acting user is
always the session user; client-supplied `investorId`, `ownerId`, `proposedBy`, `status`,
`expiresAt`, calculated totals or loan state are rejected by strict Zod validation or ignored by
the service.

| Method | Path | Purpose |
|---|---|---|
| POST | `/api/v1/offers` | INVESTOR submits an offer on an OPEN/IN_DISCUSSION request |
| GET | `/api/v1/offers/received` | OWNER lists offers on their own requests |
| GET | `/api/v1/offers/submitted` | INVESTOR lists their own offers |
| GET | `/api/v1/offers/{offerId}` | Offer detail (either party only) |
| POST | `/api/v1/offers/{offerId}/withdraw` | Proposer withdraws a pending offer |
| POST | `/api/v1/offers/{offerId}/reject` | Counterparty rejects a pending offer |
| POST | `/api/v1/offers/{offerId}/counter` | Counterparty proposes a linked replacement offer |
| POST | `/api/v1/offers/{offerId}/accept` | Counterparty accepts and creates the loan/agreement |
| GET | `/api/v1/agreements/{agreementId}` | Agreement terms, parties and schedule preview |
| POST | `/api/v1/agreements/{agreementId}/confirm` | One party confirms; the second activates the loan |

Offer lists use `?cursor=&limit=` (default 20, max 50) and optionally `?loanRequestId=`. Unknown
query keys return 400. Responses are `{ data, meta }` for lists and `{ data }` otherwise.

Offer rules:

- Only an **APPROVED INVESTOR** can submit an offer, and never on their own request.
- The request must be `OPEN` or `IN_DISCUSSION`; the first pending offer moves `OPEN → IN_DISCUSSION`.
- One live `PENDING` offer per investor per request. An expired pending row is marked `EXPIRED`
  and replaced on the next offer attempt.
- Terms: positive whole-taka `amountBdt`, `interestRatePct` 0–100 with at most two decimals,
  `tenureDays` 1–3650, `repaymentFrequency` `WEEKLY|BIWEEKLY|MONTHLY`, and a sanitized plain-text
  `message` of at most 5000 characters.
- State machine: `PENDING → ACCEPTED | REJECTED | COUNTERED | WITHDRAWN | EXPIRED`. Only the
  proposer can withdraw; only the counterparty can reject, counter or accept. Any action on a
  non-pending or expired offer returns 409.
- A counter marks its parent `COUNTERED` and creates a new `PENDING` offer with `parentOfferId`
  set to the parent. `proposedBy` is derived from the session; the investor counterparty is
  inherited from the parent offer.
- Pending offers are reported as `EXPIRED` on read once seven days pass. `expireOffers()` is an
  exported cleanup function for a future cron job; no HTTP endpoint is exposed in this phase.

Accepting an offer runs in one `prisma.$transaction`: conditionally claim the pending offer as
`ACCEPTED`, reject sibling pending offers, create `Loan` (`PENDING_AGREEMENT`) and `Agreement`,
set the request `FUNDED`, and notify both parties. Conditional updates plus the existing unique
constraints on `Loan.loanRequestId`/`Loan.offerId` prevent duplicate loans from concurrent
acceptances.

Agreement rules:

- Only the loan's owner or investor can view or confirm. Each party may confirm once.
- The stored `termsSnapshot` is authoritative. `GET` returns both parties, confirmation
  timestamps and a schedule preview derived from the snapshot.
- The second confirmation atomically sets the loan `ACTIVE` with `startDate`, writes the
  `Repayment` rows, transitions the request `FUNDED → REPAYING`, creates two
  `AGREEMENT_CONFIRMED` notifications and one owner `MILESTONE` feed post.
- Flat interest: `totalRepayable = principal + round(principal × rate% × tenureDays / 365)` in
  whole taka. Installments use 7/14/30-day intervals; all but the last use the floor share and
  the last absorbs the rounding remainder.

Request examples:

```json
{
  "loanRequestId": "lr_123",
  "amountBdt": 50000,
  "interestRatePct": "14.50",
  "tenureDays": 90,
  "repaymentFrequency": "WEEKLY",
  "message": "I can fund this oven purchase."
}
```

```json
{
  "amountBdt": 48000,
  "interestRatePct": "13.00",
  "tenureDays": 90,
  "repaymentFrequency": "WEEKLY",
  "message": "Could we meet in the middle?"
}
```

```bash
curl 'http://localhost:3000/api/v1/offers/received?loanRequestId=lr_123&limit=20'
curl -X POST http://localhost:3000/api/v1/offers/off_123/accept
curl http://localhost:3000/api/v1/agreements/agr_123
curl -X POST http://localhost:3000/api/v1/agreements/agr_123/confirm
```

## Repayments and loan history

All endpoints below require an authenticated, role-`APPROVED` `OWNER` or `INVESTOR` session and
verify that the session user is a participant of the underlying loan. A non-participant receives
404 so loan existence is not leaked. The session supplies all actor identity; client-supplied
`status`, `payerId`, `confirmedById`, `amountBdt`, `dueDate` or repayment ids in bodies are
rejected or ignored.

| Method | Path | Purpose |
|---|---|---|
| GET | `/api/v1/repayments` | List the session user's repayments |
| GET | `/api/v1/repayments/{repaymentId}` | Repayment detail (either loan party only) |
| POST | `/api/v1/repayments/{repaymentId}/mark-paid` | Owner marks an installment paid |
| POST | `/api/v1/repayments/{repaymentId}/confirm` | Investor confirms receipt |
| GET | `/api/v1/loans/{loanId}` | Full loan schedule, history and progress |

Repayment lists use `?cursor=&limit=` (default 20, max 50) and optionally `?loanId=`. The
`loanId` filter is verified before the query runs; unknown query keys return 400. Lists return
`{ data, meta }`; all other Phase 8 endpoints return `{ data }`.

`POST /api/v1/repayments/{repaymentId}/mark-paid` accepts only:

```json
{
  "note": "Paid from this week's sales",
  "proofUrl": "/api/v1/files/private/2f8c1a54-6b7d-4c9e-9f31-0a2b3c4d5e6f.pdf"
}
```

`note` is optional plain text (HTML-like tags stripped, max 5000 characters). `proofUrl` is
optional and must be an internal private storage URL; arbitrary HTTP(S) URLs are rejected so
verification/payment documents are never served from untrusted hosts. `POST .../confirm` takes
no body at all.

Repayment rules:

- State machine: `UPCOMING → MARKED_PAID → CONFIRMED`, plus persisted/read-derived `OVERDUE`
  for a past-due installment that has **not** been marked paid. Marking accepts `UPCOMING` or
  `OVERDUE`; confirming accepts only `MARKED_PAID`. Duplicate or out-of-order actions return 409.
- Only the loan owner may mark paid; only that loan's investor may confirm. A different role on
  the same loan returns 403; a non-participant returns 404.
- Amounts and due dates come from the Phase 7 `Repayment` rows; they are never recomputed from
  request bodies. All BDT values remain whole-taka integers.
- Mark and confirm use conditional `updateMany` calls inside `prisma.$transaction`, so duplicate
  or concurrent requests cannot overwrite timestamps or emit duplicate state changes.
- The final confirmation atomically claims `Loan.status = ACTIVE` only when no repayment remains
  unconfirmed, then moves `LoanRequest REPAYING → COMPLETED`. Concurrent confirmations cannot
  complete or re-complete the loan twice.
- Notifications are written inside the same transaction (`REPAYMENT_MARKED_PAID` to the investor,
  `REPAYMENT_CONFIRMED` to the owner). Best-effort emails are sent **after** commit; SMTP failures
  are logged without sensitive details and never roll back repayment state.
- `GET /api/v1/loans/{loanId}` returns `schedule` (stored repayment rows with derived status),
  `history` (`SCHEDULED`, `OVERDUE`, `MARKED_PAID`, `CONFIRMED` events from server timestamps) and
  `progress` counts/totals. Party cards contain no email, phone, NID or verification documents.

Overdue handling and jobs:

- `pnpm job:overdue` persists past-due `UPCOMING` rows as `OVERDUE`. It never touches
  `MARKED_PAID` or `CONFIRMED` rows, so an overdue installment can still be marked paid normally.
- Reads derive overdue immediately, so the HTTP API is correct even if the cron job has not run.
- `pnpm job:reminders` sends notification + email reminders two days before the due date and once
  after overdue. Reminders target both the owner and investor.
- Reminder idempotency is database-backed: a deterministic `Notification.id` is claimed per
  `(kind, repayment, recipient)` and records `emailStatus: PENDING|SENT` in its `data`. Repeated
  cron runs skip `SENT` rows. If email delivery fails, the claim is deleted so a later run retries
  without duplicating a successful notification.

```bash
curl 'http://localhost:3000/api/v1/repayments?loanId=loan_123&limit=20'
curl http://localhost:3000/api/v1/repayments/rep_1
curl -X POST http://localhost:3000/api/v1/repayments/rep_1/mark-paid \
  -H 'content-type: application/json' \
  -d '{"note":"Paid from sales"}'
curl -X POST http://localhost:3000/api/v1/repayments/rep_1/confirm
curl http://localhost:3000/api/v1/loans/loan_123
```

## Reputation, notifications and dashboards

### Reviews and trust score

| Method | Path | Auth | Purpose |
|---|---|---|---|
| GET | `/api/v1/reviews?userId=&cursor=&limit=` | public | List reviews received by one user |
| GET | `/api/v1/reviews/{reviewId}` | public | One review detail |
| POST | `/api/v1/reviews` | `OWNER`/`INVESTOR` | Review the other participant of a completed loan |

`POST` accepts exactly:

```json
{
  "loanId": "loan_123",
  "revieweeId": "usr_456",
  "rating": 5,
  "comment": "Clear communication and on-time repayment."
}
```

`rating` is an integer 1–5 and `comment` is optional plain text (max 5000). The reviewer is
always the session user. The reviewee is **derived from the loan participants**; a mismatched
`revieweeId` returns 403, a non-participant gets 404 so loan existence is not leaked, and a loan
that is not `COMPLETED` returns 422. Each participant may review the other side once per loan;
duplicates (including concurrent ones) return 409. Review cards contain only safe public author
fields — no email, phone, NID or verification documents.

Trust score is a single server-side function (`src/server/services/trust-score.ts`) that writes
`BusinessProfile.trustScore` or `InvestorProfile.trustScore`:

- +25 when the user has an `APPROVED` verification for their role
- +5 per confirmed repayment whose `confirmedAt` is on or before `dueDate`, capped at +30
- +10 per `COMPLETED` loan, capped at +25
- +20 × average received rating / 5 (rounded), max +20
- −5 per overdue installment, capped at −25
- final value clamped to the integer range 0–100

It is recomputed in the same transaction as the triggering event: verification decisions,
repayment confirmation, overdue detection (`pnpm job:overdue`) and review creation. Clients can
never submit a trust score or counts.

### Reports and blocks

| Method | Path | Auth | Purpose |
|---|---|---|---|
| POST | `/api/v1/reports` | `OWNER`/`INVESTOR` | Report a user/post/comment/message |
| GET | `/api/v1/reports?status=&cursor=&limit=` | session | Own reports; `ADMIN` sees the queue |
| POST | `/api/v1/blocks` | `OWNER`/`INVESTOR` | Block a user |
| GET | `/api/v1/blocks?cursor=&limit=` | `OWNER`/`INVESTOR` | List users blocked by the actor |
| DELETE | `/api/v1/blocks/{userId}` | `OWNER`/`INVESTOR` | Remove the actor's own block |

Report body: `{ "targetType": "POST", "targetId": "post_123", "reason": "Misleading proof" }`.
`targetType` is one of `USER`, `POST`, `COMMENT`, `MESSAGE`; missing or soft-deleted targets return
404. One open report per reporter/target is allowed; a second returns 409. `status` is `OPEN`,
`RESOLVED` or `DISMISSED`. Reports are resolved only through the ADMIN endpoints in the
Administration section below.

Blocks are mutual for social features. In one transaction, blocking deletes follows and
connections in either direction. Conversations are retained but stay unreadable through the
existing messaging block guard. Blocked users are excluded from authenticated suggestions
(`/api/v1/suggestions/*`); public discovery has no session actor and is unchanged. Self-blocks and
duplicates return 409; a missing/inactive/admin target returns 404.

### Notifications

| Method | Path | Auth | Purpose |
|---|---|---|---|
| GET | `/api/v1/notifications?unread=&cursor=&limit=` | session | Own notification page |
| GET | `/api/v1/notifications/unread-count` | session | Badge count |
| PATCH | `/api/v1/notifications/{notificationId}/read` | session | Mark one read (idempotent) |
| PATCH | `/api/v1/notifications/read-all` | session | Mark all own unread read |

All reads and writes are scoped to `actor.id`; a notification belonging to another user is
indistinguishable from a missing one (404). `?unread=true` filters to `readAt = null`; any other
value than `true`/`false` is rejected. Cursor pagination defaults to 20 and caps at 50.

Notifications are already created for new/countered/accepted offers, agreement confirmations,
messages, connection requests/acceptance, verification results, repayment due/overdue/marked/
confirmed events, comments and likes. Important events (offers, agreements, repayments,
verification) also send email through the existing single `sendEmail` abstraction. There is no
review-specific `NotificationType`, so creating a review updates the reviewee's trust score but
does not emit a notification; notification deletion is also intentionally outside this phase's
contract.

### Dashboards

| Method | Path | Auth | Purpose |
|---|---|---|---|
| GET | `/api/v1/dashboard/owner` | `OWNER` | Active request, offers, current loan, next due, progress, trust |
| GET | `/api/v1/dashboard/investor` | `INVESTOR` | Offers, portfolio totals, progress, next due, per-loan health |

Both responses are `{ data }` and contain only server-derived metrics for the session user:
verification state, profile, trust score, recent notifications and activity counts
(connections/followers/following/posts/unread). The owner dashboard exposes the single active
`OPEN`/`IN_DISCUSSION`/`FUNDED`/`REPAYING` request, counts of received offers by status, and the
most recent non-completed loan with `nextDue` and `progressPct`. The investor dashboard exposes
submitted offer counts, active/completed loan counts, total lent/repaid/expected BDT, the overall
repayment progress, the earliest due installment and per-loan `health`
(`ON_TRACK`, `DUE_SOON`, `OVERDUE`, `COMPLETED`). No query parameters can change the target user
or any metric.

```bash
curl 'http://localhost:3000/api/v1/reviews?userId=usr_456&limit=20'
curl -X POST http://localhost:3000/api/v1/reviews \
  -H 'content-type: application/json' \
  -d '{"loanId":"loan_123","revieweeId":"usr_456","rating":5,"comment":"Great partner"}'
curl 'http://localhost:3000/api/v1/notifications?unread=true'
curl -X PATCH http://localhost:3000/api/v1/notifications/ntf_123/read
curl -X POST http://localhost:3000/api/v1/blocks \
  -H 'content-type: application/json' \
  -d '{"userId":"usr_789"}'
curl http://localhost:3000/api/v1/dashboard/owner
```

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

## Administration

All endpoints below require `requireRole("ADMIN")` at the route and `assertRole("ADMIN")` in the
service. `OWNER` and `INVESTOR` sessions receive `403 FORBIDDEN`; missing sessions receive
`401 UNAUTHORIZED`. Client-supplied roles, user IDs, report statuses and audit IDs are ignored.

| Method | Path | Purpose |
|---|---|---|
| GET | `/api/v1/admin/users?q=&status=&role=&cursor=&limit=` | Account directory; `q` searches name and email |
| GET | `/api/v1/admin/users/{userId}` | Account detail, verification history and open report count |
| POST | `/api/v1/admin/users/{userId}/suspend` | Suspend a non-admin account |
| POST | `/api/v1/admin/users/{userId}/reactivate` | Reactivate a suspended account |
| GET | `/api/v1/admin/reports?status=&targetType=&cursor=&limit=` | Full report queue |
| GET | `/api/v1/admin/reports/{reportId}` | Report plus a minimal target snapshot |
| POST | `/api/v1/admin/reports/{reportId}/resolve` | `OPEN → RESOLVED`, optional moderation action |
| POST | `/api/v1/admin/reports/{reportId}/dismiss` | `OPEN → DISMISSED` |
| GET | `/api/v1/admin/posts?includeDeleted=&cursor=&limit=` | Post queue |
| DELETE | `/api/v1/admin/posts/{postId}` | Soft-delete a post and its visible comments |
| GET | `/api/v1/admin/comments?postId=&includeDeleted=&cursor=&limit=` | Comment queue |
| DELETE | `/api/v1/admin/comments/{commentId}` | Soft-delete one comment |
| GET | `/api/v1/admin/stats` | Aggregated platform analytics |
| GET | `/api/v1/admin/users/{userId}/verification-history` | Every verification submission with its documents and decision (kept after resubmission) |
| DELETE | `/api/v1/admin/users/{userId}/sessions` | Sign a member out of every device (suspending does this too) |
| GET | `/api/v1/admin/audit-logs?category=&action=&actorId=&targetId=&cursor=&limit=` | Activity log: sign-ups, sign-ins, lending events and admin actions |
| GET | `/api/v1/admin/loan-requests?status=&q=&cursor=&limit=` | Every loan request, any status |
| POST | `/api/v1/admin/loan-requests/{id}/{action}` | `pause`, `resume` or `cancel` with a `reason`; the owner is notified |
| GET | `/api/v1/admin/loans?status=&cursor=&limit=` | Every loan with parties and repayment progress |
| GET | `/api/v1/admin/verifications/{id}` | Verification submission detail (listed above) |

`status`, `role`, `targetType` and the string boolean `includeDeleted` (`true`/`false` only) are
optional strict filters. Lists use `?cursor=&limit=` (default 20, max 50) and return
`{ data, meta }`. Unknown query keys and unknown body keys return `400 VALIDATION_ERROR`.

### Verification workflow

`GET /api/v1/admin/verifications?status=PENDING` remains the review queue, and
`GET /api/v1/admin/verifications/{id}` returns one submission with `userId`, `reviewerId`,
private document URLs, sales proofs and shop links. `POST /api/v1/admin/verifications/{id}`
accepts only:

```json
{ "status": "APPROVED", "reviewNote": "Documents checked" }
```

`status` must be `APPROVED` or `REJECTED`; a rejection requires a non-empty `reviewNote`. Only a
`PENDING` submission can be reviewed (otherwise `409`), and a client cannot set the reviewer or
timestamps. The decision, `VERIFICATION_RESULT` notification and trust-score recomputation remain
in the existing single transaction. Rejected users may resubmit, which resets the same row to
`PENDING` and clears reviewer fields.

### Report resolution and moderation

Resolve example:

```json
{
  "resolutionNote": "Prohibited content removed",
  "moderationAction": "REMOVE_CONTENT"
}
```

Dismiss example:

```json
{ "resolutionNote": "False report" }
```

- The resulting status comes from the endpoint: `resolve` always writes `RESOLVED`, `dismiss`
  always writes `DISMISSED`. A client-sent `status` is rejected by strict Zod validation.
- Only `OPEN` reports can be handled; a second action returns `409`. Both require a non-empty
  resolution note (max 5000 characters).
- `moderationAction` is optional and defaults to `NONE`. `REMOVE_CONTENT` is valid only for
  `POST` or `COMMENT` reports; `SUSPEND_USER` only for `USER` reports. Invalid combinations return
  `422 BUSINESS_RULE_VIOLATION`.
- Removing a post soft-deletes that post and its still-visible comments in one transaction;
  removing a comment soft-deletes only that comment. Rows are retained with `deletedAt` set.
- An admin cannot suspend themselves or another admin; suspending an already suspended user or
  removing already removed content returns `409`.
- Each handled report stores `handledById`, `resolutionNote`, `status` and `updatedAt`, giving an
  auditable record. Verification history uses `reviewerId`, `reviewNote` and `reviewedAt`.
- Direct suspension/reactivation uses the existing `User.status` field. Suspended actors are
  blocked by `requireSession()` → `assertActiveUser()` on protected API routes; existing
  public/discovery, profile, follow, connection and message services already exclude suspended
  targets. Reactivation restores access without deleting account or loan data.
- No business, loan, repayment, agreement or financial record is deleted by admin moderation.

### Analytics

`GET /api/v1/admin/stats` returns aggregate-only data: user totals by role and status;
verification totals by status; request, offer and loan totals by status; funded principal;
repayment counts with on-time rate; report counts including active disputes and handled reports;
and moderation counts (`suspendedUsers`, `removedPosts`, `removedComments`). All metrics use
batched `groupBy`/`aggregate`/`count` queries. No email, document URL or personal identifier is
returned.

Known limitations (no schema change was made): there is no dedicated audit table for suspension
actor/reason or content-removal actor, and the existing `NotificationType` enum has no
moderation/report/suspension value, so these admin actions emit no new notification or email.

## Data model

The relational model, ER diagram and schema decisions are documented in
[`docs/DATABASE.md`](./DATABASE.md). All implemented endpoints reuse that schema without Prisma
changes: `UserVerification` stores KYC state, `Verification` stores phone OTP challenges,
`Notification` stores verification and lending events, `BusinessProfile`, `InvestorProfile` and
`ProductImage` store profile data, `LoanRequest` stores requests, `Post` stores both
auto-generated and user-created feed entries, `Comment`, `Like`, `Follow` and `Connection`
store social interactions, `Conversation`, `Message` and `MessageDeletion` store threads and
per-user soft deletions, `Offer`, `Loan`, `Agreement` and `Repayment` store the lending flow and
repayment tracking, and `Review`, `Report` and `Block` store reputation and safety features. The
one-active-request rule is enforced by the partial unique index
`loan_request_one_active_per_owner`; the one-pending-offer rule uses
`offer_one_pending_per_investor_per_request`.

## Module status

Every module in the functional checklist is implemented above: registration/authentication,
verification and trust, owner and investor profiles, loan requests, feed and networking,
discovery, messaging, offers and agreements, repayment tracking, reputation, notifications,
dashboards and administration. Repayment schedule generation is shared by agreement confirmation
and the tracking endpoints. No payment gateway is integrated; repayments are recorded by the
owner and confirmed by the investor.
