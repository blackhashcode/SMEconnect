import { z } from "zod";

const INVISIBLE = /[\u200B-\u200D\u2060\uFEFF]/g;

export const cleanString = (min: number, max: number) =>
  z
    .string()
    .transform((v) => v.replace(INVISIBLE, "").trim())
    .pipe(z.string().min(min).max(max));

export const repaymentFrequencySchema = z.enum(["WEEKLY", "BIWEEKLY", "MONTHLY"]);

export const submitVerificationSchema = z.object({
  nidMasked: cleanString(4, 32),
  tradeLicense: cleanString(2, 64).optional(),
  idDocumentUrl: z.string().min(1).max(500),
  salesProofUrls: z.array(z.string().min(1).max(500)).max(5).default([]),
  shopLinks: z.array(z.string().url()).max(5).default([]),
});

export const reviewVerificationSchema = z.object({
  decision: z.enum(["APPROVED", "REJECTED"]),
  reviewNote: cleanString(0, 500).optional(),
});

export const createLoanRequestSchema = z.object({
  title: cleanString(5, 120),
  amountBdt: z.number().int().min(10_000).max(50_000_000),
  purpose: cleanString(2, 80),
  description: cleanString(20, 2000),
  tenureDays: z.number().int().min(30).max(1095),
  proposedRatePct: z.number().min(1).max(30),
  repaymentFrequency: repaymentFrequencySchema,
  highlights: z.array(cleanString(1, 120)).max(5).optional().default([]),
  publishNow: z.boolean().optional().default(true),
});

export const updateLoanStatusSchema = z.object({
  status: z.enum(["OPEN", "PAUSED", "CANCELLED"]),
});

export const createOfferSchema = z.object({
  amountBdt: z.number().int().min(10_000).max(50_000_000),
  interestRatePct: z.number().min(1).max(30),
  tenureDays: z.number().int().min(30).max(1095),
  repaymentFrequency: repaymentFrequencySchema,
  message: cleanString(0, 1000).optional().default(""),
});

export const respondOfferSchema = z.discriminatedUnion("action", [
  z.object({ action: z.literal("ACCEPT") }),
  z.object({ action: z.literal("REJECT"), note: cleanString(0, 500).optional() }),
  z.object({ action: z.literal("WITHDRAW") }),
  z.object({
    action: z.literal("COUNTER"),
    amountBdt: z.number().int().min(10_000).max(50_000_000),
    interestRatePct: z.number().min(1).max(30),
    tenureDays: z.number().int().min(30).max(1095),
    repaymentFrequency: repaymentFrequencySchema.optional(),
    message: cleanString(0, 1000).optional().default(""),
  }),
]);

export const markRepaymentPaidSchema = z.object({
  note: cleanString(0, 500).optional(),
  proofUrl: z.string().max(500).optional(),
});

export const createConnectionSchema = z.object({
  addresseeId: z.string().min(1).max(80),
  message: cleanString(0, 500).optional().default(""),
});

export const respondConnectionSchema = z.object({
  decision: z.enum(["ACCEPTED", "DECLINED"]),
});

export const openThreadSchema = z.object({
  participantId: z.string().min(1).max(80),
  subject: cleanString(0, 120).optional(),
  loanRequestId: z.string().max(80).optional(),
  text: cleanString(0, 4000).optional(),
});

export const sendMessageSchema = z.object({
  text: cleanString(1, 4000),
});
