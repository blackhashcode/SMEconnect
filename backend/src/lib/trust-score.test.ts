import { describe, expect, it } from "vitest";
import { computeTrustScore } from "@/lib/trust-score";

describe("computeTrustScore", () => {
  it("gives baseline score to unverified new member", () => {
    expect(
      computeTrustScore({
        verified: false,
        onTimeRepayments: 0,
        overdueRepayments: 0,
        completedLoans: 0,
        averageRating: 0,
      }),
    ).toBe(35);
  });

  it("rewards verification, on-time repayments, completed loans, and high rating up to 100", () => {
    expect(
      computeTrustScore({
        verified: true,
        onTimeRepayments: 12,
        overdueRepayments: 0,
        completedLoans: 3,
        averageRating: 5,
      }),
    ).toBe(100);
  });

  it("penalizes overdue repayments and clamps at 0", () => {
    const score = computeTrustScore({
      verified: true,
      onTimeRepayments: 2,
      overdueRepayments: 15,
      completedLoans: 0,
      averageRating: 2,
    });
    expect(score).toBe(0);
  });
});
