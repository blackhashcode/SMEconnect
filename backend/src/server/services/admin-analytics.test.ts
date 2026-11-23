import { describe, expect, it, vi } from "vitest";

vi.mock("@/server/db", () => ({ prisma: {} }));

import { ForbiddenError } from "@/server/errors";
import { getAdminStats } from "@/server/services/admin-analytics";
import { adminStatsSchema } from "@/server/validators/admin";

const admin = { id: "usr_admin", role: "ADMIN" as const };
const owner = { id: "usr_owner", role: "OWNER" as const };
const investor = { id: "usr_investor", role: "INVESTOR" as const };

const group = (key: string, value: string, count: number) => ({
  [key]: value,
  _count: { _all: count },
});

function makeDb() {
  const db = {
    user: {
      groupBy: vi.fn().mockImplementation(({ by }: { by: string[] }) => {
        if (by[0] === "role") {
          return Promise.resolve([
            group("role", "OWNER", 2),
            group("role", "INVESTOR", 1),
            group("role", "ADMIN", 1),
          ]);
        }
        return Promise.resolve([
          group("status", "ACTIVE", 3),
          group("status", "SUSPENDED", 1),
        ]);
      }),
    },
    userVerification: {
      groupBy: vi.fn().mockResolvedValue([
        { type: "OWNER", status: "PENDING", _count: { _all: 1 } },
        { type: "OWNER", status: "APPROVED", _count: { _all: 1 } },
        { type: "INVESTOR", status: "REJECTED", _count: { _all: 1 } },
      ]),
    },
    loanRequest: {
      groupBy: vi.fn().mockResolvedValue([
        group("status", "OPEN", 2),
        group("status", "REPAYING", 1),
      ]),
    },
    offer: {
      groupBy: vi.fn().mockResolvedValue([
        group("status", "PENDING", 3),
        group("status", "ACCEPTED", 1),
      ]),
    },
    loan: {
      groupBy: vi.fn().mockResolvedValue([
        group("status", "ACTIVE", 1),
        group("status", "COMPLETED", 1),
      ]),
      aggregate: vi.fn().mockResolvedValue({
        _count: { _all: 2 },
        _sum: { principalBdt: 150_000 },
      }),
    },
    repayment: {
      aggregate: vi.fn().mockResolvedValue({ _count: { _all: 4 } }),
      count: vi.fn().mockImplementation(({ where }: { where: { status?: string } }) =>
        Promise.resolve(where.status === "OVERDUE" ? 1 : 2),
      ),
      findMany: vi.fn().mockResolvedValue([
        {
          dueDate: new Date("2026-12-01T00:00:00.000Z"),
          confirmedAt: new Date("2026-11-30T00:00:00.000Z"),
        },
        {
          dueDate: new Date("2027-01-01T00:00:00.000Z"),
          confirmedAt: new Date("2027-01-02T00:00:00.000Z"),
        },
      ]),
    },
    report: {
      groupBy: vi.fn().mockResolvedValue([
        group("status", "OPEN", 1),
        group("status", "RESOLVED", 1),
      ]),
      count: vi.fn().mockResolvedValue(1),
    },
    post: { count: vi.fn().mockResolvedValue(1) },
    comment: { count: vi.fn().mockResolvedValue(2) },
  };

  return { db };
}

const deps = (fake: ReturnType<typeof makeDb>) => ({ db: fake.db as never });

describe("admin analytics", () => {
  it("is ADMIN-only", async () => {
    const fake = makeDb();

    await expect(getAdminStats(owner, deps(fake))).rejects.toBeInstanceOf(
      ForbiddenError,
    );
    await expect(getAdminStats(investor, deps(fake))).rejects.toBeInstanceOf(
      ForbiddenError,
    );
  });

  it("returns batched aggregate counts with no personal or financial detail", async () => {
    const fake = makeDb();
    const result = await getAdminStats(admin, deps(fake));

    expect(adminStatsSchema.parse(result)).toEqual(result);
    expect(result).toEqual({
      users: {
        total: 4,
        byRole: { OWNER: 2, INVESTOR: 1, ADMIN: 1 },
        byStatus: { ACTIVE: 3, SUSPENDED: 1 },
      },
      verifications: {
        total: 3,
        pending: 1,
        approved: 1,
        rejected: 1,
      },
      loanRequests: {
        total: 3,
        byStatus: {
          DRAFT: 0,
          OPEN: 2,
          IN_DISCUSSION: 0,
          FUNDED: 0,
          REPAYING: 1,
          COMPLETED: 0,
          PAUSED: 0,
          CANCELLED: 0,
        },
      },
      offers: {
        total: 4,
        byStatus: {
          PENDING: 3,
          ACCEPTED: 1,
          REJECTED: 0,
          COUNTERED: 0,
          WITHDRAWN: 0,
          EXPIRED: 0,
        },
      },
      loans: {
        fundedCount: 2,
        totalPrincipalBdt: 150_000,
        byStatus: {
          PENDING_AGREEMENT: 0,
          ACTIVE: 1,
          COMPLETED: 1,
          DEFAULTED: 0,
        },
      },
      repayments: {
        total: 4,
        confirmedCount: 2,
        onTimeConfirmedCount: 1,
        onTimeRatePct: 50,
        overdueCount: 1,
      },
      reports: {
        total: 2,
        byStatus: { OPEN: 1, RESOLVED: 1, DISMISSED: 0 },
        activeDisputes: 1,
        handledCount: 1,
      },
      moderation: {
        suspendedUsers: 1,
        removedPosts: 1,
        removedComments: 2,
      },
    });
    expect(JSON.stringify(result)).not.toContain("@example.test");
  });

  it("uses one aggregate call per metric group instead of per-row queries", async () => {
    const fake = makeDb();
    await getAdminStats(admin, deps(fake));

    expect(fake.db.user.groupBy).toHaveBeenCalledTimes(2);
    expect(fake.db.userVerification.groupBy).toHaveBeenCalledTimes(1);
    expect(fake.db.loanRequest.groupBy).toHaveBeenCalledTimes(1);
    expect(fake.db.offer.groupBy).toHaveBeenCalledTimes(1);
    expect(fake.db.loan.groupBy).toHaveBeenCalledTimes(1);
    expect(fake.db.loan.aggregate).toHaveBeenCalledTimes(1);
    expect(fake.db.repayment.aggregate).toHaveBeenCalledTimes(1);
    expect(fake.db.repayment.findMany).toHaveBeenCalledTimes(1);
    expect(fake.db.repayment.count).toHaveBeenCalledTimes(2);
    expect(fake.db.report.groupBy).toHaveBeenCalledTimes(1);
    expect(fake.db.report.count).toHaveBeenCalledTimes(1);
    expect(fake.db.post.count).toHaveBeenCalledTimes(1);
    expect(fake.db.comment.count).toHaveBeenCalledTimes(1);
  });
});
