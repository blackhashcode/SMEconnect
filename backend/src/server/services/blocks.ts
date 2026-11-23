import type { PaginationParams } from "@/lib/pagination";
import { assertRole, type Actor } from "@/server/auth/policy";
import { prisma } from "@/server/db";
import { ConflictError, NotFoundError } from "@/server/errors";
import { blockUserSchema } from "@/server/validators/block";
import type { z } from "zod";
import {
  PUBLIC_USER_SELECT,
  cursorId,
  isUniqueViolation,
  pageMeta,
  requirePublicTarget,
  toPostAuthor,
  verifiedUserIds,
  type PublicUserRow,
} from "@/server/services/social-shared";

type Db = typeof prisma;
type BlockInput = z.infer<typeof blockUserSchema>;

interface ServiceDeps {
  db?: Db;
  now?: () => Date;
}

interface BlockRow {
  id: string;
  blockerId: string;
  blockedId: string;
  createdAt: Date;
  updatedAt: Date;
  blocked: PublicUserRow;
}

const blockInclude = { blocked: { select: PUBLIC_USER_SELECT } } as const;

/** True when either user has blocked the other; reused by all social writes. */
export async function isBlockedBetween(
  actorId: string,
  otherId: string,
  db: Pick<Db, "block">,
): Promise<boolean> {
  const block = await db.block.findFirst({
    where: {
      OR: [
        { blockerId: actorId, blockedId: otherId },
        { blockerId: otherId, blockedId: actorId },
      ],
    },
    select: { id: true },
  });
  return Boolean(block);
}

async function loadBlock(id: string, db: Db): Promise<BlockRow> {
  const row = await db.block.findUnique({ where: { id }, include: blockInclude });
  if (!row) throw new NotFoundError("Block not found");
  return row as unknown as BlockRow;
}

async function toRecord(row: BlockRow, db: Db) {
  const verified = await verifiedUserIds([row.blocked.id], db);
  return {
    userId: row.blockedId,
    user: toPostAuthor(row.blocked, verified.has(row.blocked.id)),
    blockedAt: row.createdAt.toISOString(),
  };
}

/**
 * Blocks in either direction are mutual for social features. Existing follows
 * and connections are removed atomically; conversations/messages are retained
 * but remain unreadable through the existing messaging block guard.
 */
export async function blockUser(
  actor: Actor,
  input: BlockInput,
  deps: ServiceDeps = {},
) {
  assertRole(actor, "OWNER", "INVESTOR");
  const parsed = blockUserSchema.parse(input);
  const db = deps.db ?? prisma;

  if (parsed.userId === actor.id) {
    throw new ConflictError("You cannot block your own account");
  }

  const target = await db.user.findUnique({
    where: { id: parsed.userId },
    select: PUBLIC_USER_SELECT,
  });
  requirePublicTarget(target as PublicUserRow | null, actor);

  const existing = await db.block.findFirst({
    where: { blockerId: actor.id, blockedId: parsed.userId },
    select: { id: true },
  });
  if (existing) throw new ConflictError("User is already blocked");

  let blockId: string;
  try {
    blockId = await db.$transaction(async (tx) => {
      const created = await tx.block.create({
        data: { blockerId: actor.id, blockedId: parsed.userId },
      });

      const between = {
        OR: [
          { followerId: actor.id, followeeId: parsed.userId },
          { followerId: parsed.userId, followeeId: actor.id },
        ],
      };
      await tx.follow.deleteMany({ where: between });

      const connections = {
        OR: [
          { requesterId: actor.id, addresseeId: parsed.userId },
          { requesterId: parsed.userId, addresseeId: actor.id },
        ],
      };
      await tx.connection.deleteMany({ where: connections });

      return created.id;
    });
  } catch (error) {
    if (isUniqueViolation(error)) throw new ConflictError("User is already blocked");
    throw error;
  }

  return toRecord(await loadBlock(blockId, db), db);
}

/** Paginated list of users blocked by the actor. */
export async function listBlocks(
  actor: Actor,
  query: PaginationParams,
  deps: ServiceDeps = {},
) {
  assertRole(actor, "OWNER", "INVESTOR");
  const db = deps.db ?? prisma;
  const cursor = cursorId(query.cursor);

  const rows = await db.block.findMany({
    where: { blockerId: actor.id },
    include: blockInclude,
    orderBy: [{ createdAt: "desc" }, { id: "desc" }],
    take: query.limit + 1,
    ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
  });

  const page = pageMeta(rows as unknown as BlockRow[], query.limit);
  const items: Array<Awaited<ReturnType<typeof toRecord>>> = [];
  for (const row of page.items) items.push(await toRecord(row, db));
  return { items, meta: page.meta };
}

/** Only the blocker can remove their own block; a missing block is a 404. */
export async function unblockUser(
  actor: Actor,
  userId: string,
  deps: ServiceDeps = {},
) {
  assertRole(actor, "OWNER", "INVESTOR");
  const db = deps.db ?? prisma;

  const result = await db.block.deleteMany({
    where: { blockerId: actor.id, blockedId: userId },
  });
  if (result.count === 0) throw new NotFoundError("Block not found");
  return { userId, blocked: false as const };
}
