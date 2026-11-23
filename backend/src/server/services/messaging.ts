import type { PaginationParams } from "@/lib/pagination";
import { assertRole, type Actor } from "@/server/auth/policy";
import { prisma } from "@/server/db";
import {
  BusinessRuleError,
  ForbiddenError,
  NotFoundError,
  ValidationError,
} from "@/server/errors";
import { idSchema } from "@/server/validators/common";
import {
  createConversationSchema,
  messageListQuerySchema,
  sendMessageSchema,
} from "@/server/validators/message";
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
type CreateConversationInput = z.infer<typeof createConversationSchema>;
type SendMessageInput = z.infer<typeof sendMessageSchema>;

interface ServiceDeps {
  db?: Db;
}

interface ConversationRow {
  id: string;
  participantOneId: string;
  participantTwoId: string;
  createdAt: Date;
  updatedAt: Date;
}

interface MessageRow {
  id: string;
  conversationId: string;
  senderId: string;
  body: string;
  readAt: Date | null;
  deletedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

const conversationSelect = {
  id: true,
  participantOneId: true,
  participantTwoId: true,
  createdAt: true,
  updatedAt: true,
} as const;

const messageSelect = {
  id: true,
  conversationId: true,
  senderId: true,
  body: true,
  readAt: true,
  deletedAt: true,
  createdAt: true,
  updatedAt: true,
} as const;

/**
 * Conversations are unique per unordered pair, so ids are stored in code-unit
 * order. The database check uses COLLATE "C" to agree with this comparison.
 */
function canonicalPair(a: string, b: string): [string, string] {
  return a < b ? [a, b] : [b, a];
}

function otherParticipantId(conversation: ConversationRow, actorId: string): string {
  if (conversation.participantOneId === actorId) return conversation.participantTwoId;
  if (conversation.participantTwoId === actorId) return conversation.participantOneId;
  throw new NotFoundError("Conversation not found");
}

/** A block in either direction prevents all conversation and message access. */
async function assertNotBlocked(actorId: string, otherId: string, db: Db): Promise<void> {
  const block = await db.block.findFirst({
    where: {
      OR: [
        { blockerId: actorId, blockedId: otherId },
        { blockerId: otherId, blockedId: actorId },
      ],
    },
    select: { id: true },
  });
  if (block) throw new ForbiddenError("Messaging with this user is blocked");
}

/** Accepted connections and any offer relationship both grant messaging eligibility. */
async function assertMessagingAllowed(actorId: string, otherId: string, db: Db): Promise<void> {
  const [connection, offer] = await Promise.all([
    db.connection.findFirst({
      where: {
        status: "ACCEPTED",
        OR: [
          { requesterId: actorId, addresseeId: otherId },
          { requesterId: otherId, addresseeId: actorId },
        ],
      },
      select: { id: true },
    }),
    db.offer.findFirst({
      where: {
        OR: [
          { investorId: actorId, loanRequest: { ownerId: otherId } },
          { investorId: otherId, loanRequest: { ownerId: actorId } },
        ],
      },
      select: { id: true },
    }),
  ]);
  if (!connection && !offer) {
    throw new BusinessRuleError(
      "An accepted connection or an existing offer is required to message this user",
    );
  }
}

async function loadConversation(id: string, db: Db): Promise<ConversationRow> {
  const row = await db.conversation.findUnique({ where: { id }, select: conversationSelect });
  if (!row) throw new NotFoundError("Conversation not found");
  return row;
}

async function assertConversationAccess(
  actor: Actor,
  conversation: ConversationRow,
  db: Db,
): Promise<string> {
  const otherId = otherParticipantId(conversation, actor.id);
  await assertNotBlocked(actor.id, otherId, db);
  await assertMessagingAllowed(actor.id, otherId, db);
  return otherId;
}

async function loadAccessibleConversation(
  actor: Actor,
  id: string,
  db: Db,
): Promise<ConversationRow> {
  const conversation = await loadConversation(id, db);
  await assertConversationAccess(actor, conversation, db);
  return conversation;
}

/** Per-user deletions and global moderation deletes hide a message from reads/counts. */
function visibleMessageWhere(actorId: string) {
  return {
    deletedAt: null,
    messageDeletions: { none: { userId: actorId } },
  } as const;
}

async function loadParticipant(otherId: string, db: Db) {
  const user = await db.user.findUnique({
    where: { id: otherId },
    select: PUBLIC_USER_SELECT,
  });
  if (!user) throw new NotFoundError("User not found");
  const verified = await verifiedUserIds([otherId], db);
  return { id: otherId, ...toPostAuthor(user as PublicUserRow, verified.has(otherId)) };
}

function toMessageRecord(row: MessageRow, actorId: string) {
  return {
    id: row.id,
    conversationId: row.conversationId,
    senderId: row.senderId,
    mine: row.senderId === actorId,
    body: row.body,
    readAt: row.readAt ? row.readAt.toISOString() : null,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

async function countUnread(conversationId: string, actorId: string, db: Db): Promise<number> {
  return db.message.count({
    where: {
      conversationId,
      ...visibleMessageWhere(actorId),
      senderId: { not: actorId },
      readAt: null,
    },
  });
}

async function toConversationRecord(conversation: ConversationRow, actor: Actor, db: Db) {
  const otherId = otherParticipantId(conversation, actor.id);
  const [participant, lastMessage, unreadCount] = await Promise.all([
    loadParticipant(otherId, db),
    db.message.findFirst({
      where: { conversationId: conversation.id, ...visibleMessageWhere(actor.id) },
      orderBy: [{ createdAt: "desc" }, { id: "desc" }],
      select: messageSelect,
    }),
    countUnread(conversation.id, actor.id, db),
  ]);
  return {
    id: conversation.id,
    participant,
    lastMessage: lastMessage ? toMessageRecord(lastMessage, actor.id) : null,
    unreadCount,
    createdAt: conversation.createdAt.toISOString(),
    updatedAt: conversation.updatedAt.toISOString(),
  };
}

async function partnerIdsForEligibility(actorId: string, db: Db): Promise<string[]> {
  const [connections, offers] = await Promise.all([
    db.connection.findMany({
      where: {
        status: "ACCEPTED",
        OR: [{ requesterId: actorId }, { addresseeId: actorId }],
      },
      select: { requesterId: true, addresseeId: true },
    }),
    db.offer.findMany({
      where: {
        OR: [
          { investorId: actorId },
          { loanRequest: { ownerId: actorId } },
        ],
      },
      select: {
        investorId: true,
        loanRequest: { select: { ownerId: true } },
      },
    }),
  ]);

  const ids = new Set<string>();
  for (const connection of connections) {
    ids.add(connection.requesterId === actorId ? connection.addresseeId : connection.requesterId);
  }
  for (const offer of offers) {
    ids.add(offer.investorId);
    if (offer.loanRequest && offer.loanRequest.ownerId !== actorId) {
      ids.add(offer.loanRequest.ownerId);
    }
  }
  return [...ids];
}

async function blockedPartnerIds(actorId: string, db: Db): Promise<Set<string>> {
  const blocks = await db.block.findMany({
    where: { OR: [{ blockerId: actorId }, { blockedId: actorId }] },
    select: { blockerId: true, blockedId: true },
  });
  return new Set(
    blocks.map((block) => (block.blockerId === actorId ? block.blockedId : block.blockerId)),
  );
}

/** Creates the canonical conversation once, or returns the existing one. */
export async function createOrGetConversation(
  actor: Actor,
  input: CreateConversationInput,
  deps: ServiceDeps = {},
) {
  assertRole(actor, "OWNER", "INVESTOR");
  const parsed = createConversationSchema.parse(input);
  const db = deps.db ?? prisma;

  const target = await db.user.findUnique({
    where: { id: parsed.participantId },
    select: PUBLIC_USER_SELECT,
  });
  const validTarget = requirePublicTarget(target as PublicUserRow | null, actor);
  await assertNotBlocked(actor.id, validTarget.id, db);
  await assertMessagingAllowed(actor.id, validTarget.id, db);

  const [participantOneId, participantTwoId] = canonicalPair(actor.id, validTarget.id);
  const where = { participantOneId_participantTwoId: { participantOneId, participantTwoId } };

  try {
    const existing = await db.conversation.findUnique({ where, select: conversationSelect });
    const conversation =
      existing ??
      (await db.conversation.create({ data: { participantOneId, participantTwoId }, select: conversationSelect }));
    return await toConversationRecord(conversation, actor, db);
  } catch (error) {
    if (isUniqueViolation(error)) {
      const existing = await db.conversation.findUnique({ where, select: conversationSelect });
      if (existing) return await toConversationRecord(existing, actor, db);
    }
    throw error;
  }
}

export async function listConversations(
  actor: Actor,
  query: PaginationParams,
  deps: ServiceDeps = {},
) {
  assertRole(actor, "OWNER", "INVESTOR");
  const db = deps.db ?? prisma;
  const cursor = cursorId(query.cursor);

  const [eligible, blocked] = await Promise.all([
    partnerIdsForEligibility(actor.id, db),
    blockedPartnerIds(actor.id, db),
  ]);
  const allowedIds = eligible.filter((id) => !blocked.has(id));
  if (allowedIds.length === 0) {
    return { items: [], meta: pageMeta<ConversationRow>([], query.limit).meta };
  }

  const records = await db.conversation.findMany({
    where: {
      OR: [
        { participantOneId: actor.id, participantTwoId: { in: allowedIds } },
        { participantTwoId: actor.id, participantOneId: { in: allowedIds } },
      ],
    },
    orderBy: [{ updatedAt: "desc" }, { id: "desc" }],
    take: query.limit + 1,
    select: conversationSelect,
    ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
  });

  const page = pageMeta(records as ConversationRow[], query.limit);
  const items = [];
  for (const row of page.items) items.push(await toConversationRecord(row, actor, db));
  return { items, meta: page.meta };
}

export async function getConversation(actor: Actor, id: string, deps: ServiceDeps = {}) {
  assertRole(actor, "OWNER", "INVESTOR");
  const db = deps.db ?? prisma;
  const conversation = await loadAccessibleConversation(actor, idSchema.parse(id), db);
  return toConversationRecord(conversation, actor, db);
}

/** Oldest-first thread. `after` and `cursor` both resolve to a chronological anchor. */
export async function listMessages(
  actor: Actor,
  conversationId: string,
  query: PaginationParams & { after?: string },
  deps: ServiceDeps = {},
) {
  assertRole(actor, "OWNER", "INVESTOR");
  const parsedQuery = messageListQuerySchema.parse({ after: query.after });
  const cursor = cursorId(query.cursor);
  if (parsedQuery.after && cursor) {
    throw new ValidationError("Use either cursor or after, not both");
  }

  const db = deps.db ?? prisma;
  const id = idSchema.parse(conversationId);
  await loadAccessibleConversation(actor, id, db);

  const anchorId = parsedQuery.after ?? cursor;
  const anchor = anchorId
    ? await db.message.findFirst({
        where: { id: anchorId, conversationId: id },
        select: { id: true, createdAt: true },
      })
    : null;
  if (anchorId && !anchor) throw new NotFoundError("Message not found");

  const records = await db.message.findMany({
    where: {
      conversationId: id,
      ...visibleMessageWhere(actor.id),
      ...(anchor
        ? {
            OR: [
              { createdAt: { gt: anchor.createdAt } },
              { createdAt: anchor.createdAt, id: { gt: anchor.id } },
            ],
          }
        : {}),
    },
    orderBy: [{ createdAt: "asc" }, { id: "asc" }],
    take: query.limit + 1,
    select: messageSelect,
  });

  const page = pageMeta(records as MessageRow[], query.limit);
  return {
    items: page.items.map((row) => toMessageRecord(row, actor.id)),
    meta: page.meta,
  };
}

export async function getMessage(actor: Actor, id: string, deps: ServiceDeps = {}) {
  assertRole(actor, "OWNER", "INVESTOR");
  const db = deps.db ?? prisma;
  const messageId = idSchema.parse(id);
  const row = await db.message.findUnique({
    where: { id: messageId },
    select: {
      ...messageSelect,
      conversation: { select: conversationSelect },
    },
  });
  if (!row) throw new NotFoundError("Message not found");

  const { conversation, ...message } = row;
  if (!conversation) throw new NotFoundError("Conversation not found");
  await assertConversationAccess(actor, conversation, db);
  if (message.deletedAt) throw new NotFoundError("Message not found");
  const deletion = await db.messageDeletion.findUnique({
    where: { messageId_userId: { messageId, userId: actor.id } },
    select: { id: true },
  });
  if (deletion) throw new NotFoundError("Message not found");

  return toMessageRecord(message, actor.id);
}

export async function sendMessage(
  actor: Actor,
  conversationId: string,
  input: SendMessageInput,
  deps: ServiceDeps = {},
) {
  assertRole(actor, "OWNER", "INVESTOR");
  const parsed = sendMessageSchema.parse(input);
  const db = deps.db ?? prisma;
  const id = idSchema.parse(conversationId);
  await loadAccessibleConversation(actor, id, db);

  const created = await db.$transaction(async (tx) => {
    const message = await tx.message.create({
      data: { conversationId: id, senderId: actor.id, body: parsed.body },
      select: messageSelect,
    });
    await tx.conversation.update({
      where: { id },
      data: { updatedAt: message.createdAt },
    });
    return message;
  });

  return toMessageRecord(created, actor.id);
}

/** Marks only incoming, live, unread messages in this conversation as read. */
export async function markConversationRead(
  actor: Actor,
  conversationId: string,
  deps: ServiceDeps = {},
) {
  assertRole(actor, "OWNER", "INVESTOR");
  const db = deps.db ?? prisma;
  const id = idSchema.parse(conversationId);
  await loadAccessibleConversation(actor, id, db);

  const result = await db.message.updateMany({
    where: {
      conversationId: id,
      ...visibleMessageWhere(actor.id),
      senderId: { not: actor.id },
      readAt: null,
    },
    data: { readAt: new Date() },
  });
  const unreadCount = await countUnread(id, actor.id, db);
  return { conversationId: id, markedRead: result.count, unreadCount };
}

/** Per-user soft delete: only the caller's view is hidden. */
export async function deleteMessage(actor: Actor, id: string, deps: ServiceDeps = {}) {
  assertRole(actor, "OWNER", "INVESTOR");
  const db = deps.db ?? prisma;
  const messageId = idSchema.parse(id);
  const row = await db.message.findUnique({
    where: { id: messageId },
    select: {
      ...messageSelect,
      conversation: { select: conversationSelect },
    },
  });
  if (!row) throw new NotFoundError("Message not found");
  if (!row.conversation) throw new NotFoundError("Conversation not found");
  await assertConversationAccess(actor, row.conversation, db);
  if (row.deletedAt) throw new NotFoundError("Message not found");

  await db.messageDeletion.upsert({
    where: { messageId_userId: { messageId, userId: actor.id } },
    create: { messageId, userId: actor.id },
    update: { deletedAt: new Date() },
    select: { id: true },
  });
  return { id: messageId, deleted: true as const };
}
