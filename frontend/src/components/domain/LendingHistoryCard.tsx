import Link from "next/link";
import { History } from "lucide-react";
import { Card, SectionHeading } from "@/components/ui/Card";
import type { LendingHistory } from "@/lib/api";
import { formatBDT, formatBDTCompact } from "@/lib/format";
import { tenureLabel } from "@/lib/loans";
import { cn } from "@/lib/cn";

const STATUS: Record<string, { label: string; tone: string }> = {
  ACTIVE: { label: "Repaying", tone: "bg-primary-fixed text-primary" },
  COMPLETED: { label: "Completed", tone: "bg-success-container text-success" },
  DEFAULTED: { label: "Defaulted", tone: "bg-error-container text-error" },
};

/** A member's lending track record: totals, on-time rate and each agreed loan. */
export function LendingHistoryCard({ history, name }: { history: LendingHistory | null; name: string }) {
  if (!history) return null;
  const { summary, loans } = history;
  const borrower = history.role === "OWNER";
  const stats = [
    { label: borrower ? "Loans taken" : "Loans given", value: String(summary.loans) },
    { label: "Completed", value: String(summary.completed) },
    { label: borrower ? "Total borrowed" : "Total lent", value: formatBDTCompact(summary.totalPrincipalBdt) },
    { label: "Paid on time", value: summary.onTimeRatePct === null ? "—" : `${summary.onTimeRatePct}%` },
  ];

  return (
    <Card className="p-space-lg">
      <SectionHeading
        eyebrow="Track record"
        title="Lending history"
        description={borrower ? `Every loan ${name} has agreed on SME Connect and how it was repaid.` : `Every loan ${name} has given on SME Connect and how it was repaid.`}
      />
      <div className="mt-space-md grid grid-cols-2 gap-space-sm sm:grid-cols-4">
        {stats.map((s) => (
          <div key={s.label} className="rounded-xl bg-surface-container-low p-space-sm">
            <p className="text-label-sm uppercase tracking-wide text-outline">{s.label}</p>
            <p className="mt-0.5 text-headline-sm text-on-surface">{s.value}</p>
          </div>
        ))}
      </div>
      {summary.overdueInstalments > 0 && (
        <p className="mt-space-sm text-body-sm font-semibold text-error">{summary.overdueInstalments} instalment{summary.overdueInstalments === 1 ? " is" : "s are"} overdue.</p>
      )}
      {loans.length === 0 ? (
        <p className="mt-space-md flex items-center gap-1.5 text-body-sm text-on-surface-variant"><History className="h-4 w-4" aria-hidden /> No agreed loans yet.</p>
      ) : (
        <ul className="mt-space-md divide-y divide-surface-container-high">
          {loans.slice(0, 8).map((loan) => {
            const status = STATUS[loan.status] ?? { label: loan.status, tone: "bg-surface-container-high text-on-surface-variant" };
            return (
              <li key={loan.id} className="flex flex-wrap items-center gap-x-space-md gap-y-1 py-space-sm">
                <div className="min-w-0 flex-1">
                  <p className="text-label-md font-bold text-on-surface">
                    {formatBDT(loan.principalBdt)} <span className="font-normal text-on-surface-variant">{loan.role === "borrowed" ? "from" : "to"}</span>{" "}
                    <Link href={loan.counterparty.role === "OWNER" ? `/businesses/${loan.counterparty.id}` : `/investors/${loan.counterparty.id}`} className="text-primary hover:underline">{loan.counterparty.name}</Link>
                  </p>
                  <p className="text-body-sm text-on-surface-variant">
                    {loan.interestRatePct}% p.a. · {tenureLabel(loan.tenureDays)} · {loan.repayments.paid}/{loan.repayments.total} instalments paid
                    {loan.repayments.overdue > 0 && <span className="font-semibold text-error"> · {loan.repayments.overdue} overdue</span>}
                  </p>
                </div>
                <span className={cn("rounded-full px-2.5 py-1 text-label-sm font-semibold", status.tone)}>{status.label}</span>
              </li>
            );
          })}
        </ul>
      )}
    </Card>
  );
}
