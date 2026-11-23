import type { PaginationParams } from "@/lib/pagination";
import { assertRole, type Actor } from "@/server/auth/policy";
import { prisma } from "@/server/db";
import { BusinessRuleError } from "@/server/errors";
import {
  businessesQuerySchema,
  investorsQuerySchema,
} from "@/server/validators/discovery";
import type { z } from "zod";
import {
  PUBLIC_USER_SELECT,
  cursorId,
  pageMeta,
  type PublicUserRow,
} from "@/server/services/social-shared";

type Db = typeof prisma;
type BusinessesQuery = z.infer<typeof businessesQuerySchema>;
type InvestorsQuery = z.infer<typeof investorsQuerySchema>;

interface ServiceDeps {
  db?: Db;
}

interface OpenRequestSummary {
  id: string;
  amountBdt: number;
  tenureDays: number;
  proposedRatePct: unknown;
}

interface DiscoveryUserRow extends PublicUserRow {
  loanRequests?: OpenRequestSummary[];
}

type SortOrder = "asc" | "desc";

/**
 * Adds the actor's OPEN loan request to the shared public projection.
 * No private profile fields, verification documents or contact details.
 */
const DISCOVERY_USER_SELECT = {
  ...PUBLIC_USER_SELECT,
  loanRequests: {
    where: { status: "OPEN" },
    take: 1,
    select: {
      id: true,
      amountBdt: true,
      tenureDays: true,
      proposedRatePct: true,
    },
  },
} as const;

function ilike(value?: string) {
  return value ? { contains: value, mode: "insensitive" as const } : undefined;
}

/** Authenticated suggestions never surface a user in either direction of a block. */
function excludeBlocked(actorId: string) {
  return {
    NOT: {
      OR: [
        { blocksBlocked: { some: { blockedId: actorId } } },
        { blocksReceived: { some: { blockerId: actorId } } },
      ],
    },
  };
}

function requestSummary(row: DiscoveryUserRow) {
  const request = row.loanRequests?.[0];
  if (!request) return null;
  return {
    id: request.id,
    amountBdt: request.amountBdt,
    tenureDays: request.tenureDays,
    proposedRatePct: String(request.proposedRatePct),
  };
}

function toBusiness(row: DiscoveryUserRow) {
  const profile = row.businessProfile;
  if (!profile || row.role !== "OWNER") {
    throw new BusinessRuleError("Discovery record is not a verified business");
  }
  return {
    id: row.id,
    name: row.name,
    image: row.image ?? null,
    role: "OWNER" as const,
    verified: true as const,
    shopName: profile.shopName,
    slug: profile.slug,
    category: profile.category,
    district: profile.district,
    city: profile.city,
    logoUrl: profile.logoUrl ?? null,
    trustScore: profile.trustScore,
    description: profile.description ?? null,
    loanRequest: requestSummary(row),
  };
}

function toInvestor(row: DiscoveryUserRow) {
  const profile = row.investorProfile;
  if (!profile || row.role !== "INVESTOR") {
    throw new BusinessRuleError("Discovery record is not a verified investor");
  }
  return {
    id: row.id,
    name: row.name,
    image: row.image ?? null,
    role: "INVESTOR" as const,
    verified: true as const,
    bio: profile.bio ?? null,
    minLendBdt: profile.minLendBdt,
    maxLendBdt: profile.maxLendBdt,
    preferredCategories: profile.preferredCategories ?? [],
    district: profile.district ?? null,
    city: profile.city ?? null,
    trustScore: profile.trustScore,
  };
}

/** Only APPROVED owners are visible; the verification records themselves stay private. */
export async function discoverBusinesses(
  query: PaginationParams & Partial<BusinessesQuery>,
  deps: ServiceDeps = {},
) {
  const filterInput = { ...query } as Record<string, unknown>;
  delete filterInput.cursor;
  delete filterInput.limit;
  const parsed = businessesQuerySchema.parse(filterInput);
  const db = deps.db ?? prisma;
  const cursor = cursorId(query.cursor);

  const nameSearch = ilike(parsed.q);
  const category = ilike(parsed.category);
  const location = ilike(parsed.location);
  const district = ilike(parsed.district);
  const city = ilike(parsed.city);

  const profileFilters: Record<string, unknown>[] = [];
  if (nameSearch) {
    profileFilters.push({
      OR: [
        { shopName: nameSearch },
        { description: nameSearch },
        { category: nameSearch },
      ],
    });
  }
  if (category) profileFilters.push({ category });
  if (district) profileFilters.push({ district });
  if (city) profileFilters.push({ city });
  if (location) profileFilters.push({ OR: [{ district: location }, { city: location }] });
  if (parsed.minTrustScore !== undefined) {
    profileFilters.push({ trustScore: { gte: parsed.minTrustScore } });
  }

  const loanFilters: Record<string, unknown>[] = [{ status: "OPEN" }];
  if (parsed.minAmountBdt !== undefined) {
    loanFilters.push({ amountBdt: { gte: parsed.minAmountBdt } });
  }
  if (parsed.maxAmountBdt !== undefined) {
    loanFilters.push({ amountBdt: { lte: parsed.maxAmountBdt } });
  }
  if (parsed.maxTenureDays !== undefined) {
    loanFilters.push({ tenureDays: { lte: parsed.maxTenureDays } });
  }

  const usesLoanFilter =
    parsed.minAmountBdt !== undefined ||
    parsed.maxAmountBdt !== undefined ||
    parsed.maxTenureDays !== undefined;

  const where: Record<string, unknown> = {
    role: "OWNER",
    status: "ACTIVE",
    businessProfile: {
      isNot: null,
      ...(profileFilters.length > 0 ? { AND: profileFilters } : {}),
    },
    verificationsSubmitted: { some: { type: "OWNER", status: "APPROVED" } },
    ...(usesLoanFilter ? { loanRequests: { some: { AND: loanFilters } } } : {}),
  };

  const orderBy =
    parsed.sort === "trustScore"
      ? [{ businessProfile: { trustScore: "desc" as const } }, { id: "desc" as const }]
      : [{ createdAt: "desc" as const }, { id: "desc" as const }];

  const records = await db.user.findMany({
    where,
    orderBy,
    take: query.limit + 1,
    ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
    select: DISCOVERY_USER_SELECT,
  });

  const page = pageMeta(records as unknown as DiscoveryUserRow[], query.limit);
  return { items: page.items.map(toBusiness), meta: page.meta };
}

/** Only APPROVED investors are visible. */
export async function discoverInvestors(
  query: PaginationParams & Partial<InvestorsQuery>,
  deps: ServiceDeps = {},
) {
  const filterInput = { ...query } as Record<string, unknown>;
  delete filterInput.cursor;
  delete filterInput.limit;
  const parsed = investorsQuerySchema.parse(filterInput);
  const db = deps.db ?? prisma;
  const cursor = cursorId(query.cursor);

  const bioSearch = ilike(parsed.q);
  const category = ilike(parsed.category);
  const location = ilike(parsed.location);
  const district = ilike(parsed.district);
  const city = ilike(parsed.city);

  const profileFilters: Record<string, unknown>[] = [];
  if (bioSearch) profileFilters.push({ bio: bioSearch });
  if (category) profileFilters.push({ preferredCategories: { has: parsed.category } });
  if (district) profileFilters.push({ district });
  if (city) profileFilters.push({ city });
  if (location) profileFilters.push({ OR: [{ district: location }, { city: location }] });
  if (parsed.minTrustScore !== undefined) {
    profileFilters.push({ trustScore: { gte: parsed.minTrustScore } });
  }
  if (parsed.minLendBdt !== undefined) {
    profileFilters.push({ maxLendBdt: { gte: parsed.minLendBdt } });
  }
  if (parsed.maxLendBdt !== undefined) {
    profileFilters.push({ minLendBdt: { lte: parsed.maxLendBdt } });
  }

  const where: Record<string, unknown> = {
    role: "INVESTOR",
    status: "ACTIVE",
    investorProfile: { isNot: null },
    verificationsSubmitted: { some: { type: "INVESTOR", status: "APPROVED" } },
    ...(profileFilters.length > 0
      ? { investorProfile: { isNot: null, AND: profileFilters } }
      : {}),
  };

  const profileOrder: Record<string, SortOrder> =
    parsed.sort === "trustScore"
      ? { trustScore: "desc" }
      : parsed.sort === "lendAsc"
        ? { minLendBdt: "asc" }
        : parsed.sort === "lendDesc"
          ? { maxLendBdt: "desc" }
          : {};
  const orderBy = [
    ...(Object.keys(profileOrder).length > 0 ? [{ investorProfile: profileOrder }] : []),
    { createdAt: "desc" as const },
    { id: "desc" as const },
  ];

  const records = await db.user.findMany({
    where,
    orderBy,
    take: query.limit + 1,
    ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
    select: DISCOVERY_USER_SELECT,
  });

  const page = pageMeta(records as unknown as DiscoveryUserRow[], query.limit);
  return { items: page.items.map(toInvestor), meta: page.meta };
}

async function requireProfile(actor: Actor, db: Db): Promise<DiscoveryUserRow> {
  const user = await db.user.findUnique({
    where: { id: actor.id },
    select: DISCOVERY_USER_SELECT,
  });
  if (!user) throw new BusinessRuleError("Complete your profile before using suggestions");
  return user as unknown as DiscoveryUserRow;
}

/**
 * Investors see approved owners matching their preferred categories, lending
 * range and location. Preferences are optional; an empty profile means "all".
 */
export async function suggestBusinesses(
  actor: Actor,
  query: PaginationParams,
  deps: ServiceDeps = {},
) {
  assertRole(actor, "INVESTOR");
  const db = deps.db ?? prisma;
  const cursor = cursorId(query.cursor);
  const investor = await requireProfile(actor, db);
  const profile = investor.investorProfile;

  const ownerFilters: Record<string, unknown>[] = [];
  if (profile?.preferredCategories?.length) {
    ownerFilters.push({ category: { in: profile.preferredCategories } });
  }
  if (profile?.district) ownerFilters.push({ district: profile.district });
  if (profile?.city) ownerFilters.push({ city: profile.city });

  const loanFilters: Record<string, unknown>[] = [{ status: "OPEN" }];
  if (profile) {
    loanFilters.push({ amountBdt: { lte: profile.maxLendBdt } });
    loanFilters.push({ amountBdt: { gte: profile.minLendBdt } });
  }

  const where: Record<string, unknown> = {
    role: "OWNER",
    status: "ACTIVE",
    businessProfile: {
      isNot: null,
      ...(ownerFilters.length > 0 ? { AND: ownerFilters } : {}),
    },
    verificationsSubmitted: { some: { type: "OWNER", status: "APPROVED" } },
    loanRequests: { some: { AND: loanFilters } },
    ...excludeBlocked(actor.id),
  };

  const records = await db.user.findMany({
    where,
    orderBy: [
      { businessProfile: { trustScore: "desc" } },
      { createdAt: "desc" },
      { id: "desc" },
    ],
    take: query.limit + 1,
    ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
    select: DISCOVERY_USER_SELECT,
  });

  const page = pageMeta(records as unknown as DiscoveryUserRow[], query.limit);
  return { items: page.items.map(toBusiness), meta: page.meta };
}

/** Owners see approved investors whose category, range and location fit their OPEN request. */
export async function suggestInvestors(
  actor: Actor,
  query: PaginationParams,
  deps: ServiceDeps = {},
) {
  assertRole(actor, "OWNER");
  const db = deps.db ?? prisma;
  const cursor = cursorId(query.cursor);
  const owner = await requireProfile(actor, db);
  const business = owner.businessProfile;
  const request = owner.loanRequests?.[0];

  const filters: Record<string, unknown>[] = [];
  if (business?.category) {
    filters.push({ preferredCategories: { has: business.category } });
  }
  if (business?.district) filters.push({ district: business.district });
  if (business?.city) filters.push({ city: business.city });
  if (request) {
    filters.push({ minLendBdt: { lte: request.amountBdt } });
    filters.push({ maxLendBdt: { gte: request.amountBdt } });
  }

  const where: Record<string, unknown> = {
    role: "INVESTOR",
    status: "ACTIVE",
    investorProfile: {
      isNot: null,
      ...(filters.length > 0 ? { AND: filters } : {}),
    },
    verificationsSubmitted: { some: { type: "INVESTOR", status: "APPROVED" } },
    ...excludeBlocked(actor.id),
  };

  const records = await db.user.findMany({
    where,
    orderBy: [
      { investorProfile: { trustScore: "desc" } },
      { createdAt: "desc" },
      { id: "desc" },
    ],
    take: query.limit + 1,
    ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
    select: DISCOVERY_USER_SELECT,
  });

  const page = pageMeta(records as unknown as DiscoveryUserRow[], query.limit);
  return { items: page.items.map(toInvestor), meta: page.meta };
}
