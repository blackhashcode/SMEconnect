import { assertRole, type Actor } from "@/server/auth/policy";
import { prisma } from "@/server/db";
import type { adminStatsSchema } from "@/server/validators/admin";
import type { z } from "zod";

type Db = typeof prisma;
type Stats = z.infer<typeof adminStatsSchema>;

interface ServiceDeps {
  db?: Db;
}

interface GroupRow {
  [key: string]: unknown;
  _count?: { _all?: number } | number;
}

const LOAN_REQUEST_STATUSES = [
  "DRAFT",
  "OPEN",
  "IN_DISCUSSION",
  "FUNDED",
  "REPAYING",
  "COMPLETED",
  "PAUSED",
  "CANCELLED",
] as const;
const OFFER_STATUSES = [
  "PENDING",
  "ACCEPTED",
  "REJECTED",
  "COUNTERED",
  "WITHDRAWN",
  "EXPIRED",
] as const;
const LOAN_STATUSES = [
  "PENDING_AGREEMENT",
  "ACTIVE",
  "COMPLETED",
  "DEFAULTED",
] as const;
const REPORT_STATUSES = ["OPEN", "RESOLVED", "DISMISSED"] as const;

function groupCount<T extends string>(
  rows: GroupRow[],
  key: string,
  values: readonly T[],
): Record<T, number> {
  const result = Object.fromEntries(values.map((value) => [value, 0])) as Record<
    T,
    number
  >;
  for (const row of rows) {
    const name = row[key] as T;
    const raw = row._count;
    const count =
      typeof raw === "number" ? raw : (raw?._all ?? 0);
    if (name in result) result[name] += Number(count);
  }
  return result;
}

/**
 * ADMIN-only platform statistics. Every metric is a batched aggregate; no
 * per-row queries, personal identifiers or verification documents are returned.
 */
export async function getAdminStats(
  actor: Actor,
  deps: ServiceDeps = {},
): Promise<Stats> {
  assertRole(actor, "ADMIN");
  const db = deps.db ?? prisma;

  const [
    roleGroups,
    statusGroups,
    verificationGroups,
    requestGroups,
    offerGroups,
    loanGroups,
    loanTotals,
    repaymentTotals,
    confirmedCount,
    confirmedDates,
    overdueCount,
    reportGroups,
    handledReports,
    removedPosts,
    removedComments,
  ] = await Promise.all([
    db.user.groupBy({ by: ["role"], _count: { _all: true } }),
    db.user.groupBy({ by: ["status"], _count: { _all: true } }),
    db.userVerification.groupBy({
      by: ["type", "status"],
      _count: { _all: true },
    }),
    db.loanRequest.groupBy({ by: ["status"], _count: { _all: true } }),
    db.offer.groupBy({ by: ["status"], _count: { _all: true } }),
    db.loan.groupBy({ by: ["status"], _count: { _all: true } }),
    db.loan.aggregate({ _count: { _all: true }, _sum: { principalBdt: true } }),
    db.repayment.aggregate({ _count: { _all: true } }),
    db.repayment.count({ where: { status: "CONFIRMED" } }),
    db.repayment.findMany({
      where: { status: "CONFIRMED", confirmedAt: { not: null } },
      select: { dueDate: true, confirmedAt: true },
    }),
    db.repayment.count({ where: { status: "OVERDUE" } }),
    db.report.groupBy({ by: ["status"], _count: { _all: true } }),
    db.report.count({ where: { handledById: { not: null } } }),
    db.post.count({ where: { deletedAt: { not: null } } }),
    db.comment.count({ where: { deletedAt: { not: null } } }),
  ]);

  const verificationCounts = { PENDING: 0, APPROVED: 0, REJECTED: 0 };
  for (const row of verificationGroups as GroupRow[]) {
    const status = row.status as keyof typeof verificationCounts;
    if (status in verificationCounts) {
      verificationCounts[status] += Number(
        (row._count as { _all?: number } | undefined)?._all ?? 0,
      );
    }
  }

  const dates = confirmedDates as Array<{
    dueDate: Date;
    confirmedAt: Date | null;
  }>;
  const onTimeConfirmedCount = dates.filter(
    (row) =>
      row.confirmedAt !== null &&
      new Date(row.confirmedAt).getTime() <= new Date(row.dueDate).getTime(),
  ).length;
  const onTimeRatePct =
    confirmedCount > 0
      ? Math.round((onTimeConfirmedCount / confirmedCount) * 10_000) / 100
      : 0;

  const roles = groupCount(roleGroups as GroupRow[], "role", [
    "OWNER",
    "INVESTOR",
    "ADMIN",
  ] as const);
  const statuses = groupCount(statusGroups as GroupRow[], "status", [
    "ACTIVE",
    "SUSPENDED",
  ] as const);
  const requests = groupCount(
    requestGroups as GroupRow[],
    "status",
    LOAN_REQUEST_STATUSES,
  );
  const offers = groupCount(offerGroups as GroupRow[], "status", OFFER_STATUSES);
  const loans = groupCount(loanGroups as GroupRow[], "status", LOAN_STATUSES);
  const reports = groupCount(
    reportGroups as GroupRow[],
    "status",
    REPORT_STATUSES,
  );

  return {
    users: {
      total: roles.OWNER + roles.INVESTOR + roles.ADMIN,
      byRole: roles,
      byStatus: statuses,
    },
    verifications: {
      total:
        verificationCounts.PENDING +
        verificationCounts.APPROVED +
        verificationCounts.REJECTED,
      pending: verificationCounts.PENDING,
      approved: verificationCounts.APPROVED,
      rejected: verificationCounts.REJECTED,
    },
    loanRequests: {
      total: Object.values(requests).reduce((sum, value) => sum + value, 0),
      byStatus: requests,
    },
    offers: {
      total: Object.values(offers).reduce((sum, value) => sum + value, 0),
      byStatus: offers,
    },
    loans: {
      fundedCount: loanTotals._count._all,
      totalPrincipalBdt: loanTotals._sum.principalBdt ?? 0,
      byStatus: loans,
    },
    repayments: {
      total: repaymentTotals._count._all,
      confirmedCount,
      onTimeConfirmedCount,
      onTimeRatePct,
      overdueCount,
    },
    reports: {
      total: Object.values(reports).reduce((sum, value) => sum + value, 0),
      byStatus: reports,
      activeDisputes: reports.OPEN,
      handledCount: handledReports,
    },
    moderation: {
      suspendedUsers: statuses.SUSPENDED,
      removedPosts,
      removedComments,
    },
  };
}
