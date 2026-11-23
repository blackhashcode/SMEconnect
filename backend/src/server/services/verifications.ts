import type { VerificationStatus } from "@/generated/prisma/client";
import { computeTrustScore } from "@/lib/trust-score";
import { recordAuditLog } from "@/server/audit";
import { prisma } from "@/server/db";
import { BusinessRuleError, ConflictError, ForbiddenError, NotFoundError } from "@/server/errors";
import { createNotification } from "@/server/notifications";
import type { Actor } from "@/server/services/actor";

export interface SubmitVerificationInput {
  nidMasked: string;
  tradeLicense?: string;
  idDocumentUrl: string;
  salesProofUrls: string[];
  shopLinks: string[];
}

export async function isUserVerified(userId: string): Promise<boolean> {
  const approved = await prisma.kycVerification.findFirst({
    where: { userId, status: "APPROVED" },
    select: { id: true },
  });
  return Boolean(approved);
}

export async function submitVerification(actor: Actor, input: SubmitVerificationInput) {
  if (actor.role === "ADMIN") {
    throw new ForbiddenError("Admins do not submit KYC verifications");
  }

  const existing = await prisma.kycVerification.findFirst({
    where: { userId: actor.id, status: { in: ["PENDING", "APPROVED"] } },
    select: { id: true, status: true },
  });

  if (existing?.status === "APPROVED") {
    throw new ConflictError("Your account is already verified");
  }
  if (existing?.status === "PENDING") {
    throw new ConflictError("You already have a verification submission under review");
  }

  return prisma.$transaction(async (tx) => {
    const record = await tx.kycVerification.create({
      data: {
        userId: actor.id,
        type: actor.role,
        status: "PENDING",
        nidMasked: input.nidMasked,
        tradeLicense: input.tradeLicense ?? null,
        idDocumentUrl: input.idDocumentUrl,
        salesProofUrls: input.salesProofUrls,
        shopLinks: input.shopLinks,
      },
    });

    await recordAuditLog(
      {
        actorId: actor.id,
        action: "VERIFICATION_SUBMITTED",
        entityType: "KycVerification",
        entityId: record.id,
      },
      tx,
    );

    return record;
  });
}

export async function getOwnVerificationStatus(actor: Actor) {
  return prisma.kycVerification.findFirst({
    where: { userId: actor.id },
    orderBy: { createdAt: "desc" },
  });
}

export async function listVerificationQueue(
  actor: Actor,
  filters: { status?: VerificationStatus; limit: number },
) {
  if (actor.role !== "ADMIN") {
    throw new ForbiddenError("Admin role required");
  }

  return prisma.kycVerification.findMany({
    where: filters.status ? { status: filters.status } : undefined,
    include: {
      user: {
        select: {
          id: true,
          name: true,
          email: true,
          role: true,
          location: true,
          image: true,
          businessProfile: { select: { id: true, shopName: true, category: true } },
        },
      },
    },
    orderBy: { createdAt: "desc" },
    take: filters.limit,
  });
}

export async function reviewVerification(
  actor: Actor,
  verificationId: string,
  input: { decision: "APPROVED" | "REJECTED"; reviewNote?: string },
) {
  if (actor.role !== "ADMIN") {
    throw new ForbiddenError("Only admins can review verifications");
  }

  const record = await prisma.kycVerification.findUnique({
    where: { id: verificationId },
  });
  if (!record) throw new NotFoundError("Verification case not found");
  if (record.status !== "PENDING") {
    throw new ConflictError(`Verification case is already ${record.status}`);
  }
  if (input.decision === "REJECTED" && !input.reviewNote?.trim()) {
    throw new BusinessRuleError("A review note is required when rejecting a verification");
  }

  const approved = input.decision === "APPROVED";

  return prisma.$transaction(async (tx) => {
    const updated = await tx.kycVerification.update({
      where: { id: verificationId },
      data: {
        status: input.decision,
        reviewerId: actor.id,
        reviewNote: input.reviewNote ?? null,
        reviewedAt: new Date(),
      },
    });

    if (approved) {
      const trustScore = computeTrustScore({
        verified: true,
        onTimeRepayments: 0,
        overdueRepayments: 0,
        completedLoans: 0,
        averageRating: 0,
      });

      await tx.user.update({
        where: { id: record.userId },
        data: { trustScore },
      });

      if (record.type === "OWNER") {
        await tx.businessProfile.updateMany({
          where: { ownerId: record.userId },
          data: { verified: true, trustScore },
        });
      } else if (record.type === "INVESTOR") {
        await tx.investorProfile.updateMany({
          where: { userId: record.userId },
          data: { verified: true, trustScore },
        });
      }
    }

    await createNotification(
      {
        userId: record.userId,
        type: "VERIFICATION",
        title: approved ? "Verification approved" : "Verification requires updates",
        body: approved
          ? "Your identity and records have been approved. You can now post requests and offers."
          : `Your verification was not approved: ${input.reviewNote}`,
        link: record.type === "OWNER" ? "/business-dashboard" : "/investor-dashboard",
        sendEmailCopy: true,
      },
      tx,
    );

    await recordAuditLog(
      {
        actorId: actor.id,
        action: `VERIFICATION_${input.decision}`,
        entityType: "KycVerification",
        entityId: verificationId,
        metadata: { targetUserId: record.userId, reviewNote: input.reviewNote ?? null },
      },
      tx,
    );

    return updated;
  });
}
