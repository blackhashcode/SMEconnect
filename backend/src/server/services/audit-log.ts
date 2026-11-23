import type { PaginationParams } from "@/lib/pagination";
import { assertRole, type Actor } from "@/server/auth/policy";
import type { prisma as PrismaClient } from "@/server/db";
import { cursorId, pageMeta } from "@/server/services/social-shared";

type Db = typeof PrismaClient;

export interface AuditEntry {
  actorId?: string | null;
  /** Dotted verb, e.g. "auth.sign_in", "admin.user_suspended", "loan_request.published". */
  action: string;
  targetType?: string | null;
  targetId?: string | null;
  detail?: Record<string, unknown> | null;
  ipAddress?: string | null;
}

// Loaded lazily so modules that only need the types (and their unit tests)
// don't require DATABASE_URL at import time.
const defaultDb = async (): Promise<Db> => (await import("@/server/db")).prisma;

/** Visitor IP from proxy headers (Vercel / the frontend rewrite), first hop only. */
export function clientIp(headers: Headers): string | null {
  const raw = headers.get("x-vercel-forwarded-for") ?? headers.get("x-forwarded-for") ?? headers.get("x-real-ip");
  return raw?.split(",")[0]?.trim().slice(0, 64) || null;
}

/**
 * Appends one activity-log entry. Never throws: a logging failure must not
 * undo or block the action it describes, so errors are reported and swallowed.
 */
export async function recordAudit(entry: AuditEntry, db?: Db): Promise<void> {
  try {
    const client = db ?? (await defaultDb());
    await client.auditLog.create({
      data: {
        actorId: entry.actorId ?? null,
        action: entry.action.slice(0, 80),
        targetType: entry.targetType ?? null,
        targetId: entry.targetId ?? null,
        detail: (entry.detail ?? undefined) as object | undefined,
        ipAddress: entry.ipAddress ?? null,
      },
    });
  } catch (error) {
    console.error(
      JSON.stringify({ level: "warn", message: "audit log write failed", action: entry.action, error: error instanceof Error ? error.message : String(error) }),
    );
  }
}

export interface AuditQuery extends PaginationParams {
  action?: string;
  actorId?: string;
  targetId?: string;
  /** Matches the start of the action, e.g. "admin." or "auth.". */
  category?: string;
}

/** ADMIN-only, newest first, cursor-paginated. Actor names/emails joined in one batch. */
export async function listAuditLogs(actor: Actor, query: AuditQuery, db?: Db) {
  assertRole(actor, "ADMIN");
  const client = db ?? (await defaultDb());
  const cursor = cursorId(query.cursor);

  const rows = await client.auditLog.findMany({
    where: {
      ...(query.action ? { action: query.action } : {}),
      ...(query.category ? { action: { startsWith: query.category } } : {}),
      ...(query.actorId ? { actorId: query.actorId } : {}),
      ...(query.targetId ? { targetId: query.targetId } : {}),
    },
    orderBy: [{ createdAt: "desc" }, { id: "desc" }],
    take: query.limit + 1,
    ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
  });

  const page = pageMeta(rows, query.limit);
  const actorIds = [...new Set(page.items.map((row) => row.actorId).filter((id): id is string => Boolean(id)))];
  const actors = actorIds.length
    ? await client.user.findMany({ where: { id: { in: actorIds } }, select: { id: true, name: true, email: true, role: true } })
    : [];
  const byId = new Map(actors.map((row) => [row.id, row]));

  return {
    items: page.items.map((row) => ({
      id: row.id,
      action: row.action,
      actor: row.actorId ? (byId.get(row.actorId) ?? { id: row.actorId, name: "Deleted account", email: null, role: null }) : null,
      targetType: row.targetType,
      targetId: row.targetId,
      detail: row.detail,
      ipAddress: row.ipAddress,
      createdAt: row.createdAt.toISOString(),
    })),
    meta: page.meta,
  };
}
