# SME Connect — user & business flows

This document describes the **actual API sequence** implemented in the backend so far.
It is written from the code, `docs/API.md` and the implementation reports in
[docs/implementation/](./implementation/README.md).

Legend:

- ✅ **Implemented** — endpoint exists and is documented in `docs/API.md` / OpenAPI.
- 🧭 **Planned** — described in `BACKEND_PROMPT.md` for a later phase; **not implemented**.
  No planned endpoint below should be treated as callable.

Scope: Phases 0–4 (setup, data model, auth/verification/storage, profiles, loan requests)
are implemented. Phases 5–11 are not.

> **Frontend status:** the repository's `frontend/` app talks to a stand-in mock API at
> `http://localhost:4000` (`frontend/src/lib/api.ts`), and no frontend code calls the backend
> auth endpoints. Therefore **no automatic redirect from signup to verification exists**.
> Navigation between steps is the frontend's responsibility and must be driven by API
> responses. This document does not claim any redirect that has not been implemented.

## At a glance: signup → email OTP → verification → login

```mermaid
flowchart TD
    A[User picks OWNER or INVESTOR] -->|POST /api/v1/auth/sign-up/email ✅| B[Account created, emailVerified=false, no session token]
    B --> C[Backend sends 6-digit OTP by email to Mailpit]
    C --> D[Frontend shows 'check your email' screen]
    D --> E[User reads OTP in Mailpit :8025]
    E -->|POST /api/v1/auth/email-otp/verify-email ✅| F[emailVerified=true + session cookie set]
    F --> G[POST /api/v1/auth/sign-in/email ✅ for returning users]
    G --> H[GET /api/v1/auth/get-session ✅]
    H --> I[Access protected APIs: /me, /verifications, /me/loan-requests ✅]
    F -.->|frontend decides; no redirect implemented| D
```

Canonical sequence:

**Sign up → Receive OTP by email → Verify OTP → Sign in → Access protected APIs**

Note: `/verify-email` itself sets a session cookie (`autoSignInAfterVerification: true`), so
a freshly verified user already has a valid session. Sign-in is still the normal entry path
for returning users, and is the step the frontend should perform when no session exists.

---

## A. Signup and email verification ✅

### Step 1 — Choose a role and submit signup

`POST /api/v1/auth/sign-up/email` (public; Better Auth native JSON, not `{ data }`).

```json
{
  "name": "Shamima Akter",
  "email": "owner@example.com",
  "password": "example-password",
  "signupRole": "OWNER"
}
```

- `signupRole` is **required** and accepts only `OWNER` or `INVESTOR`. `ADMIN` is rejected.
- Client-supplied `role`, `status` or `signupRole` cannot become the stored role/status: a
  request hook maps `signupRole` onto the server-owned `role` column and strips the others.
- Password must be 8–128 characters.
- Successful response contains **no session token** (`requireEmailVerification: true`):

```json
{
  "token": null,
  "user": {
    "id": "usr_123",
    "name": "Shamima Akter",
    "email": "owner@example.com",
    "emailVerified": false,
    "role": "OWNER",
    "status": "ACTIVE"
  }
}
```

### Step 2 — Backend sends the OTP email

Signup triggers an email automatically (`emailVerification.sendOnSignUp: true` plus the
email-OTP plugin override). The message subject is **"Verify your SME Connect email"** and
contains a six-digit code that expires in **5 minutes (300 seconds)**. Locally, email is
delivered to Mailpit: UI `http://localhost:8025`, SMTP `localhost:1025`.

The frontend must tell the user to check their email — the backend does not redirect anyone.

### Step 3 — User retrieves the OTP

The user copies the six digits from Mailpit. The OTP is never logged by the backend and is
stored hashed by Better Auth.

### Step 4 — Verify the OTP

`POST /api/v1/auth/email-otp/verify-email` (public).

```json
{ "email": "owner@example.com", "otp": "123456" }
```

Success (`emailVerified: true`, session cookie `better-auth.session_token` set):

```json
{
  "status": true,
  "token": "session-token-value",
  "user": { "id": "usr_123", "email": "owner@example.com", "emailVerified": true }
}
```

Clients should rely on the httpOnly cookie, not persist the returned token in JavaScript.

### OTP problems and resending

| Situation | Behaviour | What the client should do |
|---|---|---|
| Wrong code | Better Auth returns an "Invalid OTP" error; attempts are counted (max 3) | Ask the user to re-check, or request a new code |
| Too many wrong attempts | "Too many attempts" after 3 failures | Request a fresh code with the send endpoint |
| Expired code | "OTP expired" after 300 seconds | Request a fresh code |
| Need to resend | `POST /api/v1/auth/email-otp/send-verification-otp` with `{ "email": "owner@example.com", "type": "email-verification" }` → `{ "success": true }` | The new code rotates/invalidates the previous one; rate limit is 3 requests per 60 seconds |
| Sign-in before verification | Better Auth rejects with `FORBIDDEN` / `EMAIL_NOT_VERIFIED` | Complete step 4 first |

The send endpoint returns `{ "success": true }` even for an unknown email, so it does not
disclose whether an account exists.

### Signup/verification are separate operations

There is no single "signup and verify" call. The frontend owns the navigation:
`sign-up/email` → "check your email" screen → `email-otp/verify-email` → sign-in or
protected API calls, based on the responses above. Password reset is a separate OTP flow:
`POST /api/v1/auth/email-otp/request-password-reset` then
`POST /api/v1/auth/email-otp/reset-password`.

---

## B. Login and session workflow ✅

| Step | Endpoint | Notes |
|---|---|---|
| Sign in | `POST /api/v1/auth/sign-in/email` | `{ "email": "...", "password": "...", "rememberMe": true }` |
| Check session | `GET /api/v1/auth/get-session` | Returns `{ session, user }` or `null` |
| Sign out | `POST /api/v1/auth/sign-out` | Deletes the session and clears the cookie; returns `{ "success": true }` |
| Protected access | any `/api/v1/me*`, `/api/v1/verifications*`, `/api/v1/admin*`, `/api/v1/uploads*`, `/api/v1/phone-otp*`, `/api/v1/files/private/*` | Requires the session cookie |

- Sign-in sets the httpOnly cookie `better-auth.session_token`. Sessions last **7 days** and
  refresh after **1 day**; cookie caching is disabled so role/status are always fresh.
- `src/proxy.ts` is only an optimistic prefilter: it rejects a missing cookie with 401 before
  a route runs, but a **present cookie is not trusted**. Every protected route re-checks the
  real session and role/ownership.
- When a session expires or is signed out, `get-session` returns `null` and protected APIs
  return 401 `UNAUTHORIZED` (or the proxy's 401 before reaching the route). The user signs in
  again.
- `POST /api/v1/auth/update-user` can change only `name` and `image`; role/status changes are
  stripped server-side.

---

## C. User profile workflow ✅

### Current user

- `GET /api/v1/me` → `{ data: { user, profile, verification, unread } }`.
  `profile` is the OWNER's `BusinessProfile` or the INVESTOR's `InvestorProfile`, `null` if
  not created. `verification` is `{ type, status }` or `null`. ADMINs get null profile and
  verification.
- `PATCH /api/v1/me` → accepts only `name`, `image` and an optional role-appropriate
  `profile`. Account and profile writes happen in one transaction.

OWNER example:

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

INVESTOR example:

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

Server-controlled keys (`userId`, `ownerId`, `role`, `status`, `trustScore`, verification
fields) are rejected. A missing profile needs the full create payload; an existing profile
accepts partial updates. A duplicate `slug` returns 409. Phone changes are not made here —
use the phone OTP flow below.

### Images and public profile

1. `POST /api/v1/uploads` with multipart `purpose=AVATAR` or `PRODUCT_IMAGE` and the file.
   Response contains a public URL such as `/api/v1/files/public/<uuid>.jpg`.
2. Use that URL in `PATCH /api/v1/me` (`image`, `logoUrl`, `coverUrl`) or in
   `POST /api/v1/me/product-images` (OWNER only).
3. `PATCH` / `DELETE /api/v1/me/product-images/{id}` edit/remove product images. Positions
   are auto-appended when omitted; duplicate positions return 409.
4. `GET /api/v1/profiles/{userId}` is public and returns
   `{ data: { name, image, role, verified, profile } }`. It returns 404 for a missing,
   suspended or ADMIN user, or one without a profile. No email, phone, internal IDs,
   verification records or review notes are exposed.

Public lookup is by **userId**, not by slug. Active loan requests, repayment history and
reviews are **not** yet part of the public profile (Phases 4/9 scope).

---

## D. Verification workflow ✅

Three different things are called "verification" — keep them distinct:

| Concept | Stored in | Endpoint(s) | Effect |
|---|---|---|---|
| **Email verification** | `User.emailVerified` (Better Auth) | `/api/v1/auth/email-otp/*` | Allows sign-in; enables a session |
| **Phone verification** | `User.phone`, `User.phoneVerified`, `Verification` (OTP challenge) | `/api/v1/phone-otp/request`, `/verify` | Links a phone number to the account |
| **Identity/business verification (KYC)** | `UserVerification` | `/api/v1/verifications*`, `/api/v1/admin/verifications*` | Produces the Verified badge and gates lending actions |

### Phone OTP (optional, authenticated)

```json
// POST /api/v1/phone-otp/request
{ "phone": "01712345678" }
```
```json
// POST /api/v1/phone-otp/verify
{ "phone": "01712345678", "otp": "123456" }
```

Six digits, 5-minute expiry, 3 attempts, resend cooldown 60 seconds (429 with
`details.retryAfterSeconds`). Locally the OTP is emailed to the account address through
Mailpit, or delivery metadata is printed if `OTP_DELIVERY_PROVIDER=console`. The code is
HMAC-hashed and never logged.

### Identity/business verification (KYC)

```mermaid
flowchart LR
    A[Upload ID + sales proof via POST /api/v1/uploads purpose=ID_DOCUMENT/SALES_PROOF] --> B[POST /api/v1/verifications]
    B --> C[status=PENDING]
    C --> D[ADMIN: GET /api/v1/admin/verifications]
    D --> E[ADMIN: POST /api/v1/admin/verifications/{id}]
    E -->|APPROVED| F[Verified badge + gated actions unlocked]
    E -->|REJECTED + reviewNote| G[User may resubmit]
    G --> B
```

- Submission requires a session; the actor's role decides the type (OWNER/INVESTOR). A
  mismatched `type` or an ADMIN submission returns 403.
- Documents must be **internal private upload URLs** from `/api/v1/uploads`; external/public
  URLs are rejected. Owners need at least one sales proof; investors need only an ID document.
- `GET /api/v1/verifications/me` returns the own record or `data: null`.
- Admin review: `POST /api/v1/admin/verifications/{id}` with
  `{ "status": "APPROVED", "reviewNote": "Documents checked" }`. Rejection requires a note.
  The decision and a `VERIFICATION_RESULT` notification are written in one transaction.
- A pending or approved verification cannot be resubmitted (409); a rejected one is replaced
  and reset to `PENDING`.

**Actions that require APPROVED verification today:** publishing and resuming a loan request
(Phase 4). Verification submission itself is available to unverified users. Public profiles
and public loan requests show only a derived `verified: true` boolean — no documents, status
history or review notes.

---

## E. Loan request workflow ✅ (Phase 4)

### Prerequisites for OWNER actions

| Requirement | Applies to | Failure |
|---|---|---|
| Valid Better Auth session cookie (`better-auth.session_token`) and `OWNER` role | Every `/api/v1/me/loan-requests*` call | 401 (missing/expired session), 403 (INVESTOR/ADMIN) |
| **APPROVED** OWNER identity/business verification | `publish`, `resume` | 403 `FORBIDDEN` |
| Complete business profile (`shopName`, `slug`, `category`, `district`, `city`) | `publish`, `resume` | 422 `BUSINESS_RULE_VIOLATION` |
| No other request in OPEN / IN_DISCUSSION / FUNDED / REPAYING | `publish`, `resume` | 422 `BUSINESS_RULE_VIOLATION` |

A draft can be created and edited before verification. Verification submission and profile
setup are separate flows (sections D and C). The owner id is always taken from the session —
clients never send it. Public discovery needs **no** session.

```mermaid
flowchart TD
    A[OWNER: POST /api/v1/me/loan-requests] --> B[DRAFT]
    B -->|PATCH /{id}| B
    B -->|POST /{id}/publish| C[OPEN + feed post]
    B -->|POST /{id}/cancel| X[CANCELLED]
    C -->|GET /api/v1/loan-requests/{id}| P[Public detail]
    C -->|POST /{id}/pause| D[PAUSED + post hidden]
    C -->|POST /{id}/cancel| X
    D -->|PATCH /{id}| D
    D -->|POST /{id}/resume| C
    D -->|POST /{id}/cancel| X
    C -.->|first offer: Phase 7, not implemented| I[IN_DISCUSSION]
```

In the diagram, `/{id}` and its suffixes are shorthand for `/api/v1/me/loan-requests/{id}`;
full paths are used in the steps below.

1. **Create a draft** — `POST /api/v1/me/loan-requests` (OWNER session):

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

Success — `201 Created` with the full owner view (`status: "DRAFT"`, `publishedAt: null`).
`ownerId`, `status`, `publishedAt` and `trustScore` cannot be supplied and are never accepted
by the strict Zod input schema:

```json
{
  "data": {
    "id": "lr_123",
    "amountBdt": 50000,
    "purpose": "Buy a second oven",
    "fundUsage": "Expand weekend meal prep capacity",
    "tenureDays": 90,
    "repaymentFrequency": "WEEKLY",
    "proposedRatePct": "14.50",
    "proofUrls": [],
    "status": "DRAFT",
    "publishedAt": null,
    "createdAt": "2026-11-23T18:00:00.000Z",
    "updatedAt": "2026-11-23T18:00:00.000Z"
  }
}
```

2. **Edit** — `PATCH /api/v1/me/loan-requests/{id}` with any subset of the same fields.
   Success is `200 OK` with the same owner view. Only DRAFT and PAUSED requests are editable;
   any other status returns 409 `CONFLICT`.

3. **Publish** — `POST /api/v1/me/loan-requests/{id}/publish` (DRAFT → OPEN). Requires an
   APPROVED OWNER verification (403), a complete business profile and no other active
   request (422). Sets `publishedAt` and creates a `LOAN_REQUEST` feed post in one
   transaction. Success is `200 OK` with the same owner view, now `status: "OPEN"` and a
   non-null `publishedAt`. Typical failures use the standard error envelope:

```json
{
  "error": {
    "code": "BUSINESS_RULE_VIOLATION",
    "message": "You already have an active loan request",
    "details": { "field": "ownerId" }
  }
}
```

4. **Discover** — `GET /api/v1/loan-requests?limit=20&sort=newest&category=Food` (public):
   returns `200 OK` with OPEN requests only, e.g.:

```json
{
  "data": [{
    "id": "lr_123",
    "amountBdt": 50000,
    "purpose": "Buy a second oven",
    "fundUsage": "Expand weekend meal prep capacity",
    "tenureDays": 90,
    "repaymentFrequency": "WEEKLY",
    "proposedRatePct": "14.50",
    "publishedAt": "2026-11-23T18:30:00.000Z",
    "createdAt": "2026-11-23T18:00:00.000Z",
    "owner": {
      "name": "Nusrat Akter",
      "image": null,
      "shopName": "Nusrat's Home Kitchen",
      "slug": "nusrat-home-kitchen",
      "category": "Food",
      "district": "Dhaka",
      "city": "Dhanmondi",
      "logoUrl": null,
      "trustScore": 80,
      "verified": true
    }
  }],
  "meta": { "limit": 20, "nextCursor": null, "hasMore": false }
}
```

Filters: `category`, `district`, `minAmountBdt`, `maxAmountBdt`, `maxTenureDays`,
`frequency`, `sort` (`newest` | `amountAsc` | `amountDesc`); inverted amount ranges return
400. `GET /api/v1/loan-requests/{id}` returns `200 OK` with one public item above, or 404
for a missing/non-OPEN request. Public responses never include `ownerId`, proof URLs,
`status`, email/phone or internal IDs.

5. **Pause / resume / cancel** — all are `POST` with no body:
   - `POST /api/v1/me/loan-requests/{id}/pause` — OPEN or IN_DISCUSSION → PAUSED.
   - `POST /api/v1/me/loan-requests/{id}/resume` — PAUSED → OPEN, re-checks verification,
     profile and the one-active rule.
   - `POST /api/v1/me/loan-requests/{id}/cancel` — DRAFT / OPEN / IN_DISCUSSION / PAUSED →
     CANCELLED (terminal).

   Each returns `200 OK` with the updated owner view, or 409 `CONFLICT` for a wrong source
   state. Pause/cancel soft-delete the feed post via `deletedAt`; resume recreates it.

6. **One active request** — at most one of OPEN, IN_DISCUSSION, FUNDED or REPAYING per owner.
   Enforced in the service and by the existing DB partial unique index; a concurrent
   publish that loses the race returns 422.

7. **Track your own requests** — `GET /api/v1/me/loan-requests?status=OPEN&limit=20`
   returns the authenticated owner's requests in every status (optional `status` filter,
   standard cursor pagination) using the same owner view and `meta`.

No offer, agreement, loan or repayment is created in this phase, and no funding amount is
calculated or promised.

---

## F. Planned workflows — placeholders only 🧭

These are **not implemented**. Endpoint names below are taken from `BACKEND_PROMPT.md` as
planning hints and may change when the phase is built.

| Phase | Planned workflow | Status |
|---|---|---|
| 5 | Posts/likes/comments/follows, `GET /api/v1/feed`, business/investor search and suggestions | 🧭 Not implemented |
| 6 | Conversations, messages, read/delete, connection-gated messaging | 🧭 Not implemented |
| 7 | Offers, counters, accept/reject/withdraw, agreement confirmation, `OPEN → IN_DISCUSSION → FUNDED → REPAYING` | 🧭 Not implemented |
| 8 | Repayment schedule, mark paid / investor confirm, overdue detection, completion | 🧭 Not implemented |
| 9 | Reviews, trust score, notifications, dashboards (`/api/v1/dashboard/owner`, `/investor`) | 🧭 Not implemented |
| 10 | Admin moderation, reports, `GET /api/v1/admin/stats` | 🧭 Not implemented |
| 11 | Seed dataset, full API docs, hardening, "Going live" guide | 🧭 Not implemented |

---

## G. Cross-cutting conventions

- Base path `/api/v1`. Success responses: `{ "data": ..., "meta": ... }`; errors:
  `{ "error": { "code", "message", "details?" } }`. **Exception:** `/api/v1/auth/*` keeps
  Better Auth's native JSON.
- Cursor pagination: `?cursor=&limit=`, default 20, max 50; `meta` carries `limit`,
  `nextCursor`, `hasMore`.
- Dates are ISO 8601 UTC in responses; the frontend formats to Asia/Dhaka.
- Money is an integer number of whole taka in `...Bdt` fields; rates are `Decimal(5,2)`
  strings such as `"14.50"`.
- Status codes: 200/201 success, 400 validation, 401 unauthenticated, 403 forbidden,
  404 not found, 409 invalid state/conflict, 422 business rule, 429 rate limited,
  500 internal, 503 dependency unavailable.
- Interactive reference: Swagger UI `/docs`, OpenAPI JSON `/api/docs` (enabled in dev by
  default; production requires `API_DOCS_ENABLED=true`).

When a workflow changes in a future phase, update this file, the phase report,
`docs/API.md` and the OpenAPI registration in the same change.
