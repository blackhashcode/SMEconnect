import "@/server/openapi/setup";
import { z } from "zod";
import { idSchema, isoDateTimeSchema } from "@/server/validators/common";
import { postAuthorSchema } from "@/server/validators/social";

/** The target id is always validated against the session user; never a trusted actor id. */
export const blockUserSchema = z.object({ userId: idSchema }).strict();

export const blockedUserSchema = z
  .object({
    userId: z.string(),
    user: postAuthorSchema,
    blockedAt: isoDateTimeSchema,
  })
  .strict();

export const blockedUserListSchema = z.array(blockedUserSchema);

export const blockResultSchema = blockedUserSchema;

export const unblockResultSchema = z
  .object({ userId: z.string(), blocked: z.literal(false) })
  .strict();
