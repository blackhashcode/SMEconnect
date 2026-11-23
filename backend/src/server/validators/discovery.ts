import "@/server/openapi/setup";
import { z } from "zod";
import {
  MAX_BDT,
  bdtAmountSchema,
  shortTextSchema,
} from "@/server/validators/common";
import { profileImageUrlSchema } from "@/server/validators/profile";
import { postLoanRequestSummarySchema } from "@/server/validators/social";

const optionalPositiveAmount = z.coerce.number().int().positive().max(MAX_BDT);
const optionalTrustScore = z.coerce.number().int().min(0).max(100);
const optionalTenureDays = z.coerce.number().int().positive().max(3650);

/**
 * `q` searches shop name, description and category. `location` matches district
 * OR city. Amount and tenure filters apply to the owner's OPEN loan request.
 * Only APPROVED owners are ever returned; verification records stay private.
 */
export const businessesQuerySchema = z
  .object({
    q: z.string().trim().max(200).optional(),
    category: shortTextSchema.optional(),
    location: shortTextSchema.optional(),
    district: shortTextSchema.optional(),
    city: shortTextSchema.optional(),
    minAmountBdt: optionalPositiveAmount.optional(),
    maxAmountBdt: optionalPositiveAmount.optional(),
    maxTenureDays: optionalTenureDays.optional(),
    minTrustScore: optionalTrustScore.optional(),
    sort: z.enum(["newest", "trustScore"]).default("newest"),
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

/**
 * `category` matches the investor's preferredCategories. Amounts use the
 * investor's lending range. Only APPROVED investors are ever returned.
 */
export const investorsQuerySchema = z
  .object({
    q: z.string().trim().max(200).optional(),
    category: shortTextSchema.optional(),
    location: shortTextSchema.optional(),
    district: shortTextSchema.optional(),
    city: shortTextSchema.optional(),
    minLendBdt: optionalPositiveAmount.optional(),
    maxLendBdt: optionalPositiveAmount.optional(),
    minTrustScore: optionalTrustScore.optional(),
    sort: z
      .enum(["newest", "trustScore", "lendAsc", "lendDesc"])
      .default("newest"),
  })
  .strict()
  .superRefine((value, ctx) => {
    if (
      value.minLendBdt !== undefined &&
      value.maxLendBdt !== undefined &&
      value.minLendBdt > value.maxLendBdt
    ) {
      ctx.addIssue({
        code: "custom",
        path: ["maxLendBdt"],
        message: "Maximum amount must be at least the minimum",
      });
    }
  });

/** Suggestions accept only pagination; matching is derived from the actor's profile. */
export const suggestionsQuerySchema = z.object({}).strict();

export const discoveryBusinessSchema = z
  .object({
    id: z.string(),
    name: z.string(),
    image: profileImageUrlSchema.nullable(),
    role: z.literal("OWNER"),
    verified: z.literal(true),
    shopName: z.string(),
    slug: z.string(),
    category: z.string(),
    district: z.string(),
    city: z.string(),
    logoUrl: profileImageUrlSchema.nullable(),
    trustScore: z.number().int().nonnegative(),
    description: z.string().nullable(),
    loanRequest: postLoanRequestSummarySchema.nullable(),
  })
  .strict();

export const discoveryInvestorSchema = z
  .object({
    id: z.string(),
    name: z.string(),
    image: profileImageUrlSchema.nullable(),
    role: z.literal("INVESTOR"),
    verified: z.literal(true),
    bio: z.string().nullable(),
    minLendBdt: bdtAmountSchema,
    maxLendBdt: bdtAmountSchema,
    preferredCategories: z.array(z.string()),
    district: z.string().nullable(),
    city: z.string().nullable(),
    trustScore: z.number().int().nonnegative(),
  })
  .strict();

export const discoveryBusinessListSchema = z.array(discoveryBusinessSchema);
export const discoveryInvestorListSchema = z.array(discoveryInvestorSchema);
