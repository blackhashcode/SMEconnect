import { decodeCursor, encodeCursor, type PaginationParams } from "@/lib/pagination";
import type { Actor } from "@/server/auth/policy";
import { prisma } from "@/server/db";
import { BusinessRuleError, NotFoundError, ValidationError } from "@/server/errors";

type Db = typeof prisma;

/** Public projection shared by feed, connections, follows and discovery. */
export const PUBLIC_USER_SELECT = {
  id: true,
  name: true,
  image: true,
  role: true,
  status: true,
  businessProfile: {
    select: {
      shopName: true,
      slug: true,
      category: true,
      district: true,
      city: true,
      logoUrl: true,
      trustScore: true,
      description: true,
    },
  },
  investorProfile: {
    select: {
      bio: true,
      minLendBdt: true,
      maxLendBdt: true,
      preferredCategories: true,
      district: true,
      city: true,
      trustScore: true,
    },
  },
} as const;

export interface PublicUserRow {
  id: string;
  name: string;
  image: string | null;
  role: "OWNER" | "INVESTOR" | "ADMIN";
  status: "ACTIVE" | "SUSPENDED";
  businessProfile?: {
    shopName: string;
    slug: string;
    category: string;
    district: string;
    city: string;
    logoUrl: string | null;
    trustScore: number;
    description: string | null;
  } | null;
  investorProfile?: {
    bio: string | null;
    minLendBdt: number;
    maxLendBdt: number;
    preferredCategories: string[];
    district: string | null;
    city: string | null;
    trustScore: number;
  } | null;
}

/** A target must be an active, non-admin account that is not the actor. */
export function requirePublicTarget(
  user: PublicUserRow | null | undefined,
  actor: Actor,
): PublicUserRow {
  if (!user || user.status !== "ACTIVE" || user.role === "ADMIN") {
    throw new NotFoundError("User not found");
  }
  if (user.id === actor.id) {
    throw new BusinessRuleError("You cannot do this with your own account");
  }
  return user;
}

export async function verifiedUserIds(
  ids: string[],
  db: Pick<Db, "userVerification">,
): Promise<Set<string>> {
  if (ids.length === 0) return new Set();
  const records = await db.userVerification.findMany({
    where: { userId: { in: ids }, status: "APPROVED" },
    select: { userId: true },
  });
  return new Set(records.map((record) => record.userId));
}

/** Explicit allow-list: no email, phone, internal ids or verification documents. */
export function toPostAuthor(user: PublicUserRow, verified: boolean) {
  if (user.role === "ADMIN") throw new NotFoundError("User not found");
  return {
    name: user.name,
    image: user.image ?? null,
    role: user.role,
    verified,
    shopName: user.businessProfile?.shopName ?? null,
    slug: user.businessProfile?.slug ?? null,
    category: user.businessProfile?.category ?? null,
  };
}

export function cursorId(cursor?: string): string | undefined {
  if (!cursor) return undefined;
  const decoded = decodeCursor<{ id?: string }>(cursor);
  if (!decoded.id || typeof decoded.id !== "string") {
    throw new ValidationError("Invalid cursor");
  }
  return decoded.id;
}

export function pageMeta<T extends { id: string }>(
  records: T[],
  limit: number,
): { items: T[]; meta: { limit: number; nextCursor: string | null; hasMore: boolean } } {
  const hasMore = records.length > limit;
  const items = records.slice(0, limit);
  const last = items.at(-1);
  return {
    items,
    meta: {
      limit,
      nextCursor: hasMore && last ? encodeCursor({ id: last.id }) : null,
      hasMore,
    },
  };
}

export function readCursor(query: PaginationParams): string | undefined {
  return cursorId(query.cursor);
}

export function isUniqueViolation(error: unknown): boolean {
  return (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    (error as { code?: string }).code === "P2002"
  );
}
