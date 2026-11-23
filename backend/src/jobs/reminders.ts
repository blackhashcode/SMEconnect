import "dotenv/config";
import { runRepaymentReminders } from "@/server/services/repayment-reminders";

async function main() {
  const result = await runRepaymentReminders();
  console.log(
    `Reminder job sent ${result.dueNotified} due and ${result.overdueNotified} overdue email(s); ` +
      `${result.skipped} skipped, ${result.failed} failed.`,
  );
}

main().catch((error) => {
  console.error("Reminder job failed:", error instanceof Error ? error.message : "unknown error");
  process.exit(1);
});
