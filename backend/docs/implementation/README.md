# Implementation reports — index

This directory records what was actually built in each phase of the SME Connect backend.
Reports are written from repository evidence: current source, tests, `docs/API.md`,
`docs/DATABASE.md`, OpenAPI registration and Git history. Chat summaries are **not** treated
as proof that a report exists.

> Before this index was created, **no phase reports existed** in the repository. The only
> design/contract documents were `docs/API.md` and `docs/DATABASE.md`.

## Status

| Phase | Report | Status | Primary history |
|---|---|---|---|
| 0 — Setup | [PHASE_00_SETUP.md](./PHASE_00_SETUP.md) | Implemented | `e3cca58` (backend init) |
| 1 — Data model | [PHASE_01_DATA_MODEL.md](./PHASE_01_DATA_MODEL.md) | Implemented | `74daca5` (db connect) |
| 2 — Auth, roles & verification | [PHASE_02_AUTH_ROLES_VERIFICATION.md](./PHASE_02_AUTH_ROLES_VERIFICATION.md) | Implemented | `c6aadae`, `460d046`, part of `072f2b5` |
| 3 — Profiles | [PHASE_03_PROFILES.md](./PHASE_03_PROFILES.md) | Implemented | part of `072f2b5` |
| 4 — Loan requests | [PHASE_04_LOAN_REQUESTS.md](./PHASE_04_LOAN_REQUESTS.md) | Implemented in working tree (uncommitted) | uncommitted changes on `nahid_dev` |
| 5 — Feed, networking & discovery | [PHASE_05_FEED_NETWORKING_DISCOVERY.md](./PHASE_05_FEED_NETWORKING_DISCOVERY.md) | Implemented in working tree (uncommitted) | uncommitted changes on `nahid_dev` |
| 6 — Messaging | [PHASE_06_MESSAGING.md](./PHASE_06_MESSAGING.md) | Implemented in working tree (uncommitted) | uncommitted changes on `nahid_dev` |
| 7 — Offers and agreements | [PHASE_07_OFFERS_AGREEMENTS.md](./PHASE_07_OFFERS_AGREEMENTS.md) | Implemented in working tree (uncommitted) | uncommitted changes on `nahid_dev` |
| 8+ — Repayments, reputation, admin | — | Not implemented | Planned in `BACKEND_PROMPT.md` |

Related reading:

- [API contract](../API.md) — endpoint-by-endpoint reference
- [Database design](../DATABASE.md) — schema, ER diagram, constraints, migration notes
- [User & business flows](../USER_FLOWS.md) — real API sequences, implemented vs planned

## Report conventions

Every phase report follows the same ten sections:

1. Phase objective
2. Implemented features
3. Files created and modified
4. Database models and migrations involved
5. API endpoints, methods, authentication and authorization
6. Business rules and state transitions
7. Validation and security measures
8. Tests and verification results
9. Known limitations or incomplete work
10. Dependencies on other phases

Anything that cannot be proven from the repository is explicitly labelled
**Not verifiable from repository** rather than guessed.

## Synchronisation checklist for future phases

When a phase is implemented:

- [ ] Create/update that phase's report here.
- [ ] Flip its status in the table above.
- [ ] Update [USER_FLOWS.md](../USER_FLOWS.md) when a workflow changes; keep planned
      endpoints in clearly marked placeholders, never as implemented behaviour.
- [ ] Update [API.md](../API.md) and the OpenAPI/Swagger registration (validators →
      `src/server/openapi/schemas.ts` → `src/server/openapi/routes/<module>.ts` →
      `routes/index.ts` → `openapi.test.ts`).
- [ ] Record the exact commands and results under "Tests and verification results".
- [ ] Record limitations, skipped work, and any migration decision.
