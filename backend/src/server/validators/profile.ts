import "@/server/openapi/setup";
import { z } from "zod";
import {
  bdtAmountSchema,
  longTextSchema,
  optionalTextSchema,
  plainDateSchema,
  ratePctSchema,
  shortTextSchema,
  urlSchema,
} from "@/server/validators/common";

const optionalUrl = urlSchema.nullable().optional();
const slugSchema = z
  .string()
  .trim()
  .toLowerCase()
  .min(3)
  .max(80)
  .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, "Use lowercase letters, numbers and hyphens");

const businessProfileBaseSchema = z
  .object({
    shopName: shortTextSchema,
    slug: slugSchema,
    category: shortTextSchema,
    description: longTextSchema.optional(),
    district: shortTextSchema,
    city: shortTextSchema,
    facebookUrl: optionalUrl,
    instagramUrl: optionalUrl,
    whatsappUrl: optionalUrl,
    websiteUrl: optionalUrl,
    runningSince: plainDateSchema.optional(),
    monthlyOrdersRange: shortTextSchema.optional(),
    monthlySalesMinBdt: bdtAmountSchema.optional(),
    monthlySalesMaxBdt: bdtAmountSchema.optional(),
    growthStory: longTextSchema.optional(),
    logoUrl: optionalUrl,
    coverUrl: optionalUrl,
  })
  .strict();

export const createBusinessProfileSchema =
  businessProfileBaseSchema.superRefine((value, ctx) => {
    const { monthlySalesMinBdt: min, monthlySalesMaxBdt: max } = value;
    if (min !== undefined && max !== undefined && min > max) {
      ctx.addIssue({
        code: "custom",
        path: ["monthlySalesMaxBdt"],
        message: "Maximum monthly sales must be at least the minimum",
      });
    }
  });

export const updateBusinessProfileSchema =
  businessProfileBaseSchema.partial().strict();

export const createProductImageSchema = z
  .object({
    url: urlSchema,
    caption: optionalTextSchema,
    position: z.number().int().nonnegative(),
  })
  .strict();

const investorProfileBaseSchema = z
  .object({
    bio: longTextSchema.optional(),
    minLendBdt: bdtAmountSchema,
    maxLendBdt: bdtAmountSchema,
    preferredCategories: z.array(shortTextSchema).max(20).default([]),
    preferredTenureDays: z.number().int().positive().max(3650).optional(),
    preferredRatePctMin: ratePctSchema.optional(),
    preferredRatePctMax: ratePctSchema.optional(),
    district: shortTextSchema.optional(),
    city: shortTextSchema.optional(),
  })
  .strict();

export const createInvestorProfileSchema =
  investorProfileBaseSchema.superRefine((value, ctx) => {
    if (value.minLendBdt > value.maxLendBdt) {
      ctx.addIssue({
        code: "custom",
        path: ["maxLendBdt"],
        message: "Maximum lending amount must be at least the minimum",
      });
    }
    const min = value.preferredRatePctMin;
    const max = value.preferredRatePctMax;
    if (min !== undefined && max !== undefined && Number(min) > Number(max)) {
      ctx.addIssue({
        code: "custom",
        path: ["preferredRatePctMax"],
        message: "Maximum preferred rate must be at least the minimum",
      });
    }
  });

export const updateInvestorProfileSchema =
  investorProfileBaseSchema.partial().strict();
