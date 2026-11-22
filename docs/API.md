# SME Connect API contract

This is the contract the Next.js front end is built against. The Express server in
[`server/`](../server/) implements it as a working stand-in. A replacement backend that
matches this document will work with the front end without changes. If it differs,
the only frontend files to touch are:

- [`src/lib/api.ts`](../src/lib/api.ts): server-side fetchers used by pages
- [`src/lib/client-api.ts`](../src/lib/client-api.ts): browser-side calls (forms, buttons, chat)
- [`src/data/types.ts`](../src/data/types.ts): response shapes (the "API views" section)

Point the front end at another server with `API_URL=https://… npm run dev:web`.

## Conventions

| | |
| --- | --- |
| Base path | `/api` |
| Format | JSON request and response bodies. Every `POST` must send `Content-Type: application/json`, even with an empty body `{}` (anything else gets `415`). Numbers must be JSON numbers, not strings. |
| Auth | Session cookie `sme_session` (httpOnly, `SameSite=Lax`, `Secure` in production), set by signup/login. Every endpoint except `/auth/*` and `/health` requires it and returns `401` without it. |
| Timestamps | ISO 8601 strings in UTC, e.g. `2026-11-22T10:42:00.000Z`. |
| Money | Whole taka as integers (`150000` = ৳1,50,000). Rates are annual percentages (`10.5`). |
| Errors | `{ "error": "Human-readable message", "fields"?: { "fieldName": ["message", …] } }` |

Status codes: `400` validation or malformed URL/JSON, `401` not logged in, `403` logged in
but not allowed, `404` not found or not visible to you, `409` conflicts with the current
state (for example an offer that's already accepted), `413` body over 100 KB, `415` not
JSON, `429` rate limited (login and signup: 10 attempts per 15 minutes per email address).

Text fields are trimmed and have zero-width characters removed before length checks.

The front end displays `error`, and shows `fields[name][0]` under the matching input, so
field names must match the request body keys below.

## Types

Defined in [`src/data/types.ts`](../src/data/types.ts):

- `Person`: public profile (never includes email or phone). For investors, `offersMade` (offers not withdrawn) and `committed` (sum of accepted offers) are computed live.
- `SessionUser`: `Person` plus `email`, `phone?` and `businessId?`
- `Business`
- `LoanRequestView`: a loan request with its `business` and `owner` embedded
- `LoanOfferView`: an offer with `investor` and a summary of its `request` embedded
- `AgreementView`
- `ThreadView`: a conversation as the viewer sees it, with the `other` member and an `unread` count
- `MessageView`

## Auth

| Method | Path | Body | Response |
| --- | --- | --- | --- |
| POST | `/auth/signup` | `name`, `email`, `password` (8+ chars, a letter and a number), `role` (`business` or `investor`), `phone?`, `location?`, plus `businessName` (required for business) and `category?` | `201 { user: SessionUser }`, sets the cookie. `409` if the email exists. |
| POST | `/auth/login` | `email`, `password` | `{ user: SessionUser }`, sets the cookie. `401` with a generic message if wrong. |
| POST | `/auth/logout` | none | `204`. Invalidates the session server-side and clears the cookie. |
| GET | `/auth/me` | none | `{ user: SessionUser }` or `401` |

## Members and businesses

| Method | Path | Query | Response |
| --- | --- | --- | --- |
| GET | `/users` | `role?`, `q?` | `{ users: Person[] }` |
| GET | `/users/:id` | none | `{ user: Person, business: Business \| null }` |
| GET | `/businesses` | `q?`, `category?` | `{ businesses: Business[] }` |
| GET | `/businesses/:id` | none | `{ business: Business, owner: Person \| null }` |

## Loan requests

| Method | Path | Who | Notes |
| --- | --- | --- | --- |
| GET | `/loans` | any member | Query: `status?` (`open`, `offers_received`, `agreed`, `closed`, or `active` meaning open or offers_received), `businessId?`, `mine=1` (requests on my business), `q?`, `category?` (case-insensitive). Returns `{ loans: LoanRequestView[] }`, newest first. `offersCount` counts offers that aren't withdrawn. |
| POST | `/loans` | business owner | Body: `title` (5–120), `purpose`, `description` (20–2000), `amount` (≥10,000), `rate` (1–30), `tenureMonths` (3–36), `repaymentFrequency` (`Monthly`, `Bi-weekly` or `Weekly`), `highlights?` (≤5 strings). Max 3 active requests per business (`409`). Returns `201 { loan }`. |
| GET | `/loans/:id` | any member | `{ loan: LoanRequestView }` |
| POST | `/loans/:id/close` | owner | Closes the request and declines its live offers, posting a message to each investor. Returns `{ loan }`. |
| GET | `/loans/:id/offers` | any member | The owner gets every offer; anyone else gets only their own. `{ offers: LoanOfferView[] }` |
| GET | `/loans/:id/agreement` | owner, or the investor on the deal | `{ agreement: AgreementView }`. Uses the accepted offer (`status: "agreed"`), or else the most recently updated offer under negotiation (`status: "draft"`). Requests with only `pending` offers have no agreement yet (`404`), and neither does anyone who isn't a party to it. |

## Offers

| Method | Path | Who | Notes |
| --- | --- | --- | --- |
| POST | `/loans/:id/offers` | investor (not the owner) | Body: `amount` (≥10,000, ≤ 2× the ask), `rate`, `tenureMonths`, `frequency`, `note?` (≤1000). Request must be active, and only one active offer per investor per request (`409`). Sets the request to `offers_received`, opens or reuses the conversation with the owner, and posts an `offer` message. Returns `201 { offer, threadId }`. |
| GET | `/offers` | any member | `role=sent` (offers I made), `role=received` (offers on my requests), or both if omitted. `{ offers: LoanOfferView[] }` |
| GET | `/offers/:id` | the investor or the owner | `{ offer, loan: LoanRequestView, viewerSide: "owner" \| "investor" }`. `404` for anyone else. |
| POST | `/offers/:id/respond` | depends on the action | See below. Returns `{ offer, threadId }`. |

### Offer negotiation

```
            investor sends                owner counters
   ──────►  pending  ───────────────────►  negotiating  ◄──┐ owner counters again
              │  │                            │  │  │      │
   owner      │  │ owner declines             │  │  └──────┘
   accepts    │  └──────────► declined ◄──────┘  │
              ▼                                  │ investor accepts counter
           accepted ◄────────────────────────────┘ (offer takes the counter terms)
              ▲
   investor can withdraw from pending/negotiating ──► withdrawn
```

`respond` body: `{ "action": "accept" | "decline" | "counter" | "withdraw", ... }`

| Action | Allowed for | Extra fields | Effect |
| --- | --- | --- | --- |
| `accept` | the owner when it's their turn (`lastActionBy: investor`), accepting the investor's terms; or the investor when the owner's counter is the latest move, accepting the counter | none | Offer becomes `accepted`, the request becomes `agreed` (progress 100), and other live offers on that request become `declined`, each with a message to its investor. |
| `decline` | owner | `note?` | Offer becomes `declined`. The request goes back to `open` if no live offers remain. |
| `counter` | owner | `amount` (≤ 2× the ask), `rate`, `tenureMonths`, `note?` | Offer becomes `negotiating`; terms are stored in `offer.counter` and `lastActionBy` is `owner`. The owner can counter again, but can't `accept` until the investor replies. |
| `withdraw` | investor | none | Offer becomes `withdrawn`. The request goes back to `open` if no live offers remain. |

Only `pending` and `negotiating` offers on active requests can be changed (`409` otherwise).
Every action also posts a message to the two parties' conversation (`kind: "offer"` for
offers and counters, `kind: "system"` for accept, decline and withdraw).

`lastActionBy` tells the UI whose turn it is: `investor` means the owner should respond,
and `owner` means the investor should.

## Messages

Conversations are one-to-one. Reopening a conversation with the same member reuses it.

| Method | Path | Notes |
| --- | --- | --- |
| GET | `/threads` | `{ threads: ThreadView[], unread: number }`, most recently active first |
| GET | `/threads/unread-count` | `{ unread: number }`: messages from others newer than my last read, across all threads (header badge) |
| POST | `/threads` | Body: `participantId`, `subject?`, `text?` (optional first message). `201 { thread: ThreadView }` for a new conversation, `200` when an existing one is reused. |
| GET | `/threads/:id/messages` | `after?` (ISO timestamp) returns only newer messages, which the UI polls every 4 s. `{ thread, messages: MessageView[] }`, oldest first. `404` if you're not a participant. |
| POST | `/threads/:id/messages` | Body: `text` (1–4000). `201 { message }`. Also marks the thread read for the sender. |
| POST | `/threads/:id/read` | Marks everything in the thread as read for me. `204` |

## Health

`GET /health` returns `{ ok: true }` with no auth required.

## Not covered yet

Notifications, the admin verification queue, profile editing, file uploads and password
reset are still front-end mock data or not built, so they have no endpoints yet.
