import { beforeEach, describe, expect, it, vi } from "vitest";
import { BusinessRuleError, ConflictError, ForbiddenError } from "@/server/errors";

// Mock prisma before importing services so we can thoroughly unit-test all domain rules & transactions.
const mockTx = {
  loanRequest: { create: vi.fn(), update: vi.fn(), count: vi.fn(), findUnique: vi.fn() },
  offer: { create: vi.fn(), update: vi.fn(), updateMany: vi.fn(), count: vi.fn() },
  loan: { create: vi.fn(), update: vi.fn(), count: vi.fn() },
  agreement: { create: vi.fn(), update: vi.fn() },
  repayment: { createMany: vi.fn(), update: vi.fn(), count: vi.fn() },
  review: { aggregate: vi.fn() },
  user: { findUnique: vi.fn(), update: vi.fn() },
  businessProfile: { updateMany: vi.fn() },
  investorProfile: { updateMany: vi.fn() },
  kycVerification: { update: vi.fn() },
  notification: { create: vi.fn() },
  auditLog: { create: vi.fn() },
};

const mockPrisma = {
  businessProfile: { findUnique: vi.fn() },
  kycVerification: { findFirst: vi.fn(), findUnique: vi.fn() },
  loanRequest: { count: vi.fn(), findUnique: vi.fn() },
  offer: { findFirst: vi.fn(), findUnique: vi.fn(), update: vi.fn(), updateMany: vi.fn() },
  loan: { findUnique: vi.fn() },
  repayment: { findUnique: vi.fn(), updateMany: vi.fn() },
  $transaction: vi.fn(async (cb: (tx: typeof mockTx) => Promise<unknown>) => cb(mockTx)),
};

vi.mock("@/server/db", () => ({ prisma: mockPrisma }));

const { createLoanRequest } = await import("@/server/services/loans");
const { createOffer, respondToOffer } = await import("@/server/services/offers");
const { confirmAgreement } = await import("@/server/services/agreements");
const { confirmRepayment, markRepaymentPaid } = await import("@/server/services/repayments");
const { reviewVerification } = await import("@/server/services/verifications");

describe("Domain Services — Business Rules, State Machines & RBAC", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockTx.notification.create.mockResolvedValue({ id: "notif-1" });
    mockTx.auditLog.create.mockResolvedValue({ id: "audit-1" });
    mockTx.user.findUnique.mockResolvedValue({ email: "member@example.com" });
  });

  it("blocks unverified owners from publishing a loan request", async () => {
    mockPrisma.businessProfile.findUnique.mockResolvedValue({ id: "biz-1", verified: false });
    mockPrisma.kycVerification.findFirst.mockResolvedValue(null);

    await expect(
      createLoanRequest(
        { id: "owner-1", role: "OWNER" },
        {
          title: "New oven for bakery",
          amountBdt: 100_000,
          purpose: "Equipment",
          description: "Buying a second commercial oven to double festive order capacity.",
          tenureDays: 180,
          proposedRatePct: 12,
          repaymentFrequency: "MONTHLY",
          highlights: [],
          publishNow: true,
        },
      ),
    ).rejects.toThrow(ForbiddenError);
  });

  it("enforces the one-active-request rule per owner", async () => {
    mockPrisma.businessProfile.findUnique.mockResolvedValue({ id: "biz-1", verified: true });
    mockPrisma.loanRequest.count.mockResolvedValue(1);

    await expect(
      createLoanRequest(
        { id: "owner-1", role: "OWNER" },
        {
          title: "Second request should fail",
          amountBdt: 100_000,
          purpose: "Inventory",
          description: "This request should be rejected because one is already active.",
          tenureDays: 180,
          proposedRatePct: 12,
          repaymentFrequency: "MONTHLY",
          highlights: [],
          publishNow: true,
        },
      ),
    ).rejects.toThrow(ConflictError);
  });

  it("rejects offers exceeding 2x the requested amount", async () => {
    mockPrisma.kycVerification.findFirst.mockResolvedValue({ id: "kyc-1" });
    mockPrisma.loanRequest.findUnique.mockResolvedValue({
      id: "lr-1",
      ownerId: "owner-1",
      amountBdt: 100_000,
      status: "OPEN",
      title: "Oven",
    });

    await expect(
      createOffer(
        { id: "inv-1", role: "INVESTOR" },
        "lr-1",
        {
          amountBdt: 250_000,
          interestRatePct: 12,
          tenureDays: 180,
          repaymentFrequency: "MONTHLY",
          message: "",
        },
      ),
    ).rejects.toThrow(BusinessRuleError);
  });

  it("atomically accepts an offer, rejects competing offers, and creates Loan + Agreement", async () => {
    const future = new Date(Date.now() + 86_400_000);
    mockPrisma.offer.findUnique.mockResolvedValue({
      id: "of-1",
      loanRequestId: "lr-1",
      investorId: "inv-1",
      amountBdt: 100_000,
      interestRatePct: 12,
      tenureDays: 365,
      repaymentFrequency: "MONTHLY",
      status: "PENDING",
      proposedBy: "INVESTOR",
      expiresAt: future,
      loanRequest: { id: "lr-1", ownerId: "owner-1", title: "Oven", amountBdt: 100_000, status: "IN_DISCUSSION" },
    });
    mockTx.offer.update.mockResolvedValue({ id: "of-1", status: "ACCEPTED" });
    mockTx.loan.create.mockResolvedValue({ id: "loan-1", totalRepayableBdt: 112_000 });
    mockTx.agreement.create.mockResolvedValue({ id: "agr-1" });

    const result = await respondToOffer({ id: "owner-1", role: "OWNER" }, "of-1", { action: "ACCEPT" });

    expect(mockPrisma.$transaction).toHaveBeenCalledTimes(1);
    expect(mockTx.offer.updateMany).toHaveBeenCalledWith({
      where: { loanRequestId: "lr-1", id: { not: "of-1" }, status: "PENDING" },
      data: { status: "REJECTED" },
    });
    expect(mockTx.loanRequest.update).toHaveBeenCalledWith({
      where: { id: "lr-1" },
      data: { status: "FUNDED" },
    });
    expect(mockTx.loan.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ totalRepayableBdt: 112_000, status: "PENDING_AGREEMENT" }),
      }),
    );
    expect(result.agreement).toEqual({ id: "agr-1" });
  });

  it("prevents proposer from accepting their own offer", async () => {
    mockPrisma.offer.findUnique.mockResolvedValue({
      id: "of-1",
      loanRequestId: "lr-1",
      investorId: "inv-1",
      status: "PENDING",
      proposedBy: "INVESTOR",
      expiresAt: new Date(Date.now() + 86_400_000),
      loanRequest: { id: "lr-1", ownerId: "owner-1", title: "Oven", amountBdt: 100_000, status: "IN_DISCUSSION" },
    });

    await expect(
      respondToOffer({ id: "inv-1", role: "INVESTOR" }, "of-1", { action: "ACCEPT" }),
    ).rejects.toThrow(ForbiddenError);
  });

  it("activates loan and generates exact repayment schedule when second party confirms agreement", async () => {
    mockPrisma.loan.findUnique.mockResolvedValue({
      id: "loan-1",
      loanRequestId: "lr-1",
      ownerId: "owner-1",
      investorId: "inv-1",
      principalBdt: 100_000,
      interestRatePct: 12,
      tenureDays: 180,
      repaymentFrequency: "MONTHLY",
      status: "PENDING_AGREEMENT",
      loanRequest: { title: "Oven" },
      agreement: { id: "agr-1", ownerConfirmedAt: new Date(), investorConfirmedAt: null },
    });
    mockTx.agreement.update.mockResolvedValue({ id: "agr-1" });

    const res = await confirmAgreement({ id: "inv-1", role: "INVESTOR" }, "lr-1");

    expect(res.activated).toBe(true);
    expect(mockTx.repayment.createMany).toHaveBeenCalledTimes(1);
    const createdRows = mockTx.repayment.createMany.mock.calls[0][0].data as Array<{ amountBdt: number }>;
    expect(createdRows).toHaveLength(6);
    expect(createdRows.reduce((s, r) => s + r.amountBdt, 0)).toBe(105_918);
    expect(mockTx.loan.update).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ status: "ACTIVE" }) }),
    );
  });

  it("blocks owner from confirming their own repayment receipt", async () => {
    mockPrisma.repayment.findUnique.mockResolvedValue({
      id: "rep-1",
      loanId: "loan-1",
      status: "MARKED_PAID",
      loan: { ownerId: "owner-1", investorId: "inv-1", loanRequestId: "lr-1", loanRequest: { title: "Oven" } },
    });

    await expect(confirmRepayment({ id: "owner-1", role: "OWNER" }, "rep-1")).rejects.toThrow(
      ForbiddenError,
    );
  });

  it("blocks investor from marking a repayment paid on borrower's behalf", async () => {
    mockPrisma.repayment.findUnique.mockResolvedValue({
      id: "rep-1",
      loanId: "loan-1",
      status: "UPCOMING",
      loan: { ownerId: "owner-1", investorId: "inv-1", loanRequestId: "lr-1", loanRequest: { title: "Oven" } },
    });

    await expect(markRepaymentPaid({ id: "inv-1", role: "INVESTOR" }, "rep-1", {})).rejects.toThrow(
      ForbiddenError,
    );
  });

  it("blocks non-admins from approving verifications", async () => {
    await expect(
      reviewVerification({ id: "owner-1", role: "OWNER" }, "kyc-1", { decision: "APPROVED" }),
    ).rejects.toThrow(ForbiddenError);
  });
});
