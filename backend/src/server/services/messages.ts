import { prisma } from "@/server/db";
import { ForbiddenError, NotFoundError, ValidationError } from "@/server/errors";
import { createNotification } from "@/server/notifications";
import { messageRateLimiter } from "@/server/rate-limit";
import type { Actor } from "@/server/services/actor";

async function canMessagePair(userA: string, userB: string): Promise<boolean> {
  const [connection, offer] = await Promise.all([
    prisma.connection.findFirst({
      where: {
        status: "ACCEPTED",
        OR: [
          { requesterId: userA, addresseeId: userB },
          { requesterId: userB, addresseeId: userA },
        ],
      },
      select: { id: true },
    }),
    prisma.offer.findFirst({
      where: {
        OR: [
          { investorId: userA, loanRequest: { ownerId: userB } },
          { investorId: userB, loanRequest: { ownerId: userA } },
        ],
      },
      select: { id: true },
    }),
  ]);
  return Boolean(connection || offer);
}

export async function listThreads(actor: Actor) {
  const memberships = await prisma.conversationParticipant.findMany({
    where: { userId: actor.id },
    include: {
      conversation: {
        include: {
          participants: {
            include: {
              user: {
                select: {
                  id: true,
                  name: true,
                  role: true,
                  headline: true,
                  image: true,
                  businessProfile: { select: { id: true, shopName: true } },
                },
              },
            },
          },
          messages: {
            where: { deletedAt: null },
            orderBy: { createdAt: "desc" },
            take: 1,
          },
        },
      },
    },
    orderBy: { conversation: { updatedAt: "desc" } },
  });

  const threads = await Promise.all(
    memberships.map(async (m) => {
      const other = m.conversation.participants.find((p) => p.userId !== actor.id)?.user ?? null;
      const unread = await prisma.message.count({
        where: {
          conversationId: m.conversationId,
          senderId: { not: actor.id },
          deletedAt: null,
          createdAt: { gt: m.lastReadAt },
        },
      });
      const last = m.conversation.messages[0] ?? null;
      return {
        id: m.conversation.id,
        subject: m.conversation.subject,
        loanRequestId: m.conversation.loanRequestId,
        other,
        lastMessage: last?.body ?? "",
        lastMessageAt: (last?.createdAt ?? m.conversation.updatedAt).toISOString(),
        unread,
      };
    }),
  );

  const totalUnread = threads.reduce((sum, t) => sum + t.unread, 0);
  return { threads, unread: totalUnread };
}

export async function getUnreadMessageCount(actor: Actor): Promise<number> {
  const memberships = await prisma.conversationParticipant.findMany({
    where: { userId: actor.id },
    select: { conversationId: true, lastReadAt: true },
  });
  if (memberships.length === 0) return 0;

  const counts = await Promise.all(
    memberships.map((m) =>
      prisma.message.count({
        where: {
          conversationId: m.conversationId,
          senderId: { not: actor.id },
          deletedAt: null,
          createdAt: { gt: m.lastReadAt },
        },
      }),
    ),
  );
  return counts.reduce((a, b) => a + b, 0);
}

export async function openOrReuseThread(
  actor: Actor,
  input: { participantId: string; subject?: string; loanRequestId?: string; text?: string },
) {
  if (input.participantId === actor.id) {
    throw new ValidationError("You cannot message yourself");
  }

  const other = await prisma.user.findUnique({
    where: { id: input.participantId },
    select: { id: true, name: true, role: true },
  });
  if (!other || other.role === "ADMIN") {
    throw new NotFoundError("Member not found");
  }

  const allowed = await canMessagePair(actor.id, input.participantId);
  if (!allowed) {
    throw new ForbiddenError(
      "Messaging requires an accepted connection or an active loan offer between both members",
    );
  }

  const existing = await prisma.conversation.findFirst({
    where: {
      AND: [
        { participants: { some: { userId: actor.id } } },
        { participants: { some: { userId: input.participantId } } },
      ],
    },
  });

  return prisma.$transaction(async (tx) => {
    const now = new Date();
    const conversation =
      existing ??
      (await tx.conversation.create({
        data: {
          subject: input.subject || `Conversation with ${other.name}`,
          loanRequestId: input.loanRequestId ?? null,
          participants: {
            create: [
              { userId: actor.id, lastReadAt: now },
              { userId: input.participantId },
            ],
          },
        },
      }));

    if (input.text) {
      messageRateLimiter.check(`msg:${actor.id}`);
      await tx.message.create({
        data: {
          conversationId: conversation.id,
          senderId: actor.id,
          body: input.text,
          kind: "TEXT",
        },
      });
      await tx.conversation.update({
        where: { id: conversation.id },
        data: { updatedAt: now },
      });
    }

    return { thread: conversation, created: !existing };
  });
}

export async function listThreadMessages(
  actor: Actor,
  threadId: string,
  afterIso?: string,
) {
  const member = await prisma.conversationParticipant.findUnique({
    where: { conversationId_userId: { conversationId: threadId, userId: actor.id } },
  });
  if (!member) throw new NotFoundError("Conversation not found");

  return prisma.message.findMany({
    where: {
      conversationId: threadId,
      deletedAt: null,
      ...(afterIso ? { createdAt: { gt: new Date(afterIso) } } : {}),
    },
    orderBy: { createdAt: "asc" },
    take: 100,
  });
}

export async function sendThreadMessage(actor: Actor, threadId: string, text: string) {
  messageRateLimiter.check(`msg:${actor.id}`);

  const participants = await prisma.conversationParticipant.findMany({
    where: { conversationId: threadId },
  });
  const me = participants.find((p) => p.userId === actor.id);
  if (!me) throw new NotFoundError("Conversation not found");
  const other = participants.find((p) => p.userId !== actor.id);

  return prisma.$transaction(async (tx) => {
    const now = new Date();
    const message = await tx.message.create({
      data: {
        conversationId: threadId,
        senderId: actor.id,
        body: text,
        kind: "TEXT",
      },
    });
    await tx.conversation.update({ where: { id: threadId }, data: { updatedAt: now } });
    await tx.conversationParticipant.update({
      where: { conversationId_userId: { conversationId: threadId, userId: actor.id } },
      data: { lastReadAt: now },
    });
    if (other) {
      await createNotification(
        {
          userId: other.userId,
          type: "MESSAGE",
          title: "New message",
          body: text.slice(0, 140),
          link: `/messages?thread=${threadId}`,
        },
        tx,
      );
    }
    return message;
  });
}

export async function markThreadRead(actor: Actor, threadId: string) {
  const member = await prisma.conversationParticipant.findUnique({
    where: { conversationId_userId: { conversationId: threadId, userId: actor.id } },
  });
  if (!member) throw new NotFoundError("Conversation not found");

  await prisma.conversationParticipant.update({
    where: { conversationId_userId: { conversationId: threadId, userId: actor.id } },
    data: { lastReadAt: new Date() },
  });
}
