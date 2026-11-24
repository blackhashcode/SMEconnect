import type { PaginationParams } from "@/lib/pagination";
import { assertRole, type Actor } from "@/server/auth/policy";
import { prisma } from "@/server/db";
import { BusinessRuleError, ForbiddenError, NotFoundError } from "@/server/errors";
import { cursorId, pageMeta } from "@/server/services/social-shared";

type Db = typeof prisma;

const LOAN_REQUEST_STATUSES = ["DRAFT", "OPEN", "IN_DISCUSSION", "FUNDED", "REPAYING", "COMPLETED", "PAUSED", "CANCELLED"] as const;
const LOAN_STATUSES = ["PENDING_AGREEMENT", "ACTIVE", "COMPLETED", "DEFAULTED"] as const;
type LoanRequestStatus = (typeof LOAN_REQUEST_STATUSES)[number];

const asStatus = <T extends readonly string[]>(values: T, value?: string) =>
  value && (values as readonly string[]).includes(value) ? (value as T[number]) : undefined;

const OWNER_SELECT = {
  id: true,
  name: true,
  email: true,
  status: true,
  businessProfile: { select: { shopName: true, category: true } },
} as const;

/** Signs a member out everywhere by deleting their sessions (admins are protected). */
export async function revokeUserSessions(actor: Actor, userId: string, db: Db = prisma) {
  assertRole(actor, "ADMIN");
  const target = await db.user.findUnique({ where: { id: userId }, select: { id: true, role: true } });
  if (!target) throw new NotFoundError("User not found");
  if (target.role === "ADMIN" && target.id !== actor.id) {
    throw new ForbiddenError("Administrator sessions can't be revoked by another admin");
  }
  const { count } = await db.session.deleteMany({ where: { userId } });
  return { userId, revokedSessions: count };
}

/** Every loan request on the platform, any status, newest first. */
export async function listAdminLoanRequests(
  actor: Actor,
  query: PaginationParams & { status?: string; q?: string },
  db: Db = prisma,
) {
  assertRole(actor, "ADMIN");
  const status = asStatus(LOAN_REQUEST_STATUSES, query.status);
  const q = query.q?.trim();
  const cursor = cursorId(query.cursor);
  const rows = await db.loanRequest.findMany({
    where: {
      ...(status ? { status } : {}),
      ...(q
        ? {
            OR: [
              { purpose: { contains: q, mode: "insensitive" as const } },
              { owner: { name: { contains: q, mode: "insensitive" as const } } },
              { owner: { businessProfile: { shopName: { contains: q, mode: "insensitive" as const } } } },
            ],
          }
        : {}),
    },
    select: {
      id: true,
      purpose: true,
      amountBdt: true,
      tenureDays: true,
      repaymentFrequency: true,
      status: true,
      publishedAt: true,
      createdAt: true,
      owner: { select: OWNER_SELECT },
      _count: { select: { offers: true } },
    },
    orderBy: [{ createdAt: "desc" }, { id: "desc" }],
    take: query.limit + 1,
    ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
  });
  const page = pageMeta(rows, query.limit);
  return {
    items: page.items.map(({ _count, owner, ...row }) => ({
      ...row,
      publishedAt: row.publishedAt?.toISOString() ?? null,
      createdAt: row.createdAt.toISOString(),
      offerCount: _count.offers,
      owner: {
        id: owner.id,
        name: owner.name,
        email: owner.email,
        status: owner.status,
        shopName: owner.businessProfile?.shopName ?? null,
        category: owner.businessProfile?.category ?? null,
      },
    })),
    meta: page.meta,
  };
}

export type ModerationAction = "pause" | "resume" | "cancel" | "reopen";

const MODERATION: Record<ModerationAction, { to: LoanRequestStatus; from: LoanRequestStatus[]; verb: string }> = {
  pause: { to: "PAUSED", from: ["OPEN", "IN_DISCUSSION"], verb: "paused" },
  resume: { to: "OPEN", from: ["PAUSED"], verb: "reopened" },
  cancel: { to: "CANCELLED", from: ["DRAFT", "OPEN", "IN_DISCUSSION", "PAUSED"], verb: "cancelled" },
  // Admin override: bring back a cancelled request (e.g. cancelled by mistake).
  reopen: { to: "OPEN", from: ["CANCELLED"], verb: "reopened" },
};

/**
 * Admin moderation of a loan request. Pausing hides it from discovery; the owner
 * is notified with the reason. Requests already funded or repaying are left to
 * the agreement process and can't be changed here.
 */
export async function moderateLoanRequest(
  actor: Actor,
  id: string,
  action: ModerationAction,
  reason: string,
  db: Db = prisma,
) {
  assertRole(actor, "ADMIN");
  const rule = MODERATION[action];
  const existing = await db.loanRequest.findUnique({ where: { id }, select: { id: true, status: true, ownerId: true, purpose: true } });
  if (!existing) throw new NotFoundError("Loan request not found");
  if (!rule.from.includes(existing.status as LoanRequestStatus)) {
    throw new BusinessRuleError(`A ${existing.status.toLowerCase().replace("_", " ")} request can't be ${rule.verb}`);
  }
  const now = new Date();
  const visible = rule.to === "OPEN";

  await db.$transaction(async (tx) => {
    await tx.loanRequest.update({ where: { id }, data: { status: rule.to } });
    // Keep the auto-generated feed post in step with public visibility.
    if (!visible) {
      await tx.post.updateMany({ where: { loanRequestId: id, type: "LOAN_REQUEST", deletedAt: null }, data: { deletedAt: now } });
    }
    if (rule.to === "CANCELLED") {
      await tx.offer.updateMany({ where: { loanRequestId: id, status: "PENDING" }, data: { status: "WITHDRAWN" } });
    }
    await tx.notification.create({
      data: {
        userId: existing.ownerId,
        type: "ADMIN_NOTICE",
        title: `Your loan request was ${rule.verb} by SME Connect`,
        body: reason,
        link: `/business-dashboard`,
        data: { loanRequestId: id, action },
      },
    });
  });

  return { id, status: rule.to, previousStatus: existing.status };
}

/** Every loan (agreement) with its parties and repayment progress. */
export async function listAdminLoans(actor: Actor, query: PaginationParams & { status?: string }, db: Db = prisma) {
  assertRole(actor, "ADMIN");
  const status = asStatus(LOAN_STATUSES, query.status);
  const cursor = cursorId(query.cursor);
  const rows = await db.loan.findMany({
    where: status ? { status } : {},
    select: {
      id: true,
      principalBdt: true,
      interestRatePct: true,
      tenureDays: true,
      status: true,
      startDate: true,
      createdAt: true,
      owner: { select: { id: true, name: true, businessProfile: { select: { shopName: true } } } },
      investor: { select: { id: true, name: true } },
      repayments: { select: { status: true, amountBdt: true, dueDate: true } },
    },
    orderBy: [{ createdAt: "desc" }, { id: "desc" }],
    take: query.limit + 1,
    ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
  });
  const page = pageMeta(rows, query.limit);
  const now = Date.now();
  return {
    items: page.items.map(({ repayments, owner, investor, ...row }) => ({
      ...row,
      interestRatePct: Number(row.interestRatePct),
      startDate: row.startDate?.toISOString() ?? null,
      createdAt: row.createdAt.toISOString(),
      owner: { id: owner.id, name: owner.name, shopName: owner.businessProfile?.shopName ?? null },
      investor,
      repayments: {
        total: repayments.length,
        confirmed: repayments.filter((r) => r.status === "CONFIRMED").length,
        overdue: repayments.filter((r) => r.status !== "CONFIRMED" && r.dueDate.getTime() < now).length,
      },
    })),
    meta: page.meta,
  };
}

// ---------------------------------------------------------------------------
// Admin overrides: roles, restoring content, editing records, workflow.
// ---------------------------------------------------------------------------

/** Change a member's role (OWNER / INVESTOR / ADMIN). You can't change your own, and the last admin stays. */
export async function setUserRole(actor: Actor, userId: string, role: "OWNER" | "INVESTOR" | "ADMIN", db: Db = prisma) {
  assertRole(actor, "ADMIN");
  if (userId === actor.id) throw new BusinessRuleError("You can't change your own role");
  const target = await db.user.findUnique({ where: { id: userId }, select: { id: true, role: true } });
  if (!target) throw new NotFoundError("User not found");
  if (target.role === role) return { id: userId, role, previousRole: target.role };
  if (target.role === "ADMIN") {
    const admins = await db.user.count({ where: { role: "ADMIN", status: "ACTIVE" } });
    if (admins <= 1) throw new BusinessRuleError("At least one admin must remain");
  }
  await db.user.update({ where: { id: userId }, data: { role } });
  return { id: userId, role, previousRole: target.role };
}

/** Bring back a removed post (and the comments removed with it). */
export async function restorePost(actor: Actor, postId: string, db: Db = prisma) {
  assertRole(actor, "ADMIN");
  const post = await db.post.findUnique({ where: { id: postId }, select: { id: true, deletedAt: true } });
  if (!post) throw new NotFoundError("Post not found");
  if (!post.deletedAt) return { id: postId, restored: false };
  await db.$transaction([
    db.post.update({ where: { id: postId }, data: { deletedAt: null } }),
    db.comment.updateMany({ where: { postId, deletedAt: post.deletedAt }, data: { deletedAt: null } }),
  ]);
  return { id: postId, restored: true };
}

/** Bring back a removed comment. */
export async function restoreComment(actor: Actor, commentId: string, db: Db = prisma) {
  assertRole(actor, "ADMIN");
  const comment = await db.comment.findUnique({ where: { id: commentId }, select: { id: true, deletedAt: true } });
  if (!comment) throw new NotFoundError("Comment not found");
  if (!comment.deletedAt) return { id: commentId, restored: false };
  await db.comment.update({ where: { id: commentId }, data: { deletedAt: null } });
  return { id: commentId, restored: true };
}

/** Instalments of any loan, for admin review and overrides. */
export async function listLoanRepayments(actor: Actor, loanId: string, db: Db = prisma) {
  assertRole(actor, "ADMIN");
  const loan = await db.loan.findUnique({ where: { id: loanId }, select: { id: true } });
  if (!loan) throw new NotFoundError("Loan not found");
  const rows = await db.repayment.findMany({
    where: { loanId },
    select: { id: true, installmentNo: true, dueDate: true, amountBdt: true, status: true, markedPaidAt: true, confirmedAt: true, note: true },
    orderBy: { installmentNo: "asc" },
  });
  return rows.map((r) => ({
    ...r,
    dueDate: r.dueDate.toISOString(),
    markedPaidAt: r.markedPaidAt?.toISOString() ?? null,
    confirmedAt: r.confirmedAt?.toISOString() ?? null,
  }));
}
