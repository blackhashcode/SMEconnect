import { z } from "zod";
import {
  optionalTextSchema,
  urlArraySchema,
  urlSchema,
} from "@/server/validators/common";
import {
  verificationStatusSchema,
  verificationTypeSchema,
} from "@/server/validators/enums";

export const submitVerificationSchema = z
  .object({
    type: verificationTypeSchema,
    idDocumentUrl: urlSchema,
    salesProofUrls: urlArraySchema(10).default([]),
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
