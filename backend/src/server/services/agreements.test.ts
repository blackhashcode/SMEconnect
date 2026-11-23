import { describe, expect, it, vi } from "vitest";

vi.mock("@/server/db", () => ({ prisma: {} }));

import { ConflictError, ForbiddenError, NotFoundError } from "@/server/errors";
import { confirmAgreement, getAgreement } from "@/server/services/agreements";

type Row = Record<string, unknown>;

interface FakeDb {
  agreement: {
    findUnique: (args: { where: Row; include?: Row }) => Promise<Row | null>;
    updateMany: (args: { where: Row; data: Row }) => Promise<{ count: number }>;
  };
  loan: { updateMany: (args: { where: Row; data: Row }) => Promise<{ count: number }> };
  loanRequest: { updateMany: (args: { where: Row; data: Row }) => Promise<{ count: number }> };
  repayment: { createMany: (args: { data: Row[] }) => Promise<{ count: number }> };
  notification: { create: (args: { data: Row }) => Promise<Row> };
  post: { create: (args: { data: Row }) => Promise<Row> };
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
const stranger = { id: "usr_stranger", role: "INVESTOR" as const };
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
};

const TERMS = {
  loanRequestId: "lr_1",
  offerId: "off_1",
  principalBdt: 50_000,
  interestRatePct: "14.50",
  tenureDays: 90,
  repaymentFrequency: "MONTHLY",
  totalRepayableBdt: 51_788,
};

function matches(row: Row, where: Row): boolean {
  for (const [key, expected] of Object.entries(where)) {
    const actual = row[key];
    if (expected && typeof expected === "object" && !Array.isArray(expected)) {
      const rule = expected as Row;
      if ("in" in rule && Array.isArray(rule.in) && !rule.in.includes(actual)) return false;
      if ("not" in rule && actual === rule.not) return false;
      if ("equals" in rule && actual !== rule.equals) return false;
      continue;
    }
    if (actual !== expected) return false;
  }
  return true;
}

function createFakeDb() {
  const agreements: Row[] = [];
  const loans: Row[] = [];
  const requests: Row[] = [];
  const repayments: Row[] = [];
  const notifications: Row[] = [];
  const posts: Row[] = [];
  const verifications: Row[] = [
    { userId: owner.id, type: "OWNER", status: "APPROVED" },
    { userId: investor.id, type: "INVESTOR", status: "APPROVED" },
    { userId: stranger.id, type: "INVESTOR", status: "APPROVED" },
  ];

  const withLoan = (row: Row): Row => {
    const loan = loans.find((item) => item.id === row.loanId);
    const request = loan ? requests.find((item) => item.id === loan.loanRequestId) : null;
    return {
      ...row,
      loan: loan ? { ...loan, loanRequest: request ?? null } : null,
    };
  };

  const db: FakeDb = {
    agreement: {
      findUnique: async ({ where }) => {
        const row = agreements.find((item) => matches(item, where));
        return row ? withLoan(row) : null;
      },
      updateMany: async ({ where, data }) => {
        let count = 0;
        for (const row of agreements) {
          if (matches(row, where)) {
            Object.assign(row, data);
            count++;
          }
        }
        return { count };
      },
    },
    loan: {
      updateMany: async ({ where, data }) => {
        let count = 0;
        for (const row of loans) {
          if (matches(row, where)) {
            Object.assign(row, data);
            count++;
          }
        }
        return { count };
      },
    },
    loanRequest: {
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
    repayment: {
      createMany: async ({ data }) => {
        for (const row of data) repayments.push(row);
        return { count: data.length };
      },
    },
    notification: {
      create: async ({ data }) => {
        const row: Row = { id: `ntf_${notifications.length + 1}`, ...data };
        notifications.push(row);
        return row;
      },
    },
    post: {
      create: async ({ data }) => {
        const row: Row = { id: `post_${posts.length + 1}`, ...data };
        posts.push(row);
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
      findFirst: async ({ where }) => verifications.find((row) => matches(row, where)) ?? null,
      findMany: async ({ where }) => verifications.filter((row) => matches(row, where)),
    },
    $transaction: async (callback) => callback(db),
  };

  return { db, agreements, loans, requests, repayments, notifications, posts, verifications };
}

type State = ReturnType<typeof createFakeDb>;

function deps(state: State) {
  return { db: state.db as never, now: () => NOW };
}

function seed(state: State, loanOverrides: Row = {}, agreementOverrides: Row = {}) {
  const request: Row = {
    id: "lr_1",
    ownerId: owner.id,
    status: "FUNDED",
    purpose: "Buy a second oven",
  };
  const loan: Row = {
    id: "loan_1",
    loanRequestId: request.id,
    ownerId: owner.id,
    investorId: investor.id,
    principalBdt: 50_000,
    interestRatePct: "14.50",
    tenureDays: 90,
    repaymentFrequency: "MONTHLY",
    totalRepayableBdt: 51_788,
    status: "PENDING_AGREEMENT",
    startDate: null,
    ...loanOverrides,
  };
  const agreement: Row = {
    id: "agr_1",
    loanId: loan.id,
    termsSnapshot: TERMS,
    ownerConfirmedAt: null,
    investorConfirmedAt: null,
    createdAt: NOW,
    updatedAt: NOW,
    ...agreementOverrides,
  };
  state.requests.push(request);
  state.loans.push(loan);
  state.agreements.push(agreement);
  return { request, loan, agreement };
}

describe("agreement service", () => {
  it("returns participant-only terms, parties and a schedule preview", async () => {
    const state = createFakeDb();
    seed(state);

    const summary = await getAgreement(owner as never, "agr_1", deps(state));
    expect(summary.terms).toEqual(TERMS);
    expect(summary.parties.owner.id).toBe(owner.id);
    expect(summary.parties.investor.id).toBe(investor.id);
    expect(summary.schedulePreview).toHaveLength(3);
    expect(summary.schedulePreview.at(-1)).toMatchObject({
      installmentNo: 3,
      amountBdt: 17_264,
      dueDate: new Date(NOW.getTime() + 90 * DAY).toISOString(),
    });
    expect(summary.confirmations.bothConfirmed).toBe(false);

    await expect(getAgreement(stranger as never, "agr_1", deps(state))).rejects.toThrow(
      NotFoundError,
    );
    await expect(getAgreement(admin as never, "agr_1", deps(state))).rejects.toThrow(
      ForbiddenError,
    );
  });

  it("records the first confirmation without activating the loan", async () => {
    const state = createFakeDb();
    const { loan, agreement } = seed(state);

    const summary = await confirmAgreement(owner as never, "agr_1", deps(state));

    expect(agreement.ownerConfirmedAt).toEqual(NOW);
    expect(agreement.investorConfirmedAt).toBeNull();
    expect(loan.status).toBe("PENDING_AGREEMENT");
    expect(state.repayments).toHaveLength(0);
    expect(summary.confirmations.bothConfirmed).toBe(false);

    await expect(confirmAgreement(owner as never, "agr_1", deps(state))).rejects.toThrow(
      ConflictError,
    );
  });

  it("activates the loan and writes the schedule on the second confirmation", async () => {
    const state = createFakeDb();
    const { loan, request } = seed(state);
    await confirmAgreement(owner as never, "agr_1", deps(state));
    const summary = await confirmAgreement(investor as never, "agr_1", deps(state));

    expect(loan.status).toBe("ACTIVE");
    expect(loan.startDate).toEqual(NOW);
    expect(request.status).toBe("REPAYING");
    expect(state.repayments.map((row) => row.amountBdt)).toEqual([17_262, 17_262, 17_264]);
    expect(state.repayments.map((row) => row.installmentNo)).toEqual([1, 2, 3]);
    expect(state.repayments[2].dueDate).toEqual(new Date(NOW.getTime() + 90 * DAY));
    expect(state.notifications.map((row) => row.type)).toEqual([
      "AGREEMENT_CONFIRMED",
      "AGREEMENT_CONFIRMED",
    ]);
    expect(state.posts[0]).toMatchObject({
      authorId: owner.id,
      type: "MILESTONE",
      loanRequestId: request.id,
    });
    expect(summary.status).toBe("ACTIVE");
    expect(summary.confirmations.bothConfirmed).toBe(true);

    await expect(confirmAgreement(investor as never, "agr_1", deps(state))).rejects.toThrow(
      ConflictError,
    );
    expect(state.repayments).toHaveLength(3);
  });

  it("rejects unauthorized roles and already-activated agreements", async () => {
    const state = createFakeDb();
    seed(state, { status: "ACTIVE", startDate: NOW });

    await expect(
      confirmAgreement({ id: owner.id, role: "INVESTOR" } as never, "agr_1", deps(state)),
    ).rejects.toThrow(ForbiddenError);
    await expect(confirmAgreement(owner as never, "agr_1", deps(state))).rejects.toThrow(
      ConflictError,
    );
  });
});
