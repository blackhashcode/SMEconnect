import { describe, expect, it } from "vitest";
import {
  confirmRepaymentSchema,
  markRepaymentPaidSchema,
  repaymentListQuerySchema,
} from "@/server/validators/repayment";

const PRIVATE_URL = "/api/v1/files/private/2f8c1a54-6b7d-4c9e-9f31-0a2b3c4d5e6f.pdf";

describe("repayment validators", () => {
  it("accepts only sanitized notes and internal private proof URLs", () => {
    expect(
      markRepaymentPaidSchema.parse({
        note: "  <b>Paid</b>  ",
        proofUrl: PRIVATE_URL,
      }),
    ).toEqual({ note: "Paid", proofUrl: PRIVATE_URL });
    expect(markRepaymentPaidSchema.parse({})).toEqual({});
  });

  it("rejects client-owned status, identity, amounts and ids", () => {
    const forged = [
      { status: "CONFIRMED" },
      { markedPaidAt: "2026-11-23T18:00:00.000Z" },
      { confirmedAt: "2026-11-23T18:00:00.000Z" },
      { payerId: "usr_forged" },
      { investorId: "usr_forged" },
      { confirmedById: "usr_forged" },
      { amountBdt: 1 },
      { dueDate: "2030-01-01T00:00:00.000Z" },
      { repaymentId: "rep_forged" },
      { proofUrl: "https://example.com/proof.pdf" },
    ];
    for (const body of forged) {
      expect(markRepaymentPaidSchema.safeParse(body).success).toBe(false);
    }
  });

  it("accepts no fields for confirmation and only loanId as a list filter", () => {
    expect(confirmRepaymentSchema.parse({})).toEqual({});
    expect(confirmRepaymentSchema.safeParse({ status: "CONFIRMED" }).success).toBe(false);
    expect(repaymentListQuerySchema.parse({ loanId: "loan_1" })).toEqual({ loanId: "loan_1" });
    expect(repaymentListQuerySchema.safeParse({ status: "CONFIRMED" }).success).toBe(false);
  });
});
