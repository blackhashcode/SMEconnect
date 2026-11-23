import "@/server/openapi/setup";
import { z } from "zod";
import {
  isoDateTimeSchema,
  optionalTextSchema,
  urlArraySchema,
  urlSchema,
} from "@/server/validators/common";
import { privateFileUrlSchema } from "@/server/validators/storage";
import {
  verificationStatusSchema,
  verificationTypeSchema,
} from "@/server/validators/enums";

export const submitVerificationSchema = z
  .object({
    type: verificationTypeSchema,
    idDocumentUrl: privateFileUrlSchema,
    salesProofUrls: z.array(privateFileUrlSchema).max(10).default([]),
    shopLinks: urlArraySchema(10).default([]),
  })
  .strict()
  .superRefine((value, ctx) => {
    if (value.type === "OWNER" && value.salesProofUrls.length === 0) {
      ctx.addIssue({
        code: "custom",
        path: ["salesProofUrls"],
        message: "Owners must provide at least one sales proof",
      });
    }
  });

export const reviewVerificationSchema = z
  .object({
    status: z.enum(["APPROVED", "REJECTED"]),
    reviewNote: optionalTextSchema,
  })
  .strict();

export const verificationQuerySchema = z
  .object({
    status: verificationStatusSchema.optional(),
  })
  .strict();

export const verificationRecordSchema = z
  .object({
    id: z.string(),
    type: verificationTypeSchema,
    status: verificationStatusSchema,
    idDocumentUrl: privateFileUrlSchema,
    salesProofUrls: z.array(privateFileUrlSchema),
    shopLinks: z.array(urlSchema),
    reviewNote: z.string().nullable(),
    submittedAt: isoDateTimeSchema,
    reviewedAt: isoDateTimeSchema.nullable(),
  })
  .strict();

/** `null` means the current user has not submitted a verification yet. */
export const verificationStatusResponseSchema =
  verificationRecordSchema.nullable();

export const adminVerificationRecordSchema = verificationRecordSchema.extend({
  userId: z.string(),
  reviewerId: z.string().nullable(),
});
