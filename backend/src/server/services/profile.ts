import {
  assertOwnership,
  assertRole,
  type Actor,
} from "@/server/auth/policy";
import { prisma } from "@/server/db";
import {
  ConflictError,
  ForbiddenError,
  NotFoundError,
  ValidationError,
} from "@/server/errors";
import {
  createBusinessProfileSchema,
  createInvestorProfileSchema,
  createProductImageSchema,
  updateBusinessProfileSchema,
  updateInvestorProfileSchema,
  updateMeSchema,
  updateProductImageSchema,
} from "@/server/validators/profile";
import type { z } from "zod";

type UpdateMeInput = z.infer<typeof updateMeSchema>;
type CreateProductImageInput = z.infer<typeof createProductImageSchema>;
type UpdateProductImageInput = z.infer<typeof updateProductImageSchema>;

interface ProfileDeps {
  db?: typeof prisma;
}

interface BusinessRow {
  id: string;
  ownerId: string;
  shopName: string;
  slug: string;
  category: string;
  description: string | null;
  district: string;
  city: string;
  facebookUrl: string | null;
  instagramUrl: string | null;
  whatsappUrl: string | null;
  websiteUrl: string | null;
  runningSince: Date | null;
  monthlyOrdersRange: string | null;
  monthlySalesMinBdt: number | null;
  monthlySalesMaxBdt: number | null;
  growthStory: string | null;
  logoUrl: string | null;
  coverUrl: string | null;
  trustScore: number;
  createdAt: Date;
  updatedAt: Date;
  productImages?: ProductImageRow[];
}

interface InvestorRow {
  id: string;
  userId: string;
  bio: string | null;
  minLendBdt: number;
  maxLendBdt: number;
  preferredCategories: string[];
  preferredTenureDays: number | null;
  preferredRatePctMin: unknown;
  preferredRatePctMax: unknown;
  district: string | null;
  city: string | null;
  coverUrl?: string | null;
  trustScore: number;
  createdAt: Date;
  updatedAt: Date;
}

interface ProductImageRow {
  id: string;
  businessProfileId: string;
  url: string;
  caption: string | null;
  position: number;
}

interface VerificationRow {
  type: "OWNER" | "INVESTOR";
  status: "PENDING" | "APPROVED" | "REJECTED";
}

const BUSINESS_FIELDS = [
  "shopName",
  "slug",
  "category",
  "description",
  "district",
  "city",
  "facebookUrl",
  "instagramUrl",
  "whatsappUrl",
  "websiteUrl",
  "monthlyOrdersRange",
  "monthlySalesMinBdt",
  "monthlySalesMaxBdt",
  "growthStory",
  "logoUrl",
  "coverUrl",
] as const;

const INVESTOR_FIELDS = [
  "bio",
  "minLendBdt",
  "maxLendBdt",
  "preferredCategories",
  "preferredTenureDays",
  "preferredRatePctMin",
  "preferredRatePctMax",
  "district",
  "city",
  "coverUrl",
] as const;

function toIso(value: Date | null | undefined): string | null {
  return value ? new Date(value).toISOString() : null;
}

function toDateOnly(value: string | undefined): Date | null {
  if (value === undefined) return null;
  const date = new Date(`${value}T00:00:00.000Z`);
  if (Number.isNaN(date.getTime())) {
    throw new ValidationError("runningSince must be a real calendar date");
  }
  return date;
}

function decimalToString(value: unknown): string | null {
  if (value === null || value === undefined) return null;
  return String(value);
}

function isUniqueViolation(error: unknown): boolean {
  return (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    (error as { code?: string }).code === "P2002"
  );
}

function mapWriteConflict(error: unknown, field: string, message: string): never {
  if (isUniqueViolation(error)) {
    const meta = (error as { meta?: { target?: unknown } }).meta;
    const target = JSON.stringify(meta?.target ?? "");
    throw new ConflictError(
      target.includes(field) ? message : "A record with these values already exists",
    );
  }
  throw error;
}

function selectFields<T extends object>(
  source: Record<string, unknown>,
  fields: readonly (keyof T & string)[],
): Record<string, unknown> {
  const result: Record<string, unknown> = {};
  for (const field of fields) {
    if (source[field] !== undefined) result[field] = source[field];
  }
  return result;
}

function mergedNumber(
  existing: number | null,
  data: Record<string, unknown>,
  field: string,
): number | null {
  if (!(field in data)) return existing;
  const value = data[field];
  return value === null ? null : Number(value);
}

function assertRange(
  min: number | null,
  max: number | null,
  maxField: string,
  label: string,
): void {
  if (min !== null && max !== null && min > max) {
    throw new ValidationError(`Maximum ${label} must be at least the minimum`, {
      field: maxField,
    });
  }
}

function businessWriteData(input: Record<string, unknown>): Record<string, unknown> {
  const data = selectFields(input, BUSINESS_FIELDS);
  if ("runningSince" in input) {
    data.runningSince = toDateOnly(input.runningSince as string | undefined);
  }
  return data;
}

function investorWriteData(input: Record<string, unknown>): Record<string, unknown> {
  return selectFields(input, INVESTOR_FIELDS);
}

function toProductImage(row: ProductImageRow) {
  return {
    id: row.id,
    url: row.url,
    caption: row.caption ?? null,
    position: row.position,
  };
}

function toBusinessProfile(row: BusinessRow) {
  return {
    shopName: row.shopName,
    slug: row.slug,
    category: row.category,
    description: row.description ?? null,
    district: row.district,
    city: row.city,
    facebookUrl: row.facebookUrl ?? null,
    instagramUrl: row.instagramUrl ?? null,
    whatsappUrl: row.whatsappUrl ?? null,
    websiteUrl: row.websiteUrl ?? null,
    runningSince: toIso(row.runningSince),
    monthlyOrdersRange: row.monthlyOrdersRange ?? null,
    monthlySalesMinBdt: row.monthlySalesMinBdt ?? null,
    monthlySalesMaxBdt: row.monthlySalesMaxBdt ?? null,
    growthStory: row.growthStory ?? null,
    logoUrl: row.logoUrl ?? null,
    coverUrl: row.coverUrl ?? null,
    trustScore: row.trustScore,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
    productImages: (row.productImages ?? []).map((image) => toProductImage(image)),
  };
}

function toInvestorProfile(row: InvestorRow) {
  return {
    bio: row.bio ?? null,
    minLendBdt: row.minLendBdt,
    maxLendBdt: row.maxLendBdt,
    preferredCategories: row.preferredCategories ?? [],
    preferredTenureDays: row.preferredTenureDays ?? null,
    preferredRatePctMin: decimalToString(row.preferredRatePctMin),
    preferredRatePctMax: decimalToString(row.preferredRatePctMax),
    district: row.district ?? null,
    city: row.city ?? null,
    coverUrl: row.coverUrl ?? null,
    trustScore: row.trustScore,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

/** Account, role-specific profile, own verification state and unread counts. */
export async function getMe(actor: Actor, deps: ProfileDeps = {}) {
  const db = deps.db ?? prisma;
  const user = await db.user.findUnique({ where: { id: actor.id } });
  if (!user) throw new NotFoundError("Account not found");

  let profile: ReturnType<typeof toBusinessProfile> | ReturnType<typeof toInvestorProfile> | null = null;
  let verification: VerificationRow | null = null;

  if (user.role === "OWNER") {
    const row = await db.businessProfile.findUnique({
      where: { ownerId: user.id },
      include: { productImages: { orderBy: { position: "asc" } } },
    });
    if (row) profile = toBusinessProfile(row as BusinessRow);
  } else if (user.role === "INVESTOR") {
    const row = await db.investorProfile.findUnique({ where: { userId: user.id } });
    if (row) profile = toInvestorProfile(row as InvestorRow);
  }

  if (user.role === "OWNER" || user.role === "INVESTOR") {
    verification = await db.userVerification.findFirst({
      where: { userId: user.id, type: user.role },
      select: { type: true, status: true },
    });
  }

  const [unreadNotifications, unreadMessages] = await Promise.all([
    db.notification.count({ where: { userId: user.id, readAt: null } }),
    db.message.count({
      where: {
        readAt: null,
        deletedAt: null,
        senderId: { not: user.id },
        conversation: {
          OR: [{ participantOneId: user.id }, { participantTwoId: user.id }],
        },
      },
    }),
  ]);

  return {
    user: {
      id: user.id,
      name: user.name,
      email: user.email,
      emailVerified: user.emailVerified,
      role: user.role,
      status: user.status,
      phone: user.phone ?? null,
      phoneVerified: user.phoneVerified,
      image: user.image ?? null,
    },
    profile,
    verification: verification
      ? { type: verification.type, status: verification.status }
      : null,
    unread: { notifications: unreadNotifications, messages: unreadMessages },
  };
}

/**
 * Upserts the role-specific profile and optional account fields in one
 * transaction. All writes are addressed by the authenticated user id; the
 * payload can never supply ownership, role, status or verification data.
 */
export async function updateMe(
  actor: Actor,
  input: UpdateMeInput,
  deps: ProfileDeps = {},
) {
  const db = deps.db ?? prisma;
  const user = await db.user.findUnique({ where: { id: actor.id } });
  if (!user) throw new NotFoundError("Account not found");
  assertOwnership(user.id, actor);

  if (input.profile !== undefined && user.role === "ADMIN") {
    throw new ForbiddenError("Administrators do not have owner or investor profiles");
  }

  const accountData: Record<string, unknown> = {};
  if (input.name !== undefined) accountData.name = input.name;
  if (input.image !== undefined) accountData.image = input.image;

  const profileInput = input.profile as Record<string, unknown> | undefined;
  let writeProfile: (tx: typeof db) => Promise<void> = async () => {};

  if (profileInput !== undefined) {
    if (user.role === "OWNER") {
      // Re-parse with the schema selected by the server, never by the client.
      const existing = await db.businessProfile.findUnique({ where: { ownerId: user.id } });
      const data = existing
        ? businessWriteData(updateBusinessProfileSchema.parse(profileInput))
        : businessWriteData(createBusinessProfileSchema.parse(profileInput) as Record<string, unknown>);

      if (existing) {
        const row = existing as BusinessRow;
        assertRange(
          mergedNumber(row.monthlySalesMinBdt, data, "monthlySalesMinBdt"),
          mergedNumber(row.monthlySalesMaxBdt, data, "monthlySalesMaxBdt"),
          "monthlySalesMaxBdt",
          "monthly sales",
        );
      }

      // Update or create explicitly: an upsert's create half must list every
      // required field even when the row exists, so partial edits failed.
      writeProfile = async (tx) => {
        if (existing) await tx.businessProfile.update({ where: { ownerId: user.id }, data });
        else await tx.businessProfile.create({ data: { ownerId: user.id, trustScore: 0, ...data } as never });
      };
    } else if (user.role === "INVESTOR") {
      const existing = await db.investorProfile.findUnique({ where: { userId: user.id } });
      const data = existing
        ? investorWriteData(updateInvestorProfileSchema.parse(profileInput))
        : investorWriteData(createInvestorProfileSchema.parse(profileInput) as Record<string, unknown>);

      if (existing) {
        const row = existing as InvestorRow;
        assertRange(
          mergedNumber(row.minLendBdt, data, "minLendBdt"),
          mergedNumber(row.maxLendBdt, data, "maxLendBdt"),
          "maxLendBdt",
          "lending amount",
        );
        assertRange(
          mergedRate(row.preferredRatePctMin, data, "preferredRatePctMin"),
          mergedRate(row.preferredRatePctMax, data, "preferredRatePctMax"),
          "preferredRatePctMax",
          "preferred rate",
        );
      }

      writeProfile = async (tx) => {
        if (existing) await tx.investorProfile.update({ where: { userId: user.id }, data });
        else await tx.investorProfile.create({ data: { userId: user.id, trustScore: 0, ...data } as never });
      };
    } else {
      throw new ForbiddenError("Administrators do not have owner or investor profiles");
    }
  }

  try {
    await db.$transaction(async (tx) => {
      if (Object.keys(accountData).length > 0) {
        await tx.user.update({ where: { id: user.id }, data: accountData });
      }
      await writeProfile(tx as typeof db);
    });
  } catch (error) {
    mapWriteConflict(error, "slug", "Slug is already in use");
  }

  return getMe(actor, deps);
}

function mergedRate(
  existing: unknown,
  data: Record<string, unknown>,
  field: string,
): number | null {
  const value = field in data ? data[field] : existing;
  if (value === null || value === undefined) return null;
  const text = String(value);
  return text.length > 0 ? Number(text) : null;
}

/**
 * Public profiles use an explicit allow-list: no account email/phone, internal
 * ids, private document URLs, verification records or review notes.
 */
export async function getPublicProfile(userId: string, deps: ProfileDeps = {}) {
  const db = deps.db ?? prisma;
  const user = await db.user.findUnique({ where: { id: userId } });

  if (!user || user.status !== "ACTIVE" || user.role === "ADMIN") {
    throw new NotFoundError("Profile not found");
  }

  const verification = await db.userVerification.findFirst({
    where: { userId, type: user.role },
    select: { status: true },
  });
  const verified = verification?.status === "APPROVED";

  if (user.role === "OWNER") {
    const row = await db.businessProfile.findUnique({
      where: { ownerId: userId },
      include: { productImages: { orderBy: { position: "asc" } } },
    });
    // Not set up yet: still show who they are, so links to them never 404.
    if (!row) return { name: user.name, image: user.image ?? null, role: "OWNER" as const, verified, profile: null };
    const profile = row as BusinessRow;

    return {
      name: user.name,
      image: user.image ?? null,
      role: "OWNER" as const,
      verified,
      profile: {
        shopName: profile.shopName,
        slug: profile.slug,
        category: profile.category,
        description: profile.description ?? null,
        district: profile.district,
        city: profile.city,
        facebookUrl: profile.facebookUrl ?? null,
        instagramUrl: profile.instagramUrl ?? null,
        whatsappUrl: profile.whatsappUrl ?? null,
        websiteUrl: profile.websiteUrl ?? null,
        runningSince: toIso(profile.runningSince),
        monthlyOrdersRange: profile.monthlyOrdersRange ?? null,
        monthlySalesMinBdt: profile.monthlySalesMinBdt ?? null,
        monthlySalesMaxBdt: profile.monthlySalesMaxBdt ?? null,
        growthStory: profile.growthStory ?? null,
        logoUrl: profile.logoUrl ?? null,
        coverUrl: profile.coverUrl ?? null,
        trustScore: profile.trustScore,
        productImages: (profile.productImages ?? []).map((image) => ({
          url: image.url,
          caption: image.caption ?? null,
          position: image.position,
        })),
      },
    };
  }

  const row = await db.investorProfile.findUnique({ where: { userId } });
  if (!row) return { name: user.name, image: user.image ?? null, role: "INVESTOR" as const, verified, profile: null };
  const profile = row as InvestorRow;

  return {
    name: user.name,
    image: user.image ?? null,
    role: "INVESTOR" as const,
    verified,
    profile: {
      bio: profile.bio ?? null,
      minLendBdt: profile.minLendBdt,
      maxLendBdt: profile.maxLendBdt,
      preferredCategories: profile.preferredCategories ?? [],
      preferredTenureDays: profile.preferredTenureDays ?? null,
      preferredRatePctMin: decimalToString(profile.preferredRatePctMin),
      preferredRatePctMax: decimalToString(profile.preferredRatePctMax),
      district: profile.district ?? null,
      city: profile.city ?? null,
      coverUrl: profile.coverUrl ?? null,
      trustScore: profile.trustScore,
    },
  };
}

export async function addProductImage(
  actor: Actor,
  input: CreateProductImageInput,
  deps: ProfileDeps = {},
) {
  assertRole(actor, "OWNER");
  // Re-parse here: product images are shown on public profiles, so the service
  // must reject private verification files even if a future caller forgot to
  // validate (e.g. a Server Action calling this service directly).
  const parsed = createProductImageSchema.parse(input);
  const db = deps.db ?? prisma;

  const profile = await db.businessProfile.findUnique({
    where: { ownerId: actor.id },
    select: { id: true },
  });
  if (!profile) throw new ConflictError("Create a business profile first");

  let position = parsed.position;
  if (position === undefined) {
    const last = await db.productImage.findFirst({
      where: { businessProfileId: profile.id },
      orderBy: { position: "desc" },
      select: { position: true },
    });
    position = last ? last.position + 1 : 0;
  }

  try {
    const row = await db.productImage.create({
      data: {
        businessProfileId: profile.id,
        url: parsed.url,
        caption: parsed.caption ?? null,
        position,
      },
    });
    return toProductImage(row as ProductImageRow);
  } catch (error) {
    mapWriteConflict(error, "position", "That position is already used");
  }
}

export async function updateProductImage(
  actor: Actor,
  imageId: string,
  input: UpdateProductImageInput,
  deps: ProfileDeps = {},
) {
  assertRole(actor, "OWNER");
  const parsed = updateProductImageSchema.parse(input);
  const db = deps.db ?? prisma;

  const existing = await db.productImage.findUnique({
    where: { id: imageId },
    include: { businessProfile: { select: { ownerId: true } } },
  });
  if (!existing) throw new NotFoundError("Product image not found");
  assertOwnership(existing.businessProfile.ownerId, actor);

  const data: Record<string, unknown> = {};
  if (parsed.url !== undefined) data.url = parsed.url;
  if (parsed.caption !== undefined) data.caption = parsed.caption;
  if (parsed.position !== undefined) data.position = parsed.position;

  try {
    const row = await db.productImage.update({ where: { id: imageId }, data });
    return toProductImage(row as ProductImageRow);
  } catch (error) {
    mapWriteConflict(error, "position", "That position is already used");
  }
}

export async function deleteProductImage(
  actor: Actor,
  imageId: string,
  deps: ProfileDeps = {},
) {
  assertRole(actor, "OWNER");
  const db = deps.db ?? prisma;

  const existing = await db.productImage.findUnique({
    where: { id: imageId },
    include: { businessProfile: { select: { ownerId: true } } },
  });
  if (!existing) throw new NotFoundError("Product image not found");
  assertOwnership(existing.businessProfile.ownerId, actor);

  await db.productImage.delete({ where: { id: imageId } });
  return { id: imageId, deleted: true };
}
