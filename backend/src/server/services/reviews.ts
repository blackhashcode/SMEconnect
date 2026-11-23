import type { PaginationParams } from "@/lib/pagination";
import { assertRole, type Actor } from "@/server/auth/policy";
import { prisma } from "@/server/db";
import {
  BusinessRuleError,
  ConflictError,
  ForbiddenError,
  NotFoundError,
} from "@/server/errors";
import { createReviewSchema } from "@/server/validators/social";
import type { z } from "zod";
import {
  PUBLIC_USER_SELECT,
  cursorId,
  isUniqueViolation,
  pageMeta,
  toPostAuthor,
  verifiedUserIds,
  type PublicUserRow,
} from "@/server/services/social-shared";
import { recomputeTrustScore, type TrustRole } from "@/server/services/trust-score";

type Db = typeof prisma;
type CreateInput = z.infer<typeof createReviewSchema>;

interface ServiceDeps {
  db?: Db;
  now?: () => Date;
}

interface LoanRow {
  id: string;
  ownerId: string;
  investorId: string;
  status: string;
}

interface ReviewRow {
  id: string;
  loanId: string;
  reviewerId: string;
  revieweeId: string;
  rating: number;
  comment: string | null;
  createdAt: Date;
  updatedAt: Date;
  reviewer: PublicUserRow;
  reviewee: PublicUserRow;
}

const reviewInclude = {
  reviewer: { select: PUBLIC_USER_SELECT },
  reviewee: { select: PUBLIC_USER_SELECT },
} as const;

async function loadReview(id: string, db: Db): Promise<ReviewRow> {
  const row = await db.review.findUnique({ where: { id }, include: reviewInclude });
  if (!row) throw new NotFoundError("Review not found");
  return row as unknown as ReviewRow;
}

async function toReviewRecord(row: ReviewRow, db: Db) {
  const verified = await verifiedUserIds([row.reviewer.id, row.reviewee.id], db);
  return {
    id: row.id,
    loanId: row.loanId,
    rating: row.rating,
    comment: row.comment ?? null,
    reviewer: toPostAuthor(row.reviewer, verified.has(row.reviewer.id)),
    reviewee: toPostAuthor(row.reviewee, verified.has(row.reviewee.id)),
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

function participantFor(
  loan: LoanRow,
  actor: Actor,
): { revieweeId: string; revieweeRole: TrustRole } {
  if (actor.id === loan.ownerId) {
    assertRole(actor, "OWNER");
    return { revieweeId: loan.investorId, revieweeRole: "INVESTOR" };
  }
  if (actor.id === loan.investorId) {
    assertRole(actor, "INVESTOR");
    return { revieweeId: loan.ownerId, revieweeRole: "OWNER" };
  }
  // A non-participant gets 404 so loan existence is not leaked.
  throw new NotFoundError("Loan not found");
}

/**
 * One review per side is allowed, only after the loan is COMPLETED. The reviewee
 * is derived from the loan participants; a client-supplied id is only checked
 * against that derivation and can never choose the target.
 */
export async function createReview(
  actor: Actor,
  input: CreateInput,
  deps: ServiceDeps = {},
) {
  assertRole(actor, "OWNER", "INVESTOR");
  const parsed = createReviewSchema.parse(input);
  const db = deps.db ?? prisma;
  const now = (deps.now ?? (() => new Date()))();

  const loan = await db.loan.findUnique({
    where: { id: parsed.loanId },
    select: { id: true, ownerId: true, investorId: true, status: true },
  });
  if (!loan) throw new NotFoundError("Loan not found");

  const { revieweeId, revieweeRole } = participantFor(loan as LoanRow, actor);
  if (parsed.revieweeId !== revieweeId) {
    throw new ForbiddenError("You can only review the other participant of this loan");
  }
  if (loan.status !== "COMPLETED") {
    throw new BusinessRuleError("Reviews are only available after the loan is completed");
  }

  const duplicate = await db.review.findFirst({
    where: { loanId: parsed.loanId, reviewerId: actor.id },
    select: { id: true },
  });
  if (duplicate) throw new ConflictError("You have already reviewed this loan");

  let reviewId: string;
  try {
    reviewId = await db.$transaction(async (tx) => {
      const created = await tx.review.create({
        data: {
          loanId: parsed.loanId,
          reviewerId: actor.id,
          revieweeId,
          rating: parsed.rating,
          comment: parsed.comment ?? null,
        },
      });
      await recomputeTrustScore(revieweeId, revieweeRole, tx, now);
      return created.id;
    });
  } catch (error) {
    if (isUniqueViolation(error)) {
      throw new ConflictError("You have already reviewed this loan");
    }
    throw error;
  }

  return toReviewRecord(await loadReview(reviewId, db), db);
}

/** Public review detail; only safe participant cards are exposed. */
export async function getReview(id: string, deps: ServiceDeps = {}) {
  const db = deps.db ?? prisma;
  return toReviewRecord(await loadReview(id, db), db);
}

/** Public review list for one profile; the target must be a visible account. */
export async function listReviews(
  query: { userId: string } & PaginationParams,
  deps: ServiceDeps = {},
) {
  const db = deps.db ?? prisma;
  const cursor = cursorId(query.cursor);

  const target = await db.user.findUnique({
    where: { id: query.userId },
    select: { id: true, role: true, status: true },
  });
  if (!target || target.status !== "ACTIVE" || target.role === "ADMIN") {
    throw new NotFoundError("User not found");
  }

  const rows = await db.review.findMany({
    where: { revieweeId: query.userId },
    include: reviewInclude,
    orderBy: [{ createdAt: "desc" }, { id: "desc" }],
    take: query.limit + 1,
    ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
  });

  const page = pageMeta(rows as unknown as ReviewRow[], query.limit);
  const items: Array<Awaited<ReturnType<typeof toReviewRecord>>> = [];
  for (const row of page.items) items.push(await toReviewRecord(row, db));
  return { items, meta: page.meta };
}
