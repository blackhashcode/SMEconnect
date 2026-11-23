import { prisma } from "@/server/db";
import { sendEmail } from "@/server/notifications/email";
import { renderRepaymentEmail } from "@/server/notifications/templates/repayment";
import {
  isReminderUniqueViolation,
  reminderKindFor,
  repaymentInclude,
  type RepaymentDeps,
} from "@/server/services/repayments";
import { toIso } from "@/server/services/lending-shared";
import type { notificationTypeSchema } from "@/server/validators/enums";
import type { z } from "zod";

type Db = typeof prisma;
type NotificationType = z.infer<typeof notificationTypeSchema>;
type JobLogger = (message: string, meta?: Record<string, unknown>) => void;
type JsonData = Record<string, string | number | boolean | null>;

export interface ReminderJobResult {
  dueNotified: number;
  overdueNotified: number;
  skipped: number;
  failed: number;
}

const defaultLogger: JobLogger = (message, meta) => {
  console.warn(message, meta ?? "");
};

function notificationId(
  kind: "DUE" | "OVERDUE",
  repaymentId: string,
  userId: string,
): string {
  return `rem_${kind.toLowerCase()}_${repaymentId}_${userId}`;
}

function emailStatusOf(data: unknown): string | null {
  if (!data || typeof data !== "object") return null;
  const status = (data as Record<string, unknown>).emailStatus;
  return typeof status === "string" ? status : null;
}

async function claimNotification(
  db: Pick<Db, "notification">,
  args: {
    id: string;
    userId: string;
    type: NotificationType;
    title: string;
    body: string;
    link: string;
    data: JsonData;
  },
): Promise<"claimed" | "already-sent" | "in-progress"> {
  try {
    await db.notification.create({
      data: { ...args, data: { ...args.data, emailStatus: "PENDING" } },
    });
    return "claimed";
  } catch (error) {
    if (!isReminderUniqueViolation(error)) throw error;
    const existing = await db.notification.findUnique({ where: { id: args.id } });
    return emailStatusOf(existing?.data) === "SENT" ? "already-sent" : "in-progress";
  }
}

/**
 * Sends due/overdue reminders with database-backed idempotency. A deterministic
 * Notification row is claimed before delivery; repeated cron runs see SENT and skip.
 * If delivery fails the claim is removed so a later run can retry.
 */
export async function runRepaymentReminders(
  deps: RepaymentDeps = {},
): Promise<ReminderJobResult> {
  const db = deps.db ?? prisma;
  const now = (deps.now ?? (() => new Date()))();
  const sender = deps.sendEmail ?? sendEmail;
  const logger = deps.logger ?? defaultLogger;
  const dueThrough = new Date(now.getTime() + 2 * 24 * 60 * 60 * 1000);

  const candidates = await db.repayment.findMany({
    where: {
      status: { in: ["UPCOMING", "OVERDUE"] },
      OR: [{ status: "UPCOMING", dueDate: { lte: dueThrough } }, { status: "OVERDUE" }],
    },
    include: repaymentInclude,
    orderBy: [{ dueDate: "asc" }, { id: "asc" }],
  });

  const recipientIds = [
    ...new Set(
      candidates.flatMap((row) => {
        const loan = (row as unknown as { loan: { ownerId: string; investorId: string } }).loan;
        return [loan.ownerId, loan.investorId];
      }),
    ),
  ];
  const users = recipientIds.length
    ? await db.user.findMany({
        where: { id: { in: recipientIds } },
        select: { id: true, email: true },
      })
    : [];
  const emails = new Map(
    (users as Array<{ id: string; email: string | null }>).map((user) => [user.id, user.email]),
  );

  const result: ReminderJobResult = {
    dueNotified: 0,
    overdueNotified: 0,
    skipped: 0,
    failed: 0,
  };

  for (const raw of candidates) {
    const repayment = raw as unknown as {
      id: string;
      installmentNo: number;
      amountBdt: number;
      dueDate: Date;
      loan: { id: string; ownerId: string; investorId: string };
    };
    const kind = reminderKindFor(raw as never, now);
    if (!kind) {
      result.skipped += 1;
      continue;
    }

    for (const recipientRole of ["OWNER", "INVESTOR"] as const) {
      const userId =
        recipientRole === "OWNER" ? repayment.loan.ownerId : repayment.loan.investorId;
      const id = notificationId(kind, repayment.id, userId);
      const type: NotificationType = kind === "DUE" ? "REPAYMENT_DUE" : "REPAYMENT_OVERDUE";
      const title =
        kind === "DUE" ? "Repayment due in 2 days" : "Repayment is overdue";
      const body = `Installment ${repayment.installmentNo} of ৳${repayment.amountBdt} is ${
        kind === "DUE" ? "due in 2 days" : "overdue"
      }.`;
      const data = {
        kind,
        repaymentId: repayment.id,
        loanId: repayment.loan.id,
        installmentNo: repayment.installmentNo,
        amountBdt: repayment.amountBdt,
        dueDate: toIso(repayment.dueDate),
        recipientRole,
      };

      const claim = await claimNotification(db, {
        id,
        userId,
        type,
        title,
        body,
        link: `/repayments/${repayment.id}`,
        data,
      });
      if (claim !== "claimed") {
        result.skipped += 1;
        continue;
      }

      const to = emails.get(userId);
      if (!to) {
        await db.notification.delete({ where: { id } });
        result.skipped += 1;
        continue;
      }

      try {
        const rendered = renderRepaymentEmail(kind, {
          loanId: repayment.loan.id,
          repaymentId: repayment.id,
          installmentNo: repayment.installmentNo,
          amountBdt: repayment.amountBdt,
          dueDate: toIso(repayment.dueDate),
          recipientRole,
        });
        await sender({ to, ...rendered });
        await db.notification.updateMany({
          where: { id },
          data: { data: { ...data, emailStatus: "SENT" } },
        });
        if (kind === "DUE") result.dueNotified += 1;
        else result.overdueNotified += 1;
      } catch {
        logger("Repayment reminder email delivery failed", {
          event: kind,
          loanId: repayment.loan.id,
          repaymentId: repayment.id,
        });
        try {
          await db.notification.delete({ where: { id } });
        } catch {
          // The deterministic id already prevents duplicate notifications.
        }
        result.failed += 1;
      }
    }
  }

  return result;
}
