import { z } from "zod";
import {
  idSchema,
  longTextSchema,
  optionalTextSchema,
  positiveBdtSchema,
  ratePctSchema,
  tenureDaysSchema,
  urlArraySchema,
} from "@/server/validators/common";
import { repaymentFrequencySchema } from "@/server/validators/enums";

export const createLoanRequestSchema = z
  .object({
    amountBdt: positiveBdtSchema,
    purpose: z.string().trim().min(1).max(200),
    fundUsage: longTextSchema,
    tenureDays: tenureDaysSchema,
    repaymentFrequency: repaymentFrequencySchema,
    proposedRatePct: ratePctSchema,
    proofUrls: urlArraySchema(10).default([]),
  })
  .strict();

export const updateLoanRequestSchema =
  createLoanRequestSchema.partial().strict();

export const loanRequestActionSchema = z
  .object({
    loanRequestId: idSchema,
    note: optionalTextSchema,
  })
  .strict();
