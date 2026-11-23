import type { PaginationParams } from "@/lib/pagination";
import { assertRole, type Actor } from "@/server/auth/policy";
import { prisma } from "@/server/db";
import { ConflictError, NotFoundError } from "@/server/errors";
import {
  createReportSchema,
  reportListQuerySchema,
} from "@/server/validators/social";
import type { z } from "zod";
import { cursorId, isUniqueViolation, pageMeta } from "@/server/services/social-shared";

type Db = typeof prisma;
type CreateInput = z.infer<typeof createReportSchema>;
type ReportTargetType = CreateInput["targetType"];
type ReportStatus = "OPEN" | "RESOLVED" | "DISMISSED";

interface ServiceDeps {
  db?: Db;
}

interface ReportRow {
  id: string;
  reporterId: string;
  targetType: ReportTargetType;
  targetId: string;
  reason: string;
  status: ReportStatus;
  resolutionNote: string | null;
  handledById: string | null;
  createdAt: Date;
  updatedAt: Date;
}

function toRecord(row: ReportRow) {
  return {
    id: row.id,
    reporterId: row.reporterId,
    targetType: row.targetType,
    targetId: row.targetId,
    reason: row.reason,
    status: row.status,
    resolutionNote: row.resolutionNote ?? null,
    handledById: row.handledById ?? null,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

/** Rejects reports of missing or soft-deleted content before writing anything. */
async function assertTargetExists(targetType: ReportTargetType, targetId: string, db: Db) {
  let found: { id: string } | null = null;
  if (targetType === "USER") {
    found = await db.user.findUnique({
      where: { id: targetId },
      select: { id: true },
    });
  } else if (targetType === "POST") {
    found = await db.post.findFirst({
      where: { id: targetId, deletedAt: null },
      select: { id: true },
    });
  } else if (targetType === "COMMENT") {
    found = await db.comment.findFirst({
      where: { id: targetId, deletedAt: null },
      select: { id: true },
    });
  } else {
    found = await db.message.findFirst({
      where: { id: targetId, deletedAt: null },
      select: { id: true },
    });
  }
  if (!found) throw new NotFoundError("Report target not found");
}

/** Creates an OPEN report with the reporter taken from the session. */
export async function createReport(
  actor: Actor,
  input: CreateInput,
  deps: ServiceDeps = {},
) {
  assertRole(actor, "OWNER", "INVESTOR");
  const parsed = createReportSchema.parse(input);
  const db = deps.db ?? prisma;

  await assertTargetExists(parsed.targetType, parsed.targetId, db);

  const duplicate = await db.report.findFirst({
    where: {
      reporterId: actor.id,
      targetType: parsed.targetType,
      targetId: parsed.targetId,
      status: "OPEN",
    },
    select: { id: true },
  });
  if (duplicate) throw new ConflictError("You already have an open report for this target");

  try {
    const row = await db.report.create({
      data: {
        reporterId: actor.id,
        targetType: parsed.targetType,
        targetId: parsed.targetId,
        reason: parsed.reason,
        status: "OPEN",
      },
    });
    return toRecord(row as ReportRow);
  } catch (error) {
    if (isUniqueViolation(error)) {
      throw new ConflictError("You already have an open report for this target");
    }
    throw error;
  }
}

/**
 * Reporters see only their own reports. Admins see the whole queue with an
 * optional status filter, but resolution remains an ADMIN Phase 10 operation.
 */
export async function listReports(
  actor: Actor,
  query: PaginationParams & { status?: string },
  deps: ServiceDeps = {},
) {
  const parsed = reportListQuerySchema.parse({ status: query.status });
  const db = deps.db ?? prisma;
  const cursor = cursorId(query.cursor);
  const admin = actor.role === "ADMIN";
  if (!admin) assertRole(actor, "OWNER", "INVESTOR");

  const rows = await db.report.findMany({
    where: {
      ...(admin ? {} : { reporterId: actor.id }),
      ...(parsed.status ? { status: parsed.status } : {}),
    },
    orderBy: [{ createdAt: "desc" }, { id: "desc" }],
    take: query.limit + 1,
    ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
  });

  const page = pageMeta(rows as unknown as ReportRow[], query.limit);
  return {
    items: page.items.map(toRecord),
    meta: page.meta,
  };
}
