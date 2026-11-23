import { assertRole, type Actor } from "@/server/auth/policy";
import { prisma } from "@/server/db";
import {
  BusinessRuleError,
  ConflictError,
  ForbiddenError,
  NotFoundError,
} from "@/server/errors";
import { idSchema } from "@/server/validators/common";
import {
  dismissReportSchema,
  moderationActionSchema,
  resolveReportSchema,
  type adminReportDetailSchema,
  type adminModerationActionSchema,
  type adminReportResolutionResultSchema,
} from "@/server/validators/admin";
import type { z } from "zod";
import { toReportRecord, type ReportRow } from "@/server/services/reports";
import type { Prisma } from "@/generated/prisma/client";

type Db = typeof prisma;
type TransactionClient = Prisma.TransactionClient;
type ResolveInput = z.infer<typeof resolveReportSchema>;
type DismissInput = z.infer<typeof dismissReportSchema>;
type ModerationAction = z.infer<typeof moderationActionSchema>;
type ReportDetail = z.infer<typeof adminReportDetailSchema>;
type ResolutionResult = z.infer<typeof adminReportResolutionResultSchema>;
type ModerationResult = z.infer<typeof adminModerationActionSchema>;
type TargetType = ReportRow["targetType"];

interface ServiceDeps {
  db?: Db;
  now?: () => Date;
}

async function loadReport(id: string, db: Db): Promise<ReportRow> {
  const row = await db.report.findUnique({ where: { id } });
  if (!row) throw new NotFoundError("Report not found");
  return row as ReportRow;
}

function assertOpen(row: ReportRow): void {
  if (row.status !== "OPEN") {
    throw new ConflictError("Only open reports can be resolved or dismissed");
  }
}

function assertActionAllowed(action: ModerationAction, targetType: TargetType): void {
  if (action === "NONE") return;
  if (action === "REMOVE_CONTENT" && (targetType === "POST" || targetType === "COMMENT")) {
    return;
  }
  if (action === "SUSPEND_USER" && targetType === "USER") return;
  throw new BusinessRuleError(
    `The ${action} action is not valid for a ${targetType} report`,
  );
}

/** ADMIN-only detail, including a minimal snapshot of the reported target. */
export async function getAdminReport(
  actor: Actor,
  reportId: string,
  deps: ServiceDeps = {},
): Promise<ReportDetail> {
  assertRole(actor, "ADMIN");
  const id = idSchema.parse(reportId);
  const db = deps.db ?? prisma;
  const report = await loadReport(id, db);

  let target: ReportDetail["target"] = null;
  if (report.targetType === "USER") {
    const user = (await db.user.findUnique({
      where: { id: report.targetId },
      select: { id: true, name: true, role: true, status: true },
    })) as { id: string; name: string; role: "OWNER" | "INVESTOR" | "ADMIN"; status: "ACTIVE" | "SUSPENDED" } | null;
    if (user) {
      target = {
        targetType: "USER",
        targetId: user.id,
        name: user.name,
        role: user.role,
        status: user.status,
      };
    }
  } else if (report.targetType === "POST") {
    const post = (await db.post.findFirst({
      where: { id: report.targetId },
      select: { id: true, authorId: true, type: true, content: true, deletedAt: true, createdAt: true },
    })) as { id: string; authorId: string; type: "UPDATE" | "MILESTONE" | "LOAN_REQUEST" | "REPAYMENT"; content: string; deletedAt: Date | null; createdAt: Date } | null;
    if (post) {
      target = {
        targetType: "POST",
        targetId: post.id,
        authorId: post.authorId,
        type: post.type,
        content: post.content,
        deletedAt: post.deletedAt?.toISOString() ?? null,
        createdAt: post.createdAt.toISOString(),
      };
    }
  } else if (report.targetType === "COMMENT") {
    const comment = (await db.comment.findFirst({
      where: { id: report.targetId },
      select: { id: true, authorId: true, postId: true, content: true, deletedAt: true, createdAt: true },
    })) as { id: string; authorId: string; postId: string; content: string; deletedAt: Date | null; createdAt: Date } | null;
    if (comment) {
      target = {
        targetType: "COMMENT",
        targetId: comment.id,
        authorId: comment.authorId,
        postId: comment.postId,
        content: comment.content,
        deletedAt: comment.deletedAt?.toISOString() ?? null,
        createdAt: comment.createdAt.toISOString(),
      };
    }
  } else {
    const message = (await db.message.findFirst({
      where: { id: report.targetId },
      select: { id: true, senderId: true, conversationId: true, body: true, deletedAt: true, createdAt: true },
    })) as { id: string; senderId: string; conversationId: string; body: string; deletedAt: Date | null; createdAt: Date } | null;
    if (message) {
      target = {
        targetType: "MESSAGE",
        targetId: message.id,
        senderId: message.senderId,
        conversationId: message.conversationId,
        body: message.body,
        deletedAt: message.deletedAt?.toISOString() ?? null,
        createdAt: message.createdAt.toISOString(),
      };
    }
  }

  return { ...toReportRecord(report), target };
}

/** Applies an optional moderation action inside the report-resolution transaction. */
async function applyAction(
  tx: TransactionClient,
  actor: Actor,
  report: ReportRow,
  action: ModerationAction,
  now: Date,
): Promise<void> {
  if (action === "NONE") return;
  assertActionAllowed(action, report.targetType);

  if (action === "REMOVE_CONTENT") {
    if (report.targetType === "POST") {
      const post = await tx.post.findFirst({
        where: { id: report.targetId },
        select: { id: true, deletedAt: true },
      });
      if (!post) throw new NotFoundError("Report target not found");
      if (post.deletedAt) throw new ConflictError("Content was already removed");
      await tx.comment.updateMany({
        where: { postId: post.id, deletedAt: null },
        data: { deletedAt: now },
      });
      await tx.post.update({ where: { id: post.id }, data: { deletedAt: now } });
    } else {
      const comment = await tx.comment.findFirst({
        where: { id: report.targetId },
        select: { id: true, deletedAt: true },
      });
      if (!comment) throw new NotFoundError("Report target not found");
      if (comment.deletedAt) throw new ConflictError("Content was already removed");
      await tx.comment.update({
        where: { id: comment.id },
        data: { deletedAt: now },
      });
    }
    return;
  }

  const user = await tx.user.findUnique({
    where: { id: report.targetId },
    select: { id: true, role: true, status: true },
  });
  if (!user) throw new NotFoundError("Report target not found");
  if (user.id === actor.id) {
    throw new BusinessRuleError("You cannot suspend your own account");
  }
  if (user.role === "ADMIN") {
    throw new ForbiddenError("Administrator accounts cannot be suspended");
  }
  if (user.status === "SUSPENDED") {
    throw new ConflictError("The user is already suspended");
  }
  await tx.user.update({
    where: { id: user.id },
    data: { status: "SUSPENDED" },
  });
}

/** ADMIN only. OPEN → RESOLVED, records the handler and note, optional action. */
export async function resolveAdminReport(
  actor: Actor,
  reportId: string,
  input: ResolveInput,
  deps: ServiceDeps = {},
): Promise<ModerationResult> {
  assertRole(actor, "ADMIN");
  const id = idSchema.parse(reportId);
  const parsed = resolveReportSchema.parse(input);
  const db = deps.db ?? prisma;
  const now = (deps.now ?? (() => new Date()))();

  const report = await loadReport(id, db);
  assertOpen(report);
  const action = parsed.moderationAction ?? "NONE";
  assertActionAllowed(action, report.targetType);

  const updated = await db.$transaction(async (tx) => {
    await applyAction(tx, actor, report, action, now);
    return tx.report.update({
      where: { id },
      data: {
        status: "RESOLVED",
        resolutionNote: parsed.resolutionNote,
        handledById: actor.id,
      },
    });
  });

  return {
    reportId: updated.id,
    status: updated.status as "RESOLVED",
    moderationAction: action,
    resolutionNote: updated.resolutionNote ?? parsed.resolutionNote,
    handledById: updated.handledById ?? actor.id,
  };
}

/** ADMIN only. OPEN → DISMISSED with a required note; no moderation action. */
export async function dismissAdminReport(
  actor: Actor,
  reportId: string,
  input: DismissInput,
  deps: ServiceDeps = {},
): Promise<ResolutionResult> {
  assertRole(actor, "ADMIN");
  const id = idSchema.parse(reportId);
  const parsed = dismissReportSchema.parse(input);
  const db = deps.db ?? prisma;

  const report = await loadReport(id, db);
  assertOpen(report);

  const updated = await db.report.update({
    where: { id },
    data: {
      status: "DISMISSED",
      resolutionNote: parsed.resolutionNote,
      handledById: actor.id,
    },
  });

  return toReportRecord(updated as ReportRow);
}
