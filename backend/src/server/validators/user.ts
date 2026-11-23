import "@/server/openapi/setup";
import { z } from "zod";
import { optionalTextSchema, shortTextSchema, urlSchema } from "@/server/validators/common";
import { userStatusSchema } from "@/server/validators/enums";

/**
 * Bangladeshi mobile numbers: 01XXXXXXXXX, 8801XXXXXXXXX or +8801XXXXXXXXX,
 * operator prefixes 013–019, spaces or dashes allowed. Normalised to E.164
 * (+8801XXXXXXXXX) so the same number can't be stored in different forms.
 */
const BD_MOBILE_PATTERN = /^(?:\+?88)?(01[3-9]\d{8})$/;

export const phoneSchema = z
  .string()
  .trim()
  .transform((value) => value.replace(/[\s-]/g, ""))
  .pipe(z.string().regex(BD_MOBILE_PATTERN, "Enter a Bangladeshi mobile number, e.g. 01712345678"))
  .transform((value) => `+88${BD_MOBILE_PATTERN.exec(value)![1]}`);

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
