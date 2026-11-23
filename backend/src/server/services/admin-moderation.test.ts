import { describe, expect, it, vi } from "vitest";
import { ZodError } from "zod";

vi.mock("@/server/db", () => ({ prisma: {} }));

import { ConflictError, ForbiddenError, NotFoundError } from "@/server/errors";
import {
  listAdminComments,
  listAdminPosts,
  removeAdminComment,
  removeAdminPost,
} from "@/server/services/admin-moderation";

const NOW = new Date("2026-11-23T18:00:00.000Z");
const admin = { id: "usr_admin", role: "ADMIN" as const };
const owner = { id: "usr_owner", role: "OWNER" as const };
const investor = { id: "usr_investor", role: "INVESTOR" as const };

type Row = Record<string, unknown>;

function postRow(overrides: Row = {}): Row {
  return {
    id: "post_1",
    authorId: owner.id,
    type: "UPDATE",
    content: "Shop update",
    imageUrls: [],
    deletedAt: null,
    createdAt: NOW,
    updatedAt: NOW,
    ...overrides,
  };
}

function commentRow(overrides: Row = {}): Row {
  return {
    id: "cmt_1",
    postId: "post_1",
    authorId: investor.id,
    content: "Nice shop",
    deletedAt: null,
    createdAt: NOW,
    updatedAt: NOW,
    ...overrides,
  };
}

function makeDb(posts: Row[] = [postRow()], comments: Row[] = [commentRow()]) {
  const postRows = posts.map((row) => ({ ...row }));
  const commentRows = comments.map((row) => ({ ...row }));

  const db = {
    post: {
      findMany: vi.fn().mockImplementation(({ where }: { where: Row }) =>
        Promise.resolve(
          postRows.filter((row) =>
            Object.entries(where).every(([key, value]) => row[key] === value),
          ),
        ),
      ),
      findFirst: vi.fn().mockImplementation(({ where }: { where: Row }) =>
        Promise.resolve(postRows.find((row) => row.id === where.id) ?? null),
      ),
      update: vi.fn().mockImplementation(
        ({ where, data }: { where: { id: string }; data: Row }) => {
          const row = postRows.find((item) => item.id === where.id);
          if (!row) throw new Error("Post missing");
          Object.assign(row, data);
          return Promise.resolve({ ...row });
        },
      ),
    },
    comment: {
      findMany: vi.fn().mockImplementation(({ where }: { where: Row }) =>
        Promise.resolve(
          commentRows.filter((row) =>
            Object.entries(where).every(([key, value]) => row[key] === value),
          ),
        ),
      ),
      findFirst: vi.fn().mockImplementation(({ where }: { where: Row }) =>
        Promise.resolve(commentRows.find((row) => row.id === where.id) ?? null),
      ),
      updateMany: vi.fn().mockImplementation(({ data }: { data: Row }) => {
        for (const row of commentRows) Object.assign(row, data);
        return Promise.resolve({ count: commentRows.length });
      }),
      update: vi.fn().mockImplementation(
        ({ where, data }: { where: { id: string }; data: Row }) => {
          const row = commentRows.find((item) => item.id === where.id);
          if (!row) throw new Error("Comment missing");
          Object.assign(row, data);
          return Promise.resolve({ ...row });
        },
      ),
    },
    $transaction: vi.fn().mockImplementation(
      (callback: (tx: unknown) => Promise<unknown>) => callback(db),
    ),
  };

  return { db, postRows, commentRows };
}

const deps = (fake: ReturnType<typeof makeDb>) => ({
  db: fake.db as never,
  now: () => NOW,
});

describe("admin content moderation access", () => {
  it("rejects owners and investors", async () => {
    const fake = makeDb();

    for (const actor of [owner, investor]) {
      await expect(listAdminPosts(actor, { limit: 20 }, deps(fake))).rejects.toBeInstanceOf(
        ForbiddenError,
      );
      await expect(
        listAdminComments(actor, { limit: 20 }, deps(fake)),
      ).rejects.toBeInstanceOf(ForbiddenError);
      await expect(removeAdminPost(actor, "post_1", deps(fake))).rejects.toBeInstanceOf(
        ForbiddenError,
      );
      await expect(
        removeAdminComment(actor, "cmt_1", deps(fake)),
      ).rejects.toBeInstanceOf(ForbiddenError);
    }
  });
});

describe("admin post moderation", () => {
  it("hides soft-deleted posts unless included and rejects invalid filters", async () => {
    const fake = makeDb([postRow(), postRow({ id: "post_2", deletedAt: NOW })]);

    const visible = await listAdminPosts(admin, { limit: 20 }, deps(fake));
    expect(visible.items).toHaveLength(1);
    expect(visible.items[0]).toMatchObject({
      id: "post_1",
      deletedAt: null,
      createdAt: NOW.toISOString(),
    });

    const all = await listAdminPosts(
      admin,
      { limit: 20, includeDeleted: "true" },
      deps(fake),
    );
    expect(all.items).toHaveLength(2);
    expect(all.items[1].deletedAt).toBe(NOW.toISOString());

    await expect(
      listAdminPosts(admin, { limit: 20, includeDeleted: "yes" }, deps(fake)),
    ).rejects.toBeInstanceOf(ZodError);
  });

  it("soft-deletes a post and its comments in one transaction", async () => {
    const fake = makeDb();

    await expect(removeAdminPost(admin, "post_1", deps(fake))).resolves.toEqual({
      id: "post_1",
      deleted: true,
    });

    expect(fake.db.$transaction).toHaveBeenCalledTimes(1);
    expect(fake.postRows[0].deletedAt).toEqual(NOW);
    expect(fake.commentRows[0].deletedAt).toEqual(NOW);
    expect(fake.postRows[0]).toHaveProperty("content", "Shop update");
  });

  it("rejects missing or already removed posts", async () => {
    const missing = makeDb();
    await expect(
      removeAdminPost(admin, "post_missing", deps(missing)),
    ).rejects.toBeInstanceOf(NotFoundError);

    const removed = makeDb([postRow({ deletedAt: NOW })]);
    await expect(removeAdminPost(admin, "post_1", deps(removed))).rejects.toBeInstanceOf(
      ConflictError,
    );
  });
});

describe("admin comment moderation", () => {
  it("filters by post, includes deleted comments and rejects invalid IDs", async () => {
    const fake = makeDb([postRow()], [
      commentRow(),
      commentRow({ id: "cmt_2", postId: "post_2", deletedAt: NOW }),
    ]);

    const byPost = await listAdminComments(admin, { limit: 20, postId: "post_1" }, deps(fake));
    expect(byPost.items).toHaveLength(1);

    const all = await listAdminComments(
      admin,
      { limit: 20, includeDeleted: "true" },
      deps(fake),
    );
    expect(all.items).toHaveLength(2);
    expect(all.items[1].deletedAt).toBe(NOW.toISOString());
  });

  it("soft-deletes one comment and preserves its row", async () => {
    const fake = makeDb();

    await expect(removeAdminComment(admin, "cmt_1", deps(fake))).resolves.toEqual({
      id: "cmt_1",
      deleted: true,
    });
    expect(fake.commentRows[0].deletedAt).toEqual(NOW);
    expect(fake.commentRows[0].content).toBe("Nice shop");
    expect(fake.db.$transaction).not.toHaveBeenCalled();
  });

  it("rejects missing or already removed comments", async () => {
    const missing = makeDb();
    await expect(
      removeAdminComment(admin, "cmt_missing", deps(missing)),
    ).rejects.toBeInstanceOf(NotFoundError);

    const removed = makeDb([postRow()], [commentRow({ deletedAt: NOW })]);
    await expect(
      removeAdminComment(admin, "cmt_1", deps(removed)),
    ).rejects.toBeInstanceOf(ConflictError);
  });
});
