-- CreateTable
CREATE TABLE "verification_submission" (
    "id" TEXT NOT NULL,
    "verificationId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "type" "VerificationType" NOT NULL,
    "idDocumentUrl" TEXT NOT NULL,
    "salesProofUrls" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "shopLinks" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "status" "VerificationStatus" NOT NULL DEFAULT 'PENDING',
    "reviewerId" TEXT,
    "reviewNote" TEXT,
    "submittedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "reviewedAt" TIMESTAMP(3),

    CONSTRAINT "verification_submission_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "verification_submission_userId_submittedAt_idx" ON "verification_submission"("userId", "submittedAt");

-- CreateIndex
CREATE INDEX "verification_submission_verificationId_submittedAt_idx" ON "verification_submission"("verificationId", "submittedAt");

-- Backfill: every existing verification becomes the first entry in its history.
INSERT INTO "verification_submission" ("id", "verificationId", "userId", "type", "idDocumentUrl", "salesProofUrls", "shopLinks", "status", "reviewerId", "reviewNote", "submittedAt", "reviewedAt")
SELECT 'vs_' || "id", "id", "userId", "type", "idDocumentUrl", "salesProofUrls", "shopLinks", "status", "reviewerId", "reviewNote", "submittedAt", "reviewedAt"
FROM "user_verification";
