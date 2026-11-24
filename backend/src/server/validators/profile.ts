import "@/server/openapi/setup";
import { z } from "zod";
import {
  bdtAmountSchema,
  isoDateTimeSchema,
  longTextSchema,
  optionalTextSchema,
  plainDateSchema,
  ratePctSchema,
  shortTextSchema,
  urlSchema,
} from "@/server/validators/common";
import {
  roleSchema,
  userStatusSchema,
  verificationStatusSchema,
  verificationTypeSchema,
} from "@/server/validators/enums";
import { publicFileUrlSchema } from "@/server/validators/storage";

const optionalUrl = urlSchema.nullable().optional();

/** External images and internal *public* upload URLs only; private files are rejected. */
export const profileImageUrlSchema = z.union([
  urlSchema,
  publicFileUrlSchema,
]);

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
    logoUrl: profileImageUrlSchema.nullable().optional(),
    coverUrl: profileImageUrlSchema.nullable().optional(),
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
    url: profileImageUrlSchema,
    caption: optionalTextSchema,
    position: z.number().int().nonnegative().optional(),
  })
  .strict();

export const updateProductImageSchema = z
  .object({
    url: profileImageUrlSchema.optional(),
    caption: optionalTextSchema.nullable(),
    position: z.number().int().nonnegative().optional(),
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

/**
 * `PATCH /me` accepts account fields plus an optional role-specific profile.
 * The profile schema is chosen by the server from the session role; no role,
 * user id, status or verification field can be supplied by the client.
 */
export const updateMeSchema = z
  .object({
    name: shortTextSchema.optional(),
    image: profileImageUrlSchema.nullable().optional(),
    profile: z
      .union([updateBusinessProfileSchema, updateInvestorProfileSchema])
      .optional(),
  })
  .strict();

// ---------------------------------------------------------------------------
// Response shapes (explicit allow-lists; no Prisma rows or internal ids)
// ---------------------------------------------------------------------------

export const meUserSchema = z
  .object({
    id: z.string(),
    name: z.string(),
    email: z.string(),
    emailVerified: z.boolean(),
    role: roleSchema,
    status: userStatusSchema,
    phone: z.string().nullable(),
    phoneVerified: z.boolean(),
    image: profileImageUrlSchema.nullable(),
  })
  .strict();

export const productImageRecordSchema = z
  .object({
    id: z.string(),
    url: profileImageUrlSchema,
    caption: z.string().nullable(),
    position: z.number().int().nonnegative(),
  })
  .strict();

const businessProfileFields = {
  shopName: z.string(),
  slug: z.string(),
  category: z.string(),
  description: z.string().nullable(),
  district: z.string(),
  city: z.string(),
  facebookUrl: z.string().nullable(),
  instagramUrl: z.string().nullable(),
  whatsappUrl: z.string().nullable(),
  websiteUrl: z.string().nullable(),
  runningSince: isoDateTimeSchema.nullable(),
  monthlyOrdersRange: z.string().nullable(),
  monthlySalesMinBdt: z.number().int().nullable(),
  monthlySalesMaxBdt: z.number().int().nullable(),
  growthStory: z.string().nullable(),
  logoUrl: profileImageUrlSchema.nullable(),
  coverUrl: profileImageUrlSchema.nullable(),
  trustScore: z.number().int().nonnegative(),
};

export const businessProfileRecordSchema = z
  .object({
    ...businessProfileFields,
    createdAt: isoDateTimeSchema,
    updatedAt: isoDateTimeSchema,
    productImages: z.array(productImageRecordSchema),
  })
  .strict();

export const investorProfileRecordSchema = z
  .object({
    bio: z.string().nullable(),
    minLendBdt: z.number().int().nonnegative(),
    maxLendBdt: z.number().int().nonnegative(),
    preferredCategories: z.array(z.string()),
    preferredTenureDays: z.number().int().nullable(),
    preferredRatePctMin: z.string().nullable(),
    preferredRatePctMax: z.string().nullable(),
    district: z.string().nullable(),
    city: z.string().nullable(),
    trustScore: z.number().int().nonnegative(),
    createdAt: isoDateTimeSchema,
    updatedAt: isoDateTimeSchema,
  })
  .strict();

export const meVerificationSchema = z
  .object({
    type: verificationTypeSchema,
    status: verificationStatusSchema,
  })
  .strict();

export const meResponseSchema = z
  .object({
    user: meUserSchema,
    profile: z
      .union([businessProfileRecordSchema, investorProfileRecordSchema])
      .nullable(),
    verification: meVerificationSchema.nullable(),
    unread: z
      .object({
        notifications: z.number().int().nonnegative(),
        messages: z.number().int().nonnegative(),
      })
      .strict(),
  })
  .strict();

// Public profiles never include account email/phone, internal ids, document
// URLs, verification records or review notes.

export const publicProductImageSchema = productImageRecordSchema.omit({ id: true });

export const publicBusinessProfileSchema = z
  .object({
    ...businessProfileFields,
    productImages: z.array(publicProductImageSchema),
  })
  .strict();

export const publicInvestorProfileSchema = z
  .object({
    bio: z.string().nullable(),
    minLendBdt: z.number().int().nonnegative(),
    maxLendBdt: z.number().int().nonnegative(),
    preferredCategories: z.array(z.string()),
    preferredTenureDays: z.number().int().nullable(),
    preferredRatePctMin: z.string().nullable(),
    preferredRatePctMax: z.string().nullable(),
    district: z.string().nullable(),
    city: z.string().nullable(),
    trustScore: z.number().int().nonnegative(),
  })
  .strict();

export const publicProfileSchema = z
  .object({
    name: z.string(),
    image: profileImageUrlSchema.nullable(),
    role: z.enum(["OWNER", "INVESTOR"]),
    /** True only for an APPROVED verification; no documents or review notes. */
    verified: z.boolean(),
    /** Null until the member completes onboarding; the name, photo and role still show. */
    profile: z.union([publicBusinessProfileSchema, publicInvestorProfileSchema]).nullable(),
  })
  .strict();
