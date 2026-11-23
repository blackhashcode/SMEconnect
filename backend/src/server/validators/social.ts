import "@/server/openapi/setup";
import { z } from "zod";
import {
  bdtAmountSchema,
  idSchema,
  isoDateTimeSchema,
  longTextSchema,
  optionalTextSchema,
  ratingSchema,
  shortTextSchema,
  urlArraySchema,
} from "@/server/validators/common";
import {
  connectionStatusSchema,
  postTypeSchema,
  reportStatusSchema,
  reportTargetTypeSchema,
} from "@/server/validators/enums";

/** Clients may only author these post types; loan/repayment posts are system-owned. */
export const userPostTypeSchema = z.enum(["UPDATE", "MILESTONE"]);

export const createPostSchema = z
  .object({
    type: userPostTypeSchema,
    content: longTextSchema,
    imageUrls: urlArraySchema(10).default([]),
  })
  .strict();

export const updatePostSchema = z
  .object({
    content: longTextSchema.optional(),
    imageUrls: urlArraySchema(10).optional(),
  })
  .strict()
  .refine((value) => Object.keys(value).length > 0, {
    message: "Provide at least one field to update",
  });

export const createCommentSchema = z.object({ content: longTextSchema }).strict();
export const updateCommentSchema = z.object({ content: longTextSchema }).strict();

export const followUserSchema = z
  .object({ followeeId: idSchema })
  .strict();

export const sendConnectionRequestSchema = z
  .object({
    addresseeId: idSchema,
    message: optionalTextSchema,
  })
  .strict();

/** Kept for clients that send the connection id in a body; routes use the path id. */
export const connectionActionSchema = z
  .object({ connectionId: idSchema })
  .strict();

export const connectionListQuerySchema = z
  .object({
    direction: z.enum(["incoming", "outgoing", "all"]).default("all"),
    status: connectionStatusSchema.optional(),
  })
  .strict();

export const feedQuerySchema = z
  .object({ type: postTypeSchema.optional() })
  .strict();

export const createReviewSchema = z
  .object({
    loanId: idSchema,
    revieweeId: idSchema,
    rating: ratingSchema,
    comment: optionalTextSchema,
  })
  .strict();

export const createReportSchema = z
  .object({
    targetType: reportTargetTypeSchema,
    targetId: idSchema,
    reason: shortTextSchema,
  })
  .strict();

// ---------------------------------------------------------------------------
// Response shapes — explicit allow-lists, never raw Prisma rows
// ---------------------------------------------------------------------------

/** Shared public author card. Never includes email, phone, ids or documents. */
export const postAuthorSchema = z
  .object({
    name: z.string(),
    image: z.string().nullable(),
    role: z.enum(["OWNER", "INVESTOR"]),
    verified: z.boolean(),
    shopName: z.string().nullable(),
    slug: z.string().nullable(),
    category: z.string().nullable(),
  })
  .strict();

export const postLoanRequestSummarySchema = z
  .object({
    id: z.string(),
    amountBdt: bdtAmountSchema,
    tenureDays: z.number().int().positive(),
    proposedRatePct: z.string(),
  })
  .strict();

export const postRecordSchema = z
  .object({
    id: z.string(),
    type: postTypeSchema,
    content: z.string(),
    imageUrls: z.array(z.string()),
    author: postAuthorSchema,
    likeCount: z.number().int().nonnegative(),
    commentCount: z.number().int().nonnegative(),
    likedByMe: z.boolean(),
    loanRequest: postLoanRequestSummarySchema.nullable(),
    createdAt: isoDateTimeSchema,
    updatedAt: isoDateTimeSchema,
  })
  .strict();

export const commentRecordSchema = z
  .object({
    id: z.string(),
    postId: z.string(),
    content: z.string(),
    author: postAuthorSchema,
    createdAt: isoDateTimeSchema,
    updatedAt: isoDateTimeSchema,
  })
  .strict();

export const likeResultSchema = z
  .object({
    postId: z.string(),
    liked: z.boolean(),
    likeCount: z.number().int().nonnegative(),
  })
  .strict();

export const deleteResultSchema = z
  .object({ id: z.string(), deleted: z.literal(true) })
  .strict();

export const connectionRecordSchema = z
  .object({
    id: z.string(),
    user: postAuthorSchema,
    direction: z.enum(["incoming", "outgoing"]),
    status: connectionStatusSchema,
    message: z.string().nullable(),
    createdAt: isoDateTimeSchema,
    updatedAt: isoDateTimeSchema,
  })
  .strict();

export const followRecordSchema = z
  .object({
    userId: z.string(),
    user: postAuthorSchema,
    following: z.literal(true),
  })
  .strict();

export const followResultSchema = z
  .object({
    userId: z.string(),
    following: z.boolean(),
  })
  .strict();

export const postRecordListSchema = z.array(postRecordSchema);
export const commentRecordListSchema = z.array(commentRecordSchema);
export const connectionRecordListSchema = z.array(connectionRecordSchema);
export const followRecordListSchema = z.array(followRecordSchema);

// ---------------------------------------------------------------------------
// Phase 9 — reviews and reports
// ---------------------------------------------------------------------------

/** Public review card: safe participant profiles, no account email/phone/documents. */
export const reviewRecordSchema = z
  .object({
    id: z.string(),
    loanId: z.string(),
    rating: ratingSchema,
    comment: z.string().nullable(),
    reviewer: postAuthorSchema,
    reviewee: postAuthorSchema,
    createdAt: isoDateTimeSchema,
    updatedAt: isoDateTimeSchema,
  })
  .strict();

export const reviewRecordListSchema = z.array(reviewRecordSchema);

export const reviewSummarySchema = z
  .object({
    count: z.number().int().nonnegative(),
    averageRating: z.number().min(0).max(5).nullable(),
  })
  .strict();

export const reviewListQuerySchema = z
  .object({ userId: idSchema })
  .strict();

export const reportListQuerySchema = z
  .object({ status: reportStatusSchema.optional() })
  .strict();

export const reportRecordSchema = z
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
  })
  .strict();

export const reportRecordListSchema = z.array(reportRecordSchema);
