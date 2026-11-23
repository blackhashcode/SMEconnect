import "@/server/openapi/setup";
import { z } from "zod";
import { idSchema, isoDateTimeSchema } from "@/server/validators/common";
import { postAuthorSchema } from "@/server/validators/social";

/** Removes HTML-like tags, control characters and excessive blank lines from plain text. */
export function sanitizeMessageBody(value: string): string {
  return value
    .replace(/<[^>]*>/g, "")
    .replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/g, "")
    .replace(/[ \t]+\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

export const messageBodySchema = z
  .string()
  .max(5000, "Message must be at most 5000 characters")
  .transform(sanitizeMessageBody)
  .refine((value) => value.length > 0, "Message cannot be empty");

export const createConversationSchema = z
  .object({ participantId: idSchema })
  .strict();

/** The conversation id comes from the route; only the body is client-authored. */
export const sendMessageSchema = z.object({ body: messageBodySchema }).strict();

/** Raw message id for polling-friendly `?after=<messageId>`. */
export const messageListQuerySchema = z.object({ after: idSchema.optional() }).strict();

/** Kept for clients that send the message id in a body; routes use the path id. */
export const messageActionSchema = z.object({ messageId: idSchema }).strict();

// ---------------------------------------------------------------------------
// Response shapes — explicit allow-lists, never raw Prisma rows
// ---------------------------------------------------------------------------

/** Safe participant card. The id is public (the same id used by `/profiles/{id}`). */
export const messageParticipantSchema = postAuthorSchema.extend({ id: z.string() }).strict();

export const messageSummarySchema = z
  .object({
    id: z.string(),
    conversationId: z.string(),
    senderId: z.string(),
    mine: z.boolean(),
    body: z.string(),
    readAt: isoDateTimeSchema.nullable(),
    createdAt: isoDateTimeSchema,
    updatedAt: isoDateTimeSchema,
  })
  .strict();

export const messageRecordSchema = messageSummarySchema;

export const conversationRecordSchema = z
  .object({
    id: z.string(),
    participant: messageParticipantSchema,
    lastMessage: messageSummarySchema.nullable(),
    unreadCount: z.number().int().nonnegative(),
    createdAt: isoDateTimeSchema,
    updatedAt: isoDateTimeSchema,
  })
  .strict();

export const markReadResultSchema = z
  .object({
    conversationId: z.string(),
    markedRead: z.number().int().nonnegative(),
    unreadCount: z.number().int().nonnegative(),
  })
  .strict();

export const conversationRecordListSchema = z.array(conversationRecordSchema);
export const messageRecordListSchema = z.array(messageRecordSchema);
