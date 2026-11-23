import type { NotificationType, Prisma } from "@/generated/prisma/client";
import { prisma } from "@/server/db";
import { sendEmail } from "@/server/notifications/email";

type DbLike = Pick<typeof prisma, "notification" | "user">;

export interface CreateNotificationInput {
  userId: string;
  type: NotificationType;
  title: string;
  body: string;
  link?: string;
  data?: Prisma.InputJsonValue;
  sendEmailCopy?: boolean;
}

/** Creates an in-app notification and optionally dispatches an email copy. */
export async function createNotification(
  input: CreateNotificationInput,
  db: DbLike = prisma,
) {
  const notification = await db.notification.create({
    data: {
      userId: input.userId,
      type: input.type,
      title: input.title,
      body: input.body,
      link: input.link ?? null,
      data: input.data,
    },
  });

  if (input.sendEmailCopy) {
    const user = await db.user.findUnique({
      where: { id: input.userId },
      select: { email: true },
    });
    if (user?.email) {
      void sendEmail({
        to: user.email,
        subject: `[SME Connect] ${input.title}`,
        text: input.body,
      });
    }
  }

  return notification;
}
