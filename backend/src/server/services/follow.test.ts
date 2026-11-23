import { beforeEach, describe, expect, it, vi } from "vitest";
import { ZodError } from "zod";

vi.mock("@/server/db", () => ({ prisma: {} }));

import { encodeCursor } from "@/lib/pagination";
import {
  BusinessRuleError,
  ConflictError,
  ForbiddenError,
  NotFoundError,
} from "@/server/errors";
import {
  followUser,
  listFollowers,
  listFollowing,
  unfollowUser,
} from "@/server/services/follow";

type Row = Record<string, unknown>;
const actor = { id: "usr_actor", role: "OWNER" as const };
const target = { id: "usr_target", role: "INVESTOR" as const };
const admin = { id: "usr_admin", role: "ADMIN" as const };

const publicUser = (id: string, role: "OWNER" | "INVESTOR"): Row => ({
  id,
  name: `User ${id}`,
  image: null,
  role,
  status: "ACTIVE",
  email: "secret@example.com",
  phone: "+8801712345678",
  businessProfile: null,
  investorProfile: null,
});

function followRow(overrides: Row = {}): Row {
  return {
    id: "fol_1",
    followerId: actor.id,
    followeeId: target.id,
    createdAt: new Date("2026-11-23T10:00:00.000Z"),
    follower: publicUser(actor.id, "OWNER"),
    followee: publicUser(target.id, "INVESTOR"),
    ...overrides,
  };
}

interface FakeDb {
  user: { findUnique: ReturnType<typeof vi.fn> };
  follow: {
    findUnique: ReturnType<typeof vi.fn>;
    findMany: ReturnType<typeof vi.fn>;
    create: ReturnType<typeof vi.fn>;
    delete: ReturnType<typeof vi.fn>;
  };
  userVerification: { findMany: ReturnType<typeof vi.fn> };
}

function makeDb(): FakeDb {
  return {
    user: { findUnique: vi.fn().mockResolvedValue(publicUser(target.id, "INVESTOR")) },
    follow: {
      findUnique: vi.fn().mockResolvedValue(null),
      findMany: vi.fn().mockResolvedValue([]),
      create: vi.fn().mockResolvedValue({ id: "fol_1" }),
      delete: vi.fn().mockResolvedValue({}),
    },
    userVerification: { findMany: vi.fn().mockResolvedValue([{ userId: target.id }]) },
  };
}

let db: FakeDb;
beforeEach(() => {
  db = makeDb();
  db.follow.findUnique.mockImplementation(({ where }: { where: Row }) =>
    Promise.resolve(where.id ? followRow() : null),
  );
  db.user.findUnique.mockImplementation(({ where }: { where: Row }) =>
    Promise.resolve(publicUser(String(where.id), where.id === target.id ? "INVESTOR" : "OWNER")),
  );
});

describe("followUser", () => {
  it("follows a valid target using the session id as follower", async () => {
    await expect(
      followUser(actor, { followeeId: target.id }, { db: db as never }),
    ).resolves.toMatchObject({ userId: target.id, following: true });
    expect(db.follow.create).toHaveBeenCalledWith(
      expect.objectContaining({ data: { followerId: actor.id, followeeId: target.id } }),
    );
  });

  it("blocks self-follows, missing/inactive/admin targets and duplicates", async () => {
    await expect(
      followUser(actor, { followeeId: actor.id }, { db: db as never }),
    ).rejects.toThrow(BusinessRuleError);
    db.user.findUnique.mockResolvedValue(null);
    await expect(
      followUser(actor, { followeeId: "missing" }, { db: db as never }),
    ).rejects.toThrow(NotFoundError);
    db.user.findUnique.mockResolvedValue({ ...publicUser("usr_admin", "OWNER"), role: "ADMIN" });
    await expect(
      followUser(actor, { followeeId: "usr_admin" }, { db: db as never }),
    ).rejects.toThrow(NotFoundError);
    db.user.findUnique.mockResolvedValue(publicUser(target.id, "INVESTOR"));
    db.follow.findUnique.mockResolvedValue({ id: "fol_existing" });
    await expect(
      followUser(actor, { followeeId: target.id }, { db: db as never }),
    ).rejects.toThrow(ConflictError);
  });

  it("rejects admins and invalid ids", async () => {
    await expect(
      followUser(admin, { followeeId: target.id }, { db: db as never }),
    ).rejects.toThrow(ForbiddenError);
    await expect(followUser(actor, { followeeId: "" }, { db: db as never })).rejects.toThrow(
      ZodError,
    );
  });

  it("never returns private user fields", async () => {
    const result = await followUser(actor, { followeeId: target.id }, { db: db as never });
    expect(result.user).not.toHaveProperty("email");
    expect(result.user).not.toHaveProperty("phone");
    expect(result.user).not.toHaveProperty("id");
  });
});

describe("unfollowUser", () => {
  it("deletes only the actor's own follow", async () => {
    db.follow.findUnique.mockResolvedValue({ id: "fol_1" });
    await expect(unfollowUser(actor, target.id, { db: db as never })).resolves.toEqual({
      userId: target.id,
      following: false,
    });
    expect(db.follow.delete).toHaveBeenCalledWith({ where: { id: "fol_1" } });
    expect(db.follow.findUnique).toHaveBeenCalledWith({
      where: {
        followerId_followeeId: { followerId: actor.id, followeeId: target.id },
      },
      select: { id: true },
    });
  });

  it("returns not found when there is nothing to unfollow", async () => {
    db.follow.findUnique.mockResolvedValue(null);
    await expect(unfollowUser(actor, target.id, { db: db as never })).rejects.toThrow(
      NotFoundError,
    );
  });
});

describe("follower/following lists", () => {
  it("queries the correct side with cursor pagination", async () => {
    db.follow.findMany.mockResolvedValue([followRow(), followRow({ id: "fol_2" })]);
    const followers = await listFollowers(actor, { limit: 1 }, { db: db as never });
    expect(followers.meta.nextCursor).toBe(encodeCursor({ id: "fol_1" }));
    expect(db.follow.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { followeeId: actor.id }, take: 2 }),
    );

    await listFollowing(actor, { limit: 20 }, { db: db as never });
    expect(db.follow.findMany).toHaveBeenLastCalledWith(
      expect.objectContaining({ where: { followerId: actor.id } }),
    );
  });

  it("rejects admins", async () => {
    await expect(listFollowers(admin, { limit: 20 }, { db: db as never })).rejects.toThrow(
      ForbiddenError,
    );
  });
});
