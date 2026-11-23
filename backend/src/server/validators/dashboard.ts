import "@/server/openapi/setup";
import { z } from "zod";
import {
  bdtAmountSchema,
  idSchema,
  isoDateTimeSchema,
} from "@/server/validators/common";
import {
  loanRequestStatusSchema,
  loanStatusSchema,
  notificationTypeSchema,
  offerStatusSchema,
  offerProposerSchema,
  verificationStatusSchema,
} from "@/server/validators/enums";

const count = z.number().int().nonnegative();
const pct = z.number().min(0).max(100);

export const dashboardVerificationSchema = z
  .object({
    status: verificationStatusSchema.nullable(),
    submittedAt: isoDateTimeSchema.nullable(),
    reviewedAt: isoDateTimeSchema.nullable(),
  })
  .strict();

export const dashboardProfileSchema = z
  .object({
    id: idSchema,
    name: z.string(),
    image: z.string().nullable(),
    role: z.enum(["OWNER", "INVESTOR"]),
    shopName: z.string().nullable(),
    slug: z.string().nullable(),
    category: z.string().nullable(),
    district: z.string().nullable(),
    city: z.string().nullable(),
  })
  .strict();

export const recentNotificationSchema = z
  .object({
    id: z.string(),
    type: notificationTypeSchema,
    title: z.string(),
    body: z.string(),
    link: z.string().nullable(),
    readAt: isoDateTimeSchema.nullable(),
    createdAt: isoDateTimeSchema,
  })
  .strict();

export const nextDueSchema = z
  .object({
    repaymentId: z.string(),
    installmentNo: z.number().int().positive(),
    dueDate: isoDateTimeSchema,
    amountBdt: bdtAmountSchema,
    status: z.enum(["UPCOMING", "OVERDUE", "MARKED_PAID"]),
  })
  .strict();

export const dashboardLoanRequestSchema = z
  .object({
    id: z.string(),
    purpose: z.string(),
    amountBdt: bdtAmountSchema,
    status: loanRequestStatusSchema,
    createdAt: isoDateTimeSchema,
  })
  .strict();

export const dashboardOfferSchema = z
  .object({
    id: z.string(),
    status: offerStatusSchema,
    proposer: offerProposerSchema,
    amountBdt: bdtAmountSchema,
    createdAt: isoDateTimeSchema,
  })
  .strict();

export const dashboardProgressSchema = z
  .object({
    totalInstallments: count,
    confirmedCount: count,
    confirmedBdt: bdtAmountSchema,
    outstandingBdt: bdtAmountSchema,
    progressPct: pct,
  })
  .strict();

export const dashboardLoanSchema = z
  .object({
    id: z.string(),
    loanRequestId: z.string(),
    status: loanStatusSchema,
    principalBdt: bdtAmountSchema,
    totalRepayableBdt: bdtAmountSchema,
    startDate: isoDateTimeSchema.nullable(),
    progress: dashboardProgressSchema,
    nextDue: nextDueSchema.nullable(),
  })
  .strict();

export const portfolioHealthSchema = z.enum([
  "ON_TRACK",
  "DUE_SOON",
  "OVERDUE",
  "COMPLETED",
]);

export const portfolioItemSchema = dashboardLoanSchema.extend({
  health: portfolioHealthSchema,
});

export const dashboardActivitySchema = z
  .object({
    connections: count,
    followers: count,
    following: count,
    posts: count,
    unreadNotifications: count,
  })
  .strict();

export const ownerDashboardSchema = z
  .object({
    profile: dashboardProfileSchema,
    verification: dashboardVerificationSchema,
    trustScore: z.number().int().min(0).max(100),
    loanRequests: z
      .object({
        active: dashboardLoanRequestSchema.nullable(),
        total: count,
        byStatus: z.object({
          DRAFT: count,
          OPEN: count,
          IN_DISCUSSION: count,
          FUNDED: count,
          REPAYING: count,
          COMPLETED: count,
          PAUSED: count,
          CANCELLED: count,
        }).strict(),
      })
      .strict(),
    offers: z
      .object({
        received: count,
        pendingReceived: count,
        acceptedReceived: count,
      })
      .strict(),
    loan: dashboardLoanSchema.nullable(),
    recentNotifications: z.array(recentNotificationSchema),
    activity: dashboardActivitySchema,
  })
  .strict();

export const investorDashboardSchema = z
  .object({
    profile: dashboardProfileSchema,
    verification: dashboardVerificationSchema,
    trustScore: z.number().int().min(0).max(100),
    offers: z
      .object({
        submitted: count,
        pendingSubmitted: count,
        acceptedSubmitted: count,
      })
      .strict(),
    loans: z
      .object({
        active: count,
        completed: count,
        totalLentBdt: bdtAmountSchema,
        repaidBdt: bdtAmountSchema,
        expectedReturnsBdt: bdtAmountSchema,
      })
      .strict(),
    repayments: dashboardProgressSchema,
    nextDue: nextDueSchema.nullable(),
    portfolio: z.array(portfolioItemSchema),
    recentNotifications: z.array(recentNotificationSchema),
    activity: dashboardActivitySchema,
  })
  .strict();
