import { assertRole, type Actor } from "@/server/auth/policy";
import { prisma } from "@/server/db";
import { ConflictError, NotFoundError, ValidationError } from "@/server/errors";
import {
  assertLendingActorVerified,
  loadOfferParties,
  toIso,
  type OfferParty,
} from "@/server/services/lending-shared";
import { buildRepaymentSchedule } from "@/server/services/repayment-schedule";
import { isUniqueViolation } from "@/server/services/social-shared";
import { agreementTermsSnapshotSchema } from "@/server/validators/offer";
import type { loanStatusSchema } from "@/server/validators/enums";
import type { z } from "zod";

type Db = typeof prisma;
type LoanStatus = z.infer<typeof loanStatusSchema>;
type AgreementTerms = z.infer<typeof agreementTermsSnapshotSchema>;

interface AgreementDeps {
  db?: Db;
  now?: () => Date;
}

interface AgreementRow {
  id: string;
  loanId: string;
  termsSnapshot: unknown;
  ownerConfirmedAt: Date | null;
  investorConfirmedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
  loan: {
    id: string;
    loanRequestId: string;
    ownerId: string;
    investorId: string;
    principalBdt: number;
    interestRatePct: unknown;
    tenureDays: number;
    repaymentFrequency: "WEEKLY" | "BIWEEKLY" | "MONTHLY";
    totalRepayableBdt: number;
    status: LoanStatus;
    startDate: Date | null;
    loanRequest: { id: string; ownerId: string; purpose: string; status: string };
  };
}

const agreementInclude = {
  loan: {
    include: {
      loanRequest: { select: { id: true, ownerId: true, purpose: true, status: true } },
    },
  },
} as const;

async function loadAgreement(
  id: string,
  db: Pick<Db, "agreement">,
): Promise<AgreementRow> {
  const row = await db.agreement.findUnique({ where: { id }, include: agreementInclude });
  if (!row) throw new NotFoundError("Agreement not found");
  return row as unknown as AgreementRow;
}

function assertParticipant(agreement: AgreementRow, actor: Actor): "OWNER" | "INVESTOR" {
  if (actor.id === agreement.loan.ownerId) {
    assertRole(actor, "OWNER");
    return "OWNER";
  }
  if (actor.id === agreement.loan.investorId) {
    assertRole(actor, "INVESTOR");
    return "INVESTOR";
  }
  throw new NotFoundError("Agreement not found");
}

function termsFrom(agreement: AgreementRow): AgreementTerms {
  return agreementTermsSnapshotSchema.parse(agreement.termsSnapshot);
}

async function toSummary(
  agreement: AgreementRow,
  parties: Map<string, OfferParty>,
  now: Date,
) {
  const owner = parties.get(agreement.loan.ownerId);
  const investor = parties.get(agreement.loan.investorId);
  if (!owner || !investor) throw new NotFoundError("Loan participant not found");

  const terms = termsFrom(agreement);
  const schedule = buildRepaymentSchedule({
    principalBdt: terms.principalBdt,
    interestRatePct: terms.interestRatePct,
    tenureDays: terms.tenureDays,
    repaymentFrequency: terms.repaymentFrequency,
    startDate: agreement.loan.startDate ?? now,
  });

  return {
    id: agreement.id,
    loanId: agreement.loan.id,
    loanRequestId: agreement.loan.loanRequest.id,
    status: agreement.loan.status,
    parties: { owner, investor },
    terms,
    confirmations: {
      ownerConfirmedAt: agreement.ownerConfirmedAt ? toIso(agreement.ownerConfirmedAt) : null,
      investorConfirmedAt: agreement.investorConfirmedAt
        ? toIso(agreement.investorConfirmedAt)
        : null,
      bothConfirmed: Boolean(agreement.ownerConfirmedAt && agreement.investorConfirmedAt),
    },
    schedulePreview: schedule.installments.map((installment) => ({
      installmentNo: installment.installmentNo,
      dueDate: toIso(installment.dueDate),
      amountBdt: installment.amountBdt,
    })),
    createdAt: toIso(agreement.createdAt),
    updatedAt: toIso(agreement.updatedAt),
  };
}

/** Participant-only agreement summary with stored terms and a server-calculated schedule preview. */
export async function getAgreement(
  actor: Actor,
  id: string,
  deps: AgreementDeps = {},
) {
  assertRole(actor, "OWNER", "INVESTOR");
  const db = deps.db ?? prisma;
  const now = (deps.now ?? (() => new Date()))();
  await assertLendingActorVerified(actor, db);

  const agreement = await loadAgreement(id, db);
  assertParticipant(agreement, actor);
  const parties = await loadOfferParties(
    [agreement.loan.ownerId, agreement.loan.investorId],
    db,
  );
  return toSummary(agreement, parties, now);
}

/**
 * Records one party's confirmation. The second confirmation atomically activates the loan,
 * writes the repayment schedule, moves the request to REPAYING and emits a feed post/notifications.
 */
export async function confirmAgreement(
  actor: Actor,
  id: string,
  deps: AgreementDeps = {},
) {
  assertRole(actor, "OWNER", "INVESTOR");
  const db = deps.db ?? prisma;
  const now = (deps.now ?? (() => new Date()))();
  await assertLendingActorVerified(actor, db);

  const existing = await loadAgreement(id, db);
  const role = assertParticipant(existing, actor);
  if (existing.loan.status !== "PENDING_AGREEMENT") {
    throw new ConflictError("Agreement is no longer awaiting confirmations");
  }
  if (role === "OWNER" ? existing.ownerConfirmedAt : existing.investorConfirmedAt) {
    throw new ConflictError("You have already confirmed this agreement");
  }

  try {
    await db.$transaction(async (tx) => {
      const agreement = await tx.agreement.findUnique({
        where: { id },
        include: agreementInclude,
      });
      if (!agreement) throw new NotFoundError("Agreement not found");
      const row = agreement as unknown as AgreementRow;
      const participantRole = assertParticipant(row, actor);

      if (row.loan.status !== "PENDING_AGREEMENT") {
        throw new ConflictError("Agreement is no longer awaiting confirmations");
      }
      const alreadyConfirmed =
        participantRole === "OWNER" ? row.ownerConfirmedAt : row.investorConfirmedAt;
      if (alreadyConfirmed) {
        throw new ConflictError("You have already confirmed this agreement");
      }

      const confirmationField =
        participantRole === "OWNER" ? "ownerConfirmedAt" : "investorConfirmedAt";
      const confirmed = await tx.agreement.updateMany({
        where: { id, [confirmationField]: null },
        data: { [confirmationField]: now },
      });
      if (confirmed.count === 0) {
        throw new ConflictError("You have already confirmed this agreement");
      }

      const ownerConfirmedAt = participantRole === "OWNER" ? now : row.ownerConfirmedAt;
      const investorConfirmedAt =
        participantRole === "INVESTOR" ? now : row.investorConfirmedAt;
      if (!ownerConfirmedAt || !investorConfirmedAt) return;

      const activated = await tx.loan.updateMany({
        where: { id: row.loan.id, status: "PENDING_AGREEMENT" },
        data: { status: "ACTIVE", startDate: now },
      });
      if (activated.count === 0) {
        throw new ConflictError("Loan is no longer awaiting agreement confirmation");
      }

      const terms = termsFrom(row);
      const schedule = buildRepaymentSchedule({
        principalBdt: terms.principalBdt,
        interestRatePct: terms.interestRatePct,
        tenureDays: terms.tenureDays,
        repaymentFrequency: terms.repaymentFrequency,
        startDate: now,
      });
      if (schedule.totalRepayableBdt !== terms.totalRepayableBdt) {
        throw new ValidationError("Stored agreement terms do not match the repayment schedule");
      }

      await tx.repayment.createMany({
        data: schedule.installments.map((installment) => ({
          loanId: row.loan.id,
          installmentNo: installment.installmentNo,
          dueDate: installment.dueDate,
          amountBdt: installment.amountBdt,
          status: "UPCOMING",
        })),
      });

      const repaid = await tx.loanRequest.updateMany({
        where: { id: row.loan.loanRequest.id, status: "FUNDED" },
        data: { status: "REPAYING" },
      });
      if (repaid.count === 0) {
        throw new ConflictError("Loan request is no longer funded");
      }

      const link = `/agreements/${row.id}`;
      await tx.notification.create({
        data: {
          userId: row.loan.ownerId,
          type: "AGREEMENT_CONFIRMED",
          title: "Agreement confirmed",
          body: `The agreement for ৳${terms.principalBdt} is confirmed. Repayments are now scheduled.`,
          link,
          data: {
            agreementId: row.id,
            loanId: row.loan.id,
            loanRequestId: row.loan.loanRequest.id,
          },
        },
      });
      await tx.notification.create({
        data: {
          userId: row.loan.investorId,
          type: "AGREEMENT_CONFIRMED",
          title: "Agreement confirmed",
          body: `The agreement for ৳${terms.principalBdt} is confirmed. Repayments are now scheduled.`,
          link,
          data: {
            agreementId: row.id,
            loanId: row.loan.id,
            loanRequestId: row.loan.loanRequest.id,
          },
        },
      });
      await tx.post.create({
        data: {
          authorId: row.loan.ownerId,
          type: "MILESTONE",
          content: `Loan agreement confirmed: ৳${terms.principalBdt} for ${terms.tenureDays} days. Repayments are now scheduled.`,
          loanRequestId: row.loan.loanRequest.id,
        },
      });
    });

    return getAgreement(actor, id, deps);
  } catch (error) {
    if (isUniqueViolation(error)) {
      throw new ConflictError("Agreement confirmation or repayment schedule already exists");
    }
    throw error;
  }
}
