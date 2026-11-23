import { assertRole, type Actor } from "@/server/auth/policy";
import { prisma } from "@/server/db";
import { ConflictError, ForbiddenError, NotFoundError } from "@/server/errors";
import { cursorId, pageMeta, isUniqueViolation } from "@/server/services/social-shared";
import {
  assertLendingActorVerified,
  loadOfferParties,
  toIso,
} from "@/server/services/lending-shared";
import { renderRepaymentEmail } from "@/server/notifications/templates/repayment";
import type {
  EmailMessage,
} from "@/server/notifications/email";
import { sendEmail } from "@/server/notifications/email";
import { normalizeRatePct } from "@/server/validators/common";
import type {
  loanStatusSchema,
  notificationTypeSchema,
  repaymentFrequencySchema,
  repaymentStatusSchema,
} from "@/server/validators/enums";
import {
  confirmRepaymentSchema,
  markRepaymentPaidSchema,
  repaymentListQuerySchema,
} from "@/server/validators/repayment";
import type { z } from "zod";

type Db = typeof prisma;
type RepaymentStatus = z.infer<typeof repaymentStatusSchema>;
type LoanStatus = z.infer<typeof loanStatusSchema>;
type RepaymentFrequency = z.infer<typeof repaymentFrequencySchema>;
type NotificationType = z.infer<typeof notificationTypeSchema>;
type EmailSender = (message: EmailMessage) => Promise<void>;
type JobLogger = (message: string, meta?: Record<string, unknown>) => void;
type JsonData = Record<string, string | number | boolean | null>;

interface RepaymentHistoryEvent {
  id: string;
  type: "SCHEDULED" | "OVERDUE" | "MARKED_PAID" | "CONFIRMED";
  at: Date;
  actorRole: "OWNER" | "INVESTOR" | "SYSTEM";
  installmentNo: number;
  amountBdt: number;
  note: string | null;
  proofUrl: string | null;
}

export interface RepaymentDeps {
  db?: Db;
  now?: () => Date;
  /** Injected by tests; production uses the shared Mailpit/SMTP sender. */
  sendEmail?: EmailSender;
  logger?: JobLogger;
}

interface LoanRow {
  id: string;
  loanRequestId: string;
  offerId: string;
  ownerId: string;
  investorId: string;
  principalBdt: number;
  interestRatePct: unknown;
  tenureDays: number;
  repaymentFrequency: RepaymentFrequency;
  totalRepayableBdt: number;
  status: LoanStatus;
  startDate: Date | null;
  createdAt: Date;
  updatedAt: Date;
  loanRequest: { id: string; ownerId: string; purpose: string; status: string };
  agreement: { id: string; ownerConfirmedAt: Date | null; investorConfirmedAt: Date | null } | null;
}

interface RepaymentRow {
  id: string;
  loanId: string;
  installmentNo: number;
  dueDate: Date;
  amountBdt: number;
  status: RepaymentStatus;
  markedPaidAt: Date | null;
  confirmedAt: Date | null;
  note: string | null;
  proofUrl: string | null;
  createdAt: Date;
  updatedAt: Date;
  loan: LoanRow;
}

const loanInclude = {
  loanRequest: { select: { id: true, ownerId: true, purpose: true, status: true } },
  agreement: { select: { id: true, ownerConfirmedAt: true, investorConfirmedAt: true } },
} as const;

/** Every repayment read uses the same shape, including its participant-only loan context. */
export const repaymentInclude = {
  loan: { include: loanInclude },
} as const;

const defaultLogger: JobLogger = (message, meta) => {
  console.warn(message, meta ?? "");
};

async function loadLoan(id: string, db: Pick<Db, "loan">): Promise<LoanRow> {
  const loan = await db.loan.findUnique({ where: { id }, include: loanInclude });
  if (!loan) throw new NotFoundError("Loan not found");
  return loan as unknown as LoanRow;
}

async function loadRepayment(
  id: string,
  db: Pick<Db, "repayment">,
): Promise<RepaymentRow> {
  const repayment = await db.repayment.findUnique({ where: { id }, include: repaymentInclude });
  if (!repayment) throw new NotFoundError("Repayment not found");
  return repayment as unknown as RepaymentRow;
}

/** Loan participants only; a non-participant gets 404 so loan existence is not leaked. */
export function assertLoanParticipant(loan: LoanRow, actor: Actor): "OWNER" | "INVESTOR" {
  assertRole(actor, "OWNER", "INVESTOR");
  if (actor.id === loan.ownerId) {
    assertRole(actor, "OWNER");
    return "OWNER";
  }
  if (actor.id === loan.investorId) {
    assertRole(actor, "INVESTOR");
    return "INVESTOR";
  }
  throw new NotFoundError("Loan not found");
}

function assertRepaymentParticipant(
  repayment: RepaymentRow,
  actor: Actor,
): "OWNER" | "INVESTOR" {
  return assertLoanParticipant(repayment.loan, actor);
}

/**
 * Overdue is a read-time derivation too: a persisted UPCOMING row whose due date has
 * passed is reported as OVERDUE without allowing any status other than the valid
 * UPCOMING → MARKED_PAID → CONFIRMED path.
 */
export function deriveRepaymentStatus(row: RepaymentRow, now: Date): RepaymentStatus {
  if (row.status === "MARKED_PAID" || row.status === "CONFIRMED") return row.status;
  if (row.status === "OVERDUE" || row.dueDate.getTime() < now.getTime()) return "OVERDUE";
  return "UPCOMING";
}

export function toRepaymentRecord(row: RepaymentRow, now: Date) {
  return {
    id: row.id,
    loanId: row.loanId,
    installmentNo: row.installmentNo,
    dueDate: toIso(row.dueDate),
    amountBdt: row.amountBdt,
    status: deriveRepaymentStatus(row, now),
    markedPaidAt: row.markedPaidAt ? toIso(row.markedPaidAt) : null,
    confirmedAt: row.confirmedAt ? toIso(row.confirmedAt) : null,
    note: row.note ?? null,
    proofUrl: row.proofUrl ?? null,
    createdAt: toIso(row.createdAt),
    updatedAt: toIso(row.updatedAt),
  };
}

const HISTORY_ORDER: Record<string, number> = {
  SCHEDULED: 0,
  OVERDUE: 1,
  MARKED_PAID: 2,
  CONFIRMED: 3,
};

/** Builds an audit-friendly history from immutable timestamps, never from client input. */
export function toRepaymentHistory(row: RepaymentRow, now: Date) {
  const effective = deriveRepaymentStatus(row, now);
  const base = {
    installmentNo: row.installmentNo,
    amountBdt: row.amountBdt,
    note: row.note ?? null,
    proofUrl: row.proofUrl ?? null,
  };
  const events: RepaymentHistoryEvent[] = [
    {
      id: `${row.id}:scheduled`,
      type: "SCHEDULED" as const,
      at: row.createdAt,
      actorRole: "SYSTEM" as const,
      ...base,
      note: null,
      proofUrl: null,
    },
  ];

  if (effective === "OVERDUE") {
    events.push({
      id: `${row.id}:overdue`,
      type: "OVERDUE" as const,
      at: row.dueDate,
      actorRole: "SYSTEM" as const,
      ...base,
      note: null,
      proofUrl: null,
    });
  }
  if (row.markedPaidAt) {
    events.push({
      id: `${row.id}:marked-paid`,
      type: "MARKED_PAID" as const,
      at: row.markedPaidAt,
      actorRole: "OWNER" as const,
      ...base,
    });
  }
  if (row.confirmedAt) {
    events.push({
      id: `${row.id}:confirmed`,
      type: "CONFIRMED" as const,
      at: row.confirmedAt,
      actorRole: "INVESTOR" as const,
      ...base,
      note: null,
      proofUrl: null,
    });
  }

  return events.sort(
    (a, b) => a.at.getTime() - b.at.getTime() || HISTORY_ORDER[a.type] - HISTORY_ORDER[b.type],
  );
}

async function notify(
  tx: Pick<Db, "notification">,
  userId: string,
  type: NotificationType,
  title: string,
  body: string,
  link: string,
  data: JsonData,
): Promise<void> {
  await tx.notification.create({
    data: { userId, type, title, body, link, data },
  });
}

async function recipientEmail(
  db: Pick<Db, "user">,
  userId: string,
): Promise<string | null> {
  const user = await db.user.findUnique({
    where: { id: userId },
    select: { email: true },
  });
  return user?.email ?? null;
}

async function sendRepaymentEmailSafely(
  input: {
    kind: "DUE" | "OVERDUE" | "MARKED_PAID" | "CONFIRMED";
    recipientId: string;
    recipientRole: "OWNER" | "INVESTOR";
    loanId: string;
    repaymentId: string;
    installmentNo: number;
    amountBdt: number;
    dueDate: Date;
    note?: string | null;
  },
  deps: RepaymentDeps,
): Promise<void> {
  const db = deps.db ?? prisma;
  const sender = deps.sendEmail ?? sendEmail;
  const logger = deps.logger ?? defaultLogger;

  try {
    const to = await recipientEmail(db, input.recipientId);
    if (!to) return;
    const rendered = renderRepaymentEmail(input.kind, {
      loanId: input.loanId,
      repaymentId: input.repaymentId,
      installmentNo: input.installmentNo,
      amountBdt: input.amountBdt,
      dueDate: toIso(input.dueDate),
      recipientRole: input.recipientRole,
      note: input.note,
    });
    await sender({ to, ...rendered });
  } catch {
    // Email is best-effort: never leak SMTP details or undo a committed repayment change.
    logger("Repayment email delivery failed", {
      event: input.kind,
      loanId: input.loanId,
      repaymentId: input.repaymentId,
    });
  }
}

async function listRepayments(
  actor: Actor,
  query: { cursor?: string; limit: number; loanId?: string },
  deps: RepaymentDeps,
) {
  const db = deps.db ?? prisma;
  const now = (deps.now ?? (() => new Date()))();
  const cursor = cursorId(query.cursor);
  const filters = repaymentListQuerySchema.parse({ loanId: query.loanId });

  if (filters.loanId) {
    const loan = await loadLoan(filters.loanId, db);
    assertLoanParticipant(loan, actor);
  }

  const rows = await db.repayment.findMany({
    where: filters.loanId
      ? { loanId: filters.loanId }
      : {
          loan: {
            OR: [{ ownerId: actor.id }, { investorId: actor.id }],
          },
        },
    include: repaymentInclude,
    orderBy: [{ installmentNo: "asc" }, { id: "asc" }],
    take: query.limit + 1,
    ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
  });

  const page = pageMeta(rows as unknown as RepaymentRow[], query.limit);
  return {
    items: page.items.map((row) => toRepaymentRecord(row, now)),
    meta: page.meta,
  };
}

/** Participant-scoped repayment page; the optional loanId filter is verified first. */
export async function listRepaymentsForActor(
  actor: Actor,
  query: { cursor?: string; limit: number; loanId?: string },
  deps: RepaymentDeps = {},
) {
  assertRole(actor, "OWNER", "INVESTOR");
  const db = deps.db ?? prisma;
  await assertLendingActorVerified(actor, db);
  return listRepayments(actor, query, deps);
}

export async function getRepayment(
  actor: Actor,
  id: string,
  deps: RepaymentDeps = {},
) {
  assertRole(actor, "OWNER", "INVESTOR");
  const db = deps.db ?? prisma;
  const now = (deps.now ?? (() => new Date()))();
  await assertLendingActorVerified(actor, db);

  const repayment = await loadRepayment(id, db);
  assertRepaymentParticipant(repayment, actor);
  return toRepaymentRecord(repayment, now);
}

/**
 * Owner claims UPCOMING or OVERDUE. The conditional update plus the status guard makes
 * duplicate and concurrent marks conflict rather than overwrite timestamps or proof.
 */
export async function markRepaymentPaid(
  actor: Actor,
  id: string,
  input: unknown,
  deps: RepaymentDeps = {},
) {
  assertRole(actor, "OWNER", "INVESTOR");
  const db = deps.db ?? prisma;
  const now = (deps.now ?? (() => new Date()))();
  const parsed = markRepaymentPaidSchema.parse(input ?? {});
  await assertLendingActorVerified(actor, db);

  const existing = await loadRepayment(id, db);
  const role = assertRepaymentParticipant(existing, actor);
  if (role !== "OWNER") {
    throw new ForbiddenError("Only the loan owner can mark a repayment as paid");
  }
  const currentStatus = deriveRepaymentStatus(existing, now);
  if (currentStatus === "MARKED_PAID" || currentStatus === "CONFIRMED") {
    throw new ConflictError("Installment has already been marked paid");
  }

  await db.$transaction(async (tx) => {
    const repayment = await loadRepayment(id, tx);
    const participantRole = assertRepaymentParticipant(repayment, actor);
    if (participantRole !== "OWNER") {
      throw new ForbiddenError("Only the loan owner can mark a repayment as paid");
    }

    const claimed = await tx.repayment.updateMany({
      where: {
        id,
        status: { in: ["UPCOMING", "OVERDUE"] },
        markedPaidAt: null,
        confirmedAt: null,
      },
      data: {
        status: "MARKED_PAID",
        markedPaidAt: now,
        confirmedAt: null,
        note: parsed.note ?? null,
        proofUrl: parsed.proofUrl ?? null,
      },
    });
    if (claimed.count === 0) {
      throw new ConflictError("Installment is no longer awaiting payment");
    }

    await notify(
      tx,
      repayment.loan.investorId,
      "REPAYMENT_MARKED_PAID",
      "Repayment marked as paid",
      `Installment ${repayment.installmentNo} of ৳${repayment.amountBdt} was marked as paid.`,
      `/repayments/${repayment.id}`,
      {
        repaymentId: repayment.id,
        loanId: repayment.loanId,
        installmentNo: repayment.installmentNo,
        amountBdt: repayment.amountBdt,
        actorRole: "OWNER",
      },
    );
  });

  await sendRepaymentEmailSafely(
    {
      kind: "MARKED_PAID",
      recipientId: existing.loan.investorId,
      recipientRole: "INVESTOR",
      loanId: existing.loanId,
      repaymentId: existing.id,
      installmentNo: existing.installmentNo,
      amountBdt: existing.amountBdt,
      dueDate: existing.dueDate,
      note: parsed.note ?? null,
    },
    deps,
  );

  return getRepayment(actor, id, deps);
}

/**
 * Investor confirms only a MARKED_PAID row. The final confirmation atomically claims the
 * ACTIVE loan with a "no unconfirmed repayments" predicate, so concurrent confirmations
 * cannot complete or re-complete the loan twice.
 */
export async function confirmRepayment(
  actor: Actor,
  id: string,
  input: unknown = {},
  deps: RepaymentDeps = {},
) {
  assertRole(actor, "OWNER", "INVESTOR");
  const db = deps.db ?? prisma;
  const now = (deps.now ?? (() => new Date()))();
  confirmRepaymentSchema.parse(input ?? {});
  await assertLendingActorVerified(actor, db);

  const existing = await loadRepayment(id, db);
  const role = assertRepaymentParticipant(existing, actor);
  if (role !== "INVESTOR") {
    throw new ForbiddenError("Only the loan investor can confirm a repayment");
  }
  if (deriveRepaymentStatus(existing, now) !== "MARKED_PAID") {
    throw new ConflictError("Installment has not been marked as paid");
  }

  await db.$transaction(async (tx) => {
    const repayment = await loadRepayment(id, tx);
    const participantRole = assertRepaymentParticipant(repayment, actor);
    if (participantRole !== "INVESTOR") {
      throw new ForbiddenError("Only the loan investor can confirm a repayment");
    }
    if (deriveRepaymentStatus(repayment, now) !== "MARKED_PAID") {
      throw new ConflictError("Installment is no longer awaiting confirmation");
    }

    const confirmed = await tx.repayment.updateMany({
      where: { id, status: "MARKED_PAID", markedPaidAt: { not: null }, confirmedAt: null },
      data: { status: "CONFIRMED", confirmedAt: now },
    });
    if (confirmed.count === 0) {
      throw new ConflictError("Installment is no longer awaiting confirmation");
    }

    await notify(
      tx,
      repayment.loan.ownerId,
      "REPAYMENT_CONFIRMED",
      "Repayment confirmed",
      `Installment ${repayment.installmentNo} of ৳${repayment.amountBdt} was confirmed.`,
      `/repayments/${repayment.id}`,
      {
        repaymentId: repayment.id,
        loanId: repayment.loanId,
        installmentNo: repayment.installmentNo,
        amountBdt: repayment.amountBdt,
        actorRole: "INVESTOR",
      },
    );

    const completedLoan = await tx.loan.updateMany({
      where: {
        id: repayment.loanId,
        status: "ACTIVE",
        repayments: { none: { status: { not: "CONFIRMED" } } },
      },
      data: { status: "COMPLETED" },
    });
    if (completedLoan.count === 1) {
      const completedRequest = await tx.loanRequest.updateMany({
        where: { id: repayment.loan.loanRequestId, status: "REPAYING" },
        data: { status: "COMPLETED" },
      });
      if (
        completedRequest.count === 0 &&
        repayment.loan.loanRequest.status !== "COMPLETED"
      ) {
        throw new ConflictError("Loan request is no longer in repayment");
      }
    }
  });

  await sendRepaymentEmailSafely(
    {
      kind: "CONFIRMED",
      recipientId: existing.loan.ownerId,
      recipientRole: "OWNER",
      loanId: existing.loanId,
      repaymentId: existing.id,
      installmentNo: existing.installmentNo,
      amountBdt: existing.amountBdt,
      dueDate: existing.dueDate,
    },
    deps,
  );

  return getRepayment(actor, id, deps);
}

/** Full participant-only loan detail: server-derived schedule, history and progress. */
export async function getLoanDetail(
  actor: Actor,
  loanId: string,
  deps: RepaymentDeps = {},
) {
  assertRole(actor, "OWNER", "INVESTOR");
  const db = deps.db ?? prisma;
  const now = (deps.now ?? (() => new Date()))();
  await assertLendingActorVerified(actor, db);

  const loan = await loadLoan(loanId, db);
  assertLoanParticipant(loan, actor);

  const rows = await db.repayment.findMany({
    where: { loanId },
    include: repaymentInclude,
    orderBy: [{ installmentNo: "asc" }, { id: "asc" }],
  });
  const repayments = rows as unknown as RepaymentRow[];
  const parties = await loadOfferParties([loan.ownerId, loan.investorId], db);
  const owner = parties.get(loan.ownerId);
  const investor = parties.get(loan.investorId);
  if (!owner || !investor) throw new NotFoundError("Loan participant not found");

  const records = repayments.map((row) => toRepaymentRecord(row, now));
  const counts = {
    UPCOMING: 0,
    OVERDUE: 0,
    MARKED_PAID: 0,
    CONFIRMED: 0,
  };
  let confirmedBdt = 0;
  for (const record of records) {
    counts[record.status] += 1;
    if (record.status === "CONFIRMED") confirmedBdt += record.amountBdt;
  }

  return {
    id: loan.id,
    loanRequestId: loan.loanRequestId,
    offerId: loan.offerId,
    agreementId: loan.agreement?.id ?? null,
    status: loan.status,
    principalBdt: loan.principalBdt,
    interestRatePct: normalizeRatePct(String(loan.interestRatePct)),
    tenureDays: loan.tenureDays,
    repaymentFrequency: loan.repaymentFrequency,
    totalRepayableBdt: loan.totalRepayableBdt,
    startDate: loan.startDate ? toIso(loan.startDate) : null,
    parties: { owner, investor },
    schedule: records,
    history: repayments
      .flatMap((row) => toRepaymentHistory(row, now))
      .map((event) => ({ ...event, at: toIso(event.at) })),
    progress: {
      totalInstallments: records.length,
      upcomingCount: counts.UPCOMING,
      overdueCount: counts.OVERDUE,
      markedPaidCount: counts.MARKED_PAID,
      confirmedCount: counts.CONFIRMED,
      confirmedBdt,
      outstandingBdt: Math.max(0, loan.totalRepayableBdt - confirmedBdt),
    },
    createdAt: toIso(loan.createdAt),
    updatedAt: toIso(loan.updatedAt),
  };
}

/** Persists past-due UPCOMING rows as OVERDUE; paid/confirmed rows are never touched. */
export async function markOverdueRepayments(
  deps: RepaymentDeps = {},
): Promise<{ markedOverdue: number }> {
  const db = deps.db ?? prisma;
  const now = (deps.now ?? (() => new Date()))();
  const result = await db.repayment.updateMany({
    where: { status: "UPCOMING", dueDate: { lt: now } },
    data: { status: "OVERDUE" },
  });
  return { markedOverdue: result.count };
}

/** Reused by reminder jobs and their tests to map a stored row to a reminder kind. */
export function reminderKindFor(
  row: RepaymentRow,
  now: Date,
): "DUE" | "OVERDUE" | null {
  const status = deriveRepaymentStatus(row, now);
  if (status === "OVERDUE") return "OVERDUE";
  if (status !== "UPCOMING") return null;
  const dueSoon = new Date(now.getTime() + 2 * 24 * 60 * 60 * 1000);
  if (row.dueDate.getTime() > dueSoon.getTime()) return null;
  return "DUE";
}

export function isReminderUniqueViolation(error: unknown): boolean {
  return isUniqueViolation(error);
}
