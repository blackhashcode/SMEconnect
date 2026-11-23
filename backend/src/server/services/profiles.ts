import { decodeCursor, encodeCursor, type PaginationParams } from "@/lib/pagination";
import { prisma } from "@/server/db";
import { NotFoundError } from "@/server/errors";
import type { Actor } from "@/server/services/actor";

export async function getMeProfile(actor: Actor) {
  const [user, unreadNotifications, latestVerification] = await Promise.all([
    prisma.user.findUnique({
      where: { id: actor.id },
      select: {
        id: true,
        name: true,
        email: true,
        phone: true,
        role: true,
        status: true,
        headline: true,
        location: true,
        about: true,
        image: true,
        trustScore: true,
        createdAt: true,
        businessProfile: true,
        investorProfile: true,
      },
    }),
    prisma.notification.count({ where: { userId: actor.id, readAt: null } }),
    prisma.kycVerification.findFirst({
      where: { userId: actor.id },
      orderBy: { createdAt: "desc" },
      select: { id: true, status: true, reviewNote: true, reviewedAt: true },
    }),
  ]);

  if (!user) throw new NotFoundError("User not found");

  return {
    user,
    verification: latestVerification,
    unreadNotifications,
  };
}

export async function listBusinesses(
  filters: { q?: string; category?: string; location?: string; verified?: boolean },
  page: PaginationParams,
) {
  const cursorId = page.cursor ? String(decodeCursor(page.cursor).id ?? "") : undefined;

  const rows = await prisma.businessProfile.findMany({
    where: {
      ...(filters.category ? { category: { equals: filters.category, mode: "insensitive" } } : {}),
      ...(filters.location ? { location: { contains: filters.location, mode: "insensitive" } } : {}),
      ...(filters.verified !== undefined ? { verified: filters.verified } : {}),
      ...(filters.q
        ? {
            OR: [
              { shopName: { contains: filters.q, mode: "insensitive" } },
              { tagline: { contains: filters.q, mode: "insensitive" } },
              { category: { contains: filters.q, mode: "insensitive" } },
              { location: { contains: filters.q, mode: "insensitive" } },
            ],
          }
        : {}),
    },
    include: {
      owner: {
        select: { id: true, name: true, headline: true, location: true, image: true, trustScore: true },
      },
    },
    orderBy: [{ verified: "desc" }, { createdAt: "desc" }, { id: "desc" }],
    take: page.limit + 1,
    ...(cursorId ? { cursor: { id: cursorId }, skip: 1 } : {}),
  });

  const hasMore = rows.length > page.limit;
  const items = hasMore ? rows.slice(0, page.limit) : rows;
  const nextCursor = hasMore ? encodeCursor({ id: items[items.length - 1].id }) : null;

  return { items, meta: { nextCursor } };
}

export async function getBusinessByIdOrSlug(idOrSlug: string) {
  const business = await prisma.businessProfile.findFirst({
    where: { OR: [{ id: idOrSlug }, { slug: idOrSlug }] },
    include: {
      owner: {
        select: {
          id: true,
          name: true,
          role: true,
          headline: true,
          location: true,
          about: true,
          image: true,
          trustScore: true,
          createdAt: true,
        },
      },
      productImages: { orderBy: { order: "asc" } },
      loanRequests: {
        where: { status: { in: ["OPEN", "IN_DISCUSSION", "FUNDED", "REPAYING"] } },
        orderBy: { createdAt: "desc" },
      },
    },
  });

  if (!business) throw new NotFoundError("Business profile not found");
  return business;
}

export async function listInvestors(
  filters: { q?: string; location?: string; verified?: boolean },
  page: PaginationParams,
) {
  const cursorId = page.cursor ? String(decodeCursor(page.cursor).id ?? "") : undefined;

  const rows = await prisma.investorProfile.findMany({
    where: {
      ...(filters.location ? { location: { contains: filters.location, mode: "insensitive" } } : {}),
      ...(filters.verified !== undefined ? { verified: filters.verified } : {}),
      ...(filters.q
        ? {
            OR: [
              { bio: { contains: filters.q, mode: "insensitive" } },
              { user: { name: { contains: filters.q, mode: "insensitive" } } },
              { user: { headline: { contains: filters.q, mode: "insensitive" } } },
            ],
          }
        : {}),
    },
    include: {
      user: {
        select: {
          id: true,
          name: true,
          headline: true,
          location: true,
          about: true,
          image: true,
          trustScore: true,
          createdAt: true,
        },
      },
    },
    orderBy: [{ verified: "desc" }, { createdAt: "desc" }, { id: "desc" }],
    take: page.limit + 1,
    ...(cursorId ? { cursor: { id: cursorId }, skip: 1 } : {}),
  });

  const hasMore = rows.length > page.limit;
  const items = hasMore ? rows.slice(0, page.limit) : rows;
  const nextCursor = hasMore ? encodeCursor({ id: items[items.length - 1].id }) : null;

  return { items, meta: { nextCursor } };
}

export async function getInvestorByUserId(userId: string) {
  const investor = await prisma.investorProfile.findUnique({
    where: { userId },
    include: {
      user: {
        select: {
          id: true,
          name: true,
          role: true,
          headline: true,
          location: true,
          about: true,
          image: true,
          trustScore: true,
          createdAt: true,
        },
      },
    },
  });

  if (!investor) throw new NotFoundError("Investor profile not found");
  return investor;
}
