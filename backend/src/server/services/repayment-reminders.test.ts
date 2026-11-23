import { describe, expect, it, vi } from "vitest";

vi.mock("@/server/db", () => ({ prisma: {} }));

import { runRepaymentReminders } from "@/server/services/repayment-reminders";
import {
  createFakeDb,
  deps,
  NOW,
  seed,
  type State,
} from "@/server/services/repayment-fake";

const DAY = 24 * 60 * 60 * 1000;

function reminderDeps(state: State, sendEmail = vi.fn().mockResolvedValue(undefined)) {
  const logger = vi.fn();
  return { deps: { ...deps(state), sendEmail, logger } as never, sendEmail, logger };
}

function seedReminderRows(state: State) {
  seed(state, { statuses: ["UPCOMING", "OVERDUE", "MARKED_PAID"] });
  state.repayments[0].dueDate = new Date(NOW.getTime() + DAY);
  state.repayments[1].dueDate = new Date(NOW.getTime() - DAY);
  state.repayments[2].dueDate = new Date(NOW.getTime() + DAY);
}

describe("repayment reminder job", () => {
  it("reminds both parties for due and overdue rows and is idempotent across runs", async () => {
    const state = createFakeDb();
    seedReminderRows(state);
    const { deps: injected, sendEmail } = reminderDeps(state);

    const first = await runRepaymentReminders(injected);
    expect(first).toEqual({
      dueNotified: 2,
      overdueNotified: 2,
      skipped: 0,
      failed: 0,
    });
    expect(sendEmail).toHaveBeenCalledTimes(4);
    expect(state.notifications).toHaveLength(4);
    expect(state.notifications.map((row) => row.type).sort()).toEqual([
      "REPAYMENT_DUE",
      "REPAYMENT_DUE",
      "REPAYMENT_OVERDUE",
      "REPAYMENT_OVERDUE",
    ]);
    expect(
      state.notifications.every(
        (row) => (row.data as Record<string, unknown>).emailStatus === "SENT",
      ),
    ).toBe(true);

    const second = await runRepaymentReminders(injected);
    expect(second).toEqual({
      dueNotified: 0,
      overdueNotified: 0,
      skipped: 4,
      failed: 0,
    });
    expect(sendEmail).toHaveBeenCalledTimes(4);
    expect(state.notifications).toHaveLength(4);
  });

  it("does not remind for installments that are already marked paid", async () => {
    const state = createFakeDb();
    seed(state, { statuses: ["MARKED_PAID", "CONFIRMED", "UPCOMING"] });
    state.repayments[1].dueDate = new Date(NOW.getTime() + DAY);
    state.repayments[2].dueDate = new Date(NOW.getTime() + 20 * DAY);
    const { deps: injected, sendEmail } = reminderDeps(state);

    const result = await runRepaymentReminders(injected);
    expect(result).toEqual({
      dueNotified: 0,
      overdueNotified: 0,
      skipped: 0,
      failed: 0,
    });
    expect(sendEmail).not.toHaveBeenCalled();
    expect(state.notifications).toHaveLength(0);
  });

  it("releases the idempotency claim when email delivery fails so a later run retries", async () => {
    const state = createFakeDb();
    seed(state, { statuses: ["UPCOMING", "UPCOMING", "UPCOMING"] });
    state.repayments[0].dueDate = new Date(NOW.getTime() + DAY);
    const failing = vi.fn().mockRejectedValue(new Error("SMTP unavailable"));
    const failedRun = reminderDeps(state, failing);

    const first = await runRepaymentReminders(failedRun.deps);
    expect(first).toMatchObject({ dueNotified: 0, failed: 2 });
    expect(state.notifications).toHaveLength(0);
    expect(failedRun.logger).toHaveBeenCalledTimes(2);

    const succeeding = reminderDeps(state);
    const second = await runRepaymentReminders(succeeding.deps);
    expect(second).toMatchObject({ dueNotified: 2, failed: 0 });
    expect(succeeding.sendEmail).toHaveBeenCalledTimes(2);
    expect(state.notifications).toHaveLength(2);
  });
});
