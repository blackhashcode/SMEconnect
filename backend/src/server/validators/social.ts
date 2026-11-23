import "@/server/openapi/setup";
import { z } from "zod";
import {
  idSchema,
  longTextSchema,
  optionalTextSchema,
  ratingSchema,
  shortTextSchema,
  urlArraySchema,
} from "@/server/validators/common";
import {
  postTypeSchema,
  reportTargetTypeSchema,
} from "@/server/validators/enums";

export const createPostSchema = z
  .object({
    type: postTypeSchema,
    content: longTextSchema,
    imageUrls: urlArraySchema(10).default([]),
    loanRequestId: idSchema.optional(),
  })
  .strict();

export const updatePostSchema = z
  .object({
    content: longTextSchema,
    imageUrls: urlArraySchema(10).optional(),
  })
  .strict();

export const createCommentSchema = z
  .object({
    postId: idSchema,
    content: longTextSchema,
  })
  .strict();

export const followUserSchema = z
  .object({ followeeId: idSchema })
  .strict();

export const sendConnectionRequestSchema = z
  .object({
    addresseeId: idSchema,
    message: optionalTextSchema,
  })
  .strict();

export const connectionActionSchema = z
  .object({ connectionId: idSchema })
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
