import type { PaginationParams } from "@/lib/pagination";
import { assertRole, type Actor } from "@/server/auth/policy";
import { prisma } from "@/server/db";
import {
  ConflictError,
  ForbiddenError,
  NotFoundError,
} from "@/server/errors";
import {
  createPostSchema,
  updatePostSchema,
  createCommentSchema,
  updateCommentSchema,
} from "@/server/validators/social";
import type { z } from "zod";
import {
  PUBLIC_USER_SELECT,
  cursorId,
  isUniqueViolation,
  pageMeta,
  toPostAuthor,
  verifiedUserIds,
  type PublicUserRow,
} from "@/server/services/social-shared";

type Db = typeof prisma;
type CreateInput = z.infer<typeof createPostSchema>;
type UpdateInput = z.infer<typeof updatePostSchema>;
type CommentInput = z.infer<typeof createCommentSchema>;
type CommentUpdateInput = z.infer<typeof updateCommentSchema>;
type PostType = "UPDATE" | "MILESTONE" | "LOAN_REQUEST" | "REPAYMENT";

interface ServiceDeps {
  db?: Db;
}

interface PostRow {
  id: string;
  authorId: string;
  type: PostType;
  content: string;
  imageUrls: string[];
  deletedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
  author: PublicUserRow;
  likes: Array<{ userId: string }>;
  comments: Array<{ id: string }>;
  loanRequest: {
    id: string;
    amountBdt: number;
    tenureDays: number;
    proposedRatePct: unknown;
    status: string;
  } | null;
}

interface CommentRow {
  id: string;
  postId: string;
  authorId: string;
  content: string;
  deletedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
  author: PublicUserRow;
}

const USER_POST_TYPES: readonly PostType[] = ["UPDATE", "MILESTONE"];

function postInclude() {
  return {
    author: { select: PUBLIC_USER_SELECT },
    likes: { select: { userId: true } },
    comments: { where: { deletedAt: null }, select: { id: true } },
    loanRequest: {
      select: {
        id: true,
        amountBdt: true,
        tenureDays: true,
        proposedRatePct: true,
        status: true,
      },
    },
  };
}

function commentInclude() {
  return { author: { select: PUBLIC_USER_SELECT } };
}

async function loadPost(id: string, db: Db): Promise<PostRow> {
  const row = await db.post.findFirst({
    where: { id, deletedAt: null },
    include: postInclude(),
  });
  if (!row) throw new NotFoundError("Post not found");
  return row as unknown as PostRow;
}

async function toPostRecord(row: PostRow, actor: Actor | undefined, db: Db) {
  const verified = await verifiedUserIds([row.author.id], db);
  const request = row.loanRequest?.status === "OPEN" ? row.loanRequest : null;
  return {
    id: row.id,
    type: row.type,
    content: row.content,
    imageUrls: row.imageUrls ?? [],
    authorId: row.author.id,
    author: toPostAuthor(row.author, verified.has(row.author.id)),
    likeCount: row.likes.length,
    commentCount: row.comments.length,
    likedByMe: actor ? row.likes.some((like) => like.userId === actor.id) : false,
    loanRequest: request
      ? {
          id: request.id,
          amountBdt: request.amountBdt,
          tenureDays: request.tenureDays,
          proposedRatePct: String(request.proposedRatePct),
        }
      : null,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

async function toCommentRecord(row: CommentRow, db: Db) {
  const verified = await verifiedUserIds([row.author.id], db);
  return {
    id: row.id,
    postId: row.postId,
    content: row.content,
    authorId: row.author.id,
    author: toPostAuthor(row.author, verified.has(row.author.id)),
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

export async function createPost(
  actor: Actor,
  input: CreateInput,
  deps: ServiceDeps = {},
) {
  assertRole(actor, "OWNER", "INVESTOR");
  const parsed = createPostSchema.parse(input);
  const db = deps.db ?? prisma;

  const created = await db.post.create({
    data: {
      authorId: actor.id,
      type: parsed.type,
      content: parsed.content,
      imageUrls: parsed.imageUrls,
    },
  });
  const row = await loadPost(created.id, db);
  return toPostRecord(row, actor, db);
}

/** Public recent posts; anonymous callers simply see `likedByMe: false`. */
export async function listPosts(
  query: PaginationParams & { type?: PostType; authorId?: string },
  actor: Actor | undefined,
  deps: ServiceDeps = {},
) {
  const db = deps.db ?? prisma;
  const cursor = cursorId(query.cursor);
  const records = await db.post.findMany({
    where: {
      deletedAt: null,
      ...(query.type ? { type: query.type } : {}),
      ...(query.authorId ? { authorId: query.authorId } : {}),
    },
    orderBy: [{ createdAt: "desc" }, { id: "desc" }],
    take: query.limit + 1,
    ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
    include: postInclude(),
  });

  const page = pageMeta(records as unknown as PostRow[], query.limit);
  const items = [];
  for (const row of page.items) items.push(await toPostRecord(row, actor, db));
  return { items, meta: page.meta };
}

/** Personalized feed: own posts, followed authors, accepted connections and OPEN requests. */
export async function listFeed(
  actor: Actor,
  query: PaginationParams & { type?: PostType },
  deps: ServiceDeps = {},
) {
  assertRole(actor, "OWNER", "INVESTOR", "ADMIN");
  const db = deps.db ?? prisma;
  const cursor = cursorId(query.cursor);

  // Admins review the whole platform, newest first.
  if (actor.role === "ADMIN") {
    const all = await db.post.findMany({
      where: { deletedAt: null, ...(query.type ? { type: query.type } : {}) },
      orderBy: [{ createdAt: "desc" }, { id: "desc" }],
      take: query.limit + 1,
      ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
      include: postInclude(),
    });
    const adminPage = pageMeta(all as unknown as PostRow[], query.limit);
    const adminItems = [];
    for (const row of adminPage.items) adminItems.push(await toPostRecord(row, actor, db));
    return { items: adminItems, meta: adminPage.meta };
  }

  const [follows, connections] = await Promise.all([
    db.follow.findMany({
      where: { followerId: actor.id },
      select: { followeeId: true },
    }),
    db.connection.findMany({
      where: {
        status: "ACCEPTED",
        OR: [{ requesterId: actor.id }, { addresseeId: actor.id }],
      },
      select: { requesterId: true, addresseeId: true },
    }),
  ]);

  const authorIds = new Set<string>([actor.id]);
  for (const follow of follows) authorIds.add(follow.followeeId);
  for (const connection of connections) {
    authorIds.add(
      connection.requesterId === actor.id ? connection.addresseeId : connection.requesterId,
    );
  }

  const records = await db.post.findMany({
    where: {
      deletedAt: null,
      ...(query.type ? { type: query.type } : {}),
      OR: [
        { authorId: { in: [...authorIds] } },
        { loanRequest: { status: "OPEN" } },
      ],
    },
    orderBy: [{ createdAt: "desc" }, { id: "desc" }],
    take: query.limit + 1,
    ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
    include: postInclude(),
  });

  const page = pageMeta(records as unknown as PostRow[], query.limit);
  const items = [];
  for (const row of page.items) items.push(await toPostRecord(row, actor, db));
  return { items, meta: page.meta };
}

export async function getPost(id: string, actor: Actor | undefined, deps: ServiceDeps = {}) {
  const db = deps.db ?? prisma;
  return toPostRecord(await loadPost(id, db), actor, db);
}

function assertEditable(type: PostType): void {
  if (!USER_POST_TYPES.includes(type)) {
    throw new ForbiddenError("System-generated posts cannot be edited by users");
  }
}

export async function updatePost(
  actor: Actor,
  id: string,
  input: UpdateInput,
  deps: ServiceDeps = {},
) {
  assertRole(actor, "OWNER", "INVESTOR", "ADMIN");
  const parsed = updatePostSchema.parse(input);
  const db = deps.db ?? prisma;
  const existing = await db.post.findFirst({ where: { id, deletedAt: null } });
  if (!existing) throw new NotFoundError("Post not found");
  // Admins may edit any post, including system-generated ones (moderation).
  if (actor.role !== "ADMIN") {
    if (existing.authorId !== actor.id) throw new ForbiddenError("You do not own this post");
    assertEditable(existing.type as PostType);
  }

  await db.post.update({ where: { id }, data: parsed });
  return toPostRecord(await loadPost(id, db), actor, db);
}

/** Soft-deletes the post and its visible comments in one transaction. */
export async function deletePost(actor: Actor, id: string, deps: ServiceDeps = {}) {
  assertRole(actor, "OWNER", "INVESTOR", "ADMIN");
  const db = deps.db ?? prisma;
  const existing = await db.post.findFirst({ where: { id, deletedAt: null } });
  if (!existing) throw new NotFoundError("Post not found");
  if (actor.role !== "ADMIN") {
    if (existing.authorId !== actor.id) throw new ForbiddenError("You do not own this post");
    assertEditable(existing.type as PostType);
  }

  const now = new Date();
  await db.$transaction(async (tx) => {
    await tx.comment.updateMany({
      where: { postId: id, deletedAt: null },
      data: { deletedAt: now },
    });
    await tx.post.update({ where: { id }, data: { deletedAt: now } });
  });
  return { id, deleted: true as const };
}

export async function likePost(actor: Actor, postId: string, deps: ServiceDeps = {}) {
  assertRole(actor, "OWNER", "INVESTOR");
  const db = deps.db ?? prisma;
  await loadPost(postId, db);

  try {
    const { likeCount } = await db.$transaction(async (tx) => {
      const existing = await tx.like.findUnique({
        where: { postId_userId: { postId, userId: actor.id } },
        select: { id: true },
      });
      if (existing) throw new ConflictError("You already liked this post");
      await tx.like.create({ data: { postId, userId: actor.id } });
      const likeCount = await tx.like.count({ where: { postId } });
      return { likeCount };
    });
    return { postId, liked: true as const, likeCount };
  } catch (error) {
    if (isUniqueViolation(error)) throw new ConflictError("You already liked this post");
    throw error;
  }
}

export async function unlikePost(actor: Actor, postId: string, deps: ServiceDeps = {}) {
  assertRole(actor, "OWNER", "INVESTOR");
  const db = deps.db ?? prisma;
  await loadPost(postId, db);

  const result = await db.like.deleteMany({ where: { postId, userId: actor.id } });
  if (result.count === 0) throw new NotFoundError("Like not found");
  const likeCount = await db.like.count({ where: { postId } });
  return { postId, liked: false as const, likeCount };
}

export async function createComment(
  actor: Actor,
  postId: string,
  input: CommentInput,
  deps: ServiceDeps = {},
) {
  assertRole(actor, "OWNER", "INVESTOR");
  const parsed = createCommentSchema.parse(input);
  const db = deps.db ?? prisma;
  await loadPost(postId, db);

  const created = await db.comment.create({
    data: { postId, authorId: actor.id, content: parsed.content },
  });
  const row = await db.comment.findUnique({
    where: { id: created.id },
    include: commentInclude(),
  });
  return toCommentRecord(row as unknown as CommentRow, db);
}

export async function updateComment(
  actor: Actor,
  postId: string,
  commentId: string,
  input: CommentUpdateInput,
  deps: ServiceDeps = {},
) {
  assertRole(actor, "OWNER", "INVESTOR");
  const parsed = updateCommentSchema.parse(input);
  const db = deps.db ?? prisma;
  await loadPost(postId, db);

  const existing = await db.comment.findFirst({
    where: { id: commentId, postId, deletedAt: null },
  });
  if (!existing) throw new NotFoundError("Comment not found");
  if (existing.authorId !== actor.id) throw new ForbiddenError("You do not own this comment");

  await db.comment.update({ where: { id: commentId }, data: { content: parsed.content } });
  const row = await db.comment.findUnique({
    where: { id: commentId },
    include: commentInclude(),
  });
  return toCommentRecord(row as unknown as CommentRow, db);
}

/** Soft delete so moderation history survives. */
export async function deleteComment(
  actor: Actor,
  postId: string,
  commentId: string,
  deps: ServiceDeps = {},
) {
  assertRole(actor, "OWNER", "INVESTOR");
  const db = deps.db ?? prisma;
  await loadPost(postId, db);

  const existing = await db.comment.findFirst({
    where: { id: commentId, postId, deletedAt: null },
  });
  if (!existing) throw new NotFoundError("Comment not found");
  if (existing.authorId !== actor.id) throw new ForbiddenError("You do not own this comment");

  await db.comment.update({ where: { id: commentId }, data: { deletedAt: new Date() } });
  return { id: commentId, deleted: true as const };
}

export async function listComments(
  postId: string,
  query: PaginationParams,
  deps: ServiceDeps = {},
) {
  const db = deps.db ?? prisma;
  await loadPost(postId, db);
  const cursor = cursorId(query.cursor);

  const records = await db.comment.findMany({
    where: { postId, deletedAt: null },
    orderBy: [{ createdAt: "asc" }, { id: "asc" }],
    take: query.limit + 1,
    ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
    include: commentInclude(),
  });

  const page = pageMeta(records as unknown as CommentRow[], query.limit);
  const items = [];
  for (const row of page.items) items.push(await toCommentRecord(row, db));
  return { items, meta: page.meta };
}
