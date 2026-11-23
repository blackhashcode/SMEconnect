export type RepaymentFrequencyValue = "WEEKLY" | "BIWEEKLY" | "MONTHLY";

export interface ScheduleInput {
  principalBdt: number;
  interestRatePct: number;
  tenureDays: number;
  frequency: RepaymentFrequencyValue;
  startDate?: Date;
}

export interface ScheduledInstallment {
  installmentNo: number;
  dueDate: Date;
  amountBdt: number;
}

export interface RepaymentScheduleResult {
  principalBdt: number;
  interestBdt: number;
  totalRepayableBdt: number;
  installmentCount: number;
  installments: ScheduledInstallment[];
}

const FREQUENCY_INTERVAL_DAYS: Record<RepaymentFrequencyValue, number> = {
  WEEKLY: 7,
  BIWEEKLY: 14,
  MONTHLY: 30,
};

/**
 * Simple flat interest per AGENTS.md §6:
 * totalRepayable = principal + round(principal * rate% * (tenureDays / 365))
 * All BDT amounts are whole taka integers.
 */
export function calculateTotalRepayableBdt(
  principalBdt: number,
  interestRatePct: number,
  tenureDays: number,
): { interestBdt: number; totalRepayableBdt: number } {
  if (!Number.isInteger(principalBdt) || principalBdt <= 0) {
    throw new RangeError("principalBdt must be a positive integer");
  }
  if (!Number.isFinite(interestRatePct) || interestRatePct < 0) {
    throw new RangeError("interestRatePct must be non-negative");
  }
  if (!Number.isInteger(tenureDays) || tenureDays <= 0) {
    throw new RangeError("tenureDays must be a positive integer");
  }

  const interestBdt = Math.round(principalBdt * (interestRatePct / 100) * (tenureDays / 365));
  return { interestBdt, totalRepayableBdt: principalBdt + interestBdt };
}

/**
 * Generates an exact whole-taka repayment schedule where the final installment
 * absorbs any integer rounding remainder so sum(installments) === totalRepayableBdt.
 */
export function generateRepaymentSchedule(input: ScheduleInput): RepaymentScheduleResult {
  const { interestBdt, totalRepayableBdt } = calculateTotalRepayableBdt(
    input.principalBdt,
    input.interestRatePct,
    input.tenureDays,
  );

  const intervalDays = FREQUENCY_INTERVAL_DAYS[input.frequency];
  const installmentCount = Math.max(1, Math.round(input.tenureDays / intervalDays));
  const baseInstallment = Math.floor(totalRepayableBdt / installmentCount);
  const remainder = totalRepayableBdt - baseInstallment * installmentCount;

  const anchor = input.startDate ? new Date(input.startDate.getTime()) : new Date();
  const installments: ScheduledInstallment[] = [];

  for (let i = 1; i <= installmentCount; i++) {
    const dueDate = new Date(anchor.getTime() + i * intervalDays * 86_400_000);
    const amountBdt = i === installmentCount ? baseInstallment + remainder : baseInstallment;
    installments.push({ installmentNo: i, dueDate, amountBdt });
  }

  return {
    principalBdt: input.principalBdt,
    interestBdt,
    totalRepayableBdt,
    installmentCount,
    installments,
  };
}
