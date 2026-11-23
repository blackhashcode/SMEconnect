import { assertRole, type Actor } from "@/server/auth/policy";
import type { prisma as PrismaClient } from "@/server/db";

type Db = typeof PrismaClient;
const defaultDb = async (): Promise<Db> => (await import("@/server/db")).prisma;

interface SubmittedVerification {
  id: string;
  type: "OWNER" | "INVESTOR";
  idDocumentUrl: string;
  salesProofUrls: string[];
  shopLinks: string[];
  submittedAt: string;
}

/** Appends one submission (documents exactly as sent) to the permanent history. */
export async function recordSubmission(userId: string, v: SubmittedVerification, db?: Db): Promise<void> {
  const client = db ?? (await defaultDb());
  await client.verificationSubmission.create({
    data: {
      verificationId: v.id,
      userId,
      type: v.type,
      idDocumentUrl: v.idDocumentUrl,
      salesProofUrls: v.salesProofUrls,
      shopLinks: v.shopLinks,
      submittedAt: new Date(v.submittedAt),
    },
  });
}

/** Stamps the admin's decision on the newest pending submission for that verification. */
export async function recordReview(
  verificationId: string,
  review: { status: "APPROVED" | "REJECTED"; reviewerId: string; reviewNote?: string | null },
  db?: Db,
): Promise<void> {
  const client = db ?? (await defaultDb());
  const latest = await client.verificationSubmission.findFirst({
    where: { verificationId, status: "PENDING" },
    orderBy: { submittedAt: "desc" },
    select: { id: true },
  });
  if (!latest) return;
  await client.verificationSubmission.update({
    where: { id: latest.id },
    data: { status: review.status, reviewerId: review.reviewerId, reviewNote: review.reviewNote ?? null, reviewedAt: new Date() },
  });
}

/** ADMIN: every submission a member has made, newest first, with reviewer names. */
export async function listSubmissions(actor: Actor, userId: string, db?: Db) {
  assertRole(actor, "ADMIN");
  const client = db ?? (await defaultDb());
  const rows = await client.verificationSubmission.findMany({
    where: { userId },
    orderBy: { submittedAt: "desc" },
    take: 50,
  });
  const reviewerIds = [...new Set(rows.map((r) => r.reviewerId).filter((id): id is string => Boolean(id)))];
  const reviewers = reviewerIds.length
    ? await client.user.findMany({ where: { id: { in: reviewerIds } }, select: { id: true, name: true } })
    : [];
  const names = new Map(reviewers.map((r) => [r.id, r.name]));
  return rows.map((row) => ({
    id: row.id,
    verificationId: row.verificationId,
    type: row.type,
    status: row.status,
    idDocumentUrl: row.idDocumentUrl,
    salesProofUrls: row.salesProofUrls,
    shopLinks: row.shopLinks,
    submittedAt: row.submittedAt.toISOString(),
    reviewedAt: row.reviewedAt?.toISOString() ?? null,
    reviewNote: row.reviewNote,
    reviewer: row.reviewerId ? { id: row.reviewerId, name: names.get(row.reviewerId) ?? "Former admin" } : null,
  }));
}
