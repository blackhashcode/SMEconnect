import { decodeCursor, encodeCursor, type PaginationParams } from "@/lib/pagination";
import {
  assertRole,
  verificationTypeForRole,
  type Actor,
  type VerificationStatus,
  type VerificationType,
} from "@/server/auth/policy";
import { prisma } from "@/server/db";
import {
  ConflictError,
  ForbiddenError,
  NotFoundError,
  ValidationError,
} from "@/server/errors";
import type {
  reviewVerificationSchema,
  submitVerificationSchema,
} from "@/server/validators/verification";
import { z } from "zod";

type SubmitInput = z.infer<typeof submitVerificationSchema>;
type ReviewInput = z.infer<typeof reviewVerificationSchema>;

interface VerificationRow {
  id: string;
  userId: string;
  reviewerId: string | null;
  type: VerificationType;
  status: VerificationStatus;
  idDocumentUrl: string;
  salesProofUrls: string[];
  shopLinks: string[];
  reviewNote: string | null;
  submittedAt: Date;
  reviewedAt: Date | null;
}

export interface VerificationResponse {
  id: string;
  type: VerificationType;
  status: VerificationStatus;
  idDocumentUrl: string;
  salesProofUrls: string[];
  shopLinks: string[];
  reviewNote: string | null;
  submittedAt: string;
  reviewedAt: string | null;
}

interface VerificationDeps {
  db?: typeof prisma;
  now?: () => Date;
}

function toResponse(record: VerificationRow): VerificationResponse {
  return {
    id: record.id,
    type: record.type,
    status: record.status,
    idDocumentUrl: record.idDocumentUrl,
    salesProofUrls: record.salesProofUrls,
    shopLinks: record.shopLinks,
    reviewNote: record.reviewNote,
    submittedAt: record.submittedAt.toISOString(),
    reviewedAt: record.reviewedAt?.toISOString() ?? null,
  };
}

function submitterType(actor: Actor): VerificationType {
  assertRole(actor, "OWNER", "INVESTOR");
  return verificationTypeForRole(actor.role);
}

/** Submits a new verification or replaces a previously rejected one. */
export async function submitVerification(
  actor: Actor,
  input: SubmitInput,
  deps: VerificationDeps = {},
): Promise<VerificationResponse> {
  const db = deps.db ?? prisma;
  const now = (deps.now ?? (() => new Date()))();
  const type = submitterType(actor);

  if (input.type !== type) {
    throw new ForbiddenError("Cannot submit a verification for a different role");
  }

  const existing = await db.userVerification.findFirst({
    where: { userId: actor.id, type },
  });

  if (existing?.status === "PENDING") {
    throw new ConflictError("A verification is already pending review");
  }
  if (existing?.status === "APPROVED") {
    throw new ConflictError("An approved verification cannot be resubmitted");
  }

  const data = {
    status: "PENDING" as const,
    idDocumentUrl: input.idDocumentUrl,
    salesProofUrls: input.salesProofUrls,
    shopLinks: input.shopLinks,
    submittedAt: now,
    reviewerId: null,
    reviewNote: null,
    reviewedAt: null,
  };

  const record = existing
    ? await db.userVerification.update({ where: { id: existing.id }, data })
    : await db.userVerification.create({
        data: { userId: actor.id, type, ...data },
      });

  return toResponse(record as VerificationRow);
}

/** Returns the current user's verification, or null when none was submitted. */
export async function getMyVerification(
  actor: Actor,
  deps: VerificationDeps = {},
): Promise<VerificationResponse | null> {
  const db = deps.db ?? prisma;
  const type = submitterType(actor);

  const record = await db.userVerification.findFirst({
    where: { userId: actor.id, type },
  });

  return record ? toResponse(record as VerificationRow) : null;
}

export interface ListVerificationsResult {
  items: Array<VerificationResponse & { userId: string; reviewerId: string | null }>;
  meta: {
    limit: number;
    nextCursor: string | null;
    hasMore: boolean;
  };
}

/** ADMIN-only verification queue with opaque cursor pagination. */
export async function listVerifications(
  actor: Actor,
  query: { status?: VerificationStatus } & PaginationParams,
  deps: VerificationDeps = {},
): Promise<ListVerificationsResult> {
  assertRole(actor, "ADMIN");
  const db = deps.db ?? prisma;

  let cursorId: string | undefined;
  if (query.cursor) {
    const decoded = decodeCursor<{ id: string }>(query.cursor);
    if (!decoded.id || decoded.id.length === 0) {
      throw new ValidationError("Invalid cursor");
    }
    cursorId = decoded.id;
  }

  const records = await db.userVerification.findMany({
    where: query.status ? { status: query.status } : {},
    orderBy: [{ submittedAt: "desc" }, { id: "desc" }],
    take: query.limit + 1,
    ...(cursorId
      ? { cursor: { id: cursorId }, skip: 1 }
      : {}),
  });

  const hasMore = records.length > query.limit;
  const page = records.slice(0, query.limit);
  const last = page.at(-1);

  return {
    items: page.map((record) => ({
      ...toResponse(record as VerificationRow),
      userId: record.userId,
      reviewerId: record.reviewerId,
    })),
    meta: {
      limit: query.limit,
      nextCursor: hasMore && last ? encodeCursor({ id: last.id }) : null,
      hasMore,
    },
  };
}

/** ADMIN-only decision; review and notification are written atomically. */
export async function reviewVerification(
  actor: Actor,
  verificationId: string,
  input: ReviewInput,
  deps: VerificationDeps = {},
): Promise<VerificationResponse> {
  assertRole(actor, "ADMIN");
  const db = deps.db ?? prisma;
  const now = (deps.now ?? (() => new Date()))();

  if (input.status === "REJECTED" && !input.reviewNote?.trim()) {
    throw new ValidationError("A review note is required when rejecting");
  }

  const existing = await db.userVerification.findFirst({
    where: { id: verificationId },
  });
  if (!existing) throw new NotFoundError("Verification not found");
  if (existing.status !== "PENDING") {
    throw new ConflictError("Only pending verifications can be reviewed");
  }

  const approved = input.status === "APPROVED";
  const updated = await db.$transaction(async (tx) => {
    const record = await tx.userVerification.update({
      where: { id: verificationId },
      data: {
        status: input.status,
        reviewNote: input.reviewNote ?? null,
        reviewerId: actor.id,
        reviewedAt: now,
      },
    });

    await tx.notification.create({
      data: {
        userId: record.userId,
        type: "VERIFICATION_RESULT",
        title: approved ? "Verification approved" : "Verification rejected",
        body: approved
          ? "Your SME Connect verification was approved. You can now use verified features."
          : `Your SME Connect verification was rejected. ${input.reviewNote ?? ""}`.trim(),
        link: "/verification",
        data: {
          verificationId,
          status: input.status,
        },
      },
    });

    return record;
  });

  return toResponse(updated as VerificationRow);
}
