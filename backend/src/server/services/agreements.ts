import { generateRepaymentSchedule } from "@/lib/finance";
import { recordAuditLog } from "@/server/audit";
import { prisma } from "@/server/db";
import { ConflictError, ForbiddenError, NotFoundError } from "@/server/errors";
import { createNotification } from "@/server/notifications";
import type { Actor } from "@/server/services/actor";

export async function getAgreementForLoanRequest(actor: Actor, loanRequestId: string) {
  const loan = await prisma.loan.findUnique({
    where: { loanRequestId },
    include: {
      agreement: true,
      loanRequest: { include: { businessProfile: true } },
      owner: { select: { id: true, name: true, headline: true, image: true, trustScore: true } },
      investor: { select: { id: true, name: true, headline: true, image: true, trustScore: true } },
      repayments: { orderBy: { installmentNo: "asc" } },
    },
  });

  if (!loan || !loan.agreement) {
    throw new NotFoundError("No agreement exists for this loan request yet");
  }
  if (loan.ownerId !== actor.id && loan.investorId !== actor.id && actor.role !== "ADMIN") {
    throw new ForbiddenError("Only parties to the agreement can view it");
  }

  const schedulePreview =
    loan.repayments.length > 0
      ? loan.repayments
      : generateRepaymentSchedule({
          principalBdt: loan.principalBdt,
          interestRatePct: Number(loan.interestRatePct),
          tenureDays: loan.tenureDays,
          frequency: loan.repaymentFrequency,
          startDate: loan.startDate ?? new Date(),
        }).installments;

  return { loan, agreement: loan.agreement, schedulePreview };
}

/**
 * Dual-party agreement confirmation per AGENTS.md §6:
 * Once both owner and investor confirm, generates exact Repayment rows,
 * activates Loan, and moves LoanRequest to REPAYING in one transaction.
 */
export async function confirmAgreement(actor: Actor, loanRequestId: string) {
  const loan = await prisma.loan.findUnique({
    where: { loanRequestId },
    include: { agreement: true, loanRequest: true },
  });

  if (!loan || !loan.agreement) {
    throw new NotFoundError("Agreement not found");
  }

  const isOwner = loan.ownerId === actor.id;
  const isInvestor = loan.investorId === actor.id;
  if (!isOwner && !isInvestor) {
    throw new ForbiddenError("Only the borrower or investor can confirm this agreement");
  }
  if (loan.status !== "PENDING_AGREEMENT") {
    throw new ConflictError("Agreement has already been finalized");
  }
  if (isOwner && loan.agreement.ownerConfirmedAt) {
    throw new ConflictError("You have already confirmed this agreement");
  }
  if (isInvestor && loan.agreement.investorConfirmedAt) {
    throw new ConflictError("You have already confirmed this agreement");
  }

  const now = new Date();
  const bothConfirmed = Boolean(
    (isOwner ? now : loan.agreement.ownerConfirmedAt) &&
      (isInvestor ? now : loan.agreement.investorConfirmedAt),
  );

  return prisma.$transaction(async (tx) => {
    const agreement = await tx.agreement.update({
      where: { id: loan.agreement!.id },
      data: isOwner ? { ownerConfirmedAt: now } : { investorConfirmedAt: now },
    });

    if (bothConfirmed) {
      const schedule = generateRepaymentSchedule({
        principalBdt: loan.principalBdt,
        interestRatePct: Number(loan.interestRatePct),
        tenureDays: loan.tenureDays,
        frequency: loan.repaymentFrequency,
        startDate: now,
      });

      await tx.repayment.createMany({
        data: schedule.installments.map((inst) => ({
          loanId: loan.id,
          installmentNo: inst.installmentNo,
          dueDate: inst.dueDate,
          amountBdt: inst.amountBdt,
          status: "UPCOMING",
        })),
      });

      await tx.loan.update({
        where: { id: loan.id },
        data: { status: "ACTIVE", startDate: now },
      });

      await tx.loanRequest.update({
        where: { id: loan.loanRequestId },
        data: { status: "REPAYING" },
      });

      await Promise.all([
        createNotification(
          {
            userId: loan.ownerId,
            type: "AGREEMENT",
            title: "Loan agreement active",
            body: `Both parties confirmed "${loan.loanRequest.title}". Your ${schedule.installmentCount}-installment repayment schedule is now active.`,
            link: `/loans/${loan.loanRequestId}/agreement`,
            sendEmailCopy: true,
          },
          tx,
        ),
        createNotification(
          {
            userId: loan.investorId,
            type: "AGREEMENT",
            title: "Loan agreement active",
            body: `Both parties confirmed "${loan.loanRequest.title}". Repayment tracking is now active.`,
            link: `/loans/${loan.loanRequestId}/agreement`,
            sendEmailCopy: true,
          },
          tx,
        ),
      ]);
    }

    await recordAuditLog(
      {
        actorId: actor.id,
        action: bothConfirmed ? "AGREEMENT_ACTIVATED" : "AGREEMENT_CONFIRMED_ONE_SIDE",
        entityType: "Agreement",
        entityId: agreement.id,
        metadata: { loanId: loan.id, side: isOwner ? "OWNER" : "INVESTOR" },
      },
      tx,
    );

    return { agreement, activated: bothConfirmed };
  });
}
