import "@/server/openapi/setup";
import { z } from "zod";
import {
  idSchema,
  isoDateTimeSchema,
  longTextSchema,
} from "@/server/validators/common";
import {
  postTypeSchema,
  reportStatusSchema,
  reportTargetTypeSchema,
  roleSchema,
  userStatusSchema,
  verificationStatusSchema,
  verificationTypeSchema,
} from "@/server/validators/enums";

/** Rejects `?unknown=` keys so clients cannot silently change an admin query. */
const boolQuery = (name: string) =>
  z
    .enum(["true", "false"])
    .transform((value) => value === "true")
    .optional()
    .describe(name);

export const adminUserListQuerySchema = z
  .object({
    status: userStatusSchema.optional(),
    role: roleSchema.optional(),
    /** Name or email contains (case-insensitive). */
    q: z.string().trim().min(1).max(100).optional(),
  })
  .strict();

export const adminReportListQuerySchema = z
  .object({
    status: reportStatusSchema.optional(),
    targetType: reportTargetTypeSchema.optional(),
  })
  .strict();

export const adminPostListQuerySchema = z
  .object({ includeDeleted: boolQuery("includeDeleted") })
  .strict();

export const adminCommentListQuerySchema = z
  .object({
    postId: idSchema.optional(),
    includeDeleted: boolQuery("includeDeleted"),
  })
  .strict();

/** The action is explicit input; the resulting report status comes from the endpoint. */
export const moderationActionSchema = z
  .enum(["NONE", "REMOVE_CONTENT", "SUSPEND_USER"])
  .default("NONE");

export const resolveReportSchema = z
  .object({
    resolutionNote: longTextSchema,
    moderationAction: moderationActionSchema.optional(),
  })
  .strict();

export const dismissReportSchema = z
  .object({ resolutionNote: longTextSchema })
  .strict();

// ---------------------------------------------------------------------------
// Response shapes — explicit allow-lists, never raw Prisma rows
// ---------------------------------------------------------------------------

export const adminUserRecordSchema = z
  .object({
    id: z.string(),
    name: z.string(),
    email: z.string(),
    role: roleSchema,
    status: userStatusSchema,
    verificationStatus: verificationStatusSchema.nullable(),
    trustScore: z.number().int().nonnegative(),
    createdAt: isoDateTimeSchema,
    updatedAt: isoDateTimeSchema,
  })
  .strict();

export const adminVerificationSummarySchema = z
  .object({
    id: z.string(),
    type: verificationTypeSchema,
    status: verificationStatusSchema,
    reviewNote: z.string().nullable(),
    reviewerId: z.string().nullable(),
    submittedAt: isoDateTimeSchema,
    reviewedAt: isoDateTimeSchema.nullable(),
    idDocumentUrl: z.string(),
    salesProofUrls: z.array(z.string()),
    shopLinks: z.array(z.string()),
  })
  .strict();

export const adminUserDetailSchema = adminUserRecordSchema.extend({
  verifications: z.array(adminVerificationSummarySchema),
  openReportsAgainst: z.number().int().nonnegative(),
});

export const adminUserStatusResultSchema = z
  .object({
    id: z.string(),
    status: userStatusSchema,
    changedAt: isoDateTimeSchema,
  })
  .strict();

export const adminReportTargetSchema = z.discriminatedUnion("targetType", [
  z
    .object({
      targetType: z.literal("USER"),
      targetId: z.string(),
      name: z.string(),
      role: roleSchema,
      status: userStatusSchema,
    })
    .strict(),
  z
    .object({
      targetType: z.literal("POST"),
      targetId: z.string(),
      authorId: z.string(),
      type: postTypeSchema,
      content: z.string(),
      deletedAt: isoDateTimeSchema.nullable(),
      createdAt: isoDateTimeSchema,
    })
    .strict(),
  z
    .object({
      targetType: z.literal("COMMENT"),
      targetId: z.string(),
      authorId: z.string(),
      postId: z.string(),
      content: z.string(),
      deletedAt: isoDateTimeSchema.nullable(),
      createdAt: isoDateTimeSchema,
    })
    .strict(),
  z
    .object({
      targetType: z.literal("MESSAGE"),
      targetId: z.string(),
      senderId: z.string(),
      conversationId: z.string(),
      body: z.string(),
      deletedAt: isoDateTimeSchema.nullable(),
      createdAt: isoDateTimeSchema,
    })
    .strict(),
]);

export const adminReportDetailSchema = z
  .object({
    id: z.string(),
    reporterId: z.string(),
    targetType: reportTargetTypeSchema,
    targetId: z.string(),
    reason: z.string(),
    status: reportStatusSchema,
    resolutionNote: z.string().nullable(),
    handledById: z.string().nullable(),
    createdAt: isoDateTimeSchema,
    updatedAt: isoDateTimeSchema,
    target: adminReportTargetSchema.nullable(),
  })
  .strict();

export const adminReportResolutionResultSchema = adminReportDetailSchema.omit({
  target: true,
});

export const adminModerationActionSchema = z
  .object({
    reportId: z.string(),
    status: reportStatusSchema,
    moderationAction: moderationActionSchema,
    resolutionNote: z.string(),
    handledById: z.string(),
  })
  .strict();

export const adminPostRecordSchema = z
  .object({
    id: z.string(),
    authorId: z.string(),
    type: postTypeSchema,
    content: z.string(),
    imageUrls: z.array(z.string()),
    deletedAt: isoDateTimeSchema.nullable(),
    createdAt: isoDateTimeSchema,
    updatedAt: isoDateTimeSchema,
  })
  .strict();

export const adminCommentRecordSchema = z
  .object({
    id: z.string(),
    postId: z.string(),
    authorId: z.string(),
    content: z.string(),
    deletedAt: isoDateTimeSchema.nullable(),
    createdAt: isoDateTimeSchema,
    updatedAt: isoDateTimeSchema,
  })
  .strict();

export const adminDeleteResultSchema = z
  .object({ id: z.string(), deleted: z.literal(true) })
  .strict();

const zeroCount = <T extends string>(values: readonly T[]) =>
  z.object(Object.fromEntries(values.map((value) => [value, z.number().int().nonnegative()])) as {
    [K in T]: z.ZodNumber;
  });

const loanRequestStatuses = [
  "DRAFT",
  "OPEN",
  "IN_DISCUSSION",
  "FUNDED",
  "REPAYING",
  "COMPLETED",
  "PAUSED",
  "CANCELLED",
] as const;
const offerStatuses = ["PENDING", "ACCEPTED", "REJECTED", "COUNTERED", "WITHDRAWN", "EXPIRED"] as const;
const loanStatuses = ["PENDING_AGREEMENT", "ACTIVE", "COMPLETED", "DEFAULTED"] as const;
const reportStatuses = ["OPEN", "RESOLVED", "DISMISSED"] as const;

export const adminStatsSchema = z
  .object({
    users: z
      .object({
        total: z.number().int().nonnegative(),
        byRole: zeroCount(["OWNER", "INVESTOR", "ADMIN"] as const),
        byStatus: zeroCount(["ACTIVE", "SUSPENDED"] as const),
      })
      .strict(),
    verifications: z
      .object({
        total: z.number().int().nonnegative(),
        pending: z.number().int().nonnegative(),
        approved: z.number().int().nonnegative(),
        rejected: z.number().int().nonnegative(),
      })
      .strict(),
    loanRequests: z
      .object({
        total: z.number().int().nonnegative(),
        byStatus: zeroCount(loanRequestStatuses),
      })
      .strict(),
    offers: z
      .object({
        total: z.number().int().nonnegative(),
        byStatus: zeroCount(offerStatuses),
      })
      .strict(),
    loans: z
      .object({
        fundedCount: z.number().int().nonnegative(),
        totalPrincipalBdt: z.number().int().nonnegative(),
        byStatus: zeroCount(loanStatuses),
      })
      .strict(),
    repayments: z
      .object({
        total: z.number().int().nonnegative(),
        confirmedCount: z.number().int().nonnegative(),
        onTimeConfirmedCount: z.number().int().nonnegative(),
        onTimeRatePct: z.number().min(0).max(100),
        overdueCount: z.number().int().nonnegative(),
      })
      .strict(),
    reports: z
      .object({
        total: z.number().int().nonnegative(),
        byStatus: zeroCount(reportStatuses),
        activeDisputes: z.number().int().nonnegative(),
        handledCount: z.number().int().nonnegative(),
      })
      .strict(),
    moderation: z
      .object({
        suspendedUsers: z.number().int().nonnegative(),
        removedPosts: z.number().int().nonnegative(),
        removedComments: z.number().int().nonnegative(),
      })
      .strict(),
  })
  .strict();
