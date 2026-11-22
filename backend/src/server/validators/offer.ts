import { z } from "zod";
import {
  idSchema,
  isoDateTimeSchema,
  optionalTextSchema,
  positiveBdtSchema,
  ratePctSchema,
  tenureDaysSchema,
} from "@/server/validators/common";
import {
  offerProposerSchema,
  repaymentFrequencySchema,
} from "@/server/validators/enums";

export const createOfferSchema = z
  .object({
    loanRequestId: idSchema,
    amountBdt: positiveBdtSchema,
    interestRatePct: ratePctSchema,
    tenureDays: tenureDaysSchema,
    repaymentFrequency: repaymentFrequencySchema,
    message: optionalTextSchema,
    // Server derives the 7-day expiry when omitted.
    expiresAt: isoDateTimeSchema.optional(),
  })
  .strict();

export const counterOfferSchema = createOfferSchema
  .extend({
    parentOfferId: idSchema,
    proposedBy: offerProposerSchema,
  })
  .strict();

export const offerActionSchema = z
  .object({
    offerId: idSchema,
    note: optionalTextSchema,
  })
  .strict();
