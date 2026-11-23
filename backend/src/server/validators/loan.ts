import "@/server/openapi/setup";
import { z } from "zod";
import {
  idSchema,
  isoDateTimeSchema,
  longTextSchema,
  optionalTextSchema,
  positiveBdtSchema,
  ratePctSchema,
  shortTextSchema,
  tenureDaysSchema,
  urlArraySchema,
} from "@/server/validators/common";
import {
  loanRequestStatusSchema,
  repaymentFrequencySchema,
} from "@/server/validators/enums";

export const createLoanRequestSchema = z
  .object({
    amountBdt: positiveBdtSchema,
    purpose: shortTextSchema,
    fundUsage: longTextSchema,
    tenureDays: tenureDaysSchema,
    repaymentFrequency: repaymentFrequencySchema,
    proposedRatePct: ratePctSchema,
    proofUrls: urlArraySchema(10).default([]),
  })
  .strict();

export const updateLoanRequestSchema =
  createLoanRequestSchema.partial().strict();

export const loanRequestActionSchema = z
  .object({
    loanRequestId: idSchema,
    note: optionalTextSchema,
  })
  .strict();

// ---------------------------------------------------------------------------
// Query filters (pagination itself is parsed by lib/pagination.parsePagination)
// ---------------------------------------------------------------------------

export const myLoanRequestFiltersSchema = z
  .object({ status: loanRequestStatusSchema.optional() })
  .strict();

const optionalAmount = z.coerce.number().int().positive().max(2_147_483_647);
const optionalTenure = z.coerce.number().int().positive().max(3650);

export const loanRequestSortSchema = z
  .enum(["newest", "amountAsc", "amountDesc"])
  .default("newest");

export const publicLoanRequestFiltersSchema = z
  .object({
    category: shortTextSchema.optional(),
    district: shortTextSchema.optional(),
    minAmountBdt: optionalAmount.optional(),
    maxAmountBdt: optionalAmount.optional(),
    maxTenureDays: optionalTenure.optional(),
    frequency: repaymentFrequencySchema.optional(),
    sort: loanRequestSortSchema,
  })
  .strict()
  .superRefine((value, ctx) => {
    if (
      value.minAmountBdt !== undefined &&
      value.maxAmountBdt !== undefined &&
      value.minAmountBdt > value.maxAmountBdt
    ) {
      ctx.addIssue({
        code: "custom",
        path: ["maxAmountBdt"],
        message: "Maximum amount must be at least the minimum",
      });
    }
  });

// ---------------------------------------------------------------------------
// Response shapes (explicit allow-lists; no Prisma rows or private data)
// ---------------------------------------------------------------------------

/** Full view for the authenticated owner. Never returned to other users. */
export const loanRequestRecordSchema = z
  .object({
    id: z.string(),
    amountBdt: z.number().int().positive(),
    purpose: z.string(),
    fundUsage: z.string(),
    tenureDays: z.number().int().positive(),
    repaymentFrequency: repaymentFrequencySchema,
    proposedRatePct: z.string(),
    proofUrls: z.array(z.string()),
    status: loanRequestStatusSchema,
    publishedAt: isoDateTimeSchema.nullable(),
    createdAt: isoDateTimeSchema,
    updatedAt: isoDateTimeSchema,
  })
  .strict();

/** Mini profile embedded in public requests — no account email/phone or ids. */
export const publicLoanRequestOwnerSchema = z
  .object({
    name: z.string(),
    image: z.string().nullable(),
    shopName: z.string(),
    slug: z.string(),
    category: z.string(),
    district: z.string(),
    city: z.string(),
    logoUrl: z.string().nullable(),
    trustScore: z.number().int().nonnegative(),
    verified: z.boolean(),
  })
  .strict();

/** Public OPEN request: no ownerId, proofUrls, status history or internal ids. */
export const publicLoanRequestSchema = z
  .object({
    id: z.string(),
    amountBdt: z.number().int().positive(),
    purpose: z.string(),
    fundUsage: z.string(),
    tenureDays: z.number().int().positive(),
    repaymentFrequency: repaymentFrequencySchema,
    proposedRatePct: z.string(),
    publishedAt: isoDateTimeSchema.nullable(),
    createdAt: isoDateTimeSchema,
    owner: publicLoanRequestOwnerSchema,
  })
  .strict();

export const publicLoanRequestListSchema = z.array(publicLoanRequestSchema);
