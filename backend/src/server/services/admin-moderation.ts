import type { PaginationParams } from "@/lib/pagination";
import { assertRole, type Actor } from "@/server/auth/policy";
import { prisma } from "@/server/db";
import { ConflictError, NotFoundError } from "@/server/errors";
import { idSchema } from "@/server/validators/common";
import {
  adminCommentListQuerySchema,
  adminPostListQuerySchema,
} from "@/server/validators/admin";
import { cursorId, pageMeta } from "@/server/services/social-shared";

type Db = typeof prisma;

interface ServiceDeps {
  db?: Db;
  now?: () => Date;
}

const POST_SELECT = {
  id: true,
  authorId: true,
  type: true,
  content: true,
  imageUrls: true,
  deletedAt: true,
  createdAt: true,
  updatedAt: true,
} as const;

const COMMENT_SELECT = {
  id: true,
  postId: true,
  authorId: true,
  content: true,
  deletedAt: true,
  createdAt: true,
  updatedAt: true,
} as const;

function toIso(value: Date | null): string | null {
  return value ? value.toISOString() : null;
}

/** ADMIN-only post list; soft-deleted rows are hidden unless requested. */
export async function listAdminPosts(
  actor: Actor,
  query: PaginationParams & { includeDeleted?: string },
  deps: ServiceDeps = {},
) {
  assertRole(actor, "ADMIN");
  const parsed = adminPostListQuerySchema.parse({
    includeDeleted: query.includeDeleted,
  });
  const db = deps.db ?? prisma;
  const cursor = cursorId(query.cursor);

  const rows = await db.post.findMany({
    where: parsed.includeDeleted ? {} : { deletedAt: null },
    select: POST_SELECT,
    orderBy: [{ createdAt: "desc" }, { id: "desc" }],
    take: query.limit + 1,
    ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
  });

  const page = pageMeta(rows, query.limit);
  return {
    items: page.items.map((row) => ({
      id: row.id,
      authorId: row.authorId,
      type: row.type,
      content: row.content,
      imageUrls: row.imageUrls ?? [],
      deletedAt: toIso(row.deletedAt),
      createdAt: row.createdAt.toISOString(),
      updatedAt: row.updatedAt.toISOString(),
    })),
    meta: page.meta,
  };
}

/** Soft-deletes a post and its still-visible comments, preserving all rows. */
export async function removeAdminPost(
  actor: Actor,
  postId: string,
  deps: ServiceDeps = {},
) {
  assertRole(actor, "ADMIN");
  const id = idSchema.parse(postId);
  const db = deps.db ?? prisma;
  const now = (deps.now ?? (() => new Date()))();

  const post = await db.post.findFirst({
    where: { id },
    select: { id: true, deletedAt: true },
  });
  if (!post) throw new NotFoundError("Post not found");
  if (post.deletedAt) throw new ConflictError("Post was already removed");

  await db.$transaction(async (tx) => {
    await tx.comment.updateMany({
      where: { postId: id, deletedAt: null },
      data: { deletedAt: now },
    });
    await tx.post.update({ where: { id }, data: { deletedAt: now } });
  });

  return { id, deleted: true as const };
}

/** ADMIN-only comment list with an optional post filter. */
export async function listAdminComments(
  actor: Actor,
  query: PaginationParams & { postId?: string; includeDeleted?: string },
  deps: ServiceDeps = {},
) {
  assertRole(actor, "ADMIN");
  const parsed = adminCommentListQuerySchema.parse({
    postId: query.postId,
    includeDeleted: query.includeDeleted,
  });
  const db = deps.db ?? prisma;
  const cursor = cursorId(query.cursor);

  const rows = await db.comment.findMany({
    where: {
      ...(parsed.postId ? { postId: parsed.postId } : {}),
      ...(parsed.includeDeleted ? {} : { deletedAt: null }),
    },
    select: COMMENT_SELECT,
    orderBy: [{ createdAt: "desc" }, { id: "desc" }],
    take: query.limit + 1,
    ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
  });

  const page = pageMeta(rows, query.limit);
  return {
    items: page.items.map((row) => ({
      id: row.id,
      postId: row.postId,
      authorId: row.authorId,
      content: row.content,
      deletedAt: toIso(row.deletedAt),
      createdAt: row.createdAt.toISOString(),
      updatedAt: row.updatedAt.toISOString(),
    })),
    meta: page.meta,
  };
}

/** Soft-deletes one comment; the row is retained for audit. */
export async function removeAdminComment(
  actor: Actor,
  commentId: string,
  deps: ServiceDeps = {},
) {
  assertRole(actor, "ADMIN");
  const id = idSchema.parse(commentId);
  const db = deps.db ?? prisma;
  const now = (deps.now ?? (() => new Date()))();

  const comment = await db.comment.findFirst({
    where: { id },
    select: { id: true, deletedAt: true },
  });
  if (!comment) throw new NotFoundError("Comment not found");
  if (comment.deletedAt) throw new ConflictError("Comment was already removed");

  await db.comment.update({ where: { id }, data: { deletedAt: now } });
  return { id, deleted: true as const };
}
