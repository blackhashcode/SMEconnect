import { z } from "zod";
import { idSchema } from "@/server/validators/common";

export const createConversationSchema = z
  .object({ participantId: idSchema })
  .strict();

export const sendMessageSchema = z
  .object({
    conversationId: idSchema,
    body: z.string().trim().min(1).max(5000),
  })
  .strict();

export const messageActionSchema = z
  .object({ messageId: idSchema })
  .strict();
