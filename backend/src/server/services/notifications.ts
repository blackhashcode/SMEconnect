import { decodeCursor, encodeCursor, type PaginationParams } from "@/lib/pagination";
import { prisma } from "@/server/db";
import { NotFoundError } from "@/server/errors";
import type { Actor } from "@/server/services/actor";

export async function listNotifications(actor: Actor, page: PaginationParams) {
  const cursorId = page.cursor ? String(decodeCursor(page.cursor).id ?? "") : undefined;

  const [rows, unreadCount] = await Promise.all([
    prisma.notification.findMany({
      where: { userId: actor.id },
      orderBy: [{ createdAt: "desc" }, { id: "desc" }],
      take: page.limit + 1,
      ...(cursorId ? { cursor: { id: cursorId }, skip: 1 } : {}),
    }),
    prisma.notification.count({ where: { userId: actor.id, readAt: null } }),
  ]);

  const hasMore = rows.length > page.limit;
  const items = hasMore ? rows.slice(0, page.limit) : rows;
  const nextCursor = hasMore ? encodeCursor({ id: items[items.length - 1].id }) : null;

  return { items, meta: { nextCursor, unreadCount } };
}

export async function markNotificationRead(actor: Actor, notificationId: string) {
  const existing = await prisma.notification.findFirst({
    where: { id: notificationId, userId: actor.id },
  });
  if (!existing) throw new NotFoundError("Notification not found");

  return prisma.notification.update({
    where: { id: notificationId },
    data: { readAt: existing.readAt ?? new Date() },
  });
}

export async function markAllNotificationsRead(actor: Actor) {
  const result = await prisma.notification.updateMany({
    where: { userId: actor.id, readAt: null },
    data: { readAt: new Date() },
  });
  return { updated: result.count };
}
