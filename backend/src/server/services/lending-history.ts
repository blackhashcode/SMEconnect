import type { Actor } from "@/server/auth/policy";
import { prisma } from "@/server/db";
import { NotFoundError } from "@/server/errors";

type Db = typeof prisma;

/**
 * A member's public lending track record: every loan they've borrowed (as an
 * owner) or lent (as an investor) once both sides agreed, with repayment
 * reliability. Shown on profiles so members can judge how far to trust each
 * other. Counterparty names are shown; documents and messages never are.
 */
export async function getLendingHistory(_actor: Actor, userId: string, db: Db = prisma) {
  const user = await db.user.findUnique({ where: { id: userId }, select: { id: true, role: true, status: true } });
  if (!user || user.role === "ADMIN") throw new NotFoundError("User not found");
  const asOwner = user.role === "OWNER";

  const loans = await db.loan.findMany({
    where: asOwner ? { ownerId: userId } : { investorId: userId },
    select: {
      id: true,
      principalBdt: true,
      interestRatePct: true,
      tenureDays: true,
      status: true,
      startDate: true,
      createdAt: true,
      owner: { select: { id: true, name: true, businessProfile: { select: { shopName: true } } } },
      investor: { select: { id: true, name: true } },
      repayments: { select: { status: true, dueDate: true, markedPaidAt: true, confirmedAt: true } },
    },
    orderBy: [{ createdAt: "desc" }],
    take: 50,
  });

  const now = Date.now();
  let paidCount = 0;
  let onTimeCount = 0;
  let overdueCount = 0;
  const items = loans.map((loan) => {
    let paid = 0;
    let overdue = 0;
    for (const r of loan.repayments) {
      const paidAt = r.markedPaidAt ?? r.confirmedAt;
      if (r.status === "CONFIRMED" || r.status === "MARKED_PAID") {
        paid += 1;
        paidCount += 1;
        if (paidAt && paidAt.getTime() <= r.dueDate.getTime()) onTimeCount += 1;
      } else if (r.dueDate.getTime() < now) {
        overdue += 1;
        overdueCount += 1;
      }
    }
    const counterparty = asOwner
      ? { id: loan.investor.id, name: loan.investor.name, role: "INVESTOR" as const }
      : { id: loan.owner.id, name: loan.owner.businessProfile?.shopName ?? loan.owner.name, role: "OWNER" as const };
    return {
      id: loan.id,
      role: asOwner ? ("borrowed" as const) : ("lent" as const),
      counterparty,
      principalBdt: loan.principalBdt,
      interestRatePct: Number(loan.interestRatePct),
      tenureDays: loan.tenureDays,
      status: loan.status,
      startDate: loan.startDate?.toISOString() ?? null,
      repayments: { total: loan.repayments.length, paid, overdue },
    };
  });

  const agreed = items.filter((l) => l.status !== "PENDING_AGREEMENT");
  return {
    userId,
    role: asOwner ? ("OWNER" as const) : ("INVESTOR" as const),
    summary: {
      loans: agreed.length,
      completed: agreed.filter((l) => l.status === "COMPLETED").length,
      active: agreed.filter((l) => l.status === "ACTIVE").length,
      defaulted: agreed.filter((l) => l.status === "DEFAULTED").length,
      totalPrincipalBdt: agreed.reduce((sum, l) => sum + l.principalBdt, 0),
      instalmentsPaid: paidCount,
      onTimeRatePct: paidCount ? Math.round((onTimeCount / paidCount) * 100) : null,
      overdueInstalments: overdueCount,
    },
    loans: agreed,
  };
}
