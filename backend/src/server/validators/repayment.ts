import "@/server/openapi/setup";
import { z } from "zod";
import {
  idSchema,
  isoDateTimeSchema,
  positiveBdtSchema,
} from "@/server/validators/common";
import {
  loanStatusSchema,
  repaymentFrequencySchema,
  repaymentStatusSchema,
} from "@/server/validators/enums";
import { offerPartySchema } from "@/server/validators/offer";
import { sanitizeMessageBody } from "@/server/validators/message";
import { privateFileUrlSchema } from "@/server/validators/storage";

/** Notes are plain text; HTML-like tags and control characters are stripped server-side. */
const repaymentNoteSchema = z
  .string()
  .max(5000, "Note must be at most 5000 characters")
  .transform(sanitizeMessageBody)
  .refine((value) => value.length > 0, "Note cannot be empty")
  .optional();

/** The repayment id stays in the path; the body never carries identity, status or amounts. */
export const markRepaymentPaidSchema = z
  .object({
    note: repaymentNoteSchema,
    proofUrl: privateFileUrlSchema.optional(),
  })
  .strict();

/** Confirmation has no client-authored fields at all. */
export const confirmRepaymentSchema = z.object({}).strict();

export const repaymentListQuerySchema = z
  .object({
    loanId: idSchema.optional(),
  })
  .strict();

// ---------------------------------------------------------------------------
// Response shapes — explicit allow-lists, never raw Prisma rows
// ---------------------------------------------------------------------------

export const repaymentRecordSchema = z
  .object({
    id: z.string(),
    loanId: z.string(),
    installmentNo: z.number().int().positive(),
    dueDate: isoDateTimeSchema,
    amountBdt: positiveBdtSchema,
    status: repaymentStatusSchema,
    markedPaidAt: isoDateTimeSchema.nullable(),
    confirmedAt: isoDateTimeSchema.nullable(),
    note: z.string().nullable(),
    proofUrl: privateFileUrlSchema.nullable(),
    createdAt: isoDateTimeSchema,
    updatedAt: isoDateTimeSchema,
  })
  .strict();

export const repaymentRecordListSchema = z.array(repaymentRecordSchema);

export const repaymentHistoryEventTypeSchema = z.enum([
  "SCHEDULED",
  "OVERDUE",
  "MARKED_PAID",
  "CONFIRMED",
]);

export const repaymentHistoryEventSchema = z
  .object({
    id: z.string(),
    type: repaymentHistoryEventTypeSchema,
    at: isoDateTimeSchema,
    installmentNo: z.number().int().positive(),
    amountBdt: positiveBdtSchema,
    actorRole: z.enum(["OWNER", "INVESTOR", "SYSTEM"]),
    note: z.string().nullable(),
    proofUrl: privateFileUrlSchema.nullable(),
  })
  .strict();

export const repaymentHistoryEventListSchema = z.array(repaymentHistoryEventSchema);

export const loanProgressSchema = z
  .object({
    totalInstallments: z.number().int().nonnegative(),
    upcomingCount: z.number().int().nonnegative(),
    overdueCount: z.number().int().nonnegative(),
    markedPaidCount: z.number().int().nonnegative(),
    confirmedCount: z.number().int().nonnegative(),
    confirmedBdt: z.number().int().nonnegative(),
    outstandingBdt: z.number().int().nonnegative(),
  })
  .strict();

export const loanDetailSchema = z
  .object({
    id: z.string(),
    loanRequestId: z.string(),
    offerId: z.string(),
    agreementId: z.string().nullable(),
    status: loanStatusSchema,
    principalBdt: positiveBdtSchema,
    interestRatePct: z.string(),
    tenureDays: z.number().int().positive(),
    repaymentFrequency: repaymentFrequencySchema,
    totalRepayableBdt: positiveBdtSchema,
    startDate: isoDateTimeSchema.nullable(),
    parties: z
      .object({
        owner: offerPartySchema,
        investor: offerPartySchema,
      })
      .strict(),
    schedule: repaymentRecordListSchema,
    history: repaymentHistoryEventListSchema,
    progress: loanProgressSchema,
    createdAt: isoDateTimeSchema,
    updatedAt: isoDateTimeSchema,
  })
  .strict();

export const repaymentDetailResultSchema = z
  .object({
    repayment: repaymentRecordSchema,
    loanId: z.string(),
    installmentNo: z.number().int().positive(),
  })
  .strict();
