import { describe, expect, it } from "vitest";
import {
  counterOfferSchema,
  createBusinessProfileSchema,
  createInvestorProfileSchema,
  createLoanRequestSchema,
  createReportSchema,
  createReviewSchema,
  sendMessageSchema,
  submitVerificationSchema,
} from "@/server/validators";

const businessProfileInput = {
  shopName: "Nusrat's Home Kitchen",
  slug: "nusrat-home-kitchen",
  category: "Food",
  district: "Dhaka",
  city: "Dhanmondi",
};

const loanRequestInput = {
  amountBdt: 50_000,
  purpose: "Buy a second oven",
  fundUsage: "Expand weekend meal prep capacity",
  tenureDays: 90,
  repaymentFrequency: "WEEKLY" as const,
  proposedRatePct: "14.5",
};

describe("submitVerificationSchema", () => {
  it("requires sales proof from owners", () => {
    const result = submitVerificationSchema.safeParse({
      type: "OWNER",
      idDocumentUrl:
        "/api/v1/files/private/2f8c1a54-6b7d-4c9e-9f31-0a2b3c4d5e6f.pdf",
      salesProofUrls: [],
      shopLinks: [],
    });
    expect(result.success).toBe(false);
  });

  it("lets investors submit without sales proof", () => {
    const result = submitVerificationSchema.safeParse({
      type: "INVESTOR",
      idDocumentUrl:
        "/api/v1/files/private/2f8c1a54-6b7d-4c9e-9f31-0a2b3c4d5e6f.pdf",
      salesProofUrls: [],
      shopLinks: [],
    });
    expect(result.success).toBe(true);
  });
});

describe("profile schemas", () => {
  it("rejects an inverted monthly sales range", () => {
    const result = createBusinessProfileSchema.safeParse({
      ...businessProfileInput,
      monthlySalesMinBdt: 100_000,
      monthlySalesMaxBdt: 50_000,
    });
    expect(result.success).toBe(false);
  });

  it("rejects an inverted lending range", () => {
    const result = createInvestorProfileSchema.safeParse({
      minLendBdt: 100_000,
      maxLendBdt: 20_000,
    });
    expect(result.success).toBe(false);
  });

  it("rejects an inverted preferred rate range", () => {
    const result = createInvestorProfileSchema.safeParse({
      minLendBdt: 20_000,
      maxLendBdt: 100_000,
      preferredRatePctMin: "16.00",
      preferredRatePctMax: "12.00",
    });
    expect(result.success).toBe(false);
  });
});

describe("loan and offer schemas", () => {
  it("defaults proofUrls to an empty array and normalizes the rate", () => {
    const parsed = createLoanRequestSchema.parse(loanRequestInput);
    expect(parsed.proofUrls).toEqual([]);
    expect(parsed.proposedRatePct).toBe("14.50");
  });

  it("requires a parent offer when countering", () => {
    const base = {
      loanRequestId: "request-1",
      amountBdt: loanRequestInput.amountBdt,
      interestRatePct: "12.00",
      tenureDays: loanRequestInput.tenureDays,
      repaymentFrequency: loanRequestInput.repaymentFrequency,
    };
    expect(counterOfferSchema.safeParse(base).success).toBe(false);
    expect(
      counterOfferSchema.safeParse({
        ...base,
        parentOfferId: "offer-123",
        proposedBy: "OWNER",
      }).success,
    ).toBe(true);
  });
});

describe("reputation, moderation and messaging schemas", () => {
  it.each([0, 6, 4.5])("rejects rating %s", (rating) => {
    const result = createReviewSchema.safeParse({
      loanId: "loan-1",
      revieweeId: "user-2",
      rating,
    });
    expect(result.success).toBe(false);
  });

  it("accepts a rating from 1 to 5", () => {
    expect(
      createReviewSchema.safeParse({
        loanId: "loan-1",
        revieweeId: "user-2",
        rating: 5,
      }).success,
    ).toBe(true);
  });

  it("restricts report targets to the polymorphic enum", () => {
    expect(
      createReportSchema.safeParse({
        targetType: "POST",
        targetId: "post-1",
        reason: "Spam",
      }).success,
    ).toBe(true);
    expect(
      createReportSchema.safeParse({
        targetType: "LOAN",
        targetId: "loan-1",
        reason: "Spam",
      }).success,
    ).toBe(false);
  });

  it("rejects empty message bodies", () => {
    expect(
      sendMessageSchema.safeParse({
        conversationId: "conv-1",
        body: "   ",
      }).success,
    ).toBe(false);
  });
});
