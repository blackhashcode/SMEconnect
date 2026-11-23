import { NextRequest } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  requireRole: vi.fn(),
  createOffer: vi.fn(),
  listReceivedOffers: vi.fn(),
  listSubmittedOffers: vi.fn(),
  getOffer: vi.fn(),
  withdrawOffer: vi.fn(),
  rejectOffer: vi.fn(),
  counterOffer: vi.fn(),
  acceptOffer: vi.fn(),
  getAgreement: vi.fn(),
  confirmAgreement: vi.fn(),
}));

vi.mock("@/server/auth/guards", () => ({ requireRole: mocks.requireRole }));
vi.mock("@/server/services/offers", () => ({
  createOffer: mocks.createOffer,
  listReceivedOffers: mocks.listReceivedOffers,
  listSubmittedOffers: mocks.listSubmittedOffers,
  getOffer: mocks.getOffer,
  withdrawOffer: mocks.withdrawOffer,
  rejectOffer: mocks.rejectOffer,
  counterOffer: mocks.counterOffer,
  acceptOffer: mocks.acceptOffer,
}));
vi.mock("@/server/services/agreements", () => ({
  getAgreement: mocks.getAgreement,
  confirmAgreement: mocks.confirmAgreement,
}));

import { UnauthorizedError } from "@/server/errors";
import * as offersRoute from "./offers/route";
import * as receivedRoute from "./offers/received/route";
import * as submittedRoute from "./offers/submitted/route";
import * as offerRoute from "./offers/[offerId]/route";
import * as withdrawRoute from "./offers/[offerId]/withdraw/route";
import * as rejectRoute from "./offers/[offerId]/reject/route";
import * as counterRoute from "./offers/[offerId]/counter/route";
import * as acceptRoute from "./offers/[offerId]/accept/route";
import * as agreementRoute from "./agreements/[agreementId]/route";
import * as confirmRoute from "./agreements/[agreementId]/confirm/route";

const owner = { id: "usr_owner", role: "OWNER" as const };
const investor = { id: "usr_investor", role: "INVESTOR" as const };
const meta = { limit: 20, nextCursor: null, hasMore: false };
const offer = { id: "off_1", status: "PENDING" };
const terms = {
  amountBdt: 50_000,
  interestRatePct: "14.5",
  tenureDays: 90,
  repaymentFrequency: "WEEKLY",
};

function jsonRequest(url: string, body: unknown): NextRequest {
  return new NextRequest(url, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
}

function offerContext(offerId = "off_1") {
  return { params: Promise.resolve({ offerId }) };
}

function agreementContext(agreementId = "agr_1") {
  return { params: Promise.resolve({ agreementId }) };
}

beforeEach(() => {
  vi.clearAllMocks();
  mocks.requireRole.mockResolvedValue({ user: investor });
  mocks.createOffer.mockResolvedValue(offer);
  mocks.listReceivedOffers.mockResolvedValue({ items: [offer], meta });
  mocks.listSubmittedOffers.mockResolvedValue({ items: [offer], meta });
  mocks.getOffer.mockResolvedValue(offer);
  mocks.withdrawOffer.mockResolvedValue({ ...offer, status: "WITHDRAWN" });
  mocks.rejectOffer.mockResolvedValue({ ...offer, status: "REJECTED" });
  mocks.counterOffer.mockResolvedValue({ id: "off_2" });
  mocks.acceptOffer.mockResolvedValue({ loanId: "loan_1", offer });
  mocks.getAgreement.mockResolvedValue({ id: "agr_1" });
  mocks.confirmAgreement.mockResolvedValue({ id: "agr_1", status: "ACTIVE" });
});

describe("offer routes", () => {
  it("creates an offer from validated input and session identity", async () => {
    const response = await offersRoute.POST(
      jsonRequest("http://localhost/api/v1/offers", {
        loanRequestId: "lr_1",
        ...terms,
        message: "  <b>I can fund this.</b>  ",
      }),
    );

    expect(response.status).toBe(201);
    expect(mocks.requireRole).toHaveBeenCalledWith("INVESTOR");
    expect(mocks.createOffer).toHaveBeenCalledWith(investor, {
      loanRequestId: "lr_1",
      ...terms,
      interestRatePct: "14.50",
      message: "I can fund this.",
    });
  });

  it("rejects client-supplied expiry before calling the service", async () => {
    const response = await offersRoute.POST(
      jsonRequest("http://localhost/api/v1/offers", {
        loanRequestId: "lr_1",
        ...terms,
        expiresAt: "2030-01-01T00:00:00.000Z",
      }),
    );

    expect(response.status).toBe(400);
    expect(mocks.createOffer).not.toHaveBeenCalled();
  });

  it("lists received and submitted offers with parsed filters", async () => {
    mocks.requireRole.mockResolvedValueOnce({ user: owner });
    const received = await receivedRoute.GET(
      new NextRequest(
        "http://localhost/api/v1/offers/received?loanRequestId=lr_1&limit=5",
      ),
    );
    const submitted = await submittedRoute.GET(
      new NextRequest("http://localhost/api/v1/offers/submitted?limit=10"),
    );

    expect(received.status).toBe(200);
    expect(submitted.status).toBe(200);
    await expect(received.json()).resolves.toEqual({ data: [offer], meta });
    expect(mocks.listReceivedOffers).toHaveBeenCalledWith(owner, {
      cursor: undefined,
      limit: 5,
      loanRequestId: "lr_1",
    });
    expect(mocks.listSubmittedOffers).toHaveBeenCalledWith(investor, {
      cursor: undefined,
      limit: 10,
    });
  });

  it("rejects unknown offer list filters", async () => {
    mocks.requireRole.mockResolvedValueOnce({ user: owner });
    const response = await receivedRoute.GET(
      new NextRequest("http://localhost/api/v1/offers/received?status=PENDING"),
    );
    expect(response.status).toBe(400);
    expect(mocks.listReceivedOffers).not.toHaveBeenCalled();
  });

  it("passes path ids to detail and simple actions", async () => {
    const detail = await offerRoute.GET(
      new NextRequest("http://localhost/api/v1/offers/off_1"),
      offerContext(),
    );
    const withdrawn = await withdrawRoute.POST(
      new NextRequest("http://localhost/api/v1/offers/off_1/withdraw", { method: "POST" }),
      offerContext(),
    );
    const rejected = await rejectRoute.POST(
      new NextRequest("http://localhost/api/v1/offers/off_1/reject", { method: "POST" }),
      offerContext(),
    );
    const accepted = await acceptRoute.POST(
      new NextRequest("http://localhost/api/v1/offers/off_1/accept", { method: "POST" }),
      offerContext(),
    );

    expect(detail.status).toBe(200);
    expect(withdrawn.status).toBe(200);
    expect(rejected.status).toBe(200);
    expect(accepted.status).toBe(200);
    expect(mocks.getOffer).toHaveBeenCalledWith(investor, "off_1");
    expect(mocks.withdrawOffer).toHaveBeenCalledWith(investor, "off_1");
    expect(mocks.rejectOffer).toHaveBeenCalledWith(investor, "off_1");
    expect(mocks.acceptOffer).toHaveBeenCalledWith(investor, "off_1");
  });

  it("counters with terms only and never trusts a body parent id", async () => {
    const response = await counterRoute.POST(
      jsonRequest("http://localhost/api/v1/offers/off_1/counter", {
        ...terms,
        parentOfferId: "off_forged",
        proposedBy: "INVESTOR",
      }),
      offerContext(),
    );

    expect(response.status).toBe(400);
    expect(mocks.counterOffer).not.toHaveBeenCalled();

    const valid = await counterRoute.POST(
      jsonRequest("http://localhost/api/v1/offers/off_1/counter", terms),
      offerContext(),
    );
    expect(valid.status).toBe(201);
    expect(mocks.counterOffer).toHaveBeenCalledWith(investor, "off_1", {
      ...terms,
      interestRatePct: "14.50",
    });
  });

  it("maps guard failures to the standard error envelope", async () => {
    mocks.requireRole.mockRejectedValueOnce(new UnauthorizedError());
    const response = await offerRoute.GET(
      new NextRequest("http://localhost/api/v1/offers/off_1"),
      offerContext(),
    );

    expect(response.status).toBe(401);
    await expect(response.json()).resolves.toEqual({
      error: { code: "UNAUTHORIZED", message: "Authentication required" },
    });
    expect(mocks.getOffer).not.toHaveBeenCalled();
  });
});

describe("agreement routes", () => {
  it("reads and confirms an agreement from the path id", async () => {
    mocks.requireRole.mockResolvedValue({ user: owner });
    const detail = await agreementRoute.GET(
      new NextRequest("http://localhost/api/v1/agreements/agr_1"),
      agreementContext(),
    );
    const confirmed = await confirmRoute.POST(
      new NextRequest("http://localhost/api/v1/agreements/agr_1/confirm", { method: "POST" }),
      agreementContext(),
    );

    expect(detail.status).toBe(200);
    expect(confirmed.status).toBe(200);
    expect(mocks.requireRole).toHaveBeenCalledWith("OWNER", "INVESTOR");
    expect(mocks.getAgreement).toHaveBeenCalledWith(owner, "agr_1");
    expect(mocks.confirmAgreement).toHaveBeenCalledWith(owner, "agr_1");
  });
});
