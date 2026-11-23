import { describe, expect, it, vi } from "vitest";

vi.mock("@/server/db", () => ({ prisma: {} }));

import { ForbiddenError, NotFoundError } from "@/server/errors";
import {
  getInvestorDashboard,
  getOwnerDashboard,
} from "@/server/services/dashboards";
import {
  investorDashboardSchema,
  ownerDashboardSchema,
} from "@/server/validators/dashboard";

const NOW = new Date("2026-11-23T18:00:00.000Z");
const DAY = 24 * 60 * 60 * 1000;
const owner = { id: "usr_owner", role: "OWNER" as const };
const investor = { id: "usr_inv", role: "INVESTOR" as const };
const admin = { id: "usr_admin", role: "ADMIN" as const };

type Row = Record<string, unknown>;

function notification(overrides: Row = {}): Row {
  return {
    id: "ntf_1",
    type: "OFFER_RECEIVED",
    title: "New offer",
    body: "An investor sent you an offer.",
    link: "/offers/off_1",
    readAt: null,
    createdAt: NOW,
    ...overrides,
  };
}

function repayment(overrides: Row = {}): Row {
  return {
    id: "rep_1",
    installmentNo: 1,
    dueDate: new Date(NOW.getTime() + 10 * DAY),
    amountBdt: 2_000,
    status: "UPCOMING",
    confirmedAt: null,
    ...overrides,
  };
}

function loan(overrides: Row = {}): Row {
  return {
    id: "loan_1",
    loanRequestId: "lr_1",
    status: "ACTIVE",
    principalBdt: 50_000,
    totalRepayableBdt: 51_000,
    startDate: NOW,
    createdAt: NOW,
    repayments: [repayment()],
    ...overrides,
  };
}

function baseDb(user: Row, verificationType: "OWNER" | "INVESTOR") {
  return {
    user: { findUnique: vi.fn().mockResolvedValue(user) },
    userVerification: {
      findFirst: vi.fn().mockResolvedValue({
        status: "APPROVED",
        submittedAt: new Date(NOW.getTime() - 10 * DAY),
        reviewedAt: new Date(NOW.getTime() - 8 * DAY),
      }),
    },
    notification: {
      findMany: vi.fn().mockImplementation(({ take }: Row) =>
        Promise.resolve(
          [notification(), notification({ id: "ntf_2" })].slice(0, Number(take ?? 2)),
        ),
      ),
      count: vi.fn().mockResolvedValue(3),
    },
    connection: { count: vi.fn().mockResolvedValue(4) },
    follow: {
      count: vi.fn().mockResolvedValueOnce(5).mockResolvedValueOnce(6),
    },
    post: { count: vi.fn().mockResolvedValue(7) },
    businessProfile: { findUnique: vi.fn() },
    investorProfile: { findUnique: vi.fn() },
    loanRequest: { findMany: vi.fn() },
    offer: { findMany: vi.fn() },
    loan: { findFirst: vi.fn(), findMany: vi.fn() },
    verificationType,
  };
}

const deps = (db: ReturnType<typeof baseDb>) =>
  ({ db: db as never, now: () => NOW, recentLimit: 1 }) as never;

describe("getOwnerDashboard", () => {
  function ownerDb() {
    const db = baseDb(
      { id: owner.id, name: "Nusrat", image: null, role: "OWNER", status: "ACTIVE" },
      "OWNER",
    );
    db.businessProfile.findUnique.mockResolvedValue({
      shopName: "Nusrat's Kitchen",
      slug: "nusrat-kitchen",
      category: "Food",
      district: "Dhaka",
      city: "Dhaka",
      trustScore: 82,
    });
    db.loanRequest.findMany.mockResolvedValue([
      {
        id: "lr_1",
        purpose: "New oven",
        amountBdt: 50_000,
        status: "REPAYING",
        createdAt: NOW,
      },
      {
        id: "lr_2",
        purpose: "Packaging",
        amountBdt: 20_000,
        status: "COMPLETED",
        createdAt: new Date(NOW.getTime() - 30 * DAY),
      },
    ]);
    db.offer.findMany.mockResolvedValue([
      { status: "PENDING" },
      { status: "ACCEPTED" },
      { status: "REJECTED" },
    ]);
    db.loan.findFirst.mockResolvedValue(
      loan({
        totalRepayableBdt: 6_000,
        repayments: [
          repayment({ id: "rep_1", status: "CONFIRMED", confirmedAt: NOW, amountBdt: 2_000 }),
          repayment({ id: "rep_2", status: "OVERDUE", dueDate: new Date(NOW.getTime() - DAY), amountBdt: 1_000 }),
          repayment({ id: "rep_3", dueDate: new Date(NOW.getTime() + 10 * DAY), amountBdt: 3_000 }),
        ],
      }),
    );
    return db;
  }

  it("returns a schema-valid owner dashboard with server-derived metrics", async () => {
    const db = ownerDb();
    const result = await getOwnerDashboard(owner as never, deps(db));

    expect(ownerDashboardSchema.safeParse(result).success).toBe(true);
    expect(result.profile).toMatchObject({ id: owner.id, role: "OWNER", shopName: "Nusrat's Kitchen" });
    expect(result.trustScore).toBe(82);
    expect(result.loanRequests.active).toMatchObject({ id: "lr_1", status: "REPAYING" });
    expect(result.loanRequests.byStatus).toMatchObject({ REPAYING: 1, COMPLETED: 1, OPEN: 0 });
    expect(result.offers).toEqual({ received: 3, pendingReceived: 1, acceptedReceived: 1 });
    expect(result.loan?.nextDue).toMatchObject({ repaymentId: "rep_2", status: "OVERDUE", amountBdt: 1_000 });
    expect(result.loan?.progress).toMatchObject({
      totalInstallments: 3,
      confirmedCount: 1,
      confirmedBdt: 2_000,
      progressPct: 33,
    });
    expect(result.recentNotifications).toHaveLength(1);
    expect(result.activity).toEqual({
      connections: 4,
      followers: 5,
      following: 6,
      posts: 7,
      unreadNotifications: 3,
    });
    expect(db.userVerification.findFirst).toHaveBeenCalledWith({
      where: { userId: owner.id, type: "OWNER" },
      select: { status: true, submittedAt: true, reviewedAt: true },
    });
  });

  it("returns nulls and zeroed counts when the owner has no activity", async () => {
    const db = ownerDb();
    db.businessProfile.findUnique.mockResolvedValue({
      shopName: "New Shop",
      slug: "new-shop",
      category: "Food",
      district: "Dhaka",
      city: "Dhaka",
      trustScore: 0,
    });
    db.userVerification.findFirst.mockResolvedValue(null);
    db.loanRequest.findMany.mockResolvedValue([]);
    db.offer.findMany.mockResolvedValue([]);
    db.loan.findFirst.mockResolvedValue(null);
    db.notification.findMany.mockResolvedValue([]);
    db.notification.count.mockResolvedValue(0);

    const result = await getOwnerDashboard(owner as never, deps(db));

    expect(ownerDashboardSchema.safeParse(result).success).toBe(true);
    expect(result.verification).toEqual({ status: null, submittedAt: null, reviewedAt: null });
    expect(result.loanRequests.active).toBeNull();
    expect(result.loan).toBeNull();
    expect(result.offers.received).toBe(0);
    expect(result.recentNotifications).toEqual([]);
  });

  it("rejects the wrong role and a missing profile", async () => {
    const db = ownerDb();
    await expect(getOwnerDashboard(investor as never, deps(db))).rejects.toBeInstanceOf(ForbiddenError);
    await expect(getOwnerDashboard(admin as never, deps(db))).rejects.toBeInstanceOf(ForbiddenError);

    db.user.findUnique.mockResolvedValue(null);
    await expect(getOwnerDashboard(owner as never, deps(db))).rejects.toBeInstanceOf(NotFoundError);
    db.user.findUnique.mockResolvedValue({
      id: owner.id,
      name: "Nusrat",
      image: null,
      role: "OWNER",
      status: "ACTIVE",
    });
    db.businessProfile.findUnique.mockResolvedValue(null);
    await expect(getOwnerDashboard(owner as never, deps(db))).rejects.toBeInstanceOf(NotFoundError);
  });
});

describe("getInvestorDashboard", () => {
  function investorDb() {
    const db = baseDb(
      { id: investor.id, name: "Tanvir", image: null, role: "INVESTOR", status: "ACTIVE" },
      "INVESTOR",
    );
    db.investorProfile.findUnique.mockResolvedValue({
      bio: "Angel investor",
      minLendBdt: 10_000,
      maxLendBdt: 100_000,
      preferredCategories: ["Food"],
      district: "Dhaka",
      city: "Dhaka",
      trustScore: 74,
    });
    db.offer.findMany.mockResolvedValue([{ status: "PENDING" }, { status: "ACCEPTED" }]);
    db.loan.findMany.mockResolvedValue([
      loan({
        id: "loan_active",
        principalBdt: 50_000,
        totalRepayableBdt: 6_000,
        repayments: [
          repayment({ id: "rep_a1", status: "CONFIRMED", confirmedAt: NOW, amountBdt: 1_000 }),
          repayment({ id: "rep_a2", dueDate: new Date(NOW.getTime() + 3 * DAY), amountBdt: 2_000 }),
        ],
      }),
      loan({
        id: "loan_done",
        status: "COMPLETED",
        principalBdt: 30_000,
        totalRepayableBdt: 3_000,
        repayments: [
          repayment({ id: "rep_d1", status: "CONFIRMED", confirmedAt: NOW, amountBdt: 3_000 }),
        ],
      }),
      loan({
        id: "loan_late",
        principalBdt: 20_000,
        totalRepayableBdt: 2_500,
        repayments: [
          repayment({ id: "rep_l1", status: "OVERDUE", dueDate: new Date(NOW.getTime() - DAY), amountBdt: 500 }),
        ],
      }),
    ]);
    return db;
  }

  it("returns a schema-valid portfolio with health, totals and earliest due", async () => {
    const db = investorDb();
    const result = await getInvestorDashboard(investor as never, deps(db));

    expect(investorDashboardSchema.safeParse(result).success).toBe(true);
    expect(result.trustScore).toBe(74);
    expect(result.offers).toEqual({ submitted: 2, pendingSubmitted: 1, acceptedSubmitted: 1 });
    expect(result.loans).toEqual({
      active: 2,
      completed: 1,
      totalLentBdt: 100_000,
      repaidBdt: 4_000,
      expectedReturnsBdt: 11_500,
    });
    expect(result.repayments).toMatchObject({
      totalInstallments: 4,
      confirmedCount: 2,
      confirmedBdt: 4_000,
      outstandingBdt: 7_500,
    });
    expect(result.nextDue).toMatchObject({ repaymentId: "rep_l1", status: "OVERDUE", amountBdt: 500 });
    expect(result.portfolio.map((item) => [item.id, item.health])).toEqual([
      ["loan_active", "DUE_SOON"],
      ["loan_done", "COMPLETED"],
      ["loan_late", "OVERDUE"],
    ]);
    expect(db.loan.findMany).toHaveBeenCalledWith({
      where: { investorId: investor.id },
      include: expect.objectContaining({ repayments: expect.anything() }),
      orderBy: { createdAt: "desc" },
    });
  });

  it("handles an empty portfolio and rejects wrong roles or missing profiles", async () => {
    const db = investorDb();
    db.investorProfile.findUnique.mockResolvedValue({
      bio: null,
      minLendBdt: 0,
      maxLendBdt: 0,
      preferredCategories: [],
      district: null,
      city: null,
      trustScore: 0,
    });
    db.offer.findMany.mockResolvedValue([]);
    db.loan.findMany.mockResolvedValue([]);

    const empty = await getInvestorDashboard(investor as never, deps(db));
    expect(investorDashboardSchema.safeParse(empty).success).toBe(true);
    expect(empty.nextDue).toBeNull();
    expect(empty.portfolio).toEqual([]);
    expect(empty.loans.totalLentBdt).toBe(0);

    await expect(getInvestorDashboard(owner as never, deps(db))).rejects.toBeInstanceOf(ForbiddenError);
    db.investorProfile.findUnique.mockResolvedValue(null);
    await expect(getInvestorDashboard(investor as never, deps(db))).rejects.toBeInstanceOf(NotFoundError);
  });
});
