import { beforeEach, describe, expect, it, vi } from "vitest";
import { ZodError } from "zod";

vi.mock("@/server/db", () => ({ prisma: {} }));

import {
  BusinessRuleError,
  ForbiddenError,
  NotFoundError,
  ValidationError,
} from "@/server/errors";
import {
  createOrGetConversation,
  deleteMessage,
  getConversation,
  getMessage,
  listConversations,
  listMessages,
  markConversationRead,
  sendMessage,
} from "@/server/services/messaging";

/* eslint-disable @typescript-eslint/no-explicit-any -- test doubles mirror loose Prisma filter shapes */
type Row = Record<string, any>;

const owner = { id: "usr_owner", role: "OWNER" as const };
const investor = { id: "usr_inv", role: "INVESTOR" as const };
const stranger = { id: "usr_str", role: "OWNER" as const };
const admin = { id: "usr_admin", role: "ADMIN" as const };

const t1 = new Date("2026-11-23T10:00:00.000Z");
const t2 = new Date("2026-11-23T10:01:00.000Z");
const t3 = new Date("2026-11-23T10:02:00.000Z");

function pairKey(a: string, b: string): string {
  return [a, b].sort().join(":");
}

function publicUser(
  id: string,
  role: "OWNER" | "INVESTOR" | "ADMIN" = "INVESTOR",
  status: "ACTIVE" | "SUSPENDED" = "ACTIVE",
): Row {
  return {
    id,
    name: `User ${id}`,
    image: null,
    role,
    status,
    email: "secret@example.com",
    phone: "+8801712345678",
    businessProfile:
      role === "OWNER"
        ? {
            shopName: "Owner Shop",
            slug: "owner-shop",
            category: "Food",
            district: "Dhaka",
            city: "Dhanmondi",
            logoUrl: null,
            trustScore: 70,
            description: null,
          }
        : null,
    investorProfile:
      role === "INVESTOR"
        ? {
            bio: "Investor",
            minLendBdt: 10_000,
            maxLendBdt: 100_000,
            preferredCategories: ["Food"],
            district: "Dhaka",
            city: null,
            trustScore: 60,
          }
        : null,
  };
}

function conversationRow(overrides: Row = {}): Row {
  const [one, two] = pairKey(owner.id, investor.id).split(":");
  return {
    id: "con_1",
    participantOneId: one,
    participantTwoId: two,
    createdAt: t1,
    updatedAt: t1,
    ...overrides,
  };
}

function messageRow(overrides: Row = {}): Row {
  return {
    id: "msg_1",
    conversationId: "con_1",
    senderId: investor.id,
    body: "Hello",
    readAt: null,
    deletedAt: null,
    createdAt: t1,
    updatedAt: t1,
    ...overrides,
  };
}

interface State {
  users: Map<string, Row>;
  conversations: Row[];
  messages: Row[];
  deletions: Row[];
  connections: Set<string>;
  offers: Set<string>;
  blocks: Set<string>;
}

let state: State;
let db: ReturnType<typeof makeDb>;

function messageMatches(row: Row, where: Row): boolean {
  if (where.id !== undefined && row.id !== where.id) return false;
  if (where.conversationId !== undefined && row.conversationId !== where.conversationId) return false;
  if (where.deletedAt === null && row.deletedAt !== null) return false;
  if (where.readAt === null && row.readAt !== null) return false;

  if (where.senderId !== undefined) {
    const senderFilter = where.senderId as Row | string;
    if (typeof senderFilter === "string") {
      if (row.senderId !== senderFilter) return false;
    } else if (senderFilter.not !== undefined && row.senderId === senderFilter.not) {
      return false;
    }
  }

  if (where.messageDeletions?.none?.userId) {
    const hidden = state.deletions.some(
      (entry) => entry.messageId === row.id && entry.userId === where.messageDeletions.none.userId,
    );
    if (hidden) return false;
  }

  if (where.OR) {
    const matches = (where.OR as Row[]).some((condition) => {
      if (condition.createdAt) {
        const createdFilter = condition.createdAt as Row | Date;
        const created = new Date(row.createdAt as Date).getTime();
        if (createdFilter instanceof Date) {
          if (created !== createdFilter.getTime()) return false;
        } else if (createdFilter.gt !== undefined) {
          if (created <= new Date(createdFilter.gt as Date).getTime()) return false;
        }
      }
      if (condition.id?.gt !== undefined && (row.id as string) <= condition.id.gt) return false;
      return true;
    });
    if (!matches) return false;
  }

  return true;
}

function makeDb() {
  const fake = {
    $transaction: vi.fn(async (callback: (tx: typeof fake) => Promise<unknown>) => callback(fake)),
    user: {
      findUnique: vi.fn(async ({ where }: Row) => state.users.get(where.id as string) ?? null),
    },
    userVerification: {
      findMany: vi.fn(({ where }: Row) =>
        Promise.resolve(
          (where.userId.in as string[])
            .filter((id) => state.users.get(id)?.id)
            .map((id) => ({ userId: id })),
        ),
      ),
    },
    block: {
      findFirst: vi.fn(({ where }: Row) => {
        const [first] = where.OR as Row[];
        const key = pairKey(first.blockerId as string, first.blockedId as string);
        return Promise.resolve(state.blocks.has(key) ? { id: "blk_1" } : null);
      }),
      findMany: vi.fn(({ where }: Row) => {
        const actorId = (where.OR as Row[])[0].blockerId as string;
        return Promise.resolve(
          [...state.blocks]
            .filter((key) => key.split(":").includes(actorId))
            .map((key) => {
              const [a, b] = key.split(":");
              return { blockerId: a, blockedId: b };
            }),
        );
      }),
    },
    connection: {
      findFirst: vi.fn(({ where }: Row) => {
        if (where.status && where.status !== "ACCEPTED") return Promise.resolve(null);
        const [first] = where.OR as Row[];
        const key = pairKey(first.requesterId as string, first.addresseeId as string);
        return Promise.resolve(state.connections.has(key) ? { id: "conn_allowed" } : null);
      }),
      findMany: vi.fn(({ where }: Row) => {
        const actorId = (where.OR as Row[])[0].requesterId as string;
        return Promise.resolve(
          [...state.connections]
            .filter((key) => key.split(":").includes(actorId))
            .map((key) => {
              const [a, b] = key.split(":");
              return { requesterId: a, addresseeId: b };
            }),
        );
      }),
    },
    offer: {
      findFirst: vi.fn(({ where }: Row) => {
        const allowed = (where.OR as Row[]).some((condition) =>
          state.offers.has(
            pairKey(
              condition.investorId as string,
              (condition.loanRequest as Row).ownerId as string,
            ),
          ),
        );
        return Promise.resolve(allowed ? { id: "offer_allowed" } : null);
      }),
      findMany: vi.fn(({ where }: Row) => {
        const actorId = (where.OR as Row[])[0].investorId as string;
        return Promise.resolve(
          [...state.offers]
            .filter((key) => key.split(":").includes(actorId))
            .map((key) => {
              const [investorId, ownerId] = key.split(":");
              return { investorId, loanRequest: { ownerId } };
            }),
        );
      }),
    },
    conversation: {
      findUnique: vi.fn(({ where }: Row) => {
        if (where.id) {
          return Promise.resolve(state.conversations.find((row) => row.id === where.id) ?? null);
        }
        const target = where.participantOneId_participantTwoId as Row;
        return Promise.resolve(
          state.conversations.find(
            (row) =>
              row.participantOneId === target.participantOneId &&
              row.participantTwoId === target.participantTwoId,
          ) ?? null,
        );
      }),
      findMany: vi.fn(({ where, cursor, skip, take }: Row) => {
        let rows = state.conversations.filter((row) => {
          if (!where.OR) return true;
          return (where.OR as Row[]).some((condition) => {
            const oneFilter = condition.participantOneId as Row | string | undefined;
            const twoFilter = condition.participantTwoId as Row | string | undefined;
            if (oneFilter && !(oneFilter as Row).in?.includes(row.participantOneId as string)) {
              if (typeof oneFilter === "string" && row.participantOneId !== oneFilter) return false;
              if (typeof oneFilter !== "string") return false;
            }
            if (twoFilter && !(twoFilter as Row).in?.includes(row.participantTwoId as string)) {
              if (typeof twoFilter === "string" && row.participantTwoId !== twoFilter) return false;
              if (typeof twoFilter !== "string") return false;
            }
            return true;
          });
        });
        rows = [...rows].sort(
          (a, b) =>
            new Date(b.updatedAt as Date).getTime() - new Date(a.updatedAt as Date).getTime() ||
            String(b.id).localeCompare(String(a.id)),
        );
        if (cursor?.id) {
          const index = rows.findIndex((row) => row.id === cursor.id);
          rows = index >= 0 ? rows.slice(index + (skip as number ?? 1)) : [];
        }
        return Promise.resolve(rows.slice(0, take as number));
      }),
      create: vi.fn(({ data }: Row) => {
        const row = conversationRow(data);
        state.conversations.push(row);
        return Promise.resolve(row);
      }),
      update: vi.fn(({ where, data }: Row) => {
        const row = state.conversations.find((entry) => entry.id === where.id);
        if (!row) return Promise.reject(new NotFoundError("Conversation not found"));
        Object.assign(row, data);
        return Promise.resolve(row);
      }),
    },
    message: {
      findFirst: vi.fn(({ where, orderBy }: Row) => {
        const sortBy = (orderBy as Row[] | undefined)?.[0] ?? { createdAt: "asc" };
        const rows = state.messages
          .filter((row) => messageMatches(row, where))
          .sort((a, b) => {
            const direction = sortBy.createdAt === "desc" ? -1 : 1;
            return (
              direction *
              (new Date(a.createdAt as Date).getTime() - new Date(b.createdAt as Date).getTime())
            );
          });
        return Promise.resolve(rows[0] ?? null);
      }),
      findMany: vi.fn(({ where, orderBy, take }: Row) => {
        const sortBy = (orderBy as Row[] | undefined)?.[0] ?? { createdAt: "asc" };
        const direction = sortBy.createdAt === "desc" ? -1 : 1;
        const rows = state.messages
          .filter((row) => messageMatches(row, where))
          .sort(
            (a, b) =>
              direction *
              (new Date(a.createdAt as Date).getTime() - new Date(b.createdAt as Date).getTime()),
          );
        return Promise.resolve(rows.slice(0, take as number));
      }),
      findUnique: vi.fn(({ where, select }: Row) => {
        const row = state.messages.find((entry) => entry.id === where.id);
        if (!row) return Promise.resolve(null);
        if (select?.conversation) {
          return Promise.resolve({
            ...row,
            conversation:
              state.conversations.find((entry) => entry.id === row.conversationId) ?? null,
          });
        }
        return Promise.resolve(row);
      }),
      count: vi.fn(({ where }: Row) =>
        Promise.resolve(state.messages.filter((row) => messageMatches(row, where)).length),
      ),
      create: vi.fn(({ data }: Row) => {
        const row = messageRow(data);
        state.messages.push(row);
        return Promise.resolve(row);
      }),
      updateMany: vi.fn(({ where, data }: Row) => {
        let count = 0;
        for (const row of state.messages) {
          if (messageMatches(row, where)) {
            Object.assign(row, data);
            count += 1;
          }
        }
        return Promise.resolve({ count });
      }),
    },
    messageDeletion: {
      findUnique: vi.fn(({ where }: Row) => {
        const target = where.messageId_userId as Row;
        return Promise.resolve(
          state.deletions.find(
            (row) => row.messageId === target.messageId && row.userId === target.userId,
          ) ?? null,
        );
      }),
      upsert: vi.fn(({ where, create, update }: Row) => {
        const target = where.messageId_userId as Row;
        let row = state.deletions.find(
          (entry) => entry.messageId === target.messageId && entry.userId === target.userId,
        );
        if (!row) {
          const createdRow = { ...(create as Row) };
          state.deletions.push(createdRow);
          row = createdRow;
        } else {
          Object.assign(row, update);
        }
        return Promise.resolve(row);
      }),
    },
  };

  return fake;
}

beforeEach(() => {
  state = {
    users: new Map([
      [owner.id, publicUser(owner.id, "OWNER")],
      [investor.id, publicUser(investor.id, "INVESTOR")],
      [stranger.id, publicUser(stranger.id, "OWNER")],
      [admin.id, publicUser(admin.id, "ADMIN")],
    ]),
    conversations: [conversationRow()],
    messages: [],
    deletions: [],
    connections: new Set([pairKey(owner.id, investor.id)]),
    offers: new Set(),
    blocks: new Set(),
  };
  db = makeDb();
});

describe("createOrGetConversation", () => {
  it("canonicalizes the pair and rejects client-supplied identity fields", async () => {
    state.conversations = [];
    await expect(
      createOrGetConversation(
        owner,
        { participantId: investor.id, userId: stranger.id } as never,
        { db: db as never },
      ),
    ).rejects.toThrow(ZodError);

    const result = await createOrGetConversation(
      owner,
      { participantId: investor.id },
      { db: db as never },
    );

    expect(db.conversation.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: { participantOneId: investor.id, participantTwoId: owner.id },
      }),
    );
    expect(result.participant.id).toBe(investor.id);
    expect(result.unreadCount).toBe(0);
    expect(result.lastMessage).toBeNull();
  });

  it("returns the existing conversation instead of creating a duplicate", async () => {
    await createOrGetConversation(owner, { participantId: investor.id }, { db: db as never });

    expect(db.conversation.create).not.toHaveBeenCalled();
    expect(state.conversations).toHaveLength(1);
  });

  it("accepts an offer relationship when there is no accepted connection", async () => {
    state.connections.clear();
    state.offers.add(pairKey(investor.id, owner.id));

    await expect(
      createOrGetConversation(owner, { participantId: investor.id }, { db: db as never }),
    ).resolves.toMatchObject({ id: "con_1" });
  });

  it("rejects self, missing/admin targets, blocked pairs and ineligible pairs", async () => {
    await expect(
      createOrGetConversation(owner, { participantId: owner.id }, { db: db as never }),
    ).rejects.toThrow(BusinessRuleError);
    await expect(
      createOrGetConversation(owner, { participantId: "missing" }, { db: db as never }),
    ).rejects.toThrow(NotFoundError);
    await expect(
      createOrGetConversation(owner, { participantId: admin.id }, { db: db as never }),
    ).rejects.toThrow(NotFoundError);

    // An owner and an investor may message directly; two owners need a connection.
    state.connections.clear();
    await expect(
      createOrGetConversation(owner, { participantId: investor.id }, { db: db as never }),
    ).resolves.toMatchObject({ id: expect.any(String) });
    await expect(
      createOrGetConversation(owner, { participantId: stranger.id }, { db: db as never }),
    ).rejects.toThrow(BusinessRuleError);

    state.connections.add(pairKey(owner.id, investor.id));
    state.blocks.add(pairKey(owner.id, investor.id));
    await expect(
      createOrGetConversation(owner, { participantId: investor.id }, { db: db as never }),
    ).rejects.toThrow(ForbiddenError);
  });

  it("rejects admins and malformed input", async () => {
    await expect(
      createOrGetConversation(admin, { participantId: investor.id }, { db: db as never }),
    ).rejects.toThrow(ForbiddenError);
    await expect(
      createOrGetConversation(owner, { participantId: "" }, { db: db as never }),
    ).rejects.toThrow(ZodError);
  });
});

describe("conversation reads", () => {
  it("returns only safe participant data, the latest message and unread counts", async () => {
    state.messages = [
      messageRow({ id: "msg_1", senderId: investor.id, createdAt: t1, updatedAt: t1 }),
      messageRow({
        id: "msg_2",
        senderId: investor.id,
        body: "Second",
        createdAt: t2,
        updatedAt: t2,
      }),
      messageRow({
        id: "msg_3",
        senderId: owner.id,
        body: "Mine",
        createdAt: t3,
        updatedAt: t3,
      }),
    ];
    state.messages[1].readAt = t2;

    const result = await getConversation(owner, "con_1", { db: db as never });

    expect(result.unreadCount).toBe(1);
    expect(result.lastMessage).toMatchObject({ id: "msg_3", mine: true });
    expect(result.participant).toMatchObject({ id: investor.id, role: "INVESTOR" });
    expect(JSON.stringify(result)).not.toContain("secret@example.com");
    expect(JSON.stringify(result)).not.toContain("+8801712345678");
  });

  it("denies non-participants and exposes no data for blocked pairs", async () => {
    state.connections.add(pairKey(stranger.id, owner.id));
    state.connections.add(pairKey(stranger.id, investor.id));
    await expect(getConversation(stranger, "con_1", { db: db as never })).rejects.toThrow(
      NotFoundError,
    );

    state.blocks.add(pairKey(owner.id, investor.id));
    await expect(getConversation(owner, "con_1", { db: db as never })).rejects.toThrow(
      ForbiddenError,
    );
  });

  it("lists only eligible, unblocked conversations with pagination", async () => {
    state.conversations.push(conversationRow({ id: "con_2", participantOneId: owner.id, participantTwoId: stranger.id, updatedAt: t2 }));
    state.connections.add(pairKey(owner.id, stranger.id));
    state.blocks.add(pairKey(owner.id, stranger.id));
    state.messages = [
      messageRow({ id: "msg_1", senderId: investor.id, createdAt: t1, updatedAt: t1 }),
    ];

    const first = await listConversations(owner, { limit: 1 }, { db: db as never });
    expect(first.items).toHaveLength(1);
    expect(first.items[0].unreadCount).toBe(1);
    expect(first.meta.hasMore).toBe(false);

    const all = await listConversations(owner, { limit: 20 }, { db: db as never });
    expect(all.items.map((item) => item.id)).toEqual(["con_1"]);
  });

  it("returns no conversations when no relationship is eligible", async () => {
    state.connections.clear();
    const result = await listConversations(owner, { limit: 20 }, { db: db as never });
    expect(result.items).toEqual([]);
    expect(result.meta.nextCursor).toBeNull();
  });
});

describe("listMessages", () => {
  beforeEach(() => {
    state.messages = [
      messageRow({ id: "msg_1", senderId: investor.id, createdAt: t1, updatedAt: t1 }),
      messageRow({ id: "msg_2", senderId: owner.id, body: "Second", createdAt: t2, updatedAt: t2 }),
      messageRow({ id: "msg_3", senderId: investor.id, body: "Third", createdAt: t3, updatedAt: t3 }),
    ];
  });

  it("returns an oldest-first page and supports opaque cursor pagination", async () => {
    const first = await listMessages(owner, "con_1", { limit: 2 }, { db: db as never });
    expect(first.items.map((item) => item.id)).toEqual(["msg_1", "msg_2"]);
    expect(first.meta.hasMore).toBe(true);
    expect(first.meta.nextCursor).toBeTruthy();

    const second = await listMessages(
      owner,
      "con_1",
      { limit: 2, cursor: first.meta.nextCursor ?? undefined },
      { db: db as never },
    );
    expect(second.items.map((item) => item.id)).toEqual(["msg_3"]);
    expect(second.meta.nextCursor).toBeNull();
  });

  it("supports polling with after=<messageId>", async () => {
    const result = await listMessages(
      owner,
      "con_1",
      { limit: 20, after: "msg_1" },
      { db: db as never },
    );
    expect(result.items.map((item) => item.id)).toEqual(["msg_2", "msg_3"]);
  });

  it("rejects conflicting or foreign anchors and non-members", async () => {
    await expect(
      listMessages(
        owner,
        "con_1",
        { limit: 20, after: "msg_1", cursor: "eyJpZCI6Im1zZ18xIn0" },
        { db: db as never },
      ),
    ).rejects.toThrow(ValidationError);

    state.messages[2].conversationId = "con_other";
    await expect(
      listMessages(owner, "con_1", { limit: 20, after: "msg_3" }, { db: db as never }),
    ).rejects.toThrow(NotFoundError);

    await expect(listMessages(stranger, "con_1", { limit: 20 }, { db: db as never })).rejects.toThrow(
      NotFoundError,
    );
  });

  it("hides messages deleted by the caller", async () => {
    state.deletions.push({ messageId: "msg_1", userId: owner.id });
    const result = await listMessages(owner, "con_1", { limit: 20 }, { db: db as never });
    expect(result.items.map((item) => item.id)).toEqual(["msg_2", "msg_3"]);
  });
});

describe("sendMessage", () => {
  it("uses the session sender, sanitizes the body and touches the conversation", async () => {
    const result = await sendMessage(
      owner,
      "con_1",
      { body: "  <b>Hello</b>  there\n\n\nfriend " } as never,
      { db: db as never },
    );

    expect(db.$transaction).toHaveBeenCalledTimes(1);
    expect(db.message.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: {
          conversationId: "con_1",
          senderId: owner.id,
          body: "Hello  there\n\nfriend",
        },
      }),
    );
    expect(db.conversation.update).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: "con_1" } }),
    );
    expect(result).toMatchObject({ senderId: owner.id, mine: true, body: "Hello  there\n\nfriend" });
  });

  it("rejects client sender ids, empty or oversized bodies", async () => {
    await expect(
      sendMessage(
        owner,
        "con_1",
        { body: "hello", senderId: stranger.id, conversationId: "con_other" } as never,
        { db: db as never },
      ),
    ).rejects.toThrow(ZodError);
    await expect(
      sendMessage(owner, "con_1", { body: "   " } as never, { db: db as never }),
    ).rejects.toThrow(ZodError);
    await expect(
      sendMessage(owner, "con_1", { body: "x".repeat(5001) } as never, { db: db as never }),
    ).rejects.toThrow(ZodError);
  });

  it("denies blocked, ineligible and non-member senders", async () => {
    state.blocks.add(pairKey(owner.id, investor.id));
    await expect(sendMessage(owner, "con_1", { body: "hi" }, { db: db as never })).rejects.toThrow(
      ForbiddenError,
    );

    // Owner and investor stay allowed without a connection once unblocked.
    state.blocks.clear();
    state.connections.clear();
    await expect(sendMessage(owner, "con_1", { body: "hi" }, { db: db as never })).resolves.toBeDefined();

    state.connections.add(pairKey(owner.id, investor.id));
    await expect(sendMessage(stranger, "con_1", { body: "hi" }, { db: db as never })).rejects.toThrow(
      NotFoundError,
    );
  });
});

describe("markConversationRead", () => {
  it("marks only incoming live unread messages and reports the remaining unread count", async () => {
    state.messages = [
      messageRow({ id: "msg_1", senderId: investor.id, createdAt: t1, updatedAt: t1 }),
      messageRow({ id: "msg_2", senderId: owner.id, createdAt: t2, updatedAt: t2 }),
      messageRow({ id: "msg_3", senderId: investor.id, readAt: t2, createdAt: t3, updatedAt: t3 }),
      messageRow({ id: "msg_4", senderId: investor.id, createdAt: t3, updatedAt: t3 }),
    ];
    state.deletions.push({ messageId: "msg_4", userId: owner.id });

    const result = await markConversationRead(owner, "con_1", { db: db as never });

    expect(result).toEqual({ conversationId: "con_1", markedRead: 1, unreadCount: 0 });
    expect(state.messages[0].readAt).toBeInstanceOf(Date);
    expect(state.messages[1].readAt).toBeNull();
    expect(state.messages[3].readAt).toBeNull();
  });

  it("validates conversation access", async () => {
    await expect(markConversationRead(stranger, "con_1", { db: db as never })).rejects.toThrow(
      NotFoundError,
    );
  });
});

describe("message detail and deletion", () => {
  beforeEach(() => {
    state.messages = [
      messageRow({ id: "msg_1", senderId: investor.id, createdAt: t1, updatedAt: t1 }),
    ];
  });

  it("returns detail only to participants", async () => {
    await expect(getMessage(owner, "msg_1", { db: db as never })).resolves.toMatchObject({
      id: "msg_1",
      mine: false,
    });
    await expect(getMessage(stranger, "msg_1", { db: db as never })).rejects.toThrow(NotFoundError);
  });

  it("soft-deletes only the caller's view and is idempotent", async () => {
    const first = await deleteMessage(owner, "msg_1", { db: db as never });
    const second = await deleteMessage(owner, "msg_1", { db: db as never });

    expect(first).toEqual({ id: "msg_1", deleted: true });
    expect(second).toEqual({ id: "msg_1", deleted: true });
    expect(state.deletions).toHaveLength(1);
    expect(state.messages[0].deletedAt).toBeNull();
    await expect(getMessage(owner, "msg_1", { db: db as never })).rejects.toThrow(NotFoundError);
    await expect(getMessage(investor, "msg_1", { db: db as never })).resolves.toMatchObject({
      mine: true,
    });
  });

  it("rejects deletion of another conversation's message", async () => {
    state.messages[0].conversationId = "con_other";
    await expect(deleteMessage(owner, "msg_1", { db: db as never })).rejects.toThrow(NotFoundError);
  });
});
