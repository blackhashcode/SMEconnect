import { describe, expect, it, vi } from "vitest";
import { ZodError } from "zod";

vi.mock("@/server/db", () => ({ prisma: {} }));

import {
  ConflictError,
  ForbiddenError,
  NotFoundError,
} from "@/server/errors";
import { encodeCursor } from "@/lib/pagination";
import {
  blockUser,
  isBlockedBetween,
  listBlocks,
  unblockUser,
} from "@/server/services/blocks";
import { blockedUserSchema } from "@/server/validators/block";

const NOW = new Date("2026-11-23T18:00:00.000Z");
const actor = { id: "usr_me", role: "OWNER" as const };
const target = { id: "usr_target", role: "INVESTOR" as const };
const admin = { id: "usr_admin", role: "ADMIN" as const };

type Row = Record<string, unknown>;

function publicUser(id: string, role: "OWNER" | "INVESTOR" | "ADMIN" = "INVESTOR"): Row {
  return {
    id,
    name: `User ${id}`,
    image: null,
    role,
    status: "ACTIVE",
    businessProfile: null,
    investorProfile: {
      bio: "Investor",
      minLendBdt: 10_000,
      maxLendBdt: 100_000,
      preferredCategories: ["Food"],
      district: "Dhaka",
      city: null,
      trustScore: 70,
    },
  };
}

function blockRow(overrides: Row = {}): Row {
  return {
    id: "blk_1",
    blockerId: actor.id,
    blockedId: target.id,
    createdAt: NOW,
    updatedAt: NOW,
    blocked: publicUser(target.id),
    ...overrides,
  };
}

function makeDb(initial: Row[] = []) {
  const rows = [...initial];
  let sequence = rows.length;
  const db = {
    user: {
      findUnique: vi.fn().mockResolvedValue(publicUser(target.id)),
    },
    block: {
      findFirst: vi.fn().mockImplementation(({ where }: { where: Row }) => {
        const matches = (row: Row, filter: Row) =>
          Object.entries(filter).every(([key, value]) => row[key] === value);
        const orFilters = where.OR as Row[] | undefined;
        return Promise.resolve(
          rows.find((row) =>
            orFilters
              ? orFilters.some((rule) => matches(row, rule))
              : matches(row, where),
          ) ?? null,
        );
      }),
      findUnique: vi.fn().mockImplementation(({ where }: { where: Row }) =>
        Promise.resolve(rows.find((row) => row.id === where.id) ?? null),
      ),
      findMany: vi.fn().mockImplementation(
        ({ where, take, cursor, skip, orderBy }: Row) => {
          const filtered = rows.filter(
            (row) => !where || row.blockerId === (where as Row).blockerId,
          );
          const ordered = orderBy ? [...filtered] : filtered;
          const index = cursor ? ordered.findIndex((row) => row.id === (cursor as Row).id) : -1;
          const start = index >= 0 ? index + Number(skip ?? 1) : 0;
          return Promise.resolve(ordered.slice(start, start + Number(take ?? ordered.length)));
        },
      ),
      create: vi.fn().mockImplementation(({ data }: { data: Row }) => {
        const row = blockRow({ id: `blk_${++sequence}`, ...data });
        rows.push(row);
        return Promise.resolve(row);
      }),
      deleteMany: vi.fn().mockImplementation(({ where }: { where: Row }) => {
        const before = rows.length;
        for (let index = rows.length - 1; index >= 0; index -= 1) {
          if (
            rows[index].blockerId === where.blockerId &&
            rows[index].blockedId === where.blockedId
          ) {
            rows.splice(index, 1);
          }
        }
        return Promise.resolve({ count: before - rows.length });
      }),
    },
    follow: { deleteMany: vi.fn().mockResolvedValue({ count: 0 }) },
    connection: { deleteMany: vi.fn().mockResolvedValue({ count: 0 }) },
    userVerification: {
      findMany: vi.fn().mockResolvedValue([{ userId: target.id }]),
    },
    $transaction: vi.fn().mockImplementation((cb: (tx: unknown) => Promise<unknown>) => cb(db)),
  };
  return { db, rows };
}

const deps = (db: ReturnType<typeof makeDb>["db"]) => ({ db: db as never, now: () => NOW });

describe("blockUser", () => {
  it("blocks a target, severs follows/connections and returns a safe card", async () => {
    const { db } = makeDb();
    const result = await blockUser(actor, { userId: target.id }, deps(db));

    expect(db.block.create).toHaveBeenCalledWith({
      data: { blockerId: actor.id, blockedId: target.id },
    });
    expect(db.follow.deleteMany).toHaveBeenCalledWith({
      where: {
        OR: [
          { followerId: actor.id, followeeId: target.id },
          { followerId: target.id, followeeId: actor.id },
        ],
      },
    });
    expect(db.connection.deleteMany).toHaveBeenCalledWith({
      where: {
        OR: [
          { requesterId: actor.id, addresseeId: target.id },
          { requesterId: target.id, addresseeId: actor.id },
        ],
      },
    });
    expect(blockedUserSchema.safeParse(result).success).toBe(true);
    expect(result).toMatchObject({ userId: target.id, blockedAt: NOW.toISOString() });
    expect(JSON.stringify(result)).not.toContain("email");
  });

  it("rejects self-blocks, duplicates, admins and missing targets", async () => {
    const { db } = makeDb();
    await expect(blockUser(actor, { userId: actor.id }, deps(db))).rejects.toBeInstanceOf(
      ConflictError,
    );

    db.user.findUnique.mockResolvedValueOnce(publicUser(admin.id, "ADMIN"));
    await expect(blockUser(actor, { userId: admin.id }, deps(db))).rejects.toBeInstanceOf(
      NotFoundError,
    );

    db.user.findUnique.mockResolvedValueOnce(null);
    await expect(blockUser(actor, { userId: "missing" }, deps(db))).rejects.toBeInstanceOf(
      NotFoundError,
    );

    const duplicate = makeDb([blockRow()]);
    await expect(
      blockUser(actor, { userId: target.id }, deps(duplicate.db)),
    ).rejects.toBeInstanceOf(ConflictError);
  });

  it("denies admins and validates ids", async () => {
    const { db } = makeDb();
    await expect(blockUser(admin, { userId: target.id }, deps(db))).rejects.toBeInstanceOf(
      ForbiddenError,
    );
    await expect(blockUser(actor, { userId: "" }, deps(db))).rejects.toBeInstanceOf(ZodError);
  });

  it("detects blocks in either direction", async () => {
    const { db, rows } = makeDb([blockRow({ blockerId: target.id, blockedId: actor.id })]);
    await expect(isBlockedBetween(actor.id, target.id, db as never)).resolves.toBe(true);
    await expect(isBlockedBetween(target.id, actor.id, db as never)).resolves.toBe(true);
    rows.length = 0;
    await expect(isBlockedBetween(actor.id, target.id, db as never)).resolves.toBe(false);
  });
});

describe("block reads and unblock", () => {
  it("lists only the actor's blocks with pagination", async () => {
    const { db } = makeDb([
      blockRow(),
      blockRow({ id: "blk_2", blockedId: "usr_other" }),
      blockRow({ id: "blk_3", blockedId: "usr_third" }),
    ]);

    const page = await listBlocks(actor, { limit: 2 }, deps(db));
    expect(page.items).toHaveLength(2);
    expect(page.meta).toMatchObject({ limit: 2, hasMore: true });
    expect(page.meta.nextCursor).toBe(encodeCursor({ id: "blk_2" }));
    expect(db.block.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { blockerId: actor.id }, take: 3 }),
    );

    const next = await listBlocks(
      actor,
      { limit: 2, cursor: page.meta.nextCursor! },
      deps(db),
    );
    expect(next.items.map((item) => item.userId)).toEqual(["usr_third"]);
  });

  it("removes only the actor's own block and reports missing blocks", async () => {
    const { db, rows } = makeDb([blockRow()]);
    await expect(unblockUser(actor, target.id, deps(db))).resolves.toEqual({
      userId: target.id,
      blocked: false,
    });
    expect(rows).toHaveLength(0);

    await expect(unblockUser(actor, target.id, deps(db))).rejects.toBeInstanceOf(NotFoundError);

    const other = makeDb([blockRow({ blockerId: "usr_other" })]);
    await expect(
      unblockUser(actor, target.id, deps(other.db)),
    ).rejects.toBeInstanceOf(NotFoundError);
    expect(other.rows).toHaveLength(1);
  });
});
