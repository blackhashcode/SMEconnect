import type { Response } from "express";

export type ErrorCode =
  | "VALIDATION_ERROR"
  | "UNAUTHORIZED"
  | "FORBIDDEN"
  | "NOT_FOUND"
  | "CONFLICT"
  | "BUSINESS_RULE_VIOLATION"
  | "RATE_LIMITED"
  | "UNSUPPORTED_MEDIA_TYPE"
  | "PAYLOAD_TOO_LARGE"
  | "INTERNAL_ERROR";

export function ok<T>(res: Response, data: T, meta?: Record<string, unknown>) {
  res.status(200).json(meta === undefined ? { data } : { data, meta });
}

export function created<T>(res: Response, data: T, meta?: Record<string, unknown>) {
  res.status(201).json(meta === undefined ? { data } : { data, meta });
}

export function fail(
  res: Response,
  status: number,
  code: ErrorCode,
  message: string,
  details?: { fieldErrors?: Record<string, string[] | undefined>; [key: string]: unknown },
) {
  res.status(status).json({
    error: {
      code,
      message,
      ...(details ? { details } : {}),
    },
  });
}

const REDACTED = new Set(["password", "password_hash", "token", "cookie", "authorization", "nid"]);

function sanitize(value: unknown, depth = 0): unknown {
  if (depth > 3 || value === null || value === undefined || typeof value !== "object") return value;
  if (Array.isArray(value)) return value.map((v) => sanitize(v, depth + 1));
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
    out[k] = REDACTED.has(k.toLowerCase()) ? "[REDACTED]" : sanitize(v, depth + 1);
  }
  return out;
}

export const logger = {
  info: (message: string, meta?: Record<string, unknown>) =>
    console.info(JSON.stringify({ timestamp: new Date().toISOString(), level: "info", service: "smeconnect-mock-api", message, ...(meta ? { meta: sanitize(meta) } : {}) })),
  warn: (message: string, meta?: Record<string, unknown>) =>
    console.warn(JSON.stringify({ timestamp: new Date().toISOString(), level: "warn", service: "smeconnect-mock-api", message, ...(meta ? { meta: sanitize(meta) } : {}) })),
  error: (message: string, meta?: Record<string, unknown>) =>
    console.error(JSON.stringify({ timestamp: new Date().toISOString(), level: "error", service: "smeconnect-mock-api", message, ...(meta ? { meta: sanitize(meta) } : {}) })),
};

/**
 * Exact flat-interest repayment schedule per AGENTS.md §6:
 * total = principal + round(principal * rate% * (tenureDays / 365))
 * Final installment absorbs rounding remainder so sum(installments) === total.
 */
export function buildRepaymentSchedule(
  principalBdt: number,
  ratePct: number,
  tenureMonths: number,
  frequency: string,
  startDate = new Date(),
) {
  const tenureDays = Math.max(30, Math.round(tenureMonths * 30));
  const interestBdt = Math.round(principalBdt * (ratePct / 100) * (tenureDays / 365));
  const totalRepayableBdt = principalBdt + interestBdt;
  const intervalDays = frequency === "Weekly" ? 7 : frequency === "Bi-weekly" ? 14 : 30;
  const count = Math.max(1, Math.round(tenureDays / intervalDays));
  const base = Math.floor(totalRepayableBdt / count);
  const remainder = totalRepayableBdt - base * count;

  const installments = Array.from({ length: count }, (_, idx) => {
    const no = idx + 1;
    const dueDate = new Date(startDate.getTime() + no * intervalDays * 86_400_000).toISOString();
    return {
      installmentNo: no,
      dueDate,
      amountBdt: no === count ? base + remainder : base,
    };
  });

  return { totalRepayableBdt, interestBdt, count, installments };
}
