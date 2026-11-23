import { recordAuditLog } from "@/server/audit";
import { prisma } from "@/server/db";
import { ConflictError, ForbiddenError, NotFoundError, ValidationError } from "@/server/errors";
import { createNotification } from "@/server/notifications";
import type { Actor } from "@/server/services/actor";

export async function listConnections(actor: Actor) {
  return prisma.connection.findMany({
    where: { OR: [{ requesterId: actor.id }, { addresseeId: actor.id }] },
    include: {
      requester: { select: { id: true, name: true, role: true, headline: true, image: true } },
      addressee: { select: { id: true, name: true, role: true, headline: true, image: true } },
    },
    orderBy: { updatedAt: "desc" },
  });
}

export async function requestConnection(
  actor: Actor,
  input: { addresseeId: string; message: string },
) {
  if (input.addresseeId === actor.id) {
    throw new ValidationError("You cannot connect with yourself");
  }

  const target = await prisma.user.findUnique({
    where: { id: input.addresseeId },
    select: { id: true, name: true, role: true },
  });
  if (!target || target.role === "ADMIN") {
    throw new NotFoundError("Member not found");
  }

  const existing = await prisma.connection.findFirst({
    where: {
      OR: [
        { requesterId: actor.id, addresseeId: input.addresseeId },
        { requesterId: input.addresseeId, addresseeId: actor.id },
      ],
    },
  });

  if (existing && (existing.status === "ACCEPTED" || existing.status === "PENDING")) {
    throw new ConflictError(`Connection is already ${existing.status}`);
  }

  return prisma.$transaction(async (tx) => {
    const connection = existing
      ? await tx.connection.update({
          where: { id: existing.id },
          data: { requesterId: actor.id, addresseeId: input.addresseeId, status: "PENDING", message: input.message },
        })
      : await tx.connection.create({
          data: {
            requesterId: actor.id,
            addresseeId: input.addresseeId,
            status: "PENDING",
            message: input.message,
          },
        });

    await createNotification(
      {
        userId: input.addresseeId,
        type: "CONNECTION",
        title: "New connection request",
        body: input.message || "A verified member wants to connect with you on SME Connect.",
        link: "/notifications",
      },
      tx,
    );

    await recordAuditLog(
      {
        actorId: actor.id,
        action: "CONNECTION_REQUESTED",
        entityType: "Connection",
        entityId: connection.id,
        metadata: { addresseeId: input.addresseeId },
      },
      tx,
    );

    return connection;
  });
}

export async function respondToConnection(
  actor: Actor,
  connectionId: string,
  decision: "ACCEPTED" | "DECLINED",
) {
  const connection = await prisma.connection.findUnique({ where: { id: connectionId } });
  if (!connection) throw new NotFoundError("Connection request not found");
  if (connection.addresseeId !== actor.id) {
    throw new ForbiddenError("Only the recipient can respond to this connection request");
  }
  if (connection.status !== "PENDING") {
    throw new ConflictError(`Connection request is already ${connection.status}`);
  }

  return prisma.$transaction(async (tx) => {
    const updated = await tx.connection.update({
      where: { id: connectionId },
      data: { status: decision },
    });

    if (decision === "ACCEPTED") {
      await createNotification(
        {
          userId: connection.requesterId,
          type: "CONNECTION",
          title: "Connection accepted",
          body: "Your connection request was accepted. You can now message directly.",
          link: "/messages",
        },
        tx,
      );
    }

    return updated;
  });
}
