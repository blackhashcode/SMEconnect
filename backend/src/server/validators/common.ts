import { z } from "zod";

/** PostgreSQL INTEGER upper bound; BDT amounts are whole-taka Int values. */
export const MAX_BDT = 2_147_483_647;

export const idSchema = z.string().trim().min(1).max(64);
export const emailSchema = z.email().max(255);
export const urlSchema = z
  .url()
  .max(2048)
  .refine(
    (value) => value.startsWith("http://") || value.startsWith("https://"),
    "Only HTTP(S) URLs are allowed",
  );
export const isoDateTimeSchema = z.iso.datetime();
export const plainDateSchema = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, "Expected YYYY-MM-DD");

export const shortTextSchema = z.string().trim().min(1).max(200);
export const longTextSchema = z.string().trim().min(1).max(5000);
export const optionalTextSchema = z.string().trim().max(5000).optional();

export const bdtAmountSchema = z.number().int().min(0).max(MAX_BDT);
export const positiveBdtSchema = z.number().int().positive().max(MAX_BDT);
export const ratingSchema = z.number().int().min(1).max(5);
export const tenureDaysSchema = z.number().int().positive().max(3650);

export function urlArraySchema(max = 10) {
  return z.array(urlSchema).max(max);
}

const RATE_PATTERN = /^(?:100(?:\.0{1,2})?|\d{1,2}(?:\.\d{1,2})?)$/;

/** Normalizes a 0–100 percentage to the Decimal(5,2) string Prisma expects. */
export function normalizeRatePct(value: string): string {
  const [whole, fraction = ""] = value.split(".");
  return `${whole}.${(fraction + "00").slice(0, 2)}`;
}

export const ratePctSchema = z
  .union([
    z
      .number()
      .finite()
      .min(0)
      .max(100)
      .refine((value) => RATE_PATTERN.test(String(value)), {
        message: "Use at most two decimal places",
      }),
    z.string().regex(RATE_PATTERN, "Expected a percentage between 0 and 100"),
  ])
  .transform((value) => normalizeRatePct(String(value)));
