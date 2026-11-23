import { prisma } from "@/server/db";
import { ForbiddenError } from "@/server/errors";
import type { Actor } from "@/server/services/actor";

export async function getOwnerDashboard(actor: Actor) {
  if (actor.role !== "OWNER") {
    throw new ForbiddenError("Owner dashboard is only available to business owners");
  }

  const [user, business, activeRequest, activeLoan, receivedOffers] = await Promise.all([
    prisma.user.findUnique({ where: { id: actor.id }, select: { trustScore: true } }),
    prisma.businessProfile.findUnique({ where: { ownerId: actor.id } }),
    prisma.loanRequest.findFirst({
      where: { ownerId: actor.id, status: { in: ["OPEN", "IN_DISCUSSION", "FUNDED", "REPAYING"] } },
      orderBy: { createdAt: "desc" },
    }),
    prisma.loan.findFirst({
      where: { ownerId: actor.id, status: { in: ["PENDING_AGREEMENT", "ACTIVE"] } },
      include: { repayments: { orderBy: { installmentNo: "asc" } } },
      orderBy: { createdAt: "desc" },
    }),
    prisma.offer.findMany({
      where: { loanRequest: { ownerId: actor.id } },
      orderBy: { updatedAt: "desc" },
      take: 20,
    }),
  ]);

  const repayments = activeLoan?.repayments ?? [];
  const confirmed = repayments.filter((r) => r.status === "CONFIRMED").length;
  const nextDue = repayments.find((r) => r.status === "UPCOMING" || r.status === "OVERDUE") ?? null;
  const repaymentProgressPct = repayments.length ? Math.round((confirmed / repayments.length) * 100) : 0;

  return {
    business,
    trustScore: user?.trustScore ?? 50,
    activeRequest,
    receivedOffers,
    activeLoan,
    nextDue,
    repaymentProgressPct,
  };
}

export async function getInvestorDashboard(actor: Actor) {
  if (actor.role !== "INVESTOR") {
    throw new ForbiddenError("Investor dashboard is only available to investors");
  }

  const [offers, loans] = await Promise.all([
    prisma.offer.findMany({
      where: { investorId: actor.id },
      orderBy: { updatedAt: "desc" },
      take: 50,
    }),
    prisma.loan.findMany({
      where: { investorId: actor.id },
      include: {
        loanRequest: { include: { businessProfile: { select: { id: true, shopName: true, category: true } } } },
        repayments: { orderBy: { installmentNo: "asc" } },
      },
      orderBy: { createdAt: "desc" },
    }),
  ]);

  const totalLentBdt = loans.reduce((sum, l) => sum + l.principalBdt, 0);
  const expectedReturnsBdt = loans.reduce((sum, l) => sum + (l.totalRepayableBdt - l.principalBdt), 0);
  const repaidToDateBdt = loans.reduce(
    (sum, l) =>
      sum +
      l.repayments
        .filter((r) => r.status === "CONFIRMED")
        .reduce((rSum, r) => rSum + r.amountBdt, 0),
    0,
  );

  return {
    summary: {
      totalLentBdt,
      activeLoansCount: loans.filter((l) => l.status === "ACTIVE").length,
      repaidToDateBdt,
      expectedReturnsBdt,
      pendingOffersCount: offers.filter((o) => o.status === "PENDING").length,
    },
    portfolio: loans,
    offers,
  };
}
