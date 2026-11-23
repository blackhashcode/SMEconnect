import type { Prisma } from "@/generated/prisma/client";
import { prisma } from "@/server/db";

type DbLike = Pick<typeof prisma, "auditLog">;

export interface AuditEntryInput {
  actorId?: string | null;
  action: string;
  entityType: string;
  entityId: string;
  metadata?: Prisma.InputJsonValue;
}

/** Records an immutable audit trail entry for compliance & financial events. */
export async function recordAuditLog(entry: AuditEntryInput, db: DbLike = prisma) {
  await db.auditLog.create({
    data: {
      actorId: entry.actorId ?? null,
      action: entry.action,
      entityType: entry.entityType,
      entityId: entry.entityId,
      metadata: entry.metadata,
    },
  });
}
