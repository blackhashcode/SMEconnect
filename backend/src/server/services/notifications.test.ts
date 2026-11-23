import { describe, expect, it, vi } from "vitest";
import { ZodError } from "zod";

vi.mock("@/server/db", () => ({ prisma: {} }));

import { NotFoundError } from "@/server/errors";
import {
  getUnreadNotificationCount,
  listNotifications,
  markAllNotificationsRead,
  markNotificationRead,
} from "@/server/services/notifications";
import { notificationRecordSchema } from "@/server/validators/notification";

const NOW = new Date("2026-11-23T18:00:00.000Z");
const actor = { id: "usr_me", role: "OWNER" as const };

type Row = Record<string, unknown>;

function notification(overrides: Row = {}): Row {
  return {
    id: "ntf_1",
    userId: actor.id,
    type: "OFFER_RECEIVED",
    title: "New offer",
    body: "An investor sent you an offer.",
    link: "/offers/off_1",
    data: { offerId: "off_1" },
    readAt: null,
    createdAt: NOW,
    updatedAt: NOW,
    ...overrides,
  };
}

function makeDb(initial: Row[] = []) {
  const rows = [...initial];
  const db = {
    notification: {
      findMany: vi.fn().mockImplementation(
        ({ where, take, cursor, skip }: Row) => {
          const filtered = rows.filter((row) => {
            if (where && typeof where === "object") {
              const filter = where as Row;
              if (filter.userId !== undefined && row.userId !== filter.userId) return false;
              if (filter.readAt === null && row.readAt !== null) return false;
            }
            return true;
          });
          const index = cursor ? filtered.findIndex((row) => row.id === (cursor as Row).id) : -1;
          const start = index >= 0 ? index + Number(skip ?? 1) : 0;
          return Promise.resolve(filtered.slice(start, start + Number(take ?? filtered.length)));
        },
      ),
      count: vi.fn().mockImplementation(({ where }: { where: Row }) => {
        const matching = rows.filter(
          (row) => row.userId === where.userId && row.readAt === where.readAt,
        );
        return Promise.resolve(matching.length);
      }),
      findFirst: vi.fn().mockImplementation(({ where }: { where: Row }) => {
        const row = rows.find(
          (item) => item.id === where.id && item.userId === where.userId,
        );
        return Promise.resolve(row ?? null);
      }),
      updateMany: vi.fn().mockImplementation(({ where, data }: { where: Row; data: Row }) => {
        let count = 0;
        for (const row of rows) {
          if (where.id !== undefined && row.id !== where.id) continue;
          if (where.userId !== undefined && row.userId !== where.userId) continue;
          if (where.readAt === null && row.readAt !== null) continue;
          Object.assign(row, data);
          count += 1;
        }
        return Promise.resolve({ count });
      }),
    },
  };
  return { db, rows };
}

const deps = (db: ReturnType<typeof makeDb>["db"]) => ({ db: db as never, now: () => NOW });

describe("listNotifications", () => {
  it("returns only the actor's notifications with safe records", async () => {
    const { db } = makeDb([
      notification(),
      notification({ id: "ntf_2", type: "NEW_LIKE", readAt: NOW }),
      notification({ id: "ntf_other", userId: "usr_other" }),
    ]);

    const page = await listNotifications(actor, { limit: 20 }, deps(db));

    expect(db.notification.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { userId: actor.id }, take: 21 }),
    );
    expect(page.items.map((item) => item.id)).toEqual(["ntf_1", "ntf_2"]);
    expect(page.items.every((item) => notificationRecordSchema.safeParse(item).success)).toBe(true);
    expect(page.meta).toMatchObject({ limit: 20, hasMore: false });
  });

  it("filters unread, paginates with a cursor and rejects malformed query", async () => {
    const { db } = makeDb([
      notification(),
      notification({ id: "ntf_2" }),
      notification({ id: "ntf_3", readAt: NOW }),
    ]);

    const page = await listNotifications(actor, { limit: 1, unread: "true" }, deps(db));
    expect(page.items).toHaveLength(1);
    expect(page.meta).toMatchObject({ hasMore: true });
    expect(db.notification.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { userId: actor.id, readAt: null } }),
    );

    const second = await listNotifications(
      actor,
      { limit: 1, unread: "true", cursor: page.meta.nextCursor! },
      deps(db),
    );
    expect(second.items.map((item) => item.id)).toEqual(["ntf_2"]);
    expect(second.meta.nextCursor).toBeNull();

    await expect(
      listNotifications(actor, { limit: 20, unread: "yes" }, deps(db)),
    ).rejects.toBeInstanceOf(ZodError);
  });
});

describe("notification read operations", () => {
  it("counts only unread notifications for the actor", async () => {
    const { db } = makeDb([
      notification(),
      notification({ id: "ntf_2", readAt: NOW }),
      notification({ id: "ntf_other", userId: "usr_other" }),
    ]);
    await expect(getUnreadNotificationCount(actor, deps(db))).resolves.toEqual({ unread: 1 });
  });

  it("marks one notification read and is idempotent", async () => {
    const { db, rows } = makeDb([notification()]);
    const result = await markNotificationRead(actor, "ntf_1", deps(db));
    expect(result).toEqual({ id: "ntf_1", read: true, readAt: NOW.toISOString() });
    expect(rows[0].readAt).toEqual(NOW);

    await expect(markNotificationRead(actor, "ntf_1", deps(db))).resolves.toEqual(result);
    expect(db.notification.updateMany).toHaveBeenCalledTimes(2);
  });

  it("cannot read or mark another user's notification", async () => {
    const { db, rows } = makeDb([notification({ userId: "usr_other" })]);
    await expect(markNotificationRead(actor, "ntf_1", deps(db))).rejects.toBeInstanceOf(
      NotFoundError,
    );
    expect(rows[0].readAt).toBeNull();

    await expect(markNotificationRead(actor, "missing", deps(db))).rejects.toBeInstanceOf(
      NotFoundError,
    );
  });

  it("marks all unread notifications for the actor in one update", async () => {
    const { db, rows } = makeDb([
      notification(),
      notification({ id: "ntf_2" }),
      notification({ id: "ntf_3", readAt: NOW }),
      notification({ id: "ntf_other", userId: "usr_other" }),
    ]);
    await expect(markAllNotificationsRead(actor, deps(db))).resolves.toEqual({ markedRead: 2 });
    expect(db.notification.updateMany).toHaveBeenCalledWith({
      where: { userId: actor.id, readAt: null },
      data: { readAt: NOW },
    });
    expect(rows.filter((row) => row.readAt === NOW)).toHaveLength(3);
  });
});
