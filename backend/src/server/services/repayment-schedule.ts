import { ValidationError } from "@/server/errors";
import { MAX_BDT } from "@/server/validators/common";
import { repaymentFrequencySchema } from "@/server/validators/enums";
import type { z } from "zod";

type RepaymentFrequency = z.infer<typeof repaymentFrequencySchema>;

/** Deterministic interval lengths. A month is treated as 30 days for scheduling. */
const FREQUENCY_DAYS: Record<RepaymentFrequency, number> = {
  WEEKLY: 7,
  BIWEEKLY: 14,
  MONTHLY: 30,
};

const MS_PER_DAY = 24 * 60 * 60 * 1000;
// Rate is stored in hundredths of a percent, so 10,000 × 365 is the interest denominator.
const RATE_DENOMINATOR = BigInt(10_000 * 365);
const ZERO = BigInt(0);
const HUNDRED = BigInt(100);

export interface RepaymentScheduleInput {
  principalBdt: number;
  interestRatePct: string;
  tenureDays: number;
  repaymentFrequency: RepaymentFrequency;
  startDate: Date;
}

export interface RepaymentInstallment {
  installmentNo: number;
  dueDate: Date;
  amountBdt: number;
}

export interface RepaymentSchedule {
  totalRepayableBdt: number;
  installments: RepaymentInstallment[];
}

/** Converts a Decimal(5,2) string such as "14.50" into 1450 hundredths of a percent. */
function rateHundredths(rate: string): bigint {
  const match = /^(\d{1,3})(?:\.(\d{1,2}))?$/.exec(rate.trim());
  if (!match) throw new ValidationError("Invalid interest rate");
  const whole = BigInt(match[1]);
  const fraction = BigInt((match[2] ?? "").padEnd(2, "0"));
  const hundredths = whole * HUNDRED + fraction;
  if (hundredths > BigInt(10_000)) {
    throw new ValidationError("Interest rate cannot exceed 100%");
  }
  return hundredths;
}

/**
 * Flat interest: principal + principal × rate% × (tenureDays / 365), rounded half-up
 * to whole taka. BigInt avoids floating-point drift on large principal amounts.
 */
export function calculateTotalRepayableBdt(input: {
  principalBdt: number;
  interestRatePct: string;
  tenureDays: number;
}): number {
  const { principalBdt, interestRatePct, tenureDays } = input;
  if (!Number.isInteger(principalBdt) || principalBdt <= 0) {
    throw new ValidationError("Principal must be a positive whole-taka amount");
  }
  if (!Number.isInteger(tenureDays) || tenureDays <= 0) {
    throw new ValidationError("Tenure must be a positive number of days");
  }

  const numerator =
    BigInt(principalBdt) * rateHundredths(interestRatePct) * BigInt(tenureDays);
  const interest = (numerator + RATE_DENOMINATOR / BigInt(2)) / RATE_DENOMINATOR;
  const total = BigInt(principalBdt) + interest;
  if (total > BigInt(MAX_BDT) || total < ZERO) {
    throw new ValidationError("Total repayable amount exceeds the supported BDT range");
  }
  return Number(total);
}

/**
 * Splits the total into whole-taka installments. Every installment except the last is
 * the floor share; the last one absorbs the rounding remainder so the sum matches exactly.
 */
export function buildRepaymentSchedule(input: RepaymentScheduleInput): RepaymentSchedule {
  const totalRepayableBdt = calculateTotalRepayableBdt(input);
  const intervalDays = FREQUENCY_DAYS[input.repaymentFrequency];
  const installmentCount = Math.max(1, Math.ceil(input.tenureDays / intervalDays));
  const shareBdt = Math.floor(totalRepayableBdt / installmentCount);

  const installments = Array.from({ length: installmentCount }, (_, index) => {
    const installmentNo = index + 1;
    const isLast = installmentNo === installmentCount;
    return {
      installmentNo,
      dueDate: new Date(
        input.startDate.getTime() + installmentNo * intervalDays * MS_PER_DAY,
      ),
      amountBdt: isLast
        ? totalRepayableBdt - shareBdt * (installmentCount - 1)
        : shareBdt,
    };
  });

  return { totalRepayableBdt, installments };
}
