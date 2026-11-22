-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "public";

-- CreateEnum
CREATE TYPE "Role" AS ENUM ('OWNER', 'INVESTOR', 'ADMIN');

-- CreateEnum
CREATE TYPE "UserStatus" AS ENUM ('ACTIVE', 'SUSPENDED');

-- CreateEnum
CREATE TYPE "VerificationType" AS ENUM ('OWNER', 'INVESTOR');

-- CreateEnum
CREATE TYPE "VerificationStatus" AS ENUM ('PENDING', 'APPROVED', 'REJECTED');

-- CreateEnum
CREATE TYPE "RepaymentFrequency" AS ENUM ('WEEKLY', 'BIWEEKLY', 'MONTHLY');

-- CreateEnum
CREATE TYPE "LoanRequestStatus" AS ENUM ('DRAFT', 'OPEN', 'IN_DISCUSSION', 'FUNDED', 'REPAYING', 'COMPLETED', 'PAUSED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "OfferStatus" AS ENUM ('PENDING', 'ACCEPTED', 'REJECTED', 'COUNTERED', 'WITHDRAWN', 'EXPIRED');

-- CreateEnum
CREATE TYPE "OfferProposer" AS ENUM ('OWNER', 'INVESTOR');

-- CreateEnum
CREATE TYPE "LoanStatus" AS ENUM ('PENDING_AGREEMENT', 'ACTIVE', 'COMPLETED', 'DEFAULTED');

-- CreateEnum
CREATE TYPE "RepaymentStatus" AS ENUM ('UPCOMING', 'MARKED_PAID', 'CONFIRMED', 'OVERDUE');

-- CreateEnum
CREATE TYPE "PostType" AS ENUM ('UPDATE', 'MILESTONE', 'LOAN_REQUEST', 'REPAYMENT');

-- CreateEnum
CREATE TYPE "ConnectionStatus" AS ENUM ('PENDING', 'ACCEPTED', 'DECLINED');

-- CreateEnum
CREATE TYPE "NotificationType" AS ENUM ('OFFER_RECEIVED', 'OFFER_COUNTERED', 'OFFER_ACCEPTED', 'AGREEMENT_CONFIRMED', 'MESSAGE_RECEIVED', 'CONNECTION_REQUEST', 'CONNECTION_ACCEPTED', 'VERIFICATION_RESULT', 'REPAYMENT_DUE', 'REPAYMENT_OVERDUE', 'REPAYMENT_MARKED_PAID', 'REPAYMENT_CONFIRMED', 'NEW_COMMENT', 'NEW_LIKE');

-- CreateEnum
CREATE TYPE "ReportTargetType" AS ENUM ('USER', 'POST', 'COMMENT', 'MESSAGE');

-- CreateEnum
CREATE TYPE "ReportStatus" AS ENUM ('OPEN', 'RESOLVED', 'DISMISSED');

-- CreateTable
CREATE TABLE "user" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "emailVerified" BOOLEAN NOT NULL DEFAULT false,
    "image" TEXT,
    "phone" TEXT,
    "phoneVerified" BOOLEAN NOT NULL DEFAULT false,
    "role" "Role" NOT NULL DEFAULT 'OWNER',
    "status" "UserStatus" NOT NULL DEFAULT 'ACTIVE',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "user_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "session" (
    "id" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "token" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "ipAddress" TEXT,
    "userAgent" TEXT,
    "userId" TEXT NOT NULL,

    CONSTRAINT "session_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "account" (
    "id" TEXT NOT NULL,
    "accountId" TEXT NOT NULL,
    "providerId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "accessToken" TEXT,
    "refreshToken" TEXT,
    "idToken" TEXT,
    "accessTokenExpiresAt" TIMESTAMP(3),
    "refreshTokenExpiresAt" TIMESTAMP(3),
    "scope" TEXT,
    "password" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "account_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "verification" (
    "id" TEXT NOT NULL,
    "identifier" TEXT NOT NULL,
    "value" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3),

    CONSTRAINT "verification_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "user_verification" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "type" "VerificationType" NOT NULL,
    "status" "VerificationStatus" NOT NULL DEFAULT 'PENDING',
    "idDocumentUrl" TEXT NOT NULL,
    "salesProofUrls" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "shopLinks" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "reviewerId" TEXT,
    "reviewNote" TEXT,
    "submittedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "reviewedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "user_verification_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "business_profile" (
    "id" TEXT NOT NULL,
    "ownerId" TEXT NOT NULL,
    "shopName" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "description" TEXT,
    "district" TEXT NOT NULL,
    "city" TEXT NOT NULL,
    "facebookUrl" TEXT,
    "instagramUrl" TEXT,
    "whatsappUrl" TEXT,
    "websiteUrl" TEXT,
    "runningSince" TIMESTAMP(3),
    "monthlyOrdersRange" TEXT,
    "monthlySalesMinBdt" INTEGER,
    "monthlySalesMaxBdt" INTEGER,
    "growthStory" TEXT,
    "logoUrl" TEXT,
    "coverUrl" TEXT,
    "trustScore" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "business_profile_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "product_image" (
    "id" TEXT NOT NULL,
    "businessProfileId" TEXT NOT NULL,
    "url" TEXT NOT NULL,
    "caption" TEXT,
    "position" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "product_image_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "investor_profile" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "bio" TEXT,
    "minLendBdt" INTEGER NOT NULL,
    "maxLendBdt" INTEGER NOT NULL,
    "preferredCategories" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "preferredTenureDays" INTEGER,
    "preferredRatePctMin" DECIMAL(5,2),
    "preferredRatePctMax" DECIMAL(5,2),
    "district" TEXT,
    "city" TEXT,
    "trustScore" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "investor_profile_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "loan_request" (
    "id" TEXT NOT NULL,
    "ownerId" TEXT NOT NULL,
    "amountBdt" INTEGER NOT NULL,
    "purpose" TEXT NOT NULL,
    "fundUsage" TEXT NOT NULL,
    "tenureDays" INTEGER NOT NULL,
    "repaymentFrequency" "RepaymentFrequency" NOT NULL,
    "proposedRatePct" DECIMAL(5,2) NOT NULL,
    "proofUrls" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "status" "LoanRequestStatus" NOT NULL DEFAULT 'DRAFT',
    "publishedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "loan_request_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "offer" (
    "id" TEXT NOT NULL,
    "loanRequestId" TEXT NOT NULL,
    "investorId" TEXT NOT NULL,
    "amountBdt" INTEGER NOT NULL,
    "interestRatePct" DECIMAL(5,2) NOT NULL,
    "tenureDays" INTEGER NOT NULL,
    "repaymentFrequency" "RepaymentFrequency" NOT NULL,
    "message" TEXT,
    "status" "OfferStatus" NOT NULL DEFAULT 'PENDING',
    "parentOfferId" TEXT,
    "proposedBy" "OfferProposer" NOT NULL DEFAULT 'INVESTOR',
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "offer_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "loan" (
    "id" TEXT NOT NULL,
    "loanRequestId" TEXT NOT NULL,
    "offerId" TEXT NOT NULL,
    "ownerId" TEXT NOT NULL,
    "investorId" TEXT NOT NULL,
    "principalBdt" INTEGER NOT NULL,
    "interestRatePct" DECIMAL(5,2) NOT NULL,
    "tenureDays" INTEGER NOT NULL,
    "repaymentFrequency" "RepaymentFrequency" NOT NULL,
    "totalRepayableBdt" INTEGER NOT NULL,
    "status" "LoanStatus" NOT NULL DEFAULT 'PENDING_AGREEMENT',
    "startDate" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "loan_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "agreement" (
    "id" TEXT NOT NULL,
    "loanId" TEXT NOT NULL,
    "termsSnapshot" JSONB NOT NULL,
    "ownerConfirmedAt" TIMESTAMP(3),
    "investorConfirmedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "agreement_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "repayment" (
    "id" TEXT NOT NULL,
    "loanId" TEXT NOT NULL,
    "installmentNo" INTEGER NOT NULL,
    "dueDate" TIMESTAMP(3) NOT NULL,
    "amountBdt" INTEGER NOT NULL,
    "status" "RepaymentStatus" NOT NULL DEFAULT 'UPCOMING',
    "markedPaidAt" TIMESTAMP(3),
    "confirmedAt" TIMESTAMP(3),
    "note" TEXT,
    "proofUrl" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "repayment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "post" (
    "id" TEXT NOT NULL,
    "authorId" TEXT NOT NULL,
    "type" "PostType" NOT NULL DEFAULT 'UPDATE',
    "content" TEXT NOT NULL,
    "imageUrls" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "loanRequestId" TEXT,
    "deletedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "post_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "comment" (
    "id" TEXT NOT NULL,
    "postId" TEXT NOT NULL,
    "authorId" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "deletedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "comment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "like" (
    "id" TEXT NOT NULL,
    "postId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "like_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "follow" (
    "id" TEXT NOT NULL,
    "followerId" TEXT NOT NULL,
    "followeeId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "follow_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "connection" (
    "id" TEXT NOT NULL,
    "requesterId" TEXT NOT NULL,
    "addresseeId" TEXT NOT NULL,
    "status" "ConnectionStatus" NOT NULL DEFAULT 'PENDING',
    "message" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "connection_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "conversation" (
    "id" TEXT NOT NULL,
    "participantOneId" TEXT NOT NULL,
    "participantTwoId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "conversation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "message" (
    "id" TEXT NOT NULL,
    "conversationId" TEXT NOT NULL,
    "senderId" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "readAt" TIMESTAMP(3),
    "deletedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "message_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "message_deletion" (
    "id" TEXT NOT NULL,
    "messageId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "deletedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "message_deletion_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "notification" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "type" "NotificationType" NOT NULL,
    "title" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "link" TEXT,
    "data" JSONB,
    "readAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "notification_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "review" (
    "id" TEXT NOT NULL,
    "loanId" TEXT NOT NULL,
    "reviewerId" TEXT NOT NULL,
    "revieweeId" TEXT NOT NULL,
    "rating" INTEGER NOT NULL,
    "comment" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "review_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "report" (
    "id" TEXT NOT NULL,
    "reporterId" TEXT NOT NULL,
    "targetType" "ReportTargetType" NOT NULL,
    "targetId" TEXT NOT NULL,
    "reason" TEXT NOT NULL,
    "status" "ReportStatus" NOT NULL DEFAULT 'OPEN',
    "resolutionNote" TEXT,
    "handledById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "report_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "block" (
    "id" TEXT NOT NULL,
    "blockerId" TEXT NOT NULL,
    "blockedId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "block_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "user_phone_key" ON "user"("phone");

-- CreateIndex
CREATE UNIQUE INDEX "user_email_key" ON "user"("email");

-- CreateIndex
CREATE UNIQUE INDEX "session_token_key" ON "session"("token");

-- CreateIndex
CREATE UNIQUE INDEX "account_providerId_accountId_key" ON "account"("providerId", "accountId");

-- CreateIndex
CREATE INDEX "user_verification_status_idx" ON "user_verification"("status");

-- CreateIndex
CREATE INDEX "user_verification_type_status_idx" ON "user_verification"("type", "status");

-- CreateIndex
CREATE UNIQUE INDEX "user_verification_userId_type_key" ON "user_verification"("userId", "type");

-- CreateIndex
CREATE UNIQUE INDEX "business_profile_ownerId_key" ON "business_profile"("ownerId");

-- CreateIndex
CREATE UNIQUE INDEX "business_profile_slug_key" ON "business_profile"("slug");

-- CreateIndex
CREATE INDEX "business_profile_category_idx" ON "business_profile"("category");

-- CreateIndex
CREATE INDEX "business_profile_district_city_idx" ON "business_profile"("district", "city");

-- CreateIndex
CREATE INDEX "business_profile_trustScore_idx" ON "business_profile"("trustScore");

-- CreateIndex
CREATE UNIQUE INDEX "product_image_businessProfileId_position_key" ON "product_image"("businessProfileId", "position");

-- CreateIndex
CREATE UNIQUE INDEX "investor_profile_userId_key" ON "investor_profile"("userId");

-- CreateIndex
CREATE INDEX "investor_profile_minLendBdt_maxLendBdt_idx" ON "investor_profile"("minLendBdt", "maxLendBdt");

-- CreateIndex
CREATE INDEX "investor_profile_district_city_idx" ON "investor_profile"("district", "city");

-- CreateIndex
CREATE INDEX "loan_request_ownerId_status_idx" ON "loan_request"("ownerId", "status");

-- CreateIndex
CREATE INDEX "loan_request_status_publishedAt_idx" ON "loan_request"("status", "publishedAt");

-- CreateIndex
CREATE UNIQUE INDEX "loan_request_one_active_per_owner" ON "loan_request"("ownerId") WHERE (status IN ('OPEN', 'IN_DISCUSSION', 'FUNDED', 'REPAYING'));

-- CreateIndex
CREATE INDEX "offer_loanRequestId_status_idx" ON "offer"("loanRequestId", "status");

-- CreateIndex
CREATE INDEX "offer_investorId_status_idx" ON "offer"("investorId", "status");

-- CreateIndex
CREATE INDEX "offer_parentOfferId_idx" ON "offer"("parentOfferId");

-- CreateIndex
CREATE INDEX "offer_expiresAt_idx" ON "offer"("expiresAt");

-- CreateIndex
CREATE UNIQUE INDEX "offer_one_pending_per_investor_per_request" ON "offer"("loanRequestId", "investorId") WHERE (status = 'PENDING');

-- CreateIndex
CREATE UNIQUE INDEX "loan_loanRequestId_key" ON "loan"("loanRequestId");

-- CreateIndex
CREATE UNIQUE INDEX "loan_offerId_key" ON "loan"("offerId");

-- CreateIndex
CREATE INDEX "loan_ownerId_status_idx" ON "loan"("ownerId", "status");

-- CreateIndex
CREATE INDEX "loan_investorId_status_idx" ON "loan"("investorId", "status");

-- CreateIndex
CREATE INDEX "loan_status_idx" ON "loan"("status");

-- CreateIndex
CREATE INDEX "loan_startDate_idx" ON "loan"("startDate");

-- CreateIndex
CREATE UNIQUE INDEX "agreement_loanId_key" ON "agreement"("loanId");

-- CreateIndex
CREATE INDEX "repayment_loanId_status_idx" ON "repayment"("loanId", "status");

-- CreateIndex
CREATE INDEX "repayment_dueDate_status_idx" ON "repayment"("dueDate", "status");

-- CreateIndex
CREATE UNIQUE INDEX "repayment_loanId_installmentNo_key" ON "repayment"("loanId", "installmentNo");

-- CreateIndex
CREATE INDEX "post_authorId_createdAt_idx" ON "post"("authorId", "createdAt");

-- CreateIndex
CREATE INDEX "post_loanRequestId_idx" ON "post"("loanRequestId");

-- CreateIndex
CREATE INDEX "post_deletedAt_idx" ON "post"("deletedAt");

-- CreateIndex
CREATE INDEX "comment_postId_createdAt_idx" ON "comment"("postId", "createdAt");

-- CreateIndex
CREATE INDEX "comment_authorId_idx" ON "comment"("authorId");

-- CreateIndex
CREATE INDEX "comment_deletedAt_idx" ON "comment"("deletedAt");

-- CreateIndex
CREATE UNIQUE INDEX "like_postId_userId_key" ON "like"("postId", "userId");

-- CreateIndex
CREATE INDEX "follow_followeeId_idx" ON "follow"("followeeId");

-- CreateIndex
CREATE UNIQUE INDEX "follow_followerId_followeeId_key" ON "follow"("followerId", "followeeId");

-- CreateIndex
CREATE INDEX "connection_addresseeId_status_idx" ON "connection"("addresseeId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "connection_requesterId_addresseeId_key" ON "connection"("requesterId", "addresseeId");

-- CreateIndex
CREATE INDEX "conversation_participantTwoId_idx" ON "conversation"("participantTwoId");

-- CreateIndex
CREATE UNIQUE INDEX "conversation_participantOneId_participantTwoId_key" ON "conversation"("participantOneId", "participantTwoId");

-- CreateIndex
CREATE INDEX "message_conversationId_createdAt_idx" ON "message"("conversationId", "createdAt");

-- CreateIndex
CREATE INDEX "message_senderId_idx" ON "message"("senderId");

-- CreateIndex
CREATE UNIQUE INDEX "message_deletion_messageId_userId_key" ON "message_deletion"("messageId", "userId");

-- CreateIndex
CREATE INDEX "notification_userId_readAt_idx" ON "notification"("userId", "readAt");

-- CreateIndex
CREATE INDEX "notification_userId_createdAt_idx" ON "notification"("userId", "createdAt");

-- CreateIndex
CREATE INDEX "review_revieweeId_rating_idx" ON "review"("revieweeId", "rating");

-- CreateIndex
CREATE UNIQUE INDEX "review_loanId_reviewerId_key" ON "review"("loanId", "reviewerId");

-- CreateIndex
CREATE INDEX "report_status_createdAt_idx" ON "report"("status", "createdAt");

-- CreateIndex
CREATE INDEX "report_targetType_targetId_idx" ON "report"("targetType", "targetId");

-- CreateIndex
CREATE INDEX "report_reporterId_idx" ON "report"("reporterId");

-- CreateIndex
CREATE INDEX "block_blockedId_idx" ON "block"("blockedId");

-- CreateIndex
CREATE UNIQUE INDEX "block_blockerId_blockedId_key" ON "block"("blockerId", "blockedId");

-- AddForeignKey
ALTER TABLE "session" ADD CONSTRAINT "session_userId_fkey" FOREIGN KEY ("userId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "account" ADD CONSTRAINT "account_userId_fkey" FOREIGN KEY ("userId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_verification" ADD CONSTRAINT "user_verification_userId_fkey" FOREIGN KEY ("userId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_verification" ADD CONSTRAINT "user_verification_reviewerId_fkey" FOREIGN KEY ("reviewerId") REFERENCES "user"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "business_profile" ADD CONSTRAINT "business_profile_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "product_image" ADD CONSTRAINT "product_image_businessProfileId_fkey" FOREIGN KEY ("businessProfileId") REFERENCES "business_profile"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "investor_profile" ADD CONSTRAINT "investor_profile_userId_fkey" FOREIGN KEY ("userId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "loan_request" ADD CONSTRAINT "loan_request_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "user"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "offer" ADD CONSTRAINT "offer_loanRequestId_fkey" FOREIGN KEY ("loanRequestId") REFERENCES "loan_request"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "offer" ADD CONSTRAINT "offer_investorId_fkey" FOREIGN KEY ("investorId") REFERENCES "user"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "offer" ADD CONSTRAINT "offer_parentOfferId_fkey" FOREIGN KEY ("parentOfferId") REFERENCES "offer"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "loan" ADD CONSTRAINT "loan_loanRequestId_fkey" FOREIGN KEY ("loanRequestId") REFERENCES "loan_request"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "loan" ADD CONSTRAINT "loan_offerId_fkey" FOREIGN KEY ("offerId") REFERENCES "offer"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "loan" ADD CONSTRAINT "loan_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "user"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "loan" ADD CONSTRAINT "loan_investorId_fkey" FOREIGN KEY ("investorId") REFERENCES "user"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "agreement" ADD CONSTRAINT "agreement_loanId_fkey" FOREIGN KEY ("loanId") REFERENCES "loan"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "repayment" ADD CONSTRAINT "repayment_loanId_fkey" FOREIGN KEY ("loanId") REFERENCES "loan"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "post" ADD CONSTRAINT "post_authorId_fkey" FOREIGN KEY ("authorId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "post" ADD CONSTRAINT "post_loanRequestId_fkey" FOREIGN KEY ("loanRequestId") REFERENCES "loan_request"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "comment" ADD CONSTRAINT "comment_postId_fkey" FOREIGN KEY ("postId") REFERENCES "post"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "comment" ADD CONSTRAINT "comment_authorId_fkey" FOREIGN KEY ("authorId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "like" ADD CONSTRAINT "like_postId_fkey" FOREIGN KEY ("postId") REFERENCES "post"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "like" ADD CONSTRAINT "like_userId_fkey" FOREIGN KEY ("userId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "follow" ADD CONSTRAINT "follow_followerId_fkey" FOREIGN KEY ("followerId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "follow" ADD CONSTRAINT "follow_followeeId_fkey" FOREIGN KEY ("followeeId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "connection" ADD CONSTRAINT "connection_requesterId_fkey" FOREIGN KEY ("requesterId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "connection" ADD CONSTRAINT "connection_addresseeId_fkey" FOREIGN KEY ("addresseeId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "conversation" ADD CONSTRAINT "conversation_participantOneId_fkey" FOREIGN KEY ("participantOneId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "conversation" ADD CONSTRAINT "conversation_participantTwoId_fkey" FOREIGN KEY ("participantTwoId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "message" ADD CONSTRAINT "message_conversationId_fkey" FOREIGN KEY ("conversationId") REFERENCES "conversation"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "message" ADD CONSTRAINT "message_senderId_fkey" FOREIGN KEY ("senderId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "message_deletion" ADD CONSTRAINT "message_deletion_messageId_fkey" FOREIGN KEY ("messageId") REFERENCES "message"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "message_deletion" ADD CONSTRAINT "message_deletion_userId_fkey" FOREIGN KEY ("userId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "notification" ADD CONSTRAINT "notification_userId_fkey" FOREIGN KEY ("userId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "review" ADD CONSTRAINT "review_loanId_fkey" FOREIGN KEY ("loanId") REFERENCES "loan"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "review" ADD CONSTRAINT "review_reviewerId_fkey" FOREIGN KEY ("reviewerId") REFERENCES "user"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "review" ADD CONSTRAINT "review_revieweeId_fkey" FOREIGN KEY ("revieweeId") REFERENCES "user"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "report" ADD CONSTRAINT "report_reporterId_fkey" FOREIGN KEY ("reporterId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "report" ADD CONSTRAINT "report_handledById_fkey" FOREIGN KEY ("handledById") REFERENCES "user"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "block" ADD CONSTRAINT "block_blockerId_fkey" FOREIGN KEY ("blockerId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "block" ADD CONSTRAINT "block_blockedId_fkey" FOREIGN KEY ("blockedId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- CheckConstraints
-- Prisma 7 cannot express CHECK constraints in schema.prisma. These are kept
-- in the migration and mirrored by the Zod validators.

ALTER TABLE "review" ADD CONSTRAINT "review_rating_range" CHECK ("rating" BETWEEN 1 AND 5);

ALTER TABLE "loan_request" ADD CONSTRAINT "loan_request_amount_positive" CHECK ("amountBdt" > 0);
ALTER TABLE "loan_request" ADD CONSTRAINT "loan_request_rate_range" CHECK ("proposedRatePct" >= 0 AND "proposedRatePct" <= 100);

ALTER TABLE "offer" ADD CONSTRAINT "offer_amount_positive" CHECK ("amountBdt" > 0);
ALTER TABLE "offer" ADD CONSTRAINT "offer_rate_range" CHECK ("interestRatePct" >= 0 AND "interestRatePct" <= 100);

ALTER TABLE "loan" ADD CONSTRAINT "loan_principal_positive" CHECK ("principalBdt" > 0);
ALTER TABLE "loan" ADD CONSTRAINT "loan_total_repayable_positive" CHECK ("totalRepayableBdt" > 0);
ALTER TABLE "loan" ADD CONSTRAINT "loan_rate_range" CHECK ("interestRatePct" >= 0 AND "interestRatePct" <= 100);

ALTER TABLE "repayment" ADD CONSTRAINT "repayment_amount_positive" CHECK ("amountBdt" > 0);

ALTER TABLE "business_profile" ADD CONSTRAINT "business_profile_sales_range" CHECK ("monthlySalesMinBdt" IS NULL OR "monthlySalesMaxBdt" IS NULL OR "monthlySalesMinBdt" <= "monthlySalesMaxBdt");

ALTER TABLE "investor_profile" ADD CONSTRAINT "investor_profile_lend_range" CHECK ("minLendBdt" <= "maxLendBdt");
ALTER TABLE "investor_profile" ADD CONSTRAINT "investor_profile_rate_range" CHECK ("preferredRatePctMin" IS NULL OR "preferredRatePctMax" IS NULL OR "preferredRatePctMin" <= "preferredRatePctMax");

ALTER TABLE "follow" ADD CONSTRAINT "follow_no_self" CHECK ("followerId" <> "followeeId");
ALTER TABLE "connection" ADD CONSTRAINT "connection_no_self" CHECK ("requesterId" <> "addresseeId");
ALTER TABLE "block" ADD CONSTRAINT "block_no_self" CHECK ("blockerId" <> "blockedId");
ALTER TABLE "conversation" ADD CONSTRAINT "conversation_ordered_participants" CHECK ("participantOneId" < "participantTwoId");
