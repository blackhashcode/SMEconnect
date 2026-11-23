import { NextRequest } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  requireRole: vi.fn(),
  listRepaymentsForActor: vi.fn(),
  getRepayment: vi.fn(),
  markRepaymentPaid: vi.fn(),
  confirmRepayment: vi.fn(),
  getLoanDetail: vi.fn(),
}));

vi.mock("@/server/auth/guards", () => ({ requireRole: mocks.requireRole }));
vi.mock("@/server/services/repayments", () => ({
  listRepaymentsForActor: mocks.listRepaymentsForActor,
  getRepayment: mocks.getRepayment,
  markRepaymentPaid: mocks.markRepaymentPaid,
  confirmRepayment: mocks.confirmRepayment,
  getLoanDetail: mocks.getLoanDetail,
}));

import { UnauthorizedError } from "@/server/errors";
import * as repaymentsRoute from "./repayments/route";
import * as repaymentRoute from "./repayments/[repaymentId]/route";
import * as markPaidRoute from "./repayments/[repaymentId]/mark-paid/route";
import * as confirmRoute from "./repayments/[repaymentId]/confirm/route";
import * as loanRoute from "./loans/[loanId]/route";

const owner = { id: "usr_owner", role: "OWNER" as const };
const investor = { id: "usr_investor", role: "INVESTOR" as const };
const repayment = { id: "rep_1", status: "MARKED_PAID" };
const meta = { limit: 20, nextCursor: null, hasMore: false };
const PROOF = "/api/v1/files/private/2f8c1a54-6b7d-4c9e-9f31-0a2b3c4d5e6f.pdf";

function jsonRequest(url: string, body: unknown): NextRequest {
  return new NextRequest(url, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
}

function repaymentContext(repaymentId = "rep_1") {
  return { params: Promise.resolve({ repaymentId }) };
}

function loanContext(loanId = "loan_1") {
  return { params: Promise.resolve({ loanId }) };
}

beforeEach(() => {
  vi.clearAllMocks();
  mocks.requireRole.mockResolvedValue({ user: owner });
  mocks.listRepaymentsForActor.mockResolvedValue({ items: [repayment], meta });
  mocks.getRepayment.mockResolvedValue(repayment);
  mocks.markRepaymentPaid.mockResolvedValue({ ...repayment, status: "MARKED_PAID" });
  mocks.confirmRepayment.mockResolvedValue({ ...repayment, status: "CONFIRMED" });
  mocks.getLoanDetail.mockResolvedValue({ id: "loan_1" });
});

describe("repayment routes", () => {
  it("parses pagination and the loan filter for participant lists", async () => {
    const response = await repaymentsRoute.GET(
      new NextRequest("http://localhost/api/v1/repayments?loanId=loan_1&limit=5"),
    );

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({ data: [repayment], meta });
    expect(mocks.requireRole).toHaveBeenCalledWith("OWNER", "INVESTOR");
    expect(mocks.listRepaymentsForActor).toHaveBeenCalledWith(owner, {
      cursor: undefined,
      limit: 5,
      loanId: "loan_1",
    });
  });

  it("rejects unknown repayment list filters", async () => {
    const response = await repaymentsRoute.GET(
      new NextRequest("http://localhost/api/v1/repayments?status=OVERDUE"),
    );
    expect(response.status).toBe(400);
    expect(mocks.listRepaymentsForActor).not.toHaveBeenCalled();
  });

  it("reads detail and loan history from path ids", async () => {
    const detail = await repaymentRoute.GET(
      new NextRequest("http://localhost/api/v1/repayments/rep_1"),
      repaymentContext(),
    );
    const loan = await loanRoute.GET(
      new NextRequest("http://localhost/api/v1/loans/loan_1"),
      loanContext(),
    );

    expect(detail.status).toBe(200);
    expect(loan.status).toBe(200);
    expect(mocks.getRepayment).toHaveBeenCalledWith(owner, "rep_1");
    expect(mocks.getLoanDetail).toHaveBeenCalledWith(owner, "loan_1");
  });

  it("marks paid with a strict body and ignores client identity or status", async () => {
    const forged = await markPaidRoute.POST(
      jsonRequest("http://localhost/api/v1/repayments/rep_1/mark-paid", {
        note: "Paid",
        status: "CONFIRMED",
      }),
      repaymentContext(),
    );
    expect(forged.status).toBe(400);
    expect(mocks.markRepaymentPaid).not.toHaveBeenCalled();

    const valid = await markPaidRoute.POST(
      jsonRequest("http://localhost/api/v1/repayments/rep_1/mark-paid", {
        note: " <b>Paid</b> ",
        proofUrl: PROOF,
      }),
      repaymentContext(),
    );
    expect(valid.status).toBe(200);
    expect(mocks.requireRole).toHaveBeenCalledWith("OWNER");
    expect(mocks.markRepaymentPaid).toHaveBeenCalledWith(owner, "rep_1", {
      note: "Paid",
      proofUrl: PROOF,
    });
  });

  it("confirms with an investor-only guard and no body fields", async () => {
    mocks.requireRole.mockResolvedValueOnce({ user: investor });
    const response = await confirmRoute.POST(
      jsonRequest("http://localhost/api/v1/repayments/rep_1/confirm", {
        confirmedBy: owner.id,
      }),
      repaymentContext(),
    );

    expect(response.status).toBe(200);
    expect(mocks.requireRole).toHaveBeenCalledWith("INVESTOR");
    expect(mocks.confirmRepayment).toHaveBeenCalledWith(investor, "rep_1");
  });

  it("maps guard failures to the standard error envelope", async () => {
    mocks.requireRole.mockRejectedValueOnce(new UnauthorizedError());
    const response = await repaymentRoute.GET(
      new NextRequest("http://localhost/api/v1/repayments/rep_1"),
      repaymentContext(),
    );

    expect(response.status).toBe(401);
    await expect(response.json()).resolves.toEqual({
      error: { code: "UNAUTHORIZED", message: "Authentication required" },
    });
    expect(mocks.getRepayment).not.toHaveBeenCalled();
  });
});
