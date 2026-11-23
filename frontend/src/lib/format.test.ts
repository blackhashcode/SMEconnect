import { describe, expect, it } from "vitest";
import { formatBDT, repaymentPlan } from "@/lib/format";

describe("format utilities", () => {
  it("formats BDT using Indian/Bangladeshi lakh/crore grouping", () => {
    expect(formatBDT(150_000)).toBe("৳1,50,000");
  });

  it("ensures installments sum exactly to total repayable amount", () => {
    const plan = repaymentPlan(100_000, 11.5, 6, "Monthly");
    expect(plan.cycles).toBe(6);
    const exactSum = plan.installment * (plan.cycles - 1) + plan.finalInstallment;
    expect(exactSum).toBe(plan.total);
    expect(plan.finalInstallment).toBeGreaterThanOrEqual(plan.installment);
  });

  it("handles zero or negative amounts safely", () => {
    expect(repaymentPlan(0, 12, 12, "Monthly")).toEqual({
      total: 0,
      cycles: 0,
      installment: 0,
      finalInstallment: 0,
    });
  });
});
