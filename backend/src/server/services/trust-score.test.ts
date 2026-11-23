import { describe, expect, it, vi } from "vitest";

vi.mock("@/server/db", () => ({ prisma: {} }));

import {
  calculateTrustScore,
  recomputeTrustScore,
  type TrustScoreFactors,
} from "@/server/services/trust-score";

const base: TrustScoreFactors = {
  verified: false,
  onTimeRepayments: 0,
  completedLoans: 0,
  averageRating: null,
  overdueCount: 0,
};

describe("calculateTrustScore", () => {
  it("starts at zero for an unverified account with no history", () => {
    expect(calculateTrustScore(base)).toBe(0);
  });

  it("awards verification, on-time repayments, completed loans and ratings", () => {
    expect(calculateTrustScore({ ...base, verified: true })).toBe(25);
    expect(calculateTrustScore({ ...base, onTimeRepayments: 2 })).toBe(10);
    expect(calculateTrustScore({ ...base, completedLoans: 2 })).toBe(20);
    expect(calculateTrustScore({ ...base, averageRating: 4 })).toBe(16);
    expect(
      calculateTrustScore({
        verified: true,
        onTimeRepayments: 6,
        completedLoans: 3,
        averageRating: 5,
        overdueCount: 1,
      }),
    ).toBe(25 + 30 + 25 + 20 - 5);
  });

  it("caps each positive component and the overdue penalty", () => {
    expect(calculateTrustScore({ ...base, onTimeRepayments: 100 })).toBe(30);
    expect(calculateTrustScore({ ...base, completedLoans: 100 })).toBe(25);
    expect(calculateTrustScore({ ...base, overdueCount: 100 })).toBe(0);
    expect(
      calculateTrustScore({
        verified: true,
        onTimeRepayments: 100,
        completedLoans: 100,
        averageRating: 5,
        overdueCount: 100,
      }),
    ).toBe(75);
  });

  it("clamps to 0–100 and rounds whole taka-safe integer scores", () => {
    expect(calculateTrustScore({ ...base, overdueCount: 1 })).toBe(0);
    expect(
      calculateTrustScore({
        verified: true,
        onTimeRepayments: 6,
        completedLoans: 3,
        averageRating: 5,
        overdueCount: 0,
      }),
    ).toBe(100);
    expect(calculateTrustScore({ ...base, averageRating: 3.5 })).toBe(14);
    expect(calculateTrustScore({ ...base, averageRating: Number.NaN })).toBe(0);
  });
});

describe("recomputeTrustScore", () => {
  const now = new Date("2026-11-23T18:00:00.000Z");
  const DAY = 24 * 60 * 60 * 1000;

  function fakeDb() {
    const updates: Array<{ role: string; where: Record<string, unknown>; score: number }> = [];
    const db = {
      userVerification: {
        findFirst: vi.fn().mockResolvedValue({ id: "ver_1" }),
      },
      loan: { count: vi.fn().mockResolvedValue(1) },
      repayment: {
        findMany: vi.fn().mockResolvedValue([
          {
            status: "CONFIRMED",
            dueDate: new Date(now.getTime() + 10 * DAY),
            confirmedAt: new Date(now.getTime() + 9 * DAY),
          },
          {
            status: "OVERDUE",
            dueDate: new Date(now.getTime() - DAY),
            confirmedAt: null,
          },
        ]),
      },
      review: { findMany: vi.fn().mockResolvedValue([{ rating: 4 }, { rating: 5 }]) },
      businessProfile: {
        updateMany: vi.fn().mockImplementation(({ where, data }) => {
          updates.push({ role: "OWNER", where, score: data.trustScore });
          return Promise.resolve({ count: 1 });
        }),
      },
      investorProfile: {
        updateMany: vi.fn().mockImplementation(({ where, data }) => {
          updates.push({ role: "INVESTOR", where, score: data.trustScore });
          return Promise.resolve({ count: 1 });
        }),
      },
    };
    return { db, updates };
  }

  it("derives all factors from the database and persists to the role profile", async () => {
    const { db, updates } = fakeDb();
    const score = await recomputeTrustScore("usr_1", "OWNER", db as never, now);

    expect(score).toBe(25 + 5 + 10 + 18 - 5);
    expect(db.loan.count).toHaveBeenCalledWith({
      where: { ownerId: "usr_1", status: "COMPLETED" },
    });
    expect(db.repayment.findMany).toHaveBeenCalledWith({
      where: { loan: { ownerId: "usr_1" } },
      select: { status: true, dueDate: true, confirmedAt: true },
    });
    expect(db.review.findMany).toHaveBeenCalledWith({
      where: { revieweeId: "usr_1" },
      select: { rating: true },
    });
    expect(updates).toEqual([
      { role: "OWNER", where: { ownerId: "usr_1" }, score: 53 },
    ]);
  });

  it("scopes investor scores by investorId and handles no reviews", async () => {
    const { db, updates } = fakeDb();
    db.userVerification.findFirst.mockResolvedValue(null);
    db.review.findMany.mockResolvedValue([]);
    db.repayment.findMany.mockResolvedValue([]);
    db.loan.count.mockResolvedValue(0);

    const score = await recomputeTrustScore("usr_2", "INVESTOR", db as never, now);

    expect(score).toBe(0);
    expect(db.loan.count).toHaveBeenCalledWith({
      where: { investorId: "usr_2", status: "COMPLETED" },
    });
    expect(updates[0].where).toEqual({ userId: "usr_2" });
  });

  it("does not credit a late confirmation as on time", async () => {
    const { db } = fakeDb();
    db.repayment.findMany.mockResolvedValue([
      {
        status: "CONFIRMED",
        dueDate: new Date(now.getTime() - 2 * DAY),
        confirmedAt: now,
      },
    ]);
    db.loan.count.mockResolvedValue(0);
    db.userVerification.findFirst.mockResolvedValue(null);
    db.review.findMany.mockResolvedValue([]);

    await expect(recomputeTrustScore("usr_3", "OWNER", db as never, now)).resolves.toBe(0);
  });
});
