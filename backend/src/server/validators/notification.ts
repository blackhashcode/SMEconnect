import "@/server/openapi/setup";
import { z } from "zod";
import { isoDateTimeSchema } from "@/server/validators/common";
import { notificationTypeSchema } from "@/server/validators/enums";

/** `?unread=true` keeps the cursor/limit parameters handled by parsePagination. */
export const notificationListQuerySchema = z
  .object({
    unread: z
      .enum(["true", "false"])
      .transform((value) => value === "true")
      .optional(),
  })
  .strict();

export const notificationRecordSchema = z
  .object({
    id: z.string(),
    userId: z.string(),
    type: notificationTypeSchema,
    title: z.string(),
    body: z.string(),
    link: z.string().nullable(),
    data: z.unknown().nullable(),
    readAt: isoDateTimeSchema.nullable(),
    createdAt: isoDateTimeSchema,
    updatedAt: isoDateTimeSchema,
  })
  .strict();

export const notificationRecordListSchema = z.array(notificationRecordSchema);

export const unreadNotificationCountSchema = z
  .object({ unread: z.number().int().nonnegative() })
  .strict();

export const notificationMarkReadResultSchema = z
  .object({
    id: z.string(),
    read: z.literal(true),
    readAt: isoDateTimeSchema,
  })
  .strict();

export const notificationMarkAllReadResultSchema = z
  .object({ markedRead: z.number().int().nonnegative() })
  .strict();
