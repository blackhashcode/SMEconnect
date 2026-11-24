import type { prisma as PrismaClient } from "@/server/db";

type Db = typeof PrismaClient;
const defaultDb = async (): Promise<Db> => (await import("@/server/db")).prisma;
// Without a database (unit tests) there's nothing to write to; skip instead of
// loading the database client, which is slow and only to fail anyway.
const noDatabase = (db?: unknown) => !db && !process.env.DATABASE_URL;

export interface NotifyInput {
  userId: string;
  type: "CONNECTION_REQUEST" | "CONNECTION_ACCEPTED" | "MESSAGE_RECEIVED";
  title: string;
  body: string;
  link: string;
  data?: Record<string, unknown>;
}

/**
 * Creates an in-app notification for social events (connections, messages).
 * Never throws: a failed notification must not fail the action itself.
 * For messages, only one unread notification per conversation is kept, so a
 * burst of messages doesn't flood the recipient's tray.
 */
export async function notifyUser(input: NotifyInput, db?: Db): Promise<void> {
  if (noDatabase(db)) return;
  try {
    const client = db ?? (await defaultDb());
    if (input.type === "MESSAGE_RECEIVED" && input.data?.conversationId) {
      const pending = await client.notification.findFirst({
        where: {
          userId: input.userId,
          type: "MESSAGE_RECEIVED",
          readAt: null,
          data: { path: ["conversationId"], equals: String(input.data.conversationId) },
        },
        select: { id: true },
      });
      if (pending) {
        await client.notification.update({ where: { id: pending.id }, data: { body: input.body, createdAt: new Date() } });
        return;
      }
    }
    await client.notification.create({
      data: { userId: input.userId, type: input.type, title: input.title, body: input.body, link: input.link, data: (input.data ?? undefined) as object | undefined },
    });
  } catch (error) {
    console.error(JSON.stringify({ level: "warn", message: "notification failed", type: input.type, error: error instanceof Error ? error.message : String(error) }));
  }
}

/** Notifies the other participant of a new message. Never throws. */
export async function notifyMessageRecipient(
  conversationId: string,
  sender: { id: string; name: string },
  body: string,
  db?: Db,
): Promise<void> {
  if (noDatabase(db)) return;
  try {
    const client = db ?? (await defaultDb());
    const convo = await client.conversation.findUnique({
      where: { id: conversationId },
      select: { participantOneId: true, participantTwoId: true },
    });
    if (!convo) return;
    const recipientId = convo.participantOneId === sender.id ? convo.participantTwoId : convo.participantOneId;
    const preview = body.length > 120 ? `${body.slice(0, 117)}...` : body;
    await notifyUser(
      { userId: recipientId, type: "MESSAGE_RECEIVED", title: `New message from ${sender.name}`, body: preview, link: `/conversations/${conversationId}`, data: { conversationId, fromUserId: sender.id } },
      client,
    );
  } catch (error) {
    console.error(JSON.stringify({ level: "warn", message: "message notification failed", error: error instanceof Error ? error.message : String(error) }));
  }
}

/** Marks the "new message" notifications for one conversation read. Never throws. */
export async function clearMessageNotifications(userId: string, conversationId: string, db?: Db): Promise<void> {
  if (noDatabase(db)) return;
  try {
    const client = db ?? (await defaultDb());
    await client.notification.updateMany({
      where: { userId, type: "MESSAGE_RECEIVED", readAt: null, data: { path: ["conversationId"], equals: conversationId } },
      data: { readAt: new Date() },
    });
  } catch (error) {
    console.error(JSON.stringify({ level: "warn", message: "clearing message notifications failed", error: error instanceof Error ? error.message : String(error) }));
  }
}

/**
 * After an instalment is confirmed, the business publishes a REPAYMENT post to
 * the feed ("repaid instalment 2 of 6, on time"). No amounts are shown. Never
 * throws: the confirmation itself must not fail because of the post.
 */
export async function publishRepaymentPost(repaymentId: string, db?: Db): Promise<void> {
  if (noDatabase(db)) return;
  try {
    const client = db ?? (await defaultDb());
    const r = await client.repayment.findUnique({
      where: { id: repaymentId },
      select: {
        installmentNo: true,
        status: true,
        dueDate: true,
        markedPaidAt: true,
        confirmedAt: true,
        loan: { select: { ownerId: true, loanRequestId: true, _count: { select: { repayments: true } } } },
      },
    });
    if (!r || r.status !== "CONFIRMED") return;
    const paidAt = r.markedPaidAt ?? r.confirmedAt;
    const onTime = paidAt ? paidAt.getTime() <= r.dueDate.getTime() : false;
    const total = r.loan._count.repayments;
    const content =
      r.installmentNo === total
        ? `Fully repaid a loan on SME Connect: all ${total} instalments done${onTime ? ", the last one on time" : ""}.`
        : `Repaid instalment ${r.installmentNo} of ${total}${onTime ? " on time" : ""}.`;
    await client.post.create({ data: { authorId: r.loan.ownerId, type: "REPAYMENT", content } });
  } catch (error) {
    console.error(JSON.stringify({ level: "warn", message: "repayment post failed", error: error instanceof Error ? error.message : String(error) }));
  }
}
