import { decodeCursor, encodeCursor, type PaginationParams } from "@/lib/pagination";
import {
  assertOwnership,
  assertRole,
  assertVerified,
  type Actor,
} from "@/server/auth/policy";
import { prisma } from "@/server/db";
import {
  BusinessRuleError,
  ConflictError,
  NotFoundError,
  ValidationError,
} from "@/server/errors";
import {
  createLoanRequestSchema,
  updateLoanRequestSchema,
  type loanRequestSortSchema,
} from "@/server/validators/loan";
import type { z } from "zod";

type Sort = z.infer<typeof loanRequestSortSchema>;
type CreateInput = z.infer<typeof createLoanRequestSchema>;
type UpdateInput = z.infer<typeof updateLoanRequestSchema>;
type RequestStatus =
  | "DRAFT"
  | "OPEN"
  | "IN_DISCUSSION"
  | "FUNDED"
  | "REPAYING"
  | "COMPLETED"
  | "PAUSED"
  | "CANCELLED";

interface LoanRequestDeps {
  db?: typeof prisma;
  now?: () => Date;
}

interface LoanRequestRow {
  id: string;
  ownerId: string;
  amountBdt: number;
  purpose: string;
  fundUsage: string;
  tenureDays: number;
  repaymentFrequency: "WEEKLY" | "BIWEEKLY" | "MONTHLY";
  proposedRatePct: unknown;
  proofUrls: string[];
  status: RequestStatus;
  publishedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

interface PublicOwnerRow {
  id: string;
  name: string;
  image: string | null;
  businessProfile: {
    shopName: string;
    slug: string;
    category: string;
    district: string;
    city: string;
    logoUrl: string | null;
    trustScore: number;
  } | null;
}

type PublicLoanRequestRow = LoanRequestRow & { owner: PublicOwnerRow };

/** Mirrors the partial unique index `loan_request_one_active_per_owner`. */
export const ACTIVE_LOAN_STATUSES: readonly RequestStatus[] = [
  "OPEN",
  "IN_DISCUSSION",
  "FUNDED",
  "REPAYING",
];

/** The only permitted transitions. Anything else is rejected by the service. */
const ALLOWED_TRANSITIONS: Record<RequestStatus, readonly RequestStatus[]> = {
  DRAFT: ["OPEN", "CANCELLED"],
  OPEN: ["IN_DISCUSSION", "PAUSED", "CANCELLED"],
  IN_DISCUSSION: ["PAUSED", "CANCELLED"],
  FUNDED: [],
  REPAYING: [],
  COMPLETED: [],
  PAUSED: ["OPEN", "CANCELLED"],
  CANCELLED: [],
};

const ORDER_BY: Record<Sort, Record<string, "asc" | "desc">[]> = {
  newest: [{ publishedAt: "desc" }, { id: "desc" }],
  amountAsc: [{ amountBdt: "asc" }, { id: "asc" }],
  amountDesc: [{ amountBdt: "desc" }, { id: "desc" }],
};

function assertTransition(from: RequestStatus, to: RequestStatus): void {
  if (!ALLOWED_TRANSITIONS[from]?.includes(to)) {
    throw new ConflictError(`Cannot change a ${from} request to ${to}`);
  }
}

function nullableDecimal(value: unknown): string | null {
  if (value === null || value === undefined) return null;
  return String(value);
}

function toIso(value: Date | null): string | null {
  return value ? new Date(value).toISOString() : null;
}

function toOwnerView(row: LoanRequestRow) {
  return {
    id: row.id,
    amountBdt: row.amountBdt,
    purpose: row.purpose,
    fundUsage: row.fundUsage,
    tenureDays: row.tenureDays,
    repaymentFrequency: row.repaymentFrequency,
    proposedRatePct: nullableDecimal(row.proposedRatePct),
    proofUrls: row.proofUrls ?? [],
    status: row.status,
    publishedAt: toIso(row.publishedAt),
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

function toPublicView(row: PublicLoanRequestRow, verified: boolean) {
  const owner = row.owner;
  if (!owner?.businessProfile) throw new NotFoundError("Profile not found");
  const profile = owner.businessProfile;

  return {
    id: row.id,
    amountBdt: row.amountBdt,
    purpose: row.purpose,
    fundUsage: row.fundUsage,
    tenureDays: row.tenureDays,
    repaymentFrequency: row.repaymentFrequency,
    proposedRatePct: nullableDecimal(row.proposedRatePct),
    publishedAt: toIso(row.publishedAt),
    createdAt: row.createdAt.toISOString(),
    owner: {
      id: owner.id,
      name: owner.name,
      image: owner.image ?? null,
      shopName: profile.shopName,
      slug: profile.slug,
      category: profile.category,
      district: profile.district,
      city: profile.city,
      logoUrl: profile.logoUrl ?? null,
      trustScore: profile.trustScore,
      verified,
    },
  };
}

function cursorId(cursor?: string): string | undefined {
  if (!cursor) return undefined;
  const decoded = decodeCursor<{ id?: string }>(cursor);
  if (!decoded.id || typeof decoded.id !== "string") {
    throw new ValidationError("Invalid cursor");
  }
  return decoded.id;
}

function pageMeta<T extends { id: string }>(
  records: T[],
  limit: number,
): { items: T[]; meta: { limit: number; nextCursor: string | null; hasMore: boolean } } {
  const hasMore = records.length > limit;
  const items = records.slice(0, limit);
  const last = items.at(-1);
  return {
    items,
    meta: {
      limit,
      nextCursor: hasMore && last ? encodeCursor({ id: last.id }) : null,
      hasMore,
    },
  };
}

function isUniqueViolation(error: unknown): boolean {
  return (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    (error as { code?: string }).code === "P2002"
  );
}

/** A concurrent publish/resume that loses the unique-index race is a business rule failure. */
function mapActiveRequestConflict(error: unknown): never {
  if (isUniqueViolation(error)) {
    const meta = (error as { meta?: { target?: unknown } }).meta;
    const target = JSON.stringify(meta?.target ?? "");
    if (target.includes("ownerId") || target.includes("one_active")) {
      throw new BusinessRuleError("You already have an active loan request", {
        field: "ownerId",
      });
    }
  }
  throw error;
}

async function assertCanGoOpen(actor: Actor, ownerId: string, id: string, db: typeof prisma) {
  const verification = await db.userVerification.findFirst({
    where: { userId: ownerId, type: "OWNER", status: "APPROVED" },
    select: { status: true },
  });
  assertVerified(actor, verification?.status);

  const profile = await db.businessProfile.findUnique({
    where: { ownerId },
    select: { shopName: true, slug: true, category: true, district: true, city: true },
  });
  if (
    !profile ||
    !profile.shopName.trim() ||
    !profile.slug.trim() ||
    !profile.category.trim() ||
    !profile.district.trim() ||
    !profile.city.trim()
  ) {
    throw new BusinessRuleError("Complete your business profile before publishing");
  }

  const activeCount = await db.loanRequest.count({
    where: {
      ownerId,
      id: { not: id },
      status: { in: [...ACTIVE_LOAN_STATUSES] },
    },
  });
  if (activeCount > 0) {
    throw new BusinessRuleError("You already have an active loan request", {
      field: "ownerId",
    });
  }
}

/** Keeps the auto-created feed post in sync with the request's public visibility. */
async function syncFeedPost(
  tx: Pick<typeof prisma, "post">,
  request: LoanRequestRow,
  visible: boolean,
  now: Date,
): Promise<void> {
  await tx.post.updateMany({
    where: { loanRequestId: request.id, type: "LOAN_REQUEST", deletedAt: null },
    data: { deletedAt: now },
  });

  if (visible) {
    await tx.post.create({
      data: {
        authorId: request.ownerId,
        type: "LOAN_REQUEST",
        content: `New loan request: ${request.purpose} — ৳${request.amountBdt} for ${request.tenureDays} days.`,
        loanRequestId: request.id,
      },
    });
  }
}

export async function createLoanRequest(
  actor: Actor,
  input: CreateInput,
  deps: LoanRequestDeps = {},
) {
  assertRole(actor, "OWNER");
  const parsed = createLoanRequestSchema.parse(input);
  const db = deps.db ?? prisma;

  const row = await db.loanRequest.create({
    data: {
      ownerId: actor.id,
      status: "DRAFT",
      amountBdt: parsed.amountBdt,
      purpose: parsed.purpose,
      fundUsage: parsed.fundUsage,
      tenureDays: parsed.tenureDays,
      repaymentFrequency: parsed.repaymentFrequency,
      proposedRatePct: parsed.proposedRatePct,
      proofUrls: parsed.proofUrls,
    },
  });

  return toOwnerView(row as LoanRequestRow);
}

export interface LoanRequestListResult {
  items: ReturnType<typeof toOwnerView>[];
  meta: { limit: number; nextCursor: string | null; hasMore: boolean };
}

/** Authenticated OWNER's own requests, including drafts and closed ones. */
export async function listMyLoanRequests(
  actor: Actor,
  query: PaginationParams & { status?: RequestStatus },
  deps: LoanRequestDeps = {},
): Promise<LoanRequestListResult> {
  assertRole(actor, "OWNER");
  const db = deps.db ?? prisma;
  const cursor = cursorId(query.cursor);

  const records = await db.loanRequest.findMany({
    where: { ownerId: actor.id, ...(query.status ? { status: query.status } : {}) },
    orderBy: [{ createdAt: "desc" }, { id: "desc" }],
    take: query.limit + 1,
    ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
  });

  const page = pageMeta(records as LoanRequestRow[], query.limit);
  return { items: page.items.map(toOwnerView), meta: page.meta };
}

/** Own detail: full fields, but only for the authenticated owner. */
export async function getMyLoanRequest(
  actor: Actor,
  id: string,
  deps: LoanRequestDeps = {},
) {
  assertRole(actor, "OWNER");
  const db = deps.db ?? prisma;
  const row = await db.loanRequest.findUnique({ where: { id } });
  if (!row) throw new NotFoundError("Loan request not found");
  assertOwnership(row.ownerId, actor);
  return toOwnerView(row as LoanRequestRow);
}

/** DRAFT and PAUSED requests may be edited; active/closed ones are locked. */
export async function updateLoanRequest(
  actor: Actor,
  id: string,
  input: UpdateInput,
  deps: LoanRequestDeps = {},
) {
  assertRole(actor, "OWNER");
  const parsed = updateLoanRequestSchema.parse(input);
  const db = deps.db ?? prisma;

  const existing = await db.loanRequest.findUnique({ where: { id } });
  if (!existing) throw new NotFoundError("Loan request not found");
  assertOwnership(existing.ownerId, actor);
  if (existing.status !== "DRAFT" && existing.status !== "PAUSED") {
    throw new ConflictError(`Cannot edit a ${existing.status} request`);
  }

  const row = await db.loanRequest.update({ where: { id }, data: parsed });
  return toOwnerView(row as LoanRequestRow);
}

/** Shared implementation for publish/resume/pause/cancel. */
async function changeStatus(
  actor: Actor,
  id: string,
  target: RequestStatus,
  allowedFrom: readonly RequestStatus[],
  deps: LoanRequestDeps,
) {
  assertRole(actor, "OWNER");
  const db = deps.db ?? prisma;
  const now = (deps.now ?? (() => new Date()))();

  const existing = await db.loanRequest.findUnique({ where: { id } });
  if (!existing) throw new NotFoundError("Loan request not found");
  assertOwnership(existing.ownerId, actor);
  const status = existing.status as RequestStatus;
  assertTransition(status, target);
  // Each action has its own source states even when two actions share a target.
  if (!allowedFrom.includes(status)) {
    throw new ConflictError(`Cannot perform this action on a ${status} request`);
  }

  if (target === "OPEN") {
    await assertCanGoOpen(actor, existing.ownerId, existing.id, db);
  }

  try {
    const updated = await db.$transaction(async (tx) => {
      const row = await tx.loanRequest.update({
        where: { id },
        data: {
          status: target,
          publishedAt: target === "OPEN" ? (existing.publishedAt ?? now) : existing.publishedAt,
        },
      });
      await syncFeedPost(tx, row as LoanRequestRow, target === "OPEN", now);
      return row;
    });
    return toOwnerView(updated as LoanRequestRow);
  } catch (error) {
    mapActiveRequestConflict(error);
  }
}

/** DRAFT → OPEN. Requires approval, a complete profile and no other active request. */
export async function publishLoanRequest(
  actor: Actor,
  id: string,
  deps: LoanRequestDeps = {},
) {
  return changeStatus(actor, id, "OPEN", ["DRAFT"], deps);
}

/** PAUSED → OPEN (re-checks the active-request rule after the pause). */
export async function resumeLoanRequest(
  actor: Actor,
  id: string,
  deps: LoanRequestDeps = {},
) {
  return changeStatus(actor, id, "OPEN", ["PAUSED"], deps);
}

/** OPEN | IN_DISCUSSION → PAUSED. */
export async function pauseLoanRequest(
  actor: Actor,
  id: string,
  deps: LoanRequestDeps = {},
) {
  return changeStatus(actor, id, "PAUSED", ["OPEN", "IN_DISCUSSION"], deps);
}

/** DRAFT | OPEN | IN_DISCUSSION | PAUSED → CANCELLED. */
export async function cancelLoanRequest(
  actor: Actor,
  id: string,
  deps: LoanRequestDeps = {},
) {
  return changeStatus(actor, id, "CANCELLED", ["DRAFT", "OPEN", "IN_DISCUSSION", "PAUSED"], deps);
}

export interface PublicLoanRequestListResult {
  items: ReturnType<typeof toPublicView>[];
  meta: { limit: number; nextCursor: string | null; hasMore: boolean };
}

type PublicFilters = {
  category?: string;
  district?: string;
  minAmountBdt?: number;
  maxAmountBdt?: number;
  maxTenureDays?: number;
  frequency?: "WEEKLY" | "BIWEEKLY" | "MONTHLY";
  sort: Sort;
};

function publicWhere(filters: PublicFilters) {
  const businessProfileFilter = {
    ...(filters.category
      ? { category: { equals: filters.category, mode: "insensitive" as const } }
      : {}),
    ...(filters.district
      ? { district: { equals: filters.district, mode: "insensitive" as const } }
      : {}),
  };

  const amountFilter = {
    ...(filters.minAmountBdt !== undefined ? { gte: filters.minAmountBdt } : {}),
    ...(filters.maxAmountBdt !== undefined ? { lte: filters.maxAmountBdt } : {}),
  };

  return {
    status: "OPEN" as const,
    ...(filters.category || filters.district
      ? { owner: { businessProfile: businessProfileFilter } }
      : {}),
    ...(Object.keys(amountFilter).length > 0 ? { amountBdt: amountFilter } : {}),
    ...(filters.maxTenureDays !== undefined
      ? { tenureDays: { lte: filters.maxTenureDays } }
      : {}),
    ...(filters.frequency ? { repaymentFrequency: filters.frequency } : {}),
  };
}

async function withVerifiedBadges<T extends { owner: PublicOwnerRow }>(
  rows: T[],
  db: typeof prisma,
) {
  const ownerIds = [...new Set(rows.map((row) => row.owner.id))];
  const verified = await db.userVerification.findMany({
    where: { userId: { in: ownerIds }, type: "OWNER", status: "APPROVED" },
    select: { userId: true },
  });
  const verifiedIds = new Set(verified.map((item) => item.userId));
  return rows.map((row) => ({ row, verified: verifiedIds.has(row.owner.id) }));
}

/** Public OPEN requests only; no session, no private fields. */
export async function listPublicLoanRequests(
  query: PaginationParams & PublicFilters,
  deps: LoanRequestDeps = {},
): Promise<PublicLoanRequestListResult> {
  const db = deps.db ?? prisma;
  const cursor = cursorId(query.cursor);

  const records = await db.loanRequest.findMany({
    where: publicWhere(query),
    orderBy: ORDER_BY[query.sort],
    take: query.limit + 1,
    ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
    include: {
      owner: {
        select: {
          id: true,
          name: true,
          image: true,
          businessProfile: {
            select: {
              shopName: true,
              slug: true,
              category: true,
              district: true,
              city: true,
              logoUrl: true,
              trustScore: true,
            },
          },
        },
      },
    },
  });

  const page = pageMeta(records as PublicLoanRequestRow[], query.limit);
  const decorated = await withVerifiedBadges(page.items, db);

  return {
    items: decorated
      .filter(({ row }) => row.owner.businessProfile !== null)
      .map(({ row, verified }) => toPublicView(row, verified)),
    meta: page.meta,
  };
}

/** Public detail of an OPEN request; non-OPEN requests are indistinguishable from missing. */
export async function getPublicLoanRequest(
  id: string,
  deps: LoanRequestDeps = {},
) {
  const db = deps.db ?? prisma;
  const row = await db.loanRequest.findFirst({
    where: { id, status: "OPEN" },
    include: {
      owner: {
        select: {
          id: true,
          name: true,
          image: true,
          businessProfile: {
            select: {
              shopName: true,
              slug: true,
              category: true,
              district: true,
              city: true,
              logoUrl: true,
              trustScore: true,
            },
          },
        },
      },
    },
  });
  if (!row) throw new NotFoundError("Loan request not found");

  const [verified] = await withVerifiedBadges(
    [row as PublicLoanRequestRow],
    db,
  );
  return toPublicView(verified.row, verified.verified);
}
