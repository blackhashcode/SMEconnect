import { z } from "zod";
import {
  idSchema,
  optionalTextSchema,
  urlSchema,
} from "@/server/validators/common";

export const markRepaymentPaidSchema = z
  .object({
    repaymentId: idSchema,
    note: optionalTextSchema,
    proofUrl: urlSchema.optional(),
  })
  .strict();

export const confirmRepaymentSchema = z
  .object({
    repaymentId: idSchema,
  })
  .strict();
