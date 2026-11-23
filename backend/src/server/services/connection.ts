import type { PaginationParams } from "@/lib/pagination";
import { assertRole, type Actor } from "@/server/auth/policy";
import { prisma } from "@/server/db";
import {
  ConflictError,
  ForbiddenError,
  NotFoundError,
} from "@/server/errors";
import {
  connectionListQuerySchema,
  sendConnectionRequestSchema,
} from "@/server/validators/social";
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
type CreateInput = z.infer<typeof sendConnectionRequestSchema>;
type ListQuery = z.infer<typeof connectionListQuerySchema>;
type ConnectionStatus = "PENDING" | "ACCEPTED" | "DECLINED";

interface ServiceDeps {
  db?: Db;
}

interface ConnectionRow {
  id: string;
  requesterId: string;
  addresseeId: string;
  status: ConnectionStatus;
  message: string | null;
  createdAt: Date;
  updatedAt: Date;
  requester: PublicUserRow;
  addressee: PublicUserRow;
}

const connectionInclude = {
  requester: { select: PUBLIC_USER_SELECT },
  addressee: { select: PUBLIC_USER_SELECT },
} as const;

async function loadConnection(id: string, db: Db): Promise<ConnectionRow> {
  const row = await db.connection.findUnique({ where: { id }, include: connectionInclude });
  if (!row) throw new NotFoundError("Connection not found");
  return row as unknown as ConnectionRow;
}

async function toRecord(row: ConnectionRow, actor: Actor, db: Db) {
  const outgoing = row.requesterId === actor.id;
  const other = outgoing ? row.addressee : row.requester;
  const verified = await verifiedUserIds([other.id], db);
  return {
    id: row.id,
    user: toPostAuthor(other, verified.has(other.id)),
    direction: outgoing ? ("outgoing" as const) : ("incoming" as const),
    status: row.status,
    message: row.message ?? null,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

export async function sendConnectionRequest(
  actor: Actor,
  input: CreateInput,
  deps: ServiceDeps = {},
) {
  assertRole(actor, "OWNER", "INVESTOR");
  const parsed = sendConnectionRequestSchema.parse(input);
  const db = deps.db ?? prisma;

  const target = await db.user.findUnique({
    where: { id: parsed.addresseeId },
    select: PUBLIC_USER_SELECT,
  });
  const validTarget = requirePublicTarget(target as PublicUserRow | null, actor);

  if (await isBlockedBetween(actor.id, validTarget.id, db)) {
    throw new ForbiddenError("You cannot connect with a blocked user");
  }

  const existing = await db.connection.findFirst({
    where: {
      OR: [
        { requesterId: actor.id, addresseeId: validTarget.id },
        { requesterId: validTarget.id, addresseeId: actor.id },
      ],
    },
    select: { id: true },
  });
  if (existing) throw new ConflictError("A connection already exists with this user");

  try {
    const created = await db.connection.create({
      data: {
        requesterId: actor.id,
        addresseeId: validTarget.id,
        status: "PENDING",
        message: parsed.message ?? null,
      },
    });
    return toRecord(await loadConnection(created.id, db), actor, db);
  } catch (error) {
    if (isUniqueViolation(error)) {
      throw new ConflictError("A connection already exists with this user");
    }
    throw error;
  }
}

export async function listConnections(
  actor: Actor,
  query: PaginationParams & Partial<ListQuery>,
  deps: ServiceDeps = {},
) {
  assertRole(actor, "OWNER", "INVESTOR");
  const parsed = connectionListQuerySchema.parse({
    direction: query.direction,
    status: query.status,
  });
  const db = deps.db ?? prisma;
  const cursor = cursorId(query.cursor);

  const records = await db.connection.findMany({
    where: {
      ...(parsed.direction === "incoming"
        ? { addresseeId: actor.id }
        : parsed.direction === "outgoing"
          ? { requesterId: actor.id }
          : { OR: [{ requesterId: actor.id }, { addresseeId: actor.id }] }),
      ...(parsed.status ? { status: parsed.status } : {}),
    },
    orderBy: [{ createdAt: "desc" }, { id: "desc" }],
    take: query.limit + 1,
    ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
    include: connectionInclude,
  });

  const page = pageMeta(records as unknown as ConnectionRow[], query.limit);
  const items = [];
  for (const row of page.items) items.push(await toRecord(row, actor, db));
  return { items, meta: page.meta };
}

async function respondToConnection(
  actor: Actor,
  id: string,
  targetStatus: "ACCEPTED" | "DECLINED",
  deps: ServiceDeps,
) {
  assertRole(actor, "OWNER", "INVESTOR");
  const db = deps.db ?? prisma;
  const existing = await loadConnection(id, db);

  if (existing.addresseeId !== actor.id) {
    throw new ForbiddenError("Only the recipient can respond to a connection request");
  }
  if (existing.status !== "PENDING") {
    throw new ConflictError(`Cannot ${targetStatus.toLowerCase()} a ${existing.status} connection`);
  }

  await db.connection.update({ where: { id }, data: { status: targetStatus } });
  return toRecord(await loadConnection(id, db), actor, db);
}

export async function acceptConnection(actor: Actor, id: string, deps: ServiceDeps = {}) {
  return respondToConnection(actor, id, "ACCEPTED", deps);
}

export async function declineConnection(actor: Actor, id: string, deps: ServiceDeps = {}) {
  return respondToConnection(actor, id, "DECLINED", deps);
}

/** Cancel a pending outgoing request, or remove an accepted connection. */
export async function removeConnection(actor: Actor, id: string, deps: ServiceDeps = {}) {
  assertRole(actor, "OWNER", "INVESTOR");
  const db = deps.db ?? prisma;
  const existing = await loadConnection(id, db);

  if (existing.status === "PENDING") {
    if (existing.requesterId !== actor.id) {
      throw new ForbiddenError("Only the requester can cancel a pending request");
    }
  } else if (existing.status === "ACCEPTED") {
    if (existing.requesterId !== actor.id && existing.addresseeId !== actor.id) {
      throw new ForbiddenError("You are not part of this connection");
    }
  } else {
    throw new ConflictError("A declined connection cannot be modified");
  }

  const record = await toRecord(existing, actor, db);
  await db.connection.delete({ where: { id } });
  return record;
}
