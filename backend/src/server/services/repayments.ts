import { computeTrustScore } from "@/lib/trust-score";
import { recordAuditLog } from "@/server/audit";
import { prisma } from "@/server/db";
import { ConflictError, ForbiddenError, NotFoundError } from "@/server/errors";
import { createNotification } from "@/server/notifications";
import type { Actor } from "@/server/services/actor";

/** Lazily marks past-due UPCOMING installments as OVERDUE. */
export async function detectOverdueRepayments(loanId?: string) {
  await prisma.repayment.updateMany({
    where: {
      ...(loanId ? { loanId } : {}),
      status: "UPCOMING",
      dueDate: { lt: new Date() },
    },
    data: { status: "OVERDUE" },
  });
}

export async function listRepaymentsForLoan(actor: Actor, loanRequestId: string) {
  const loan = await prisma.loan.findUnique({ where: { loanRequestId } });
  if (!loan) throw new NotFoundError("Loan not found");
  if (loan.ownerId !== actor.id && loan.investorId !== actor.id && actor.role !== "ADMIN") {
    throw new ForbiddenError("You are not authorized to view this repayment schedule");
  }

  await detectOverdueRepayments(loan.id);

  const repayments = await prisma.repayment.findMany({
    where: { loanId: loan.id },
    orderBy: { installmentNo: "asc" },
  });

  return { loan, repayments };
}

/** Owner marks an UPCOMING or OVERDUE installment as paid. */
export async function markRepaymentPaid(
  actor: Actor,
  repaymentId: string,
  input: { note?: string; proofUrl?: string },
) {
  const repayment = await prisma.repayment.findUnique({
    where: { id: repaymentId },
    include: { loan: { include: { loanRequest: true } } },
  });
  if (!repayment) throw new NotFoundError("Repayment installment not found");
  if (repayment.loan.ownerId !== actor.id) {
    throw new ForbiddenError("Only the borrower can mark an installment as paid");
  }
  if (repayment.status !== "UPCOMING" && repayment.status !== "OVERDUE") {
    throw new ConflictError(`Installment is already ${repayment.status}`);
  }

  return prisma.$transaction(async (tx) => {
    const updated = await tx.repayment.update({
      where: { id: repaymentId },
      data: {
        status: "MARKED_PAID",
        markedPaidAt: new Date(),
        note: input.note ?? null,
        proofUrl: input.proofUrl ?? null,
      },
    });

    await createNotification(
      {
        userId: repayment.loan.investorId,
        type: "REPAYMENT",
        title: `Installment #${repayment.installmentNo} marked paid`,
        body: `Borrower marked installment #${repayment.installmentNo} (৳${repayment.amountBdt.toLocaleString("en-IN")}) paid for "${repayment.loan.loanRequest.title}". Please confirm receipt.`,
        link: `/loans/${repayment.loan.loanRequestId}/agreement`,
        sendEmailCopy: true,
      },
      tx,
    );

    await recordAuditLog(
      {
        actorId: actor.id,
        action: "REPAYMENT_MARKED_PAID",
        entityType: "Repayment",
        entityId: repaymentId,
        metadata: { loanId: repayment.loanId, installmentNo: repayment.installmentNo },
      },
      tx,
    );

    return updated;
  });
}

/** Investor confirms receipt of a MARKED_PAID installment. Completes loan when all confirmed. */
export async function confirmRepayment(actor: Actor, repaymentId: string) {
  const repayment = await prisma.repayment.findUnique({
    where: { id: repaymentId },
    include: { loan: { include: { loanRequest: true } } },
  });
  if (!repayment) throw new NotFoundError("Repayment installment not found");
  if (repayment.loan.investorId !== actor.id) {
    throw new ForbiddenError("Only the investor can confirm repayment receipt");
  }
  if (repayment.status !== "MARKED_PAID") {
    throw new ConflictError("Installment must be marked paid by the borrower first");
  }

  return prisma.$transaction(async (tx) => {
    const updated = await tx.repayment.update({
      where: { id: repaymentId },
      data: { status: "CONFIRMED", confirmedAt: new Date() },
    });

    const unconfirmed = await tx.repayment.count({
      where: { loanId: repayment.loanId, status: { not: "CONFIRMED" } },
    });

    const loanCompleted = unconfirmed === 0;
    if (loanCompleted) {
      await tx.loan.update({
        where: { id: repayment.loanId },
        data: { status: "COMPLETED", completedAt: new Date() },
      });
      await tx.loanRequest.update({
        where: { id: repayment.loan.loanRequestId },
        data: { status: "COMPLETED" },
      });
    }

    // Recompute borrower's trust score from live repayment & completion history.
    const [confirmedCount, overdueCount, completedLoans, ratingAgg] = await Promise.all([
      tx.repayment.count({ where: { loan: { ownerId: repayment.loan.ownerId }, status: "CONFIRMED" } }),
      tx.repayment.count({ where: { loan: { ownerId: repayment.loan.ownerId }, status: "OVERDUE" } }),
      tx.loan.count({ where: { ownerId: repayment.loan.ownerId, status: "COMPLETED" } }),
      tx.review.aggregate({
        where: { revieweeId: repayment.loan.ownerId },
        _avg: { rating: true },
      }),
    ]);

    const newTrustScore = computeTrustScore({
      verified: true,
      onTimeRepayments: confirmedCount,
      overdueRepayments: overdueCount,
      completedLoans,
      averageRating: ratingAgg._avg.rating ?? 0,
    });

    await tx.user.update({
      where: { id: repayment.loan.ownerId },
      data: { trustScore: newTrustScore },
    });
    await tx.businessProfile.updateMany({
      where: { ownerId: repayment.loan.ownerId },
      data: { trustScore: newTrustScore },
    });

    await createNotification(
      {
        userId: repayment.loan.ownerId,
        type: "REPAYMENT",
        title: loanCompleted ? "Loan completed!" : `Installment #${repayment.installmentNo} confirmed`,
        body: loanCompleted
          ? `All installments for "${repayment.loan.loanRequest.title}" are confirmed. Your trust score is now ${newTrustScore}.`
          : `Investor confirmed receipt of installment #${repayment.installmentNo}.`,
        link: `/loans/${repayment.loan.loanRequestId}/agreement`,
        sendEmailCopy: true,
      },
      tx,
    );

    await recordAuditLog(
      {
        actorId: actor.id,
        action: loanCompleted ? "LOAN_COMPLETED" : "REPAYMENT_CONFIRMED",
        entityType: "Repayment",
        entityId: repaymentId,
        metadata: { loanId: repayment.loanId, newTrustScore },
      },
      tx,
    );

    return { repayment: updated, loanCompleted, trustScore: newTrustScore };
  });
}
