# Phase 3 — Profiles

**Status:** Implemented. Primary history: profile-related part of `072f2b5`
(`feat: complete auth, verification, storage and profile APIs`).
**Source of truth:** `src/server/services/profile.ts`, `docs/API.md`,
`src/server/validators/profile.ts`, `src/server/openapi/routes/profiles.ts`,
`git show --stat 072f2b5`.

## 1. Phase objective

Give each role its own profile: an OWNER business profile with logo/cover and product
images, and an INVESTOR profile with lending preferences. Expose a current-user endpoint
(`/me`), owner-only product-image management, and a sanitized public profile. No frontend
work is in scope.

## 2. Implemented features

- `GET /api/v1/me` — account, role-specific profile, own verification state and unread
  counts in one response.
- `PATCH /api/v1/me` — account fields plus create/update of the role-specific profile in a
  single transaction; the profile schema is selected from the session role.
- OWNER product images — create, edit and delete with owner-only ownership checks;
  positions are auto-appended when omitted.
- `GET /api/v1/profiles/{userId}` — public, sanitized OWNER or INVESTOR profile with a
  derived `verified` boolean.
- Strict Zod profile validators, including BDT ranges, category arrays, rate ranges and
  public-only image URLs.
- OpenAPI registration for all profile paths and schemas.

## 3. Files created and modified

Created/modified for profiles in `072f2b5`:

- `src/app/api/v1/me/route.ts`
- `src/app/api/v1/me/product-images/route.ts`
- `src/app/api/v1/me/product-images/[id]/route.ts`
- `src/app/api/v1/profiles/[userId]/route.ts`
- `src/server/services/profile.ts`, `src/server/services/profile.test.ts`
- `src/server/validators/profile.ts`, `src/server/validators/profile.test.ts`
- `src/server/validators/user.ts` (updated)
- `src/server/openapi/routes/profiles.ts`, `src/server/openapi/routes/index.ts`,
  `src/server/openapi/schemas.ts`, `src/server/openapi/openapi.test.ts`
- `docs/API.md` (updated)

Thin route handlers call the service; no business logic or Prisma queries live in routes.

## 4. Database models and migrations involved

- `BusinessProfile` (1:1 with `User` via `ownerId`, unique `slug`) and its `ProductImage`
  children.
- `InvestorProfile` (1:1 with `User` via `userId`).
- `UserVerification` is only read (to derive `verified` and to populate `/me`); it is not
  written by profile endpoints.
- `Notification`/message counts are read for the `unread` object in `GET /me`.
- No Prisma schema change and no new migration in Phase 3.

## 5. API endpoints, methods, authentication and authorization

| Method | Path | Authentication | Authorization |
|---|---|---|---|
| GET | `/api/v1/me` | Session cookie | Own data only; ADMIN gets `profile: null`, `verification: null` |
| PATCH | `/api/v1/me` | Session cookie | Own data only; only `name`, `image`, optional `profile`; ADMIN cannot send `profile` (403) |
| POST | `/api/v1/me/product-images` | Session cookie | OWNER only; image attaches to the session owner's profile |
| PATCH | `/api/v1/me/product-images/{id}` | Session cookie | OWNER and owner of the image's profile |
| DELETE | `/api/v1/me/product-images/{id}` | Session cookie | OWNER and owner of the image's profile |
| GET | `/api/v1/profiles/{userId}` | None (public) | 404 if user missing, suspended, ADMIN or has no profile |

`/api/v1/me*` is behind the optimistic proxy prefilter; public profiles are not.
Session identity is always taken from the Better Auth session, never from a client-supplied
`userId` or `ownerId`.

## 6. Business rules and state transitions

- A missing profile requires the full create payload; an existing profile accepts partial
  updates. Range invariants (e.g. min ≤ max) are re-checked after merging with stored values.
- Duplicate `slug` returns 409 `CONFLICT`.
- Account and profile writes are wrapped in one `prisma.$transaction`.
- Phone numbers cannot be changed here; they go through the Phase 2 phone OTP flow.
- Image fields accept HTTP(S) URLs or internal public upload URLs
  (`/api/v1/files/public/...`); private verification URLs are rejected.
- Product image `position` is auto-appended when omitted; duplicate positions return 409.
- Public profiles expose only safe fields and a derived `verified: boolean`; no email,
  phone, internal IDs, verification records, review notes or reviewer IDs.

No state machines were introduced in this phase.

## 7. Validation and security measures

- Strict Zod objects everywhere; `userId`, `role`, `status`, `trustScore`, `ownerId`,
  verification fields and client-computed amounts are rejected.
- The profile schema is chosen by session role: OWNER fields sent by an INVESTOR (or vice
  versa) return 400.
- Ownership is resolved from the session user id; product images are checked against the
  owner's profile before mutation.
- Public responses are explicit allow-lists, never raw Prisma rows.
- Images must be public URLs; private document URLs cannot leak through a profile.

## 8. Tests and verification results

- Tests added: `src/server/services/profile.test.ts` (587 lines at the commit),
  `src/server/validators/profile.test.ts`.
- OpenAPI contract test extended with the profile paths.
- **Current** repository-wide verification passes: `pnpm lint`, `pnpm typecheck`,
  `pnpm test` (271 tests / 24 files), `pnpm build`, `git diff --check`.
- **Not verifiable from repository:** per-phase command output at the end of Phase 3.

## 9. Known limitations or incomplete work

- Public profile lookup is by **`userId`**, not by slug, even though `BACKEND_PROMPT.md`
  Phase 3 mentioned a slug-based public profile. The implemented contract is documented in
  `docs/API.md` and is the one clients should use.
- Public profiles do **not** yet include an active loan request, repayment track record or
  reviews; those depend on Phases 4 and 9 and are not claimed here.
- Trust score is stored and exposed as a number but there is no recomputation function yet
  (Phase 9).
- No profile image cropping, cover handling beyond URL storage, or frontend implementation.

## 10. Dependencies on other phases

- Depends on Phase 1 profile models, Phase 2 session/role guards and the storage/upload
  endpoints for public image URLs.
- Phase 4 reads `BusinessProfile` for the publish prerequisite and embeds a mini-profile in
  public loan-request responses.
- Phase 9 will add reviews and a trust-score function to public profiles.
