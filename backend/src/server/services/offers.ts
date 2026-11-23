import { assertRole, type Actor } from "@/server/auth/policy";
import { prisma } from "@/server/db";
import {
  BusinessRuleError,
  ConflictError,
  ForbiddenError,
  NotFoundError,
} from "@/server/errors";
import {
  assertLendingActorVerified,
  assertRequestOpenForOffers,
  isOfferExpired,
  loadOfferParties,
  toIso,
} from "@/server/services/lending-shared";
import { calculateTotalRepayableBdt } from "@/server/services/repayment-schedule";
import {
  cursorId,
  isUniqueViolation,
  pageMeta,
  PUBLIC_USER_SELECT,
  type PublicUserRow,
} from "@/server/services/social-shared";
import {
  counterOfferSchema,
  createOfferSchema,
  offerListQuerySchema,
  type agreementTermsSnapshotSchema,
} from "@/server/validators/offer";
import { normalizeRatePct } from "@/server/validators/common";
import type { z } from "zod";
import type {
  loanRequestStatusSchema,
  offerProposerSchema,
  offerStatusSchema,
} from "@/server/validators/enums";

type Db = typeof prisma;
type OfferReader = Pick<Db, "offer">;
type PartyDb = Pick<Db, "user" | "userVerification">;
type CreateInput = z.input<typeof createOfferSchema>;
type CounterInput = z.input<typeof counterOfferSchema>;
type OfferStatus = z.infer<typeof offerStatusSchema>;
type Proposer = z.infer<typeof offerProposerSchema>;
type RequestStatus = z.infer<typeof loanRequestStatusSchema>;
type AgreementTerms = z.infer<typeof agreementTermsSnapshotSchema>;

export const OFFER_EXPIRY_DAYS = 7;
const MS_PER_DAY = 24 * 60 * 60 * 1000;

interface OfferDeps {
  db?: Db;
  now?: () => Date;
}

interface RequestSummaryRow {
  id: string;
  ownerId: string;
  purpose: string;
  status: RequestStatus;
  amountBdt: number;
  tenureDays: number;
}

interface OfferRow {
  id: string;
  loanRequestId: string;
  investorId: string;
  amountBdt: number;
  interestRatePct: unknown;
  tenureDays: number;
  repaymentFrequency: "WEEKLY" | "BIWEEKLY" | "MONTHLY";
  message: string | null;
  status: OfferStatus;
  parentOfferId: string | null;
  proposedBy: Proposer;
  expiresAt: Date;
  createdAt: Date;
  updatedAt: Date;
  loanRequest: RequestSummaryRow;
  investor: PublicUserRow;
}

const offerInclude = {
  loanRequest: {
    select: {
      id: true,
      ownerId: true,
      purpose: true,
      status: true,
      amountBdt: true,
      tenureDays: true,
    },
  },
  investor: { select: PUBLIC_USER_SELECT },
} as const;

async function loadOffer(id: string, db: OfferReader): Promise<OfferRow> {
  const row = await db.offer.findUnique({ where: { id }, include: offerInclude });
  if (!row) throw new NotFoundError("Offer not found");
  return row as unknown as OfferRow;
}

function effectiveStatus(offer: OfferRow, now: Date): OfferStatus {
  return offer.status === "PENDING" && isOfferExpired(offer.expiresAt, now)
    ? "EXPIRED"
    : offer.status;
}

function assertActionable(offer: OfferRow, now: Date): void {
  const status = effectiveStatus(offer, now);
  if (status !== "PENDING") {
    throw new ConflictError(`Cannot respond to a ${status} offer`);
  }
}

function proposerFor(offer: OfferRow): { id: string; role: Proposer } {
  if (offer.proposedBy === "INVESTOR") return { id: offer.investorId, role: "INVESTOR" };
  return { id: offer.loanRequest.ownerId, role: "OWNER" };
}

function counterpartyFor(offer: OfferRow): { id: string; role: Proposer } {
  if (offer.proposedBy === "INVESTOR") return { id: offer.loanRequest.ownerId, role: "OWNER" };
  return { id: offer.investorId, role: "INVESTOR" };
}

function assertProposer(offer: OfferRow, actor: Actor): void {
  const proposer = proposerFor(offer);
  assertRole(actor, proposer.role);
  if (actor.id !== proposer.id) {
    throw new ForbiddenError("Only the offer's proposer can withdraw it");
  }
}

function assertCounterparty(offer: OfferRow, actor: Actor): void {
  const counterparty = counterpartyFor(offer);
  assertRole(actor, counterparty.role);
  if (actor.id !== counterparty.id) {
    throw new ForbiddenError("Only the other party can respond to this offer");
  }
}

function assertOfferAccess(offer: OfferRow, actor: Actor): void {
  if (actor.id === offer.loanRequest.ownerId) {
    assertRole(actor, "OWNER");
    return;
  }
  if (actor.id === offer.investorId) {
    assertRole(actor, "INVESTOR");
    return;
  }
  throw new NotFoundError("Offer not found");
}

async function notify(
  tx: Pick<Db, "notification">,
  userId: string,
  type:
    | "OFFER_RECEIVED"
    | "OFFER_COUNTERED"
    | "OFFER_ACCEPTED"
    | "AGREEMENT_CONFIRMED",
  title: string,
  body: string,
  data: Record<string, string | number>,
): Promise<void> {
  await tx.notification.create({
    data: { userId, type, title, body, link: "/offers", data },
  });
}

async function toOfferRecord(offer: OfferRow, db: PartyDb, now: Date) {
  const parties = await loadOfferParties([offer.loanRequest.ownerId, offer.investorId], db);
  const investorParty = parties.get(offer.investorId);
  const ownerParty = parties.get(offer.loanRequest.ownerId);
  if (!investorParty || !ownerParty) throw new NotFoundError("Loan participant not found");

  return {
    id: offer.id,
    loanRequest: {
      id: offer.loanRequest.id,
      purpose: offer.loanRequest.purpose,
      status: offer.loanRequest.status,
      amountBdt: offer.loanRequest.amountBdt,
      tenureDays: offer.loanRequest.tenureDays,
    },
    investor: investorParty,
    owner: ownerParty,
    amountBdt: offer.amountBdt,
    interestRatePct: normalizeRatePct(String(offer.interestRatePct)),
    tenureDays: offer.tenureDays,
    repaymentFrequency: offer.repaymentFrequency,
    message: offer.message ?? null,
    status: effectiveStatus(offer, now),
    proposedBy: offer.proposedBy,
    parentOfferId: offer.parentOfferId,
    expiresAt: toIso(offer.expiresAt),
    createdAt: toIso(offer.createdAt),
    updatedAt: toIso(offer.updatedAt),
  };
}

async function listOffers(
  actor: Actor,
  query: { cursor?: string; limit: number; loanRequestId?: string },
  where: Record<string, unknown>,
  deps: OfferDeps,
) {
  const db = deps.db ?? prisma;
  const now = (deps.now ?? (() => new Date()))();
  const cursor = cursorId(query.cursor);

  const rows = await db.offer.findMany({
    where: { ...where, ...(query.loanRequestId ? { loanRequestId: query.loanRequestId } : {}) },
    include: offerInclude,
    orderBy: [{ createdAt: "desc" }, { id: "desc" }],
    take: query.limit + 1,
    ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
  });

  const page = pageMeta(rows as unknown as OfferRow[], query.limit);
  const items = await Promise.all(
    page.items.map((row) => toOfferRecord(row, db, now)),
  );
  return { items, meta: page.meta };
}

function mapOfferWriteError(error: unknown): never {
  if (isUniqueViolation(error)) {
    throw new BusinessRuleError("A conflicting pending offer already exists", {
      field: "offer",
    });
  }
  throw error;
}

function agreementTerms(
  offer: OfferRow,
  totalRepayableBdt: number,
): AgreementTerms {
  return {
    loanRequestId: offer.loanRequest.id,
    offerId: offer.id,
    principalBdt: offer.amountBdt,
    interestRatePct: normalizeRatePct(String(offer.interestRatePct)),
    tenureDays: offer.tenureDays,
    repaymentFrequency: offer.repaymentFrequency,
    totalRepayableBdt,
  };
}

/** Investor submits a new offer. The server owns identity, expiry and the first-discussion transition. */
export async function createOffer(
  actor: Actor,
  input: CreateInput,
  deps: OfferDeps = {},
) {
  assertRole(actor, "INVESTOR");
  const parsed = createOfferSchema.parse(input);
  const db = deps.db ?? prisma;
  const now = (deps.now ?? (() => new Date()))();
  await assertLendingActorVerified(actor, db);

  try {
    const offerId = await db.$transaction(async (tx) => {
      const request = await tx.loanRequest.findUnique({
        where: { id: parsed.loanRequestId },
      });
      if (!request) throw new NotFoundError("Loan request not found");
      if (request.ownerId === actor.id) {
        throw new BusinessRuleError("You cannot make an offer on your own loan request");
      }
      assertRequestOpenForOffers(request.status as string);

      const pending = await tx.offer.findMany({
        where: {
          loanRequestId: parsed.loanRequestId,
          investorId: actor.id,
          status: "PENDING",
        },
        select: { id: true, expiresAt: true },
      });
      const live = pending.filter((row) => !isOfferExpired(row.expiresAt, now));
      if (live.length > 0) {
        throw new BusinessRuleError("You already have a pending offer on this request");
      }
      const expiredIds = pending
        .filter((row) => isOfferExpired(row.expiresAt, now))
        .map((row) => row.id);
      if (expiredIds.length > 0) {
        await tx.offer.updateMany({
          where: { id: { in: expiredIds } },
          data: { status: "EXPIRED" },
        });
      }

      const transition = await tx.loanRequest.updateMany({
        where: { id: parsed.loanRequestId, status: { in: ["OPEN", "IN_DISCUSSION"] } },
        data: { status: "IN_DISCUSSION" },
      });
      if (transition.count === 0) {
        throw new ConflictError("Loan request is no longer open for offers");
      }

      const offer = await tx.offer.create({
        data: {
          loanRequestId: parsed.loanRequestId,
          investorId: actor.id,
          amountBdt: parsed.amountBdt,
          interestRatePct: parsed.interestRatePct,
          tenureDays: parsed.tenureDays,
          repaymentFrequency: parsed.repaymentFrequency,
          message: parsed.message ?? null,
          status: "PENDING",
          proposedBy: "INVESTOR",
          parentOfferId: null,
          expiresAt: new Date(now.getTime() + OFFER_EXPIRY_DAYS * MS_PER_DAY),
        },
      });

      await notify(
        tx,
        request.ownerId,
        "OFFER_RECEIVED",
        "New offer received",
        `An investor offered ৳${parsed.amountBdt} for your loan request.`,
        { offerId: offer.id, loanRequestId: request.id },
      );
      return offer.id;
    });

    return toOfferRecord(await loadOffer(offerId, db), db, now);
  } catch (error) {
    mapOfferWriteError(error);
  }
}

/** Offers on loan requests owned by the session OWNER. */
export async function listReceivedOffers(
  actor: Actor,
  query: { cursor?: string; limit: number; loanRequestId?: string },
  deps: OfferDeps = {},
) {
  assertRole(actor, "OWNER");
  const db = deps.db ?? prisma;
  await assertLendingActorVerified(actor, db);
  const filters = offerListQuerySchema.parse({ loanRequestId: query.loanRequestId });
  return listOffers(actor, { ...query, ...filters }, { loanRequest: { ownerId: actor.id } }, deps);
}

/** Offers submitted by the session INVESTOR. */
export async function listSubmittedOffers(
  actor: Actor,
  query: { cursor?: string; limit: number; loanRequestId?: string },
  deps: OfferDeps = {},
) {
  assertRole(actor, "INVESTOR");
  const db = deps.db ?? prisma;
  await assertLendingActorVerified(actor, db);
  const filters = offerListQuerySchema.parse({ loanRequestId: query.loanRequestId });
  return listOffers(actor, { ...query, ...filters }, { investorId: actor.id }, deps);
}

export async function getOffer(actor: Actor, id: string, deps: OfferDeps = {}) {
  assertRole(actor, "OWNER", "INVESTOR");
  const db = deps.db ?? prisma;
  const now = (deps.now ?? (() => new Date()))();
  await assertLendingActorVerified(actor, db);
  const offer = await loadOffer(id, db);
  assertOfferAccess(offer, actor);
  return toOfferRecord(offer, db, now);
}

/** Proposer takes back a pending offer (including an OWNER-proposed counter). */
export async function withdrawOffer(actor: Actor, id: string, deps: OfferDeps = {}) {
  assertRole(actor, "OWNER", "INVESTOR");
  const db = deps.db ?? prisma;
  const now = (deps.now ?? (() => new Date()))();
  await assertLendingActorVerified(actor, db);
  const offer = await loadOffer(id, db);
  assertProposer(offer, actor);
  assertActionable(offer, now);

  const result = await db.offer.updateMany({
    where: { id, status: "PENDING", expiresAt: { gt: now } },
    data: { status: "WITHDRAWN" },
  });
  if (result.count === 0) throw new ConflictError("Offer is no longer pending");
  return toOfferRecord(await loadOffer(id, db), db, now);
}

/** Counterparty declines a pending offer. */
export async function rejectOffer(actor: Actor, id: string, deps: OfferDeps = {}) {
  assertRole(actor, "OWNER", "INVESTOR");
  const db = deps.db ?? prisma;
  const now = (deps.now ?? (() => new Date()))();
  await assertLendingActorVerified(actor, db);
  const offer = await loadOffer(id, db);
  assertCounterparty(offer, actor);
  assertActionable(offer, now);

  const result = await db.offer.updateMany({
    where: { id, status: "PENDING", expiresAt: { gt: now } },
    data: { status: "REJECTED" },
  });
  if (result.count === 0) throw new ConflictError("Offer is no longer pending");
  return toOfferRecord(await loadOffer(id, db), db, now);
}

/** Counterparty replaces a pending offer with a linked, server-dated offer. */
export async function counterOffer(
  actor: Actor,
  id: string,
  input: CounterInput,
  deps: OfferDeps = {},
) {
  assertRole(actor, "OWNER", "INVESTOR");
  const parsed = counterOfferSchema.parse(input);
  const db = deps.db ?? prisma;
  const now = (deps.now ?? (() => new Date()))();
  await assertLendingActorVerified(actor, db);

  const existing = await loadOffer(id, db);
  assertCounterparty(existing, actor);
  assertActionable(existing, now);
  assertRequestOpenForOffers(existing.loanRequest.status as string);
  const proposer = proposerFor(existing).role === "INVESTOR" ? "OWNER" : "INVESTOR";

  try {
    const counterId = await db.$transaction(async (tx) => {
      const parent = await tx.offer.findUnique({
        where: { id },
        include: offerInclude,
      });
      if (!parent) throw new NotFoundError("Offer not found");
      const parentRow = parent as unknown as OfferRow;
      assertCounterparty(parentRow, actor);
      assertActionable(parentRow, now);
      assertRequestOpenForOffers(parentRow.loanRequest.status as string);

      const claimed = await tx.offer.updateMany({
        where: { id, status: "PENDING", expiresAt: { gt: now } },
        data: { status: "COUNTERED" },
      });
      if (claimed.count === 0) throw new ConflictError("Offer is no longer pending");

      const transition = await tx.loanRequest.updateMany({
        where: { id: parentRow.loanRequest.id, status: { in: ["OPEN", "IN_DISCUSSION"] } },
        data: { status: "IN_DISCUSSION" },
      });
      if (transition.count === 0) {
        throw new ConflictError("Loan request is no longer open for offers");
      }

      const counter = await tx.offer.create({
        data: {
          loanRequestId: parentRow.loanRequest.id,
          investorId: parentRow.investorId,
          amountBdt: parsed.amountBdt,
          interestRatePct: parsed.interestRatePct,
          tenureDays: parsed.tenureDays,
          repaymentFrequency: parsed.repaymentFrequency,
          message: parsed.message ?? null,
          status: "PENDING",
          proposedBy: proposer,
          parentOfferId: parentRow.id,
          expiresAt: new Date(now.getTime() + OFFER_EXPIRY_DAYS * MS_PER_DAY),
        },
      });

      await notify(
        tx,
        parentRow.investorId,
        "OFFER_COUNTERED",
        "Offer countered",
        `A ৳${parsed.amountBdt} counter-offer was proposed.`,
        { offerId: counter.id, loanRequestId: parentRow.loanRequest.id },
      );
      return counter.id;
    });

    return toOfferRecord(await loadOffer(counterId, db), db, now);
  } catch (error) {
    mapOfferWriteError(error);
  }
}

/**
 * Counterparty accepts a pending offer. The conditional updates inside one transaction
 * prevent two acceptances, multiple loans and acceptance of expired/stale offers.
 */
export async function acceptOffer(actor: Actor, id: string, deps: OfferDeps = {}) {
  assertRole(actor, "OWNER", "INVESTOR");
  const db = deps.db ?? prisma;
  const now = (deps.now ?? (() => new Date()))();
  await assertLendingActorVerified(actor, db);

  try {
    const loanId = await db.$transaction(async (tx) => {
      const stored = await tx.offer.findUnique({ where: { id }, include: offerInclude });
      if (!stored) throw new NotFoundError("Offer not found");
      const offer = stored as unknown as OfferRow;
      assertCounterparty(offer, actor);
      assertActionable(offer, now);
      assertRequestOpenForOffers(offer.loanRequest.status as string);

      const claimed = await tx.offer.updateMany({
        where: { id, status: "PENDING", expiresAt: { gt: now } },
        data: { status: "ACCEPTED" },
      });
      if (claimed.count === 0) throw new ConflictError("Offer is no longer pending");

      const existingLoan = await tx.loan.findUnique({
        where: { loanRequestId: offer.loanRequest.id },
      });
      if (existingLoan) {
        throw new BusinessRuleError("This loan request already has a loan");
      }

      await tx.offer.updateMany({
        where: {
          loanRequestId: offer.loanRequest.id,
          status: "PENDING",
          id: { not: id },
        },
        data: { status: "REJECTED" },
      });

      const totalRepayableBdt = calculateTotalRepayableBdt({
        principalBdt: offer.amountBdt,
        interestRatePct: normalizeRatePct(String(offer.interestRatePct)),
        tenureDays: offer.tenureDays,
      });

      const loan = await tx.loan.create({
        data: {
          loanRequestId: offer.loanRequest.id,
          offerId: offer.id,
          ownerId: offer.loanRequest.ownerId,
          investorId: offer.investorId,
          principalBdt: offer.amountBdt,
          interestRatePct: normalizeRatePct(String(offer.interestRatePct)),
          tenureDays: offer.tenureDays,
          repaymentFrequency: offer.repaymentFrequency,
          totalRepayableBdt,
          status: "PENDING_AGREEMENT",
        },
      });

      await tx.agreement.create({
        data: {
          loanId: loan.id,
          termsSnapshot: agreementTerms(offer, totalRepayableBdt) as unknown as object,
        },
      });

      const funded = await tx.loanRequest.updateMany({
        where: { id: offer.loanRequest.id, status: { in: ["OPEN", "IN_DISCUSSION"] } },
        data: { status: "FUNDED" },
      });
      if (funded.count === 0) {
        throw new ConflictError("Loan request is no longer open for offers");
      }

      await notify(
        tx,
        offer.loanRequest.ownerId,
        "OFFER_ACCEPTED",
        "Offer accepted",
        `The ৳${offer.amountBdt} offer was accepted. Confirm the agreement to continue.`,
        { offerId: offer.id, loanRequestId: offer.loanRequest.id, loanId: loan.id },
      );
      await notify(
        tx,
        offer.investorId,
        "OFFER_ACCEPTED",
        "Offer accepted",
        `Your ৳${offer.amountBdt} offer was accepted. Confirm the agreement to continue.`,
        { offerId: offer.id, loanRequestId: offer.loanRequest.id, loanId: loan.id },
      );
      return loan.id;
    });

    return { loanId, offer: await toOfferRecord(await loadOffer(id, db), db, now) };
  } catch (error) {
    mapOfferWriteError(error);
  }
}

/** Persists lazy expiry. Safe to call from a job/cron; no HTTP endpoint is exposed. */
export async function expireOffers(deps: OfferDeps = {}) {
  const db = deps.db ?? prisma;
  const now = (deps.now ?? (() => new Date()))();
  const result = await db.offer.updateMany({
    where: { status: "PENDING", expiresAt: { lte: now } },
    data: { status: "EXPIRED" },
  });
  return { expiredCount: result.count };
}
