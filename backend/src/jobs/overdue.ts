import "dotenv/config";
import { markOverdueRepayments } from "@/server/services/repayments";

async function main() {
  const result = await markOverdueRepayments();
  console.log(`Overdue job marked ${result.markedOverdue} installment(s) as OVERDUE.`);
}

main().catch((error) => {
  console.error("Overdue job failed:", error instanceof Error ? error.message : "unknown error");
  process.exit(1);
});
