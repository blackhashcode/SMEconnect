import { describe, expect, it, vi } from "vitest";

vi.mock("@/server/db", () => ({ prisma: {} }));

import { ConflictError, ForbiddenError, NotFoundError } from "@/server/errors";
import { buildRepaymentSchedule } from "@/server/services/repayment-schedule";
import {
  confirmRepayment,
  getLoanDetail,
  getRepayment,
  listRepaymentsForActor,
  markOverdueRepayments,
  markRepaymentPaid,
} from "@/server/services/repayments";
import {
  admin,
  createFakeDb,
  deps,
  investor,
  NOW,
  owner,
  seed,
  stranger,
  type State,
} from "@/server/services/repayment-fake";
import { loanDetailSchema, repaymentRecordSchema } from "@/server/validators/repayment";

const DAY = 24 * 60 * 60 * 1000;
const PROOF = "/api/v1/files/private/2f8c1a54-6b7d-4c9e-9f31-0a2b3c4d5e6f.pdf";

function withMocks(state: State, sendEmail = vi.fn().mockResolvedValue(undefined)) {
  const logger = vi.fn();
  return {
    deps: { ...deps(state), sendEmail, logger } as never,
    sendEmail,
    logger,
  };
}

describe("repayment service", () => {
  it("lists participant repayments, derives overdue on read and hides other loans", async () => {
    const state = createFakeDb();
    seed(state);
    state.repayments[0].dueDate = new Date(NOW.getTime() - DAY);

    const result = await listRepaymentsForActor(
      owner as never,
      { limit: 20, loanId: "loan_1" },
      deps(state),
    );
    expect(result.items.map((item) => item.status)).toEqual([
      "OVERDUE",
      "UPCOMING",
      "UPCOMING",
    ]);
    expect(result.items.every((item) => repaymentRecordSchema.safeParse(item).success)).toBe(true);
    expect(result.meta).toMatchObject({ limit: 20, hasMore: false });

    const filtered = await listRepaymentsForActor(
      investor as never,
      { limit: 2 },
      deps(state),
    );
    expect(filtered.items).toHaveLength(2);
    expect(filtered.meta.hasMore).toBe(true);
    expect(filtered.meta.nextCursor).toBeTruthy();

    await expect(
      listRepaymentsForActor(stranger as never, { limit: 20, loanId: "loan_1" }, deps(state)),
    ).rejects.toThrow(NotFoundError);
    await expect(
      listRepaymentsForActor(admin as never, { limit: 20 }, deps(state)),
    ).rejects.toThrow(ForbiddenError);
  });

  it("lets only the owner mark UPCOMING or OVERDUE and notifies the investor", async () => {
    const state = createFakeDb();
    seed(state);
    state.repayments[0].dueDate = new Date(NOW.getTime() - DAY);
    const { deps: injected, sendEmail } = withMocks(state);

    const result = await markRepaymentPaid(
      owner as never,
      "rep_1",
      { note: "  <b>Paid</b> from sales  ", proofUrl: PROOF },
      injected,
    );
    expect(result).toMatchObject({
      status: "MARKED_PAID",
      markedPaidAt: NOW.toISOString(),
      note: "Paid from sales",
      proofUrl: PROOF,
    });
    expect(state.repayments[0]).toMatchObject({ status: "MARKED_PAID", markedPaidAt: NOW });
    expect(state.notifications).toHaveLength(1);
    expect(state.notifications[0]).toMatchObject({
      userId: investor.id,
      type: "REPAYMENT_MARKED_PAID",
    });
    expect(sendEmail).toHaveBeenCalledTimes(1);
    expect(sendEmail.mock.calls[0][0]).toMatchObject({
      to: "investor@example.test",
      subject: "Borrower marked a repayment as paid",
    });

    await expect(
      markRepaymentPaid(owner as never, "rep_1", {}, injected),
    ).rejects.toThrow(ConflictError);
    await expect(
      markRepaymentPaid(investor as never, "rep_2", {}, injected),
    ).rejects.toThrow(ForbiddenError);
    await expect(
      markRepaymentPaid(stranger as never, "rep_2", {}, injected),
    ).rejects.toThrow(NotFoundError);
    expect(state.notifications).toHaveLength(1);
  });

  it("confirms only marked payments and completes the loan on the final confirmation", async () => {
    const state = createFakeDb();
    seed(state, { statuses: ["MARKED_PAID", "MARKED_PAID", "MARKED_PAID"] });
    const { deps: injected, sendEmail } = withMocks(state);

    await expect(
      confirmRepayment(owner as never, "rep_1", {}, injected),
    ).rejects.toThrow(ForbiddenError);

    state.repayments[2].status = "UPCOMING";
    state.repayments[2].markedPaidAt = null;
    await expect(
      confirmRepayment(investor as never, "rep_3", {}, injected),
    ).rejects.toThrow(ConflictError);
    state.repayments[2].status = "MARKED_PAID";
    state.repayments[2].markedPaidAt = NOW;

    await confirmRepayment(investor as never, "rep_1", {}, injected);
    expect(state.loans[0].status).toBe("ACTIVE");
    expect(state.requests[0].status).toBe("REPAYING");

    await confirmRepayment(investor as never, "rep_2", {}, injected);
    expect(state.loans[0].status).toBe("ACTIVE");

    await confirmRepayment(investor as never, "rep_3", {}, injected);
    expect(state.loans[0].status).toBe("COMPLETED");
    expect(state.requests[0].status).toBe("COMPLETED");
    expect(state.notifications.map((row) => row.type)).toEqual([
      "REPAYMENT_CONFIRMED",
      "REPAYMENT_CONFIRMED",
      "REPAYMENT_CONFIRMED",
    ]);
    expect(sendEmail).toHaveBeenCalledTimes(3);

    await expect(
      confirmRepayment(investor as never, "rep_3", {}, injected),
    ).rejects.toThrow(ConflictError);
  });

  it("keeps concurrent duplicate confirmations and completion duplicate-safe", async () => {
    const state = createFakeDb();
    seed(state, {
      installmentCount: 3,
      statuses: ["MARKED_PAID", "MARKED_PAID", "MARKED_PAID"],
    });
    const { deps: injected, sendEmail } = withMocks(state);

    const duplicate = await Promise.allSettled([
      confirmRepayment(investor as never, "rep_1", {}, injected),
      confirmRepayment(investor as never, "rep_1", {}, injected),
    ]);
    expect(duplicate.filter((result) => result.status === "fulfilled")).toHaveLength(1);
    expect(duplicate.filter((result) => result.status === "rejected")).toHaveLength(1);
    expect(state.notifications).toHaveLength(1);
    expect(sendEmail).toHaveBeenCalledTimes(1);

    const distinct = await Promise.all([
      confirmRepayment(investor as never, "rep_2", {}, injected),
      confirmRepayment(investor as never, "rep_3", {}, injected),
    ]);
    expect(distinct).toHaveLength(2);
    expect(state.loans[0].status).toBe("COMPLETED");
    expect(state.requests[0].status).toBe("COMPLETED");
    expect(state.notifications).toHaveLength(3);
    expect(
      state.notifications.filter((row) => row.type === "REPAYMENT_CONFIRMED"),
    ).toHaveLength(3);
    await expect(
      confirmRepayment(investor as never, "rep_3", {}, injected),
    ).rejects.toThrow(ConflictError);
  });

  it("returns a schema-valid loan detail with consistent schedule amounts and history", async () => {
    const state = createFakeDb();
    seed(state, { statuses: ["UPCOMING", "MARKED_PAID", "CONFIRMED"] });
    state.repayments[1].status = "OVERDUE";

    const detail = await getLoanDetail(owner as never, "loan_1", deps(state));
    expect(loanDetailSchema.safeParse(detail).success).toBe(true);
    expect(detail.schedule.map((row) => row.amountBdt)).toEqual([17_262, 17_262, 17_264]);
    expect(detail.schedule.reduce((sum, row) => sum + row.amountBdt, 0)).toBe(
      detail.totalRepayableBdt,
    );

    const expected = buildRepaymentSchedule({
      principalBdt: detail.principalBdt,
      interestRatePct: detail.interestRatePct,
      tenureDays: detail.tenureDays,
      repaymentFrequency: detail.repaymentFrequency,
      startDate: new Date(detail.startDate!),
    });
    expect(detail.schedule.map((row) => row.dueDate)).toEqual(
      expected.installments.map((row) => row.dueDate.toISOString()),
    );
    expect(detail.schedule.map((row) => row.amountBdt)).toEqual(
      expected.installments.map((row) => row.amountBdt),
    );
    expect(detail.progress).toMatchObject({
      totalInstallments: 3,
      upcomingCount: 1,
      overdueCount: 1,
      markedPaidCount: 0,
      confirmedCount: 1,
      confirmedBdt: 17_264,
      outstandingBdt: 34_524,
    });
    expect(detail.history.map((event) => event.type)).toContain("MARKED_PAID");
    expect(detail.history.map((event) => event.type)).toContain("CONFIRMED");

    const repayment = await getRepayment(investor as never, "rep_1", deps(state));
    expect(repayment.id).toBe("rep_1");
    await expect(getRepayment(stranger as never, "rep_1", deps(state))).rejects.toThrow(
      NotFoundError,
    );
    await expect(getLoanDetail(stranger as never, "loan_1", deps(state))).rejects.toThrow(
      NotFoundError,
    );
  });

  it("does not roll back committed repayment state when email delivery fails", async () => {
    const state = createFakeDb();
    seed(state, { statuses: ["UPCOMING", "MARKED_PAID", "UPCOMING"] });
    const failing = vi.fn().mockRejectedValue(new Error("SMTP unavailable"));
    const { deps: injected, logger } = withMocks(state, failing);

    await expect(
      markRepaymentPaid(owner as never, "rep_1", {}, injected),
    ).resolves.toMatchObject({ status: "MARKED_PAID" });
    expect(state.repayments[0].status).toBe("MARKED_PAID");
    expect(state.notifications).toHaveLength(1);

    await expect(
      confirmRepayment(investor as never, "rep_2", {}, injected),
    ).resolves.toMatchObject({ status: "CONFIRMED" });
    expect(state.repayments[1].status).toBe("CONFIRMED");
    expect(state.notifications).toHaveLength(2);
    expect(logger).toHaveBeenCalledTimes(2);
    expect(logger.mock.calls[0][0]).toContain("email delivery failed");
  });

  it("persists overdue only for past-due UPCOMING installments", async () => {
    const state = createFakeDb();
    seed(state, { statuses: ["UPCOMING", "MARKED_PAID", "UPCOMING"] });
    state.repayments[0].dueDate = new Date(NOW.getTime() - DAY);
    state.repayments[1].dueDate = new Date(NOW.getTime() - 2 * DAY);
    state.repayments[2].dueDate = new Date(NOW.getTime() + DAY);

    const result = await markOverdueRepayments(deps(state));
    expect(result).toEqual({ markedOverdue: 1 });
    expect(state.repayments.map((row) => row.status)).toEqual([
      "OVERDUE",
      "MARKED_PAID",
      "UPCOMING",
    ]);
    expect(await markOverdueRepayments(deps(state))).toEqual({ markedOverdue: 0 });
  });
});
