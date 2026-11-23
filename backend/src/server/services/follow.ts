import type { PaginationParams } from "@/lib/pagination";
import { assertRole, type Actor } from "@/server/auth/policy";
import { prisma } from "@/server/db";
import { ConflictError, ForbiddenError, NotFoundError } from "@/server/errors";
import { followUserSchema } from "@/server/validators/social";
import type { z } from "zod";
import { isBlockedBetween } from "@/server/services/blocks";
import {
  PUBLIC_USER_SELECT,
  requirePublicTarget,
  cursorId,
  isUniqueViolation,
  pageMeta,
  toPostAuthor,
  verifiedUserIds,
  type PublicUserRow,
} from "@/server/services/social-shared";

type Db = typeof prisma;
type FollowInput = z.infer<typeof followUserSchema>;

interface ServiceDeps {
  db?: Db;
}

interface FollowRow {
  id: string;
  followerId: string;
  followeeId: string;
  createdAt: Date;
  follower: PublicUserRow;
  followee: PublicUserRow;
}

const followInclude = {
  follower: { select: PUBLIC_USER_SELECT },
  followee: { select: PUBLIC_USER_SELECT },
} as const;

async function toRecord(row: FollowRow, actor: Actor, db: Db) {
  const other = row.followerId === actor.id ? row.followee : row.follower;
  const verified = await verifiedUserIds([other.id], db);
  return {
    userId: other.id,
    user: toPostAuthor(other, verified.has(other.id)),
    following: true as const,
  };
}

export async function followUser(
  actor: Actor,
  input: FollowInput,
  deps: ServiceDeps = {},
) {
  assertRole(actor, "OWNER", "INVESTOR");
  const parsed = followUserSchema.parse(input);
  const db = deps.db ?? prisma;

  const target = await db.user.findUnique({
    where: { id: parsed.followeeId },
    select: PUBLIC_USER_SELECT,
  });
  const validTarget = requirePublicTarget(target as PublicUserRow | null, actor);

  if (await isBlockedBetween(actor.id, validTarget.id, db)) {
    throw new ForbiddenError("You cannot follow a user you have blocked or who blocked you");
  }

  const existing = await db.follow.findUnique({
    where: { followerId_followeeId: { followerId: actor.id, followeeId: validTarget.id } },
    select: { id: true },
  });
  if (existing) throw new ConflictError("You already follow this user");

  try {
    const created = await db.follow.create({
      data: { followerId: actor.id, followeeId: validTarget.id },
    });
    const row = await db.follow.findUnique({
      where: { id: created.id },
      include: followInclude,
    });
    return toRecord(row as unknown as FollowRow, actor, db);
  } catch (error) {
    if (isUniqueViolation(error)) throw new ConflictError("You already follow this user");
    throw error;
  }
}

export async function unfollowUser(actor: Actor, userId: string, deps: ServiceDeps = {}) {
  assertRole(actor, "OWNER", "INVESTOR");
  const db = deps.db ?? prisma;
  const existing = await db.follow.findUnique({
    where: { followerId_followeeId: { followerId: actor.id, followeeId: userId } },
    select: { id: true },
  });
  if (!existing) throw new NotFoundError("Follow not found");

  await db.follow.delete({ where: { id: existing.id } });
  return { userId, following: false as const };
}

async function listFollows(
  actor: Actor,
  query: PaginationParams,
  side: "followers" | "following",
  db: Db,
) {
  const cursor = cursorId(query.cursor);
  const records = await db.follow.findMany({
    where: side === "followers" ? { followeeId: actor.id } : { followerId: actor.id },
    orderBy: [{ createdAt: "desc" }, { id: "desc" }],
    take: query.limit + 1,
    ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
    include: followInclude,
  });

  const page = pageMeta(records as unknown as FollowRow[], query.limit);
  const items = [];
  for (const row of page.items) items.push(await toRecord(row, actor, db));
  return { items, meta: page.meta };
}

export async function listFollowers(
  actor: Actor,
  query: PaginationParams,
  deps: ServiceDeps = {},
) {
  assertRole(actor, "OWNER", "INVESTOR");
  return listFollows(actor, query, "followers", deps.db ?? prisma);
}

export async function listFollowing(
  actor: Actor,
  query: PaginationParams,
  deps: ServiceDeps = {},
) {
  assertRole(actor, "OWNER", "INVESTOR");
  return listFollows(actor, query, "following", deps.db ?? prisma);
}
