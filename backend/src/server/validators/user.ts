import "@/server/openapi/setup";
import { z } from "zod";
import { optionalTextSchema, shortTextSchema, urlSchema } from "@/server/validators/common";
import { userStatusSchema } from "@/server/validators/enums";

export const phoneSchema = z
  .string()
  .trim()
  .regex(/^\+?[0-9][0-9\s-]{6,19}$/, "Invalid phone number");

export const updateUserSchema = z
  .object({
    name: shortTextSchema.optional(),
    phone: phoneSchema.nullable().optional(),
    image: urlSchema.nullable().optional(),
  })
  .strict();

export const adminUpdateUserSchema = updateUserSchema
  .extend({
    status: userStatusSchema.optional(),
  })
  .strict();

export const userIdSchema = z.object({ userId: z.string().trim().min(1) }).strict();

export const userNoteSchema = z
  .object({ note: optionalTextSchema })
  .strict();
