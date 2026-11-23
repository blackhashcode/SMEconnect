import { prisma } from "@/server/db";
import { ForbiddenError } from "@/server/errors";
import type { Actor } from "@/server/services/actor";

export async function getAdminStats(actor: Actor) {
  if (actor.role !== "ADMIN") {
    throw new ForbiddenError("Admin role required");
  }

  const [
    usersByRole,
    pendingVerifications,
    approvedVerifications,
    requestsByStatus,
    loanTotals,
    repaymentStats,
  ] = await Promise.all([
    prisma.user.groupBy({ by: ["role"], _count: { _all: true } }),
    prisma.kycVerification.count({ where: { status: "PENDING" } }),
    prisma.kycVerification.count({ where: { status: "APPROVED" } }),
    prisma.loanRequest.groupBy({ by: ["status"], _count: { _all: true } }),
    prisma.loan.aggregate({ _count: { _all: true }, _sum: { principalBdt: true } }),
    prisma.repayment.groupBy({ by: ["status"], _count: { _all: true } }),
  ]);

  const confirmedCount = repaymentStats.find((r) => r.status === "CONFIRMED")?._count._all ?? 0;
  const overdueCount = repaymentStats.find((r) => r.status === "OVERDUE")?._count._all ?? 0;
  const onTimeRatePct =
    confirmedCount + overdueCount > 0
      ? Math.round((confirmedCount / (confirmedCount + overdueCount)) * 1000) / 10
      : 100;

  return {
    usersByRole: Object.fromEntries(usersByRole.map((u) => [u.role, u._count._all])),
    verifications: { pending: pendingVerifications, approved: approvedVerifications },
    requestsByStatus: Object.fromEntries(requestsByStatus.map((r) => [r.status, r._count._all])),
    loansFunded: {
      count: loanTotals._count._all,
      totalPrincipalBdt: loanTotals._sum.principalBdt ?? 0,
    },
    repayments: {
      confirmed: confirmedCount,
      overdue: overdueCount,
      onTimeRatePct,
    },
  };
}
