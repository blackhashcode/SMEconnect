import "@/server/openapi/setup";
import { z } from "zod";
import { isoDateTimeSchema } from "@/server/validators/common";

/** Shape returned by GET /api/v1/health. */
export const healthStatusSchema = z
  .object({
    status: z.literal("ok"),
    database: z.literal("connected"),
    timestamp: isoDateTimeSchema,
  })
  .strict();
