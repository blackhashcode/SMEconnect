import { describe, expect, it } from "vitest";
import {
  createLoanRequestSchema,
  loanRequestRecordSchema,
  myLoanRequestFiltersSchema,
  publicLoanRequestFiltersSchema,
  publicLoanRequestSchema,
  updateLoanRequestSchema,
} from "@/server/validators/loan";

const validRequest = {
  amountBdt: 50_000,
  purpose: "Buy a second oven",
  fundUsage: "Expand weekend meal prep capacity",
  tenureDays: 90,
  repaymentFrequency: "WEEKLY",
  proposedRatePct: "14.5",
  proofUrls: [],
};

describe("loan request input schemas", () => {
  it("normalizes the rate and defaults proofUrls", () => {
    const parsed = createLoanRequestSchema.parse(validRequest);
    expect(parsed.proposedRatePct).toBe("14.50");
    expect(parsed.proofUrls).toEqual([]);
  });

  it.each([
    { amountBdt: 50_000.5 },
    { amountBdt: 0 },
    { tenureDays: 0 },
    { proposedRatePct: "101.00" },
    { proposedRatePct: "14.555" },
    { repaymentFrequency: "YEARLY" },
  ])("rejects invalid field values: %o", (override) => {
    expect(createLoanRequestSchema.safeParse({ ...validRequest, ...override }).success).toBe(
      false,
    );
  });

  it.each(["ownerId", "status", "publishedAt", "trustScore", "id"])(
    "rejects the server-controlled field %s",
    (field) => {
      expect(createLoanRequestSchema.safeParse({ ...validRequest, [field]: "x" }).success).toBe(
        false,
      );
      expect(updateLoanRequestSchema.safeParse({ [field]: "x" }).success).toBe(false);
    },
  );

  it("accepts a partial update but not an empty one with unknown keys", () => {
    expect(updateLoanRequestSchema.safeParse({ purpose: "New oven" }).success).toBe(true);
    expect(updateLoanRequestSchema.safeParse({ status: "OPEN" }).success).toBe(false);
  });
});

describe("loan request query filters", () => {
  it("defaults sorting and coerces numeric query strings", () => {
    const parsed = publicLoanRequestFiltersSchema.parse({
      minAmountBdt: "10000",
      maxAmountBdt: "100000",
      maxTenureDays: "90",
      frequency: "WEEKLY",
    });
    expect(parsed).toMatchObject({
      sort: "newest",
      minAmountBdt: 10_000,
      maxAmountBdt: 100_000,
      maxTenureDays: 90,
    });
  });

  it("rejects inverted ranges, unknown filters and invalid enums", () => {
    expect(
      publicLoanRequestFiltersSchema.safeParse({
        minAmountBdt: "100000",
        maxAmountBdt: "10000",
      }).success,
    ).toBe(false);
    expect(publicLoanRequestFiltersSchema.safeParse({ status: "OPEN" }).success).toBe(false);
    expect(publicLoanRequestFiltersSchema.safeParse({ sort: "oldest" }).success).toBe(false);
  });

  it("restricts the owner's status filter to known statuses", () => {
    expect(myLoanRequestFiltersSchema.parse({ status: "IN_DISCUSSION" }).status).toBe(
      "IN_DISCUSSION",
    );
    expect(myLoanRequestFiltersSchema.safeParse({ status: "UNKNOWN" }).success).toBe(false);
  });
});

describe("loan request response shapes", () => {
  const ownerView = {
    id: "lr_123",
    ...validRequest,
    proposedRatePct: "14.50",
    status: "DRAFT",
    publishedAt: null,
    createdAt: "2026-11-23T18:00:00.000Z",
    updatedAt: "2026-11-23T18:00:00.000Z",
  };

  const publicView = {
    id: "lr_123",
    amountBdt: 50_000,
    purpose: "Buy a second oven",
    fundUsage: "Expand weekend meal prep capacity",
    tenureDays: 90,
    repaymentFrequency: "WEEKLY",
    proposedRatePct: "14.50",
    publishedAt: "2026-11-23T18:30:00.000Z",
    createdAt: "2026-11-23T18:00:00.000Z",
    owner: {
      name: "Nusrat Akter",
      image: null,
      shopName: "Nusrat's Home Kitchen",
      slug: "nusrat-home-kitchen",
      category: "Food",
      district: "Dhaka",
      city: "Dhanmondi",
      logoUrl: null,
      trustScore: 80,
      verified: true,
    },
  };

  it("accepts the full owner view", () => {
    expect(loanRequestRecordSchema.safeParse(ownerView).success).toBe(true);
  });

  it.each(["ownerId", "proofUrls", "status", "updatedAt", "email", "phone"])(
    "rejects the private/public field %s from a public response",
    (field) => {
      expect(publicLoanRequestSchema.safeParse({ ...publicView, [field]: "secret" }).success).toBe(
        false,
      );
    },
  );

  it("requires the owner mini-profile to carry a verified boolean", () => {
    expect(publicLoanRequestSchema.safeParse(publicView).success).toBe(true);
    expect(
      publicLoanRequestSchema.safeParse({
        ...publicView,
        owner: { ...publicView.owner, verified: "yes" },
      }).success,
    ).toBe(false);
  });
});
