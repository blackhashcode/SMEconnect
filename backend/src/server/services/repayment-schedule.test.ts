import { describe, expect, it } from "vitest";
import { ValidationError } from "@/server/errors";
import {
  buildRepaymentSchedule,
  calculateTotalRepayableBdt,
} from "@/server/services/repayment-schedule";

const START = new Date("2026-11-23T18:00:00.000Z");
const MS_PER_DAY = 24 * 60 * 60 * 1000;

describe("repayment schedule", () => {
  it("uses flat interest and rounds half-up to whole taka", () => {
    expect(
      calculateTotalRepayableBdt({
        principalBdt: 50_000,
        interestRatePct: "14.50",
        tenureDays: 90,
      }),
    ).toBe(51_788);
  });

  it("avoids floating-point drift with large integer amounts", () => {
    expect(
      calculateTotalRepayableBdt({
        principalBdt: 1_000_000_000,
        interestRatePct: "12.00",
        tenureDays: 365,
      }),
    ).toBe(1_120_000_000);
  });

  it("rejects invalid rates, tenures and impossible totals", () => {
    expect(() =>
      calculateTotalRepayableBdt({
        principalBdt: 50_000,
        interestRatePct: "100.01",
        tenureDays: 90,
      }),
    ).toThrow(ValidationError);
    expect(() =>
      calculateTotalRepayableBdt({
        principalBdt: 50_000,
        interestRatePct: "14.50",
        tenureDays: 0,
      }),
    ).toThrow(ValidationError);
    expect(() =>
      calculateTotalRepayableBdt({
        principalBdt: 2_147_483_647,
        interestRatePct: "100.00",
        tenureDays: 3650,
      }),
    ).toThrow(ValidationError);
  });

  it("splits weekly installments with the remainder on the last one", () => {
    const schedule = buildRepaymentSchedule({
      principalBdt: 50_000,
      interestRatePct: "14.50",
      tenureDays: 90,
      repaymentFrequency: "WEEKLY",
      startDate: START,
    });

    expect(schedule.installments).toHaveLength(13);
    expect(schedule.installments[0]).toMatchObject({ installmentNo: 1, amountBdt: 3_983 });
    expect(schedule.installments.at(-1)).toMatchObject({
      installmentNo: 13,
      amountBdt: 3_992,
    });
    expect(schedule.installments.reduce((sum, item) => sum + item.amountBdt, 0)).toBe(
      schedule.totalRepayableBdt,
    );
  });

  it("uses 14-day and 30-day intervals for biweekly and monthly plans", () => {
    const biweekly = buildRepaymentSchedule({
      principalBdt: 50_000,
      interestRatePct: "14.50",
      tenureDays: 90,
      repaymentFrequency: "BIWEEKLY",
      startDate: START,
    });
    const monthly = buildRepaymentSchedule({
      principalBdt: 50_000,
      interestRatePct: "14.50",
      tenureDays: 90,
      repaymentFrequency: "MONTHLY",
      startDate: START,
    });

    expect(biweekly.installments).toHaveLength(7);
    expect(biweekly.installments[1].dueDate.getTime()).toBe(
      START.getTime() + 2 * 14 * MS_PER_DAY,
    );
    expect(monthly.installments).toHaveLength(3);
    expect(monthly.installments.map((item) => item.amountBdt)).toEqual([
      17_262, 17_262, 17_264,
    ]);
    expect(monthly.installments.at(-1)?.dueDate.getTime()).toBe(
      START.getTime() + 3 * 30 * MS_PER_DAY,
    );
  });

  it("always emits at least one installment", () => {
    const schedule = buildRepaymentSchedule({
      principalBdt: 1_000,
      interestRatePct: "0",
      tenureDays: 1,
      repaymentFrequency: "MONTHLY",
      startDate: START,
    });
    expect(schedule.installments).toHaveLength(1);
    expect(schedule.installments[0].amountBdt).toBe(1_000);
  });
});
