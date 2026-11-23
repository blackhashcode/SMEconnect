import "@/server/openapi/setup";
import { z } from "zod";
import {
  idSchema,
  isoDateTimeSchema,
  positiveBdtSchema,
  ratePctSchema,
  tenureDaysSchema,
} from "@/server/validators/common";
import {
  loanRequestStatusSchema,
  loanStatusSchema,
  offerProposerSchema,
  offerStatusSchema,
  repaymentFrequencySchema,
} from "@/server/validators/enums";
import { messageParticipantSchema, sanitizeMessageBody } from "@/server/validators/message";

/** Offer messages use the same plain-text sanitizer as chat messages. */
const offerMessageSchema = z
  .string()
  .max(5000, "Offer message must be at most 5000 characters")
  .optional()
  .transform((value) => (value === undefined ? undefined : sanitizeMessageBody(value)))
  .refine((value) => value === undefined || value.length > 0, "Offer message cannot be empty");

/** Terms are client-authored; expiry and all identities are derived by the server. */
export const offerTermsSchema = z
  .object({
    amountBdt: positiveBdtSchema,
    interestRatePct: ratePctSchema,
    tenureDays: tenureDaysSchema,
    repaymentFrequency: repaymentFrequencySchema,
    message: offerMessageSchema,
  })
  .strict();

export const createOfferSchema = offerTermsSchema
  .extend({
    loanRequestId: idSchema,
  })
  .strict();

/** The parent offer id comes from the route, never from the request body. */
export const counterOfferSchema = offerTermsSchema.strict();

export const offerListQuerySchema = z
  .object({
    loanRequestId: idSchema.optional(),
  })
  .strict();

export const offerActionSchema = z
  .object({
    note: z.string().trim().max(500).optional(),
  })
  .strict();

// ---------------------------------------------------------------------------
// Response shapes — explicit allow-lists, never raw Prisma rows
// ---------------------------------------------------------------------------

export const offerPartySchema = messageParticipantSchema;

export const offerLoanRequestSummarySchema = z
  .object({
    id: z.string(),
    purpose: z.string(),
    status: loanRequestStatusSchema,
    amountBdt: z.number().int().positive(),
    tenureDays: z.number().int().positive(),
  })
  .strict();

export const offerRecordSchema = z
  .object({
    id: z.string(),
    loanRequest: offerLoanRequestSummarySchema,
    investor: offerPartySchema,
    owner: offerPartySchema,
    amountBdt: z.number().int().positive(),
    interestRatePct: z.string(),
    tenureDays: z.number().int().positive(),
    repaymentFrequency: repaymentFrequencySchema,
    message: z.string().nullable(),
    status: offerStatusSchema,
    proposedBy: offerProposerSchema,
    parentOfferId: z.string().nullable(),
    expiresAt: isoDateTimeSchema,
    createdAt: isoDateTimeSchema,
    updatedAt: isoDateTimeSchema,
  })
  .strict();

export const offerRecordListSchema = z.array(offerRecordSchema);

export const acceptOfferResultSchema = z
  .object({
    loanId: z.string(),
    offer: offerRecordSchema,
  })
  .strict();

// ---------------------------------------------------------------------------
// Agreement and schedule-shape schemas
// ---------------------------------------------------------------------------

export const repaymentInstallmentPreviewSchema = z
  .object({
    installmentNo: z.number().int().positive(),
    dueDate: isoDateTimeSchema,
    amountBdt: z.number().int().positive(),
  })
  .strict();

export const agreementTermsSnapshotSchema = z
  .object({
    loanRequestId: z.string(),
    offerId: z.string(),
    principalBdt: z.number().int().positive(),
    interestRatePct: z.string(),
    tenureDays: z.number().int().positive(),
    repaymentFrequency: repaymentFrequencySchema,
    totalRepayableBdt: z.number().int().positive(),
  })
  .strict();

export const agreementSummarySchema = z
  .object({
    id: z.string(),
    loanId: z.string(),
    loanRequestId: z.string(),
    status: loanStatusSchema,
    parties: z
      .object({
        owner: offerPartySchema,
        investor: offerPartySchema,
      })
      .strict(),
    terms: agreementTermsSnapshotSchema,
    confirmations: z
      .object({
        ownerConfirmedAt: isoDateTimeSchema.nullable(),
        investorConfirmedAt: isoDateTimeSchema.nullable(),
        bothConfirmed: z.boolean(),
      })
      .strict(),
    schedulePreview: z.array(repaymentInstallmentPreviewSchema),
    createdAt: isoDateTimeSchema,
    updatedAt: isoDateTimeSchema,
  })
  .strict();
