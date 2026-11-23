import type { LoanRequestStatus, RepaymentFrequency } from "@/generated/prisma/client";
import { decodeCursor, encodeCursor, type PaginationParams } from "@/lib/pagination";
import { recordAuditLog } from "@/server/audit";
import { prisma } from "@/server/db";
import { BusinessRuleError, ConflictError, ForbiddenError, NotFoundError } from "@/server/errors";
import type { Actor } from "@/server/services/actor";
import { isUserVerified } from "@/server/services/verifications";

const ACTIVE_REQUEST_STATUSES: LoanRequestStatus[] = [
  "OPEN",
  "IN_DISCUSSION",
  "FUNDED",
  "REPAYING",
];

export interface CreateLoanRequestInput {
  title: string;
  amountBdt: number;
  purpose: string;
  description: string;
  tenureDays: number;
  proposedRatePct: number;
  repaymentFrequency: RepaymentFrequency;
  highlights: string[];
  publishNow: boolean;
}

/**
 * Creates a loan request (DRAFT or OPEN).
 * Enforces AGENTS.md §6:
 * - Only APPROVED verified OWNERs may publish.
 * - An owner may have at most ONE request in OPEN/IN_DISCUSSION/FUNDED/REPAYING at a time.
 */
export async function createLoanRequest(actor: Actor, input: CreateLoanRequestInput) {
  if (actor.role !== "OWNER") {
    throw new ForbiddenError("Only business owners can create loan requests");
  }

  const business = await prisma.businessProfile.findUnique({
    where: { ownerId: actor.id },
    select: { id: true, verified: true },
  });
  if (!business) {
    throw new BusinessRuleError("Complete your business profile before creating a loan request");
  }

  if (input.publishNow) {
    const verified = business.verified || (await isUserVerified(actor.id));
    if (!verified) {
      throw new ForbiddenError("Only verified business owners can publish loan requests");
    }

    const activeCount = await prisma.loanRequest.count({
      where: { ownerId: actor.id, status: { in: ACTIVE_REQUEST_STATUSES } },
    });
    if (activeCount >= 1) {
      throw new ConflictError(
        "You already have an active loan request. Complete or cancel it before publishing another.",
      );
    }
  }

  return prisma.$transaction(async (tx) => {
    const loan = await tx.loanRequest.create({
      data: {
        ownerId: actor.id,
        businessProfileId: business.id,
        title: input.title,
        amountBdt: input.amountBdt,
        purpose: input.purpose,
        description: input.description,
        tenureDays: input.tenureDays,
        proposedRatePct: input.proposedRatePct,
        repaymentFrequency: input.repaymentFrequency,
        highlights: input.highlights,
        status: input.publishNow ? "OPEN" : "DRAFT",
        publishedAt: input.publishNow ? new Date() : null,
      },
      include: {
        businessProfile: true,
        owner: { select: { id: true, name: true, image: true, trustScore: true } },
      },
    });

    await recordAuditLog(
      {
        actorId: actor.id,
        action: input.publishNow ? "LOAN_REQUEST_PUBLISHED" : "LOAN_REQUEST_DRAFTED",
        entityType: "LoanRequest",
        entityId: loan.id,
        metadata: { amountBdt: loan.amountBdt, tenureDays: loan.tenureDays },
      },
      tx,
    );

    return loan;
  });
}

export async function listLoanRequests(
  actor: Actor,
  filters: {
    status?: LoanRequestStatus | "ACTIVE";
    businessId?: string;
    mine?: boolean;
    category?: string;
    q?: string;
  },
  page: PaginationParams,
) {
  const cursorId = page.cursor ? String(decodeCursor(page.cursor).id ?? "") : undefined;

  const statusWhere =
    filters.status === "ACTIVE"
      ? { in: ["OPEN", "IN_DISCUSSION"] as LoanRequestStatus[] }
      : filters.status
        ? filters.status
        : { not: "DRAFT" as LoanRequestStatus };

  const rows = await prisma.loanRequest.findMany({
    where: {
      ...(filters.mine ? { ownerId: actor.id } : { status: statusWhere }),
      ...(filters.mine && filters.status ? { status: statusWhere } : {}),
      ...(filters.businessId ? { businessProfileId: filters.businessId } : {}),
      ...(filters.category
        ? { businessProfile: { category: { equals: filters.category, mode: "insensitive" } } }
        : {}),
      ...(filters.q
        ? {
            OR: [
              { title: { contains: filters.q, mode: "insensitive" } },
              { purpose: { contains: filters.q, mode: "insensitive" } },
              { businessProfile: { shopName: { contains: filters.q, mode: "insensitive" } } },
            ],
          }
        : {}),
    },
    include: {
      businessProfile: true,
      owner: { select: { id: true, name: true, headline: true, location: true, image: true, trustScore: true } },
      _count: { select: { offers: { where: { status: { not: "WITHDRAWN" } } } } },
    },
    orderBy: [{ createdAt: "desc" }, { id: "desc" }],
    take: page.limit + 1,
    ...(cursorId ? { cursor: { id: cursorId }, skip: 1 } : {}),
  });

  const hasMore = rows.length > page.limit;
  const items = hasMore ? rows.slice(0, page.limit) : rows;
  const nextCursor = hasMore ? encodeCursor({ id: items[items.length - 1].id }) : null;

  return { items, meta: { nextCursor } };
}

export async function getLoanRequestById(actor: Actor, id: string) {
  const loan = await prisma.loanRequest.findUnique({
    where: { id },
    include: {
      businessProfile: true,
      owner: { select: { id: true, name: true, headline: true, location: true, image: true, trustScore: true } },
      _count: { select: { offers: { where: { status: { not: "WITHDRAWN" } } } } },
    },
  });

  if (!loan) throw new NotFoundError("Loan request not found");
  if (loan.status === "DRAFT" && loan.ownerId !== actor.id && actor.role !== "ADMIN") {
    throw new NotFoundError("Loan request not found");
  }
  return loan;
}

const ALLOWED_STATUS_TRANSITIONS: Record<LoanRequestStatus, LoanRequestStatus[]> = {
  DRAFT: ["OPEN", "CANCELLED"],
  OPEN: ["PAUSED", "CANCELLED"],
  IN_DISCUSSION: ["PAUSED", "CANCELLED"],
  PAUSED: ["OPEN", "CANCELLED"],
  FUNDED: [],
  REPAYING: [],
  COMPLETED: [],
  CANCELLED: [],
};

export async function updateLoanRequestStatus(
  actor: Actor,
  loanId: string,
  nextStatus: "OPEN" | "PAUSED" | "CANCELLED",
) {
  const loan = await prisma.loanRequest.findUnique({ where: { id: loanId } });
  if (!loan) throw new NotFoundError("Loan request not found");
  if (loan.ownerId !== actor.id && actor.role !== "ADMIN") {
    throw new ForbiddenError("Only the business owner can modify this loan request");
  }

  const allowed = ALLOWED_STATUS_TRANSITIONS[loan.status];
  if (!allowed.includes(nextStatus)) {
    throw new ConflictError(`Cannot transition loan request from ${loan.status} to ${nextStatus}`);
  }

  if (nextStatus === "OPEN" && loan.status === "DRAFT") {
    const verified = await isUserVerified(loan.ownerId);
    if (!verified) {
      throw new ForbiddenError("Only verified business owners can publish loan requests");
    }
    const activeCount = await prisma.loanRequest.count({
      where: { ownerId: loan.ownerId, status: { in: ACTIVE_REQUEST_STATUSES } },
    });
    if (activeCount >= 1) {
      throw new ConflictError("You already have an active loan request");
    }
  }

  return prisma.$transaction(async (tx) => {
    const updated = await tx.loanRequest.update({
      where: { id: loanId },
      data: {
        status: nextStatus,
        ...(nextStatus === "OPEN" && !loan.publishedAt ? { publishedAt: new Date() } : {}),
      },
    });

    if (nextStatus === "CANCELLED") {
      await tx.offer.updateMany({
        where: { loanRequestId: loanId, status: "PENDING" },
        data: { status: "REJECTED" },
      });
    }

    await recordAuditLog(
      {
        actorId: actor.id,
        action: `LOAN_REQUEST_${nextStatus}`,
        entityType: "LoanRequest",
        entityId: loanId,
      },
      tx,
    );

    return updated;
  });
}
