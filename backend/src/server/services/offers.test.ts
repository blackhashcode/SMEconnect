import { describe, expect, it, vi } from "vitest";
import { ZodError } from "zod";

vi.mock("@/server/db", () => ({ prisma: {} }));

import {
  BusinessRuleError,
  ConflictError,
  ForbiddenError,
  NotFoundError,
} from "@/server/errors";
import {
  acceptOffer,
  counterOffer,
  createOffer,
  expireOffers,
  getOffer,
  listReceivedOffers,
  listSubmittedOffers,
  rejectOffer,
  withdrawOffer,
} from "@/server/services/offers";

type Row = Record<string, unknown>;

interface FakeDb {
  offer: {
    findUnique: (args: { where: Row; include?: Row }) => Promise<Row | null>;
    findMany: (args: {
      where: Row;
      include?: Row;
      select?: Row;
      orderBy?: Row[];
      take?: number;
      cursor?: Row;
      skip?: number;
    }) => Promise<Row[]>;
    create: (args: { data: Row }) => Promise<Row>;
    updateMany: (args: { where: Row; data: Row }) => Promise<{ count: number }>;
  };
  loanRequest: {
    findUnique: (args: { where: Row }) => Promise<Row | null>;
    updateMany: (args: { where: Row; data: Row }) => Promise<{ count: number }>;
  };
  loan: {
    findUnique: (args: { where: Row }) => Promise<Row | null>;
    create: (args: { data: Row }) => Promise<Row>;
  };
  agreement: { create: (args: { data: Row }) => Promise<Row> };
  notification: { create: (args: { data: Row }) => Promise<Row> };
  user: { findMany: (args: { where: Row; select?: Row }) => Promise<Row[]> };
  userVerification: {
    findFirst: (args: { where: Row }) => Promise<Row | null>;
    findMany: (args: { where: Row }) => Promise<Row[]>;
  };
  $transaction: (callback: (tx: FakeDb) => Promise<unknown>) => Promise<unknown>;
}

const NOW = new Date("2026-11-23T18:00:00.000Z");
const DAY = 24 * 60 * 60 * 1000;
const owner = { id: "usr_owner", role: "OWNER" as const };
const investor = { id: "usr_investor", role: "INVESTOR" as const };
const otherInvestor = { id: "usr_investor_2", role: "INVESTOR" as const };
const admin = { id: "usr_admin", role: "ADMIN" as const };

const USERS: Record<string, Row> = {
  usr_owner: {
    id: "usr_owner",
    name: "Nusrat Akter",
    image: null,
    role: "OWNER",
    status: "ACTIVE",
    businessProfile: {
      shopName: "Nusrat's Home Kitchen",
      slug: "nusrat-home-kitchen",
      category: "Food",
    },
    investorProfile: null,
  },
  usr_investor: {
    id: "usr_investor",
    name: "Tanvir Ahmed",
    image: null,
    role: "INVESTOR",
    status: "ACTIVE",
    businessProfile: null,
    investorProfile: { bio: "Angel investor" },
  },
  usr_investor_2: {
    id: "usr_investor_2",
    name: "Rahim Uddin",
    image: null,
    role: "INVESTOR",
    status: "ACTIVE",
    businessProfile: null,
    investorProfile: { bio: "Angel investor" },
  },
};

const terms = {
  amountBdt: 50_000,
  interestRatePct: "14.50",
  tenureDays: 90,
  repaymentFrequency: "WEEKLY" as const,
};

function matches(row: Row, where: Row): boolean {
  for (const [key, expected] of Object.entries(where)) {
    const actual = row[key];
    if (key === "loanRequest" && expected && typeof expected === "object") {
      if (!matches((row.loanRequest as Row | undefined) ?? {}, expected as Row)) return false;
      continue;
    }
    if (expected && typeof expected === "object" && !Array.isArray(expected)) {
      const rule = expected as Row;
      if ("in" in rule && Array.isArray(rule.in) && !rule.in.includes(actual)) return false;
      if ("not" in rule && actual === rule.not) return false;
      if ("gt" in rule && !(Number(actual) > Number(rule.gt))) return false;
      if ("gte" in rule && !(Number(actual) >= Number(rule.gte))) return false;
      if ("lte" in rule && !(Number(actual) <= Number(rule.lte))) return false;
      if ("equals" in rule && actual !== rule.equals) return false;
      continue;
    }
    if (actual !== expected) return false;
  }
  return true;
}

function sortRows(rows: Row[], orderBy: Row[] = []): Row[] {
  return [...rows].sort((a, b) => {
    for (const rule of orderBy) {
      const [field, direction] = Object.entries(rule)[0];
      const left = a[field];
      const right = b[field];
      if (left === right) continue;
      if (left === null || left === undefined) return 1;
      if (right === null || right === undefined) return -1;
      const result = String(left).localeCompare(String(right), undefined, { numeric: true });
      return direction === "desc" ? -result : result;
    }
    return 0;
  });
}

function createFakeDb() {
  const offers: Row[] = [];
  const requests: Row[] = [];
  const loans: Row[] = [];
  const agreements: Row[] = [];
  const notifications: Row[] = [];
  const verifications: Row[] = [
    { userId: owner.id, type: "OWNER", status: "APPROVED" },
    { userId: investor.id, type: "INVESTOR", status: "APPROVED" },
    { userId: otherInvestor.id, type: "INVESTOR", status: "APPROVED" },
  ];
  let loanSeq = 0;
  let agreementSeq = 0;
  let notificationSeq = 0;

  const withRelations = (row: Row): Row => ({
    ...row,
    loanRequest: requests.find((request) => request.id === row.loanRequestId) ?? null,
    investor: USERS[String(row.investorId)] ?? null,
  });

  const db: FakeDb = {
    offer: {
      findUnique: async ({ where }) => {
        const row = offers.find((item) => matches(item, where));
        return row ? withRelations(row) : null;
      },
      findMany: async ({ where, select, orderBy, take, cursor, skip }) => {
        let rows = offers.filter((item) => matches(withRelations(item), where));
        rows = sortRows(rows, orderBy);
        if (cursor?.id) {
          const index = rows.findIndex((row) => row.id === cursor.id);
          rows = index >= 0 ? rows.slice(index + (skip ?? 0)) : rows;
        }
        if (take !== undefined) rows = rows.slice(0, take);
        return rows.map((row) => {
          const enriched = withRelations(row);
          if (!select) return enriched;
          return Object.fromEntries(
            Object.keys(select).map((key) => [key, enriched[key]]),
          );
        });
      },
      create: async ({ data }) => {
        const row: Row = {
          id: `off_${offers.length + 1}`,
          createdAt: NOW,
          updatedAt: NOW,
          ...data,
        };
        offers.push(row);
        return row;
      },
      updateMany: async ({ where, data }) => {
        let count = 0;
        for (const row of offers) {
          if (matches(withRelations(row), where)) {
            Object.assign(row, data);
            count++;
          }
        }
        return { count };
      },
    },
    loanRequest: {
      findUnique: async ({ where }) =>
        requests.find((row) => matches(row, where)) ?? null,
      updateMany: async ({ where, data }) => {
        let count = 0;
        for (const row of requests) {
          if (matches(row, where)) {
            Object.assign(row, data);
            count++;
          }
        }
        return { count };
      },
    },
    loan: {
      findUnique: async ({ where }) => loans.find((row) => matches(row, where)) ?? null,
      create: async ({ data }) => {
        const row: Row = { id: `loan_${++loanSeq}`, ...data };
        loans.push(row);
        return row;
      },
    },
    agreement: {
      create: async ({ data }) => {
        const row: Row = { id: `agr_${++agreementSeq}`, ...data };
        agreements.push(row);
        return row;
      },
    },
    notification: {
      create: async ({ data }) => {
        const row: Row = { id: `ntf_${++notificationSeq}`, ...data };
        notifications.push(row);
        return row;
      },
    },
    user: {
      findMany: async ({ where }) => {
        const ids = (where.id as Row).in as string[];
        return ids.map((id) => USERS[id]).filter(Boolean);
      },
    },
    userVerification: {
      findFirst: async ({ where }) =>
        verifications.find((row) => matches(row, where)) ?? null,
      findMany: async ({ where }) => verifications.filter((row) => matches(row, where)),
    },
    $transaction: async (callback) => callback(db),
  };

  return { db, offers, requests, loans, agreements, notifications, verifications };
}

type State = ReturnType<typeof createFakeDb>;

function deps(state: State) {
  return { db: state.db as never, now: () => NOW };
}

function seedRequest(state: State, overrides: Row = {}): Row {
  const row: Row = {
    id: "lr_1",
    ownerId: owner.id,
    amountBdt: 50_000,
    purpose: "Buy a second oven",
    status: "OPEN",
    tenureDays: 90,
    publishedAt: NOW,
    createdAt: NOW,
    updatedAt: NOW,
    ...overrides,
  };
  state.requests.push(row);
  return row;
}

function seedOffer(state: State, overrides: Row = {}): Row {
  const row: Row = {
    id: `off_${state.offers.length + 1}`,
    loanRequestId: "lr_1",
    investorId: investor.id,
    amountBdt: 50_000,
    interestRatePct: "14.50",
    tenureDays: 90,
    repaymentFrequency: "WEEKLY",
    message: null,
    status: "PENDING",
    proposedBy: "INVESTOR",
    parentOfferId: null,
    expiresAt: new Date(NOW.getTime() + 7 * DAY),
    createdAt: NOW,
    updatedAt: NOW,
    ...overrides,
  };
  state.offers.push(row);
  return row;
}

const createInput = { loanRequestId: "lr_1", ...terms };

describe("offer service", () => {
  it("requires an approved INVESTOR and forbids offers on own or closed requests", async () => {
    const state = createFakeDb();
    seedRequest(state);
    await expect(createOffer(owner as never, createInput, deps(state))).rejects.toThrow(
      ForbiddenError,
    );

    const investorVerificationIndex = state.verifications.findIndex(
      (row) => row.userId === investor.id && row.type === "INVESTOR",
    );
    state.verifications.splice(investorVerificationIndex, 1);
    await expect(createOffer(investor as never, createInput, deps(state))).rejects.toThrow(
      ForbiddenError,
    );

    state.verifications.push({ userId: investor.id, type: "INVESTOR", status: "APPROVED" });
    seedRequest(state, { id: "lr_self", ownerId: investor.id });
    await expect(
      createOffer(investor as never, { ...createInput, loanRequestId: "lr_self" }, deps(state)),
    ).rejects.toThrow(BusinessRuleError);

    seedRequest(state, { id: "lr_closed", status: "CANCELLED" });
    await expect(
      createOffer(investor as never, { ...createInput, loanRequestId: "lr_closed" }, deps(state)),
    ).rejects.toThrow(ConflictError);
  });

  it("rejects client-controlled expiry and invalid terms", async () => {
    const state = createFakeDb();
    seedRequest(state);
    await expect(
      createOffer(investor as never, { ...createInput, expiresAt: NOW.toISOString() } as never, deps(state)),
    ).rejects.toThrow(ZodError);
    await expect(
      createOffer(investor as never, { ...createInput, amountBdt: 0 }, deps(state)),
    ).rejects.toThrow(ZodError);
  });

  it("derives identity/expiry, moves OPEN to IN_DISCUSSION and notifies the owner", async () => {
    const state = createFakeDb();
    const request = seedRequest(state);
    const offer = await createOffer(investor as never, createInput, deps(state));

    expect(state.offers).toHaveLength(1);
    expect(state.offers[0]).toMatchObject({
      investorId: investor.id,
      proposedBy: "INVESTOR",
      status: "PENDING",
      expiresAt: new Date(NOW.getTime() + 7 * DAY),
    });
    expect(request.status).toBe("IN_DISCUSSION");
    expect(offer.interestRatePct).toBe("14.50");
    expect(offer.owner.id).toBe(owner.id);
    expect(state.notifications[0]).toMatchObject({
      userId: owner.id,
      type: "OFFER_RECEIVED",
    });
  });

  it("allows one live pending offer per investor but replaces an expired one", async () => {
    const state = createFakeDb();
    seedRequest(state, { status: "IN_DISCUSSION" });
    await createOffer(investor as never, createInput, deps(state));
    await expect(
      createOffer(investor as never, { ...createInput, amountBdt: 60_000 }, deps(state)),
    ).rejects.toThrow(BusinessRuleError);

    state.offers[0].expiresAt = new Date(NOW.getTime() - DAY);
    await createOffer(investor as never, { ...createInput, amountBdt: 60_000 }, deps(state));
    expect(state.offers[0].status).toBe("EXPIRED");
    expect(state.offers[1].status).toBe("PENDING");
  });

  it("lists only the actor's offers and reports lazy expiry", async () => {
    const state = createFakeDb();
    seedRequest(state, { status: "IN_DISCUSSION" });
    seedOffer(state, { id: "off_expired", expiresAt: new Date(NOW.getTime() - DAY) });
    seedOffer(state, { id: "off_live" });
    seedOffer(state, { investorId: otherInvestor.id, id: "off_other" });

    const received = await listReceivedOffers(owner as never, { limit: 20 }, deps(state));
    const submitted = await listSubmittedOffers(investor as never, { limit: 20 }, deps(state));
    expect(received.items).toHaveLength(3);
    expect(submitted.items.map((item) => item.id)).toEqual(["off_live", "off_expired"]);
    expect(submitted.items.find((item) => item.id === "off_expired")?.status).toBe("EXPIRED");
    expect(submitted.meta.limit).toBe(20);

    const detail = await getOffer(investor as never, "off_expired", deps(state));
    expect(detail.status).toBe("EXPIRED");
    await expect(getOffer(admin as never, "off_expired", deps(state))).rejects.toThrow(
      ForbiddenError,
    );
    await expect(getOffer(otherInvestor as never, "off_expired", deps(state))).rejects.toThrow(
      NotFoundError,
    );
  });

  it("enforces proposer/counterparty roles on withdraw and reject", async () => {
    const state = createFakeDb();
    seedRequest(state, { status: "IN_DISCUSSION" });
    const offer = seedOffer(state);

    await expect(withdrawOffer(owner as never, offer.id as string, deps(state))).rejects.toThrow(
      ForbiddenError,
    );
    await expect(rejectOffer(investor as never, offer.id as string, deps(state))).rejects.toThrow(
      ForbiddenError,
    );

    const withdrawn = await withdrawOffer(investor as never, offer.id as string, deps(state));
    expect(withdrawn.status).toBe("WITHDRAWN");
    await expect(withdrawOffer(investor as never, offer.id as string, deps(state))).rejects.toThrow(
      ConflictError,
    );

    const second = seedOffer({ ...state, offers: state.offers }, { id: "off_2" });
    const rejected = await rejectOffer(owner as never, second.id as string, deps(state));
    expect(rejected.status).toBe("REJECTED");
  });

  it("links counters and derives the proposer from the session", async () => {
    const state = createFakeDb();
    seedRequest(state, { status: "IN_DISCUSSION" });
    const original = seedOffer(state);

    const counter = await counterOffer(
      owner as never,
      original.id as string,
      { ...terms, amountBdt: 48_000 },
      deps(state),
    );

    expect(original.status).toBe("COUNTERED");
    expect(state.offers).toHaveLength(2);
    expect(state.offers[1]).toMatchObject({
      parentOfferId: original.id,
      proposedBy: "OWNER",
      investorId: investor.id,
      status: "PENDING",
    });
    expect(counter.amountBdt).toBe(48_000);

    const investorCounter = await counterOffer(
      investor as never,
      counter.id,
      { ...terms, amountBdt: 49_000 },
      deps(state),
    );
    expect(investorCounter.proposedBy).toBe("INVESTOR");
    expect(investorCounter.parentOfferId).toBe(counter.id);

    await expect(
      counterOffer(owner as never, original.id as string, terms, deps(state)),
    ).rejects.toThrow(ConflictError);
  });

  it("atomically accepts: rejects siblings, creates loan/agreement and funds the request", async () => {
    const state = createFakeDb();
    const request = seedRequest(state, { status: "IN_DISCUSSION" });
    const accepted = seedOffer(state);
    const sibling = seedOffer({ ...state, offers: state.offers }, { id: "off_2" });

    const result = await acceptOffer(owner as never, accepted.id as string, deps(state));

    expect(accepted.status).toBe("ACCEPTED");
    expect(sibling.status).toBe("REJECTED");
    expect(request.status).toBe("FUNDED");
    expect(state.loans).toHaveLength(1);
    expect(state.loans[0]).toMatchObject({
      loanRequestId: request.id,
      offerId: accepted.id,
      ownerId: owner.id,
      investorId: investor.id,
      totalRepayableBdt: 51_788,
      status: "PENDING_AGREEMENT",
    });
    expect(state.agreements[0].termsSnapshot).toMatchObject({
      principalBdt: 50_000,
      totalRepayableBdt: 51_788,
    });
    expect(result.loanId).toBe("loan_1");
    expect(state.notifications.map((row) => row.type)).toEqual([
      "OFFER_ACCEPTED",
      "OFFER_ACCEPTED",
    ]);
  });

  it("blocks duplicate/concurrent acceptance and proposer acceptance", async () => {
    const state = createFakeDb();
    seedRequest(state, { status: "IN_DISCUSSION" });
    const offer = seedOffer(state);

    await expect(
      acceptOffer(investor as never, offer.id as string, deps(state)),
    ).rejects.toThrow(ForbiddenError);

    await acceptOffer(owner as never, offer.id as string, deps(state));
    await expect(acceptOffer(owner as never, offer.id as string, deps(state))).rejects.toThrow(
      ConflictError,
    );
    expect(state.loans).toHaveLength(1);

    // Simulates a concurrent transaction that lost the conditional pending-claim race.
    const originalUpdateMany = state.db.offer.updateMany;
    state.db.offer.updateMany = async ({ data }) => {
      if (data.status === "ACCEPTED") return { count: 0 };
      return originalUpdateMany({ where: {}, data });
    };
    seedOffer(state, { id: "off_race" });
    await expect(acceptOffer(owner as never, "off_race", deps(state))).rejects.toThrow(
      ConflictError,
    );
    expect(state.loans).toHaveLength(1);
  });

  it("expires stale pending offers via the cleanup function", async () => {
    const state = createFakeDb();
    seedRequest(state, { status: "IN_DISCUSSION" });
    seedOffer(state, { id: "off_old", expiresAt: new Date(NOW.getTime() - DAY) });
    seedOffer(state, { id: "off_live" });

    expect(await expireOffers(deps(state))).toEqual({ expiredCount: 1 });
    expect(state.offers[0].status).toBe("EXPIRED");
    expect(state.offers[1].status).toBe("PENDING");
  });
});
