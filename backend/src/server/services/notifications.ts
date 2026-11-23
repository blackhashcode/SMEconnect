import type { PaginationParams } from "@/lib/pagination";
import type { Actor } from "@/server/auth/policy";
import { prisma } from "@/server/db";
import { NotFoundError } from "@/server/errors";
import { notificationTypeSchema } from "@/server/validators/enums";
import {
  notificationListQuerySchema,
  type notificationRecordSchema,
} from "@/server/validators/notification";
import type { z } from "zod";
import { cursorId, pageMeta } from "@/server/services/social-shared";

type Db = typeof prisma;
type NotificationRecord = z.infer<typeof notificationRecordSchema>;

interface ServiceDeps {
  db?: Db;
  now?: () => Date;
}

interface NotificationRow {
  id: string;
  userId: string;
  type: z.infer<typeof notificationTypeSchema>;
  title: string;
  body: string;
  link: string | null;
  data: unknown;
  readAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

function toRecord(row: NotificationRow): NotificationRecord {
  return {
    id: row.id,
    userId: row.userId,
    type: row.type,
    title: row.title,
    body: row.body,
    link: row.link ?? null,
    data: row.data ?? null,
    readAt: row.readAt ? row.readAt.toISOString() : null,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

/** Own notifications only; `?unread=true` narrows the page to unread rows. */
export async function listNotifications(
  actor: Actor,
  query: PaginationParams & { unread?: string },
  deps: ServiceDeps = {},
) {
  const db = deps.db ?? prisma;
  const parsed = notificationListQuerySchema.parse({ unread: query.unread });
  const cursor = cursorId(query.cursor);

  const rows = await db.notification.findMany({
    where: {
      userId: actor.id,
      ...(parsed.unread ? { readAt: null } : {}),
    },
    orderBy: [{ createdAt: "desc" }, { id: "desc" }],
    take: query.limit + 1,
    ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
  });

  const page = pageMeta(rows as unknown as NotificationRow[], query.limit);
  return {
    items: page.items.map(toRecord),
    meta: page.meta,
  };
}

/** A cheap aggregate for header badges; never accepts a target user id. */
export async function getUnreadNotificationCount(
  actor: Actor,
  deps: ServiceDeps = {},
): Promise<{ unread: number }> {
  const db = deps.db ?? prisma;
  const unread = await db.notification.count({
    where: { userId: actor.id, readAt: null },
  });
  return { unread };
}

/**
 * Marks one of the actor's notifications read. A repeated call is idempotent
 * and returns the original timestamp; another user's id is indistinguishable
 * from a missing notification.
 */
export async function markNotificationRead(
  actor: Actor,
  notificationId: string,
  deps: ServiceDeps = {},
) {
  const db = deps.db ?? prisma;
  const now = (deps.now ?? (() => new Date()))();

  const row = await db.notification.findFirst({
    where: { id: notificationId, userId: actor.id },
  });
  if (!row) throw new NotFoundError("Notification not found");

  await db.notification.updateMany({
    where: { id: notificationId, userId: actor.id, readAt: null },
    data: { readAt: now },
  });

  const current = await db.notification.findFirst({
    where: { id: notificationId, userId: actor.id },
    select: { readAt: true },
  });
  return {
    id: notificationId,
    read: true as const,
    readAt: (current?.readAt ?? now).toISOString(),
  };
}

/** Marks every unread notification owned by the actor in one update. */
export async function markAllNotificationsRead(
  actor: Actor,
  deps: ServiceDeps = {},
) {
  const db = deps.db ?? prisma;
  const now = (deps.now ?? (() => new Date()))();
  const result = await db.notification.updateMany({
    where: { userId: actor.id, readAt: null },
    data: { readAt: now },
  });
  return { markedRead: result.count };
}
