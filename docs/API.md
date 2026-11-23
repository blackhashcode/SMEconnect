# SME Connect — Canonical API Contract (`/api/v1`)

This document is the single source of truth between [`frontend/`](../frontend/) and [`backend/`](../backend/) (as well as the local stand-in [`frontend/mock-api/`](../frontend/mock-api/)).

Point the frontend at either server using `API_URL`:
- Local stand-in (no Docker): `API_URL=http://localhost:4000` (default)
- Production backend (PostgreSQL + Better Auth): `API_URL=http://localhost:4001`

---

## 1. Conventions

| Convention | Standard |
| --- | --- |
| **Base path** | `/api/v1` (Better Auth endpoints mounted at `/api/auth/*` in `backend/`) |
| **Success envelope** | `{ "data": <payload>, "meta"?: { "nextCursor"?: string \| null, "unread"?: number, ... } }` |
| **Error envelope** | `{ "error": { "code": "<ERROR_CODE>", "message": "<human message>", "details"?: { "fieldErrors"?: Record<string, string[]> } } }` |
| **Pagination** | Cursor-based (`?cursor=&limit=`), default `limit=20`, max `limit=50` |
| **Timestamps** | ISO 8601 UTC (`2026-11-22T18:00:00.000Z`). Frontend formats for `Asia/Dhaka`. |
| **Money** | Whole BDT integers (`150000` = ৳1,50,000), never floats. |
| **Interest math** | Simple flat interest: `totalRepayableBdt = principalBdt + round(principalBdt * rate% * (tenureDays / 365))`. Final installment absorbs rounding remainder so installments sum exactly to `totalRepayableBdt`. |
| **Content-Type & CSRF** | All `POST`/`PUT`/`PATCH`/`DELETE` requests must send `Content-Type: application/json` (even `{}`), paired with `httpOnly`, `SameSite=Lax` cookies (`Secure` in production). |

### Error Codes & HTTP Statuses

| HTTP | Code | Meaning |
| --- | --- | --- |
| `400` | `VALIDATION_ERROR` | Schema validation or malformed JSON/cursor |
| `401` | `UNAUTHORIZED` | Missing, expired, or invalid session |
| `403` | `FORBIDDEN` | Insufficient role, ownership violation, or unverified account |
| `404` | `NOT_FOUND` | Resource missing or not visible to caller |
| `409` | `CONFLICT` | Invalid state transition or uniqueness conflict (e.g., duplicate email, active loan limit) |
| `415` | `UNSUPPORTED_MEDIA_TYPE` | Non-JSON write body |
| `422` | `BUSINESS_RULE_VIOLATION` | Domain constraint violated (e.g., offer > 2× ask, missing rejection note) |
| `429` | `RATE_LIMITED` | Rate limit exceeded (`Retry-After` header included) |
| `503` | `DATABASE_UNAVAILABLE` | Database health check failed |

---

## 2. Domain Rules (State Machines)

- **Verification:** `PENDING → APPROVED | REJECTED` (admin only). Only `APPROVED` owners can publish loan requests; only `APPROVED` investors can send offers.
- **LoanRequest:** `DRAFT → OPEN → IN_DISCUSSION → FUNDED → REPAYING → COMPLETED` (plus `PAUSED` and `CANCELLED`). An owner may have **at most 1 active request** at a time.
- **Offer:** `PENDING → ACCEPTED | REJECTED | COUNTERED | WITHDRAWN | EXPIRED` (7-day TTL). Countering creates a linked offer (`parentOfferId`). Accepting runs in a single database transaction: accepts chosen offer, rejects competing offers, moves request to `FUNDED`, and creates `Loan` + `Agreement`.
- **Agreement:** Dual confirmation (`ownerConfirmedAt` + `investorConfirmedAt`) generates exact `Repayment` rows, activates `Loan`, and sets request to `REPAYING`.
- **Repayment:** `UPCOMING → MARKED_PAID` (owner) `→ CONFIRMED` (investor); `OVERDUE` if past due. All confirmed → loan `COMPLETED` + trust score recomputed.
- **Connections & Messaging:** `PENDING → ACCEPTED | DECLINED`. Production backend gates messaging on an `ACCEPTED` connection or existing offer.

---

## 3. Endpoints

### System & Auth
| Method | Path | Auth | Description |
| --- | --- | --- | --- |
| `GET` | `/api/v1/health` | Public | API + database health check |
| `ALL` | `/api/auth/*` | Public/Session | Better Auth handler (`backend/`) |
| `POST` | `/api/v1/auth/signup` | Public | Sign up (`mock-api` stand-in) |
| `POST` | `/api/v1/auth/login` | Public | Log in (`mock-api` stand-in) |
| `POST` | `/api/v1/auth/logout` | Session | Revoke session & clear cookie |
| `GET` | `/api/v1/auth/me` | Session | Current session user |
| `GET` | `/api/v1/me` | Session | Full profile + verification + unread count (`backend/`) |

### Directory & Profiles
| Method | Path | Auth | Description |
| --- | --- | --- | --- |
| `GET` | `/api/v1/businesses` | Session | Search/filter businesses (`q`, `category`, `location`, `verified`, `cursor`, `limit`) |
| `GET` | `/api/v1/businesses/:id` | Session | Business detail (by ID or slug) |
| `GET` | `/api/v1/investors` | Session | Search/filter investors |
| `GET` | `/api/v1/investors/:id` | Session | Investor detail |
| `GET` | `/api/v1/users` / `/users/:id` | Session | Member directory (`mock-api`) |

### Verification & Admin
| Method | Path | Auth | Description |
| --- | --- | --- | --- |
| `GET` | `/api/v1/verifications` | Session | View own latest verification submission |
| `POST` | `/api/v1/verifications` | Owner/Investor | Submit KYC & trade licence documents |
| `GET` | `/api/v1/admin/verifications` | Admin | List verification queue (`status`, `limit`) |
| `POST` | `/api/v1/admin/verifications/:id/review` | Admin | Approve or reject with audit note |
| `GET` | `/api/v1/admin/stats` | Admin | Platform analytics & repayment rates |

### Loans, Offers, Agreements & Repayments
| Method | Path | Auth | Description |
| --- | --- | --- | --- |
| `GET` | `/api/v1/loans` | Session | List/filter loan requests (`status`, `businessId`, `mine`, `category`, `q`, `cursor`, `limit`) |
| `POST` | `/api/v1/loans` | Verified Owner | Create/publish loan request (max 1 active) |
| `GET` | `/api/v1/loans/:id` | Session | Loan request details |
| `POST` | `/api/v1/loans/:id/status` | Owner/Admin | Transition status (`OPEN`, `PAUSED`, `CANCELLED`) |
| `POST` | `/api/v1/loans/:id/offers` | Verified Investor | Submit offer (≤ 2× ask, max 1 active per request) |
| `GET` | `/api/v1/offers` | Session | List offers (`role=sent\|received`) |
| `GET` | `/api/v1/offers/:id` | Party/Admin | View offer + negotiation state |
| `POST` | `/api/v1/offers/:id/respond` | Party | `ACCEPT`, `REJECT`, `COUNTER`, or `WITHDRAW` |
| `GET` | `/api/v1/loans/:id/agreement` | Party/Admin | Agreement terms snapshot + repayment schedule |
| `POST` | `/api/v1/loans/:id/agreement/confirm` | Party | Confirm agreement (activates schedule once both confirm) |
| `GET` | `/api/v1/loans/:id/repayments` | Party/Admin | List repayment installments |
| `POST` | `/api/v1/repayments/:id/mark-paid` | Owner | Mark installment paid |
| `POST` | `/api/v1/repayments/:id/confirm` | Investor | Confirm receipt (completes loan when all confirmed) |

### Connections, Messaging, Notifications & Dashboards
| Method | Path | Auth | Description |
| --- | --- | --- | --- |
| `GET` / `POST` | `/api/v1/connections` | Session | List or create connections |
| `POST` | `/api/v1/connections/:id/respond` | Recipient | Accept or decline connection |
| `DELETE` | `/api/v1/connections/:participantId` | Session | Remove connection |
| `GET` / `POST` | `/api/v1/threads` | Session | List or open 1:1 conversations |
| `GET` | `/api/v1/threads/unread-count` | Session | Unread message count |
| `GET` / `POST` | `/api/v1/threads/:id/messages` | Participant | Fetch (`?after=`) or send messages |
| `POST` | `/api/v1/threads/:id/read` | Participant | Mark thread read |
| `GET` | `/api/v1/notifications` | Session | List notifications (`cursor`, `limit`) |
| `POST` | `/api/v1/notifications/:id/read` | Session | Mark one notification read |
| `POST` | `/api/v1/notifications/read-all` | Session | Mark all notifications read |
| `GET` | `/api/v1/dashboard/owner` | Owner | Aggregated owner dashboard |
| `GET` | `/api/v1/dashboard/investor` | Investor | Aggregated investor portfolio dashboard |
