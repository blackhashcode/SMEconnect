import type { RepaymentFrequency } from "@/generated/prisma/client";
import { calculateTotalRepayableBdt } from "@/lib/finance";
import { recordAuditLog } from "@/server/audit";
import { prisma } from "@/server/db";
import { BusinessRuleError, ConflictError, ForbiddenError, NotFoundError } from "@/server/errors";
import { createNotification } from "@/server/notifications";
import type { Actor } from "@/server/services/actor";
import { isUserVerified } from "@/server/services/verifications";

const OFFER_TTL_MS = 7 * 24 * 60 * 60 * 1000; // 7 days

export interface CreateOfferInput {
  amountBdt: number;
  interestRatePct: number;
  tenureDays: number;
  repaymentFrequency: RepaymentFrequency;
  message: string;
}

export type RespondOfferInput =
  | { action: "ACCEPT" }
  | { action: "REJECT"; note?: string }
  | { action: "WITHDRAW" }
  | {
      action: "COUNTER";
      amountBdt: number;
      interestRatePct: number;
      tenureDays: number;
      repaymentFrequency?: RepaymentFrequency;
      message?: string;
    };

/** Marks expired pending offers lazily on read/action. */
export async function expireStaleOffers(loanRequestId?: string) {
  await prisma.offer.updateMany({
    where: {
      ...(loanRequestId ? { loanRequestId } : {}),
      status: "PENDING",
      expiresAt: { lt: new Date() },
    },
    data: { status: "EXPIRED" },
  });
}

export async function createOffer(actor: Actor, loanRequestId: string, input: CreateOfferInput) {
  if (actor.role !== "INVESTOR") {
    throw new ForbiddenError("Only investors can submit loan offers");
  }

  const verified = await isUserVerified(actor.id);
  if (!verified) {
    throw new ForbiddenError("Only verified investors can submit loan offers");
  }

  await expireStaleOffers(loanRequestId);

  const loanRequest = await prisma.loanRequest.findUnique({ where: { id: loanRequestId } });
  if (!loanRequest) throw new NotFoundError("Loan request not found");
  if (loanRequest.ownerId === actor.id) {
    throw new ForbiddenError("You cannot make an offer on your own loan request");
  }
  if (loanRequest.status !== "OPEN" && loanRequest.status !== "IN_DISCUSSION") {
    throw new ConflictError("This loan request is not accepting offers");
  }
  if (input.amountBdt > loanRequest.amountBdt * 2) {
    throw new BusinessRuleError("Offer amount cannot exceed double the requested amount");
  }

  const existing = await prisma.offer.findFirst({
    where: { loanRequestId, investorId: actor.id, status: "PENDING" },
    select: { id: true },
  });
  if (existing) {
    throw new ConflictError("You already have a pending offer on this request");
  }

  return prisma.$transaction(async (tx) => {
    const offer = await tx.offer.create({
      data: {
        loanRequestId,
        investorId: actor.id,
        amountBdt: input.amountBdt,
        interestRatePct: input.interestRatePct,
        tenureDays: input.tenureDays,
        repaymentFrequency: input.repaymentFrequency,
        message: input.message,
        status: "PENDING",
        proposedBy: "INVESTOR",
        expiresAt: new Date(Date.now() + OFFER_TTL_MS),
      },
    });

    if (loanRequest.status === "OPEN") {
      await tx.loanRequest.update({
        where: { id: loanRequestId },
        data: { status: "IN_DISCUSSION" },
      });
    }

    await createNotification(
      {
        userId: loanRequest.ownerId,
        type: "OFFER",
        title: "New loan offer received",
        body: `An investor sent an offer of ৳${input.amountBdt.toLocaleString("en-IN")} at ${input.interestRatePct}% p.a. on "${loanRequest.title}".`,
        link: `/loans/offers/${offer.id}/review`,
        sendEmailCopy: true,
      },
      tx,
    );

    await recordAuditLog(
      {
        actorId: actor.id,
        action: "OFFER_CREATED",
        entityType: "Offer",
        entityId: offer.id,
        metadata: { loanRequestId, amountBdt: input.amountBdt, interestRatePct: input.interestRatePct },
      },
      tx,
    );

    return offer;
  });
}

export async function listOffersForUser(actor: Actor, roleFilter?: "sent" | "received") {
  await expireStaleOffers();

  const where =
    roleFilter === "sent"
      ? { investorId: actor.id }
      : roleFilter === "received"
        ? { loanRequest: { ownerId: actor.id } }
        : { OR: [{ investorId: actor.id }, { loanRequest: { ownerId: actor.id } }] };

  return prisma.offer.findMany({
    where,
    include: {
      investor: { select: { id: true, name: true, headline: true, image: true, trustScore: true } },
      loanRequest: {
        include: {
          businessProfile: { select: { id: true, shopName: true, category: true, ownerId: true } },
        },
      },
    },
    orderBy: { updatedAt: "desc" },
  });
}

export async function getOfferById(actor: Actor, offerId: string) {
  await expireStaleOffers();

  const offer = await prisma.offer.findUnique({
    where: { id: offerId },
    include: {
      investor: { select: { id: true, name: true, headline: true, image: true, trustScore: true } },
      loanRequest: {
        include: {
          businessProfile: true,
          owner: { select: { id: true, name: true, headline: true, image: true, trustScore: true } },
        },
      },
    },
  });

  if (!offer) throw new NotFoundError("Offer not found");
  const isOwner = offer.loanRequest.ownerId === actor.id;
  const isInvestor = offer.investorId === actor.id;
  if (!isOwner && !isInvestor && actor.role !== "ADMIN") {
    throw new NotFoundError("Offer not found");
  }

  return { offer, viewerSide: isOwner ? ("OWNER" as const) : ("INVESTOR" as const) };
}

/**
 * State machine for offer negotiation per AGENTS.md §6:
 * - Counter creates a new Offer linked via `parentOfferId`, marking old offer COUNTERED.
 * - Accept executes atomically in `$transaction`: offer -> ACCEPTED, all other pending
 *   offers on the request -> REJECTED, request -> FUNDED, creates Loan + Agreement.
 */
export async function respondToOffer(actor: Actor, offerId: string, input: RespondOfferInput) {
  await expireStaleOffers();

  const offer = await prisma.offer.findUnique({
    where: { id: offerId },
    include: { loanRequest: true },
  });
  if (!offer) throw new NotFoundError("Offer not found");

  const isOwner = offer.loanRequest.ownerId === actor.id;
  const isInvestor = offer.investorId === actor.id;
  if (!isOwner && !isInvestor) {
    throw new ForbiddenError("You are not a party to this offer");
  }

  if (offer.status !== "PENDING") {
    throw new ConflictError(`This offer is already ${offer.status}`);
  }
  if (offer.expiresAt < new Date()) {
    await prisma.offer.update({ where: { id: offer.id }, data: { status: "EXPIRED" } });
    throw new ConflictError("This offer has expired");
  }
  if (offer.loanRequest.status !== "OPEN" && offer.loanRequest.status !== "IN_DISCUSSION") {
    throw new ConflictError("This loan request is no longer open for negotiation");
  }

  const actorSide = isOwner ? "OWNER" : "INVESTOR";

  if (input.action === "WITHDRAW") {
    if (offer.proposedBy !== actorSide) {
      throw new ForbiddenError("Only the party who proposed this offer can withdraw it");
    }
    return prisma.$transaction(async (tx) => {
      const updated = await tx.offer.update({
        where: { id: offer.id },
        data: { status: "WITHDRAWN" },
      });
      const remaining = await tx.offer.count({
        where: { loanRequestId: offer.loanRequestId, status: "PENDING" },
      });
      if (remaining === 0) {
        await tx.loanRequest.update({
          where: { id: offer.loanRequestId },
          data: { status: "OPEN" },
        });
      }
      await recordAuditLog(
        { actorId: actor.id, action: "OFFER_WITHDRAWN", entityType: "Offer", entityId: offer.id },
        tx,
      );
      return { offer: updated };
    });
  }

  // Only the counterparty to the last proposer can ACCEPT, REJECT, or COUNTER.
  if (offer.proposedBy === actorSide) {
    throw new ForbiddenError("Wait for the other party to respond to your proposal");
  }

  if (input.action === "REJECT") {
    return prisma.$transaction(async (tx) => {
      const updated = await tx.offer.update({
        where: { id: offer.id },
        data: { status: "REJECTED" },
      });
      const remaining = await tx.offer.count({
        where: { loanRequestId: offer.loanRequestId, status: "PENDING" },
      });
      if (remaining === 0) {
        await tx.loanRequest.update({
          where: { id: offer.loanRequestId },
          data: { status: "OPEN" },
        });
      }
      const recipientId = isOwner ? offer.investorId : offer.loanRequest.ownerId;
      await createNotification(
        {
          userId: recipientId,
          type: "OFFER",
          title: "Loan offer declined",
          body: input.note
            ? `Your offer on "${offer.loanRequest.title}" was declined: ${input.note}`
            : `Your offer on "${offer.loanRequest.title}" was declined.`,
          link: `/loans/offers/${offer.id}/review`,
          sendEmailCopy: true,
        },
        tx,
      );
      await recordAuditLog(
        { actorId: actor.id, action: "OFFER_REJECTED", entityType: "Offer", entityId: offer.id },
        tx,
      );
      return { offer: updated };
    });
  }

  if (input.action === "COUNTER") {
    if (input.amountBdt > offer.loanRequest.amountBdt * 2) {
      throw new BusinessRuleError("Counter-offer amount cannot exceed double the requested amount");
    }

    return prisma.$transaction(async (tx) => {
      await tx.offer.update({
        where: { id: offer.id },
        data: { status: "COUNTERED" },
      });

      const counterOffer = await tx.offer.create({
        data: {
          loanRequestId: offer.loanRequestId,
          investorId: offer.investorId,
          amountBdt: input.amountBdt,
          interestRatePct: input.interestRatePct,
          tenureDays: input.tenureDays,
          repaymentFrequency: input.repaymentFrequency ?? offer.repaymentFrequency,
          message: input.message ?? "",
          status: "PENDING",
          proposedBy: actorSide,
          parentOfferId: offer.id,
          expiresAt: new Date(Date.now() + OFFER_TTL_MS),
        },
      });

      const recipientId = isOwner ? offer.investorId : offer.loanRequest.ownerId;
      await createNotification(
        {
          userId: recipientId,
          type: "OFFER",
          title: "Counter-offer proposed",
          body: `New terms proposed on "${offer.loanRequest.title}": ৳${input.amountBdt.toLocaleString("en-IN")} at ${input.interestRatePct}% p.a.`,
          link: `/loans/offers/${counterOffer.id}/review`,
          sendEmailCopy: true,
        },
        tx,
      );

      await recordAuditLog(
        {
          actorId: actor.id,
          action: "OFFER_COUNTERED",
          entityType: "Offer",
          entityId: counterOffer.id,
          metadata: { parentOfferId: offer.id, amountBdt: input.amountBdt },
        },
        tx,
      );

      return { offer: counterOffer };
    });
  }

  // ACCEPT — single atomic transaction
  const rateNum = Number(offer.interestRatePct);
  const { totalRepayableBdt } = calculateTotalRepayableBdt(
    offer.amountBdt,
    rateNum,
    offer.tenureDays,
  );

  return prisma.$transaction(async (tx) => {
    const acceptedOffer = await tx.offer.update({
      where: { id: offer.id },
      data: { status: "ACCEPTED" },
    });

    await tx.offer.updateMany({
      where: {
        loanRequestId: offer.loanRequestId,
        id: { not: offer.id },
        status: "PENDING",
      },
      data: { status: "REJECTED" },
    });

    await tx.loanRequest.update({
      where: { id: offer.loanRequestId },
      data: { status: "FUNDED" },
    });

    const loan = await tx.loan.create({
      data: {
        loanRequestId: offer.loanRequestId,
        offerId: offer.id,
        ownerId: offer.loanRequest.ownerId,
        investorId: offer.investorId,
        principalBdt: offer.amountBdt,
        interestRatePct: offer.interestRatePct,
        tenureDays: offer.tenureDays,
        repaymentFrequency: offer.repaymentFrequency,
        totalRepayableBdt,
        status: "PENDING_AGREEMENT",
      },
    });

    const agreement = await tx.agreement.create({
      data: {
        loanId: loan.id,
        termsSnapshot: {
          loanRequestId: offer.loanRequestId,
          title: offer.loanRequest.title,
          principalBdt: offer.amountBdt,
          interestRatePct: rateNum,
          tenureDays: offer.tenureDays,
          repaymentFrequency: offer.repaymentFrequency,
          totalRepayableBdt,
          acceptedAt: new Date().toISOString(),
        },
      },
    });

    const recipientId = isOwner ? offer.investorId : offer.loanRequest.ownerId;
    await createNotification(
      {
        userId: recipientId,
        type: "AGREEMENT",
        title: "Offer accepted — confirm agreement",
        body: `Your offer on "${offer.loanRequest.title}" was accepted. Please confirm the loan agreement to begin repayment tracking.`,
        link: `/loans/${offer.loanRequestId}/agreement`,
        sendEmailCopy: true,
      },
      tx,
    );

    await recordAuditLog(
      {
        actorId: actor.id,
        action: "OFFER_ACCEPTED",
        entityType: "Loan",
        entityId: loan.id,
        metadata: { offerId: offer.id, principalBdt: offer.amountBdt, totalRepayableBdt },
      },
      tx,
    );

    return { offer: acceptedOffer, loan, agreement };
  });
}
