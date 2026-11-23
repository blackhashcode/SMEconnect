import { describe, expect, it } from "vitest";
import { calculateTotalRepayableBdt, generateRepaymentSchedule } from "@/lib/finance";

describe("finance — flat interest & repayment schedule", () => {
  it("computes simple flat interest in whole BDT using tenureDays / 365", () => {
    const res = calculateTotalRepayableBdt(100_000, 12, 365);
    expect(res.interestBdt).toBe(12_000);
    expect(res.totalRepayableBdt).toBe(112_000);
  });

  it("absorbs rounding remainder into the final installment so totals always match exactly", () => {
    const schedule = generateRepaymentSchedule({
      principalBdt: 100_000,
      interestRatePct: 11.5,
      tenureDays: 180,
      frequency: "MONTHLY",
      startDate: new Date("2026-01-01T00:00:00.000Z"),
    });

    expect(schedule.installmentCount).toBe(6);
    const sum = schedule.installments.reduce((acc, item) => acc + item.amountBdt, 0);
    expect(sum).toBe(schedule.totalRepayableBdt);
    // All amounts must be positive whole integers
    for (const item of schedule.installments) {
      expect(Number.isInteger(item.amountBdt)).toBe(true);
      expect(item.amountBdt).toBeGreaterThan(0);
    }
    // Last installment >= base installment
    expect(schedule.installments.at(-1)!.amountBdt).toBeGreaterThanOrEqual(
      schedule.installments[0].amountBdt,
    );
  });

  it("supports WEEKLY and BIWEEKLY frequencies with monotonic due dates", () => {
    const start = new Date("2026-03-01T00:00:00.000Z");
    const weekly = generateRepaymentSchedule({
      principalBdt: 50_000,
      interestRatePct: 10,
      tenureDays: 84,
      frequency: "WEEKLY",
      startDate: start,
    });
    expect(weekly.installmentCount).toBe(12);
    expect(weekly.installments[0].dueDate.toISOString()).toBe("2026-03-08T00:00:00.000Z");
    expect(weekly.installments.reduce((a, b) => a + b.amountBdt, 0)).toBe(weekly.totalRepayableBdt);

    const biweekly = generateRepaymentSchedule({
      principalBdt: 75_000,
      interestRatePct: 14.5,
      tenureDays: 140,
      frequency: "BIWEEKLY",
      startDate: start,
    });
    expect(biweekly.installmentCount).toBe(10);
    expect(biweekly.installments[0].dueDate.toISOString()).toBe("2026-03-15T00:00:00.000Z");
    expect(biweekly.installments.reduce((a, b) => a + b.amountBdt, 0)).toBe(
      biweekly.totalRepayableBdt,
    );
  });

  it("rejects non-integer or non-positive principal", () => {
    expect(() => calculateTotalRepayableBdt(0, 10, 180)).toThrow(RangeError);
    expect(() => calculateTotalRepayableBdt(1000.5, 10, 180)).toThrow(RangeError);
  });
});
