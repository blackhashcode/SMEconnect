import { beforeEach, describe, expect, it, vi } from "vitest";
import { ZodError } from "zod";

vi.mock("@/server/db", () => ({ prisma: {} }));

import { encodeCursor } from "@/lib/pagination";
import {
  ConflictError,
  ForbiddenError,
  NotFoundError,
  ValidationError,
} from "@/server/errors";

import {
  createComment,
  createPost,
  deleteComment,
  deletePost,
  getPost,
  likePost,
  listComments,
  listFeed,
  listPosts,
  unlikePost,
  updateComment,
  updatePost,
} from "@/server/services/post";

type Row = Record<string, unknown>;
const owner = { id: "usr_owner", role: "OWNER" as const };
const investor = { id: "usr_investor", role: "INVESTOR" as const };
const other = { id: "usr_other", role: "OWNER" as const };
const admin = { id: "usr_admin", role: "ADMIN" as const };

const author = {
  id: "usr_owner",
  name: "Nusrat Akter",
  image: null,
  role: "OWNER",
  status: "ACTIVE",
  email: "private@example.com",
  phone: "+8801712345678",
  businessProfile: {
    shopName: "Nusrat's Kitchen",
    slug: "nusrat-kitchen",
    category: "Food",
    district: "Dhaka",
    city: "Dhanmondi",
    logoUrl: null,
    trustScore: 80,
    description: "Home kitchen",
  },
  investorProfile: null,
};

function postRow(overrides: Row = {}): Row {
  return {
    id: "post_1",
    authorId: owner.id,
    type: "UPDATE",
    content: "Fresh cookies today!",
    imageUrls: [],
    deletedAt: null,
    createdAt: new Date("2026-11-23T10:00:00.000Z"),
    updatedAt: new Date("2026-11-23T10:00:00.000Z"),
    author,
    likes: [],
    comments: [],
    loanRequest: null,
    ...overrides,
  };
}

function commentRow(overrides: Row = {}): Row {
  return {
    id: "cmt_1",
    postId: "post_1",
    authorId: owner.id,
    content: "Thank you!",
    deletedAt: null,
    createdAt: new Date("2026-11-23T11:00:00.000Z"),
    updatedAt: new Date("2026-11-23T11:00:00.000Z"),
    author,
    ...overrides,
  };
}

interface FakeDb {
  post: {
    create: ReturnType<typeof vi.fn>;
    findFirst: ReturnType<typeof vi.fn>;
    findMany: ReturnType<typeof vi.fn>;
    update: ReturnType<typeof vi.fn>;
  };
  comment: {
    create: ReturnType<typeof vi.fn>;
    findFirst: ReturnType<typeof vi.fn>;
    findUnique: ReturnType<typeof vi.fn>;
    findMany: ReturnType<typeof vi.fn>;
    update: ReturnType<typeof vi.fn>;
    updateMany: ReturnType<typeof vi.fn>;
  };
  like: {
    findUnique: ReturnType<typeof vi.fn>;
    create: ReturnType<typeof vi.fn>;
    deleteMany: ReturnType<typeof vi.fn>;
    count: ReturnType<typeof vi.fn>;
  };
  userVerification: { findMany: ReturnType<typeof vi.fn> };
  follow: { findMany: ReturnType<typeof vi.fn> };
  connection: { findMany: ReturnType<typeof vi.fn> };
  $transaction: ReturnType<typeof vi.fn>;
}

function makeDb(): FakeDb {
  return {
    post: {
      create: vi.fn().mockResolvedValue({ id: "post_1" }),
      findFirst: vi.fn().mockResolvedValue(postRow()),
      findMany: vi.fn().mockResolvedValue([]),
      update: vi.fn().mockResolvedValue({}),
    },
    comment: {
      create: vi.fn().mockResolvedValue({ id: "cmt_1" }),
      findFirst: vi.fn().mockResolvedValue(commentRow()),
      findUnique: vi.fn().mockResolvedValue(commentRow()),
      findMany: vi.fn().mockResolvedValue([]),
      update: vi.fn().mockResolvedValue({}),
      updateMany: vi.fn().mockResolvedValue({ count: 1 }),
    },
    like: {
      findUnique: vi.fn().mockResolvedValue(null),
      create: vi.fn().mockResolvedValue({}),
      deleteMany: vi.fn().mockResolvedValue({ count: 1 }),
      count: vi.fn().mockResolvedValue(1),
    },
    userVerification: {
      findMany: vi.fn().mockResolvedValue([{ userId: owner.id }]),
    },
    follow: { findMany: vi.fn().mockResolvedValue([]) },
    connection: { findMany: vi.fn().mockResolvedValue([]) },
    $transaction: vi.fn().mockImplementation(async (cb: (tx: FakeDb) => Promise<unknown>) => cb(db)),
  } as unknown as FakeDb;
}

let db: FakeDb;
beforeEach(() => {
  db = makeDb();
});

describe("post validators via services", () => {
  it("rejects system-only post types and trusts the session author id", async () => {
    await expect(
      createPost(owner, { type: "UPDATE", content: "hello" } as never, { db: db as never }),
    ).resolves.toMatchObject({ author: { name: "Nusrat Akter" } });
    expect(db.post.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ authorId: owner.id, type: "UPDATE" }),
      }),
    );

    await expect(
      createPost(
        owner,
        { type: "LOAN_REQUEST", content: "not allowed" } as never,
        { db: db as never },
      ),
    ).rejects.toThrow(ZodError);
  });

  it("rejects admins and requires at least one field on update", async () => {
    await expect(
      createPost(admin, { type: "UPDATE", content: "hi" } as never, { db: db as never }),
    ).rejects.toThrow(ForbiddenError);
    await expect(
      updatePost(owner, "post_1", {} as never, { db: db as never }),
    ).rejects.toThrow(ZodError);
  });
});

describe("post ownership and soft deletion", () => {
  it("only lets the author edit or delete a user post", async () => {
    await expect(
      updatePost(other, "post_1", { content: "changed" }, { db: db as never }),
    ).rejects.toThrow(ForbiddenError);
    await expect(deletePost(other, "post_1", { db: db as never })).rejects.toThrow(
      ForbiddenError,
    );
    await expect(
      updatePost(owner, "post_1", { content: "changed" }, { db: db as never }),
    ).resolves.toMatchObject({ content: "Fresh cookies today!" });
  });

  it("refuses to edit or delete system-generated posts", async () => {
    db.post.findFirst.mockResolvedValue(postRow({ type: "LOAN_REQUEST" }));
    await expect(
      updatePost(owner, "post_1", { content: "hack" }, { db: db as never }),
    ).rejects.toThrow(ForbiddenError);
    await expect(deletePost(owner, "post_1", { db: db as never })).rejects.toThrow(
      ForbiddenError,
    );
  });

  it("soft-deletes the post and all of its live comments in one transaction", async () => {
    await expect(deletePost(owner, "post_1", { db: db as never })).resolves.toEqual({
      id: "post_1",
      deleted: true,
    });
    expect(db.comment.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { postId: "post_1", deletedAt: null } }),
    );
    expect(db.post.update).toHaveBeenCalledWith(
      expect.objectContaining({ data: { deletedAt: expect.any(Date) } }),
    );
    expect(db.$transaction).toHaveBeenCalledTimes(1);
  });

  it("hides soft-deleted posts from detail lookups", async () => {
    db.post.findFirst.mockResolvedValue(null);
    await expect(getPost("post_1", undefined, { db: db as never })).rejects.toThrow(
      NotFoundError,
    );
  });
});

describe("likes and comments", () => {
  it("prevents duplicate likes and reports a stale unlike", async () => {
    db.like.findUnique.mockResolvedValue({ id: "like_1" });
    await expect(likePost(investor, "post_1", { db: db as never })).rejects.toThrow(
      ConflictError,
    );
    db.like.findUnique.mockResolvedValue(null);
    await expect(likePost(investor, "post_1", { db: db as never })).resolves.toEqual({
      postId: "post_1",
      liked: true,
      likeCount: 1,
    });
    db.like.deleteMany.mockResolvedValue({ count: 0 });
    await expect(unlikePost(investor, "post_1", { db: db as never })).rejects.toThrow(
      NotFoundError,
    );
  });

  it("enforces comment ownership and soft-deletes comments", async () => {
    await expect(
      updateComment(other, "post_1", "cmt_1", { content: "mine now" }, { db: db as never }),
    ).rejects.toThrow(ForbiddenError);
    await expect(deleteComment(other, "post_1", "cmt_1", { db: db as never })).rejects.toThrow(
      ForbiddenError,
    );
    await expect(deleteComment(owner, "post_1", "cmt_1", { db: db as never })).resolves.toEqual({
      id: "cmt_1",
      deleted: true,
    });
    expect(db.comment.update).toHaveBeenCalledWith(
      expect.objectContaining({ data: { deletedAt: expect.any(Date) } }),
    );
  });

  it("creates comments with the session author and excludes deleted ones from lists", async () => {
    await expect(
      createComment(investor, "post_1", { content: "Great!" }, { db: db as never }),
    ).resolves.toMatchObject({ postId: "post_1", content: "Thank you!" });
    expect(db.comment.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ authorId: investor.id, postId: "post_1" }),
      }),
    );

    await listComments("post_1", { limit: 20 }, { db: db as never });
    expect(db.comment.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { postId: "post_1", deletedAt: null } }),
    );
  });
});

describe("pagination and public data protection", () => {
  it("uses limit+1, returns a cursor only when more rows exist and never leaks private fields", async () => {
    const rows = [postRow(), postRow({ id: "post_2" }), postRow({ id: "post_3" })];
    db.post.findMany.mockResolvedValue(rows);
    const page = await listPosts({ limit: 2 }, undefined, { db: db as never });
    expect(page.items).toHaveLength(2);
    expect(page.meta).toEqual({
      limit: 2,
      nextCursor: encodeCursor({ id: "post_2" }),
      hasMore: true,
    });
    expect(db.post.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ take: 3, where: { deletedAt: null } }),
    );
    expect(page.items[0].author).not.toHaveProperty("email");
    expect(page.items[0].author).not.toHaveProperty("phone");
    expect(page.items[0].author).not.toHaveProperty("id");
  });

  it("rejects malformed cursors", async () => {
    await expect(
      listPosts({ limit: 20, cursor: encodeCursor({ wrong: "x" }) }, undefined, {
        db: db as never,
      }),
    ).rejects.toThrow(ValidationError);
  });

  it("builds the feed from own posts, follows, connections and OPEN requests", async () => {
    db.follow.findMany.mockResolvedValue([{ followeeId: "usr_investor" }]);
    db.connection.findMany.mockResolvedValue([
      { requesterId: owner.id, addresseeId: other.id },
    ]);
    db.post.findMany.mockResolvedValue([postRow()]);

    await listFeed(owner, { limit: 20 }, { db: db as never });
    expect(db.post.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          OR: [
            { authorId: { in: expect.arrayContaining([owner.id, investor.id, other.id]) } },
            { loanRequest: { status: "OPEN" } },
          ],
        }),
      }),
    );
  });

  it("marks posts liked by the acting user only", async () => {
    db.post.findFirst.mockResolvedValue(
      postRow({ likes: [{ userId: investor.id }] }),
    );
    await expect(getPost("post_1", investor, { db: db as never })).resolves.toMatchObject({
      likedByMe: true,
      likeCount: 1,
    });
    await expect(getPost("post_1", undefined, { db: db as never })).resolves.toMatchObject({
      likedByMe: false,
    });
  });
});
