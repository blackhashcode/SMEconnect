"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { CheckCircle2, Clock3, LoaderCircle } from "lucide-react";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { ProgressBar } from "@/components/ui/ProgressBar";
import { FormAlert } from "@/components/auth/FormField";
import { postJson } from "@/lib/client-api";
import { formatBDT } from "@/lib/format";
import type { RepaymentItem } from "@/data/types";

const statusLabel: Record<RepaymentItem["status"], { label: string; tone: "neutral" | "warning" | "success" | "error" }> = {
  UPCOMING: { label: "Scheduled", tone: "neutral" },
  MARKED_PAID: { label: "Marked paid", tone: "warning" },
  CONFIRMED: { label: "Confirmed", tone: "success" },
  OVERDUE: { label: "Overdue", tone: "error" },
};

export function RepaymentScheduleCard({
  initialRepayments,
  fallbackCycles,
  fallbackInstallment,
  fallbackFinalInstallment,
  tenureMonths,
  viewerSide,
  agreed,
}: {
  initialRepayments: RepaymentItem[];
  fallbackCycles: number;
  fallbackInstallment: number;
  fallbackFinalInstallment: number;
  tenureMonths: number;
  viewerSide: "owner" | "investor";
  agreed: boolean;
}) {
  const router = useRouter();
  const [repayments, setRepayments] = useState<RepaymentItem[]>(initialRepayments);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const confirmedCount = repayments.filter((r) => r.status === "CONFIRMED").length;
  const progressPct = repayments.length > 0 ? Math.round((confirmedCount / repayments.length) * 100) : 0;

  async function act(id: string, endpoint: "mark-paid" | "confirm") {
    setBusyId(id);
    setError(null);
    const res = await postJson<{ repayments: RepaymentItem[] }>(`/api/v1/repayments/${encodeURIComponent(id)}/${endpoint}`);
    setBusyId(null);
    if (!res.ok) {
      setError(res.error);
      return;
    }
    setRepayments(res.data.repayments);
    router.refresh();
  }

  return (
    <section className="rounded-2xl border border-surface-container-high p-space-lg">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h2 className="text-headline-sm text-on-surface">Repayment roadmap</h2>
          <p className="mt-1 text-body-sm text-outline">
            {repayments.length > 0
              ? `${confirmedCount} of ${repayments.length} instalments confirmed.`
              : "Schedule activates once both parties confirm the agreement."}
          </p>
        </div>
        {repayments.length > 0 && <Badge tone="primary">{progressPct}% repaid</Badge>}
      </div>

      {error && (
        <div className="mt-space-sm">
          <FormAlert>{error}</FormAlert>
        </div>
      )}

      {repayments.length > 0 ? (
        <div className="mt-space-md space-y-space-sm">
          {repayments.slice(0, 8).map((item) => {
            const meta = statusLabel[item.status];
            const canMarkPaid = agreed && viewerSide === "owner" && (item.status === "UPCOMING" || item.status === "OVERDUE");
            const canConfirm = agreed && viewerSide === "investor" && item.status === "MARKED_PAID";
            return (
              <div
                key={item.id}
                className="flex flex-wrap items-center justify-between gap-space-sm rounded-xl bg-surface-container-low px-space-md py-space-sm"
              >
                <div className="flex items-center gap-space-sm">
                  <span className="flex h-7 w-7 items-center justify-center rounded-full bg-primary-fixed text-label-sm font-bold text-primary">
                    {item.installmentNo}
                  </span>
                  <div>
                    <p className="text-label-md font-bold text-on-surface">{formatBDT(item.amountBdt)}</p>
                    <p className="text-[11px] text-outline">
                      Due {new Date(item.dueDate).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" })}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-space-sm">
                  <Badge tone={meta.tone}>
                    {item.status === "CONFIRMED" ? <CheckCircle2 className="h-3.5 w-3.5" aria-hidden /> : <Clock3 className="h-3.5 w-3.5" aria-hidden />}
                    {meta.label}
                  </Badge>
                  {canMarkPaid && (
                    <Button size="sm" variant="soft" disabled={busyId === item.id} onClick={() => act(item.id, "mark-paid")}>
                      {busyId === item.id && <LoaderCircle className="h-3.5 w-3.5 animate-spin" aria-hidden />}
                      Mark paid
                    </Button>
                  )}
                  {canConfirm && (
                    <Button size="sm" variant="success" disabled={busyId === item.id} onClick={() => act(item.id, "confirm")}>
                      {busyId === item.id && <LoaderCircle className="h-3.5 w-3.5 animate-spin" aria-hidden />}
                      Confirm receipt
                    </Button>
                  )}
                </div>
              </div>
            );
          })}
          {repayments.length > 8 && (
            <p className="text-body-sm text-outline">+ {repayments.length - 8} more instalments through month {tenureMonths}</p>
          )}
        </div>
      ) : (
        <>
          <div className="mt-space-md grid gap-space-sm sm:grid-cols-2 lg:grid-cols-3">
            {Array.from({ length: Math.min(fallbackCycles, 6) }).map((_, index) => {
              const isLast = index + 1 === fallbackCycles;
              return (
                <div key={index} className="flex items-center justify-between rounded-xl bg-surface-container-low px-space-md py-space-sm">
                  <div className="flex items-center gap-space-sm">
                    <span className="flex h-7 w-7 items-center justify-center rounded-full bg-primary-fixed text-label-sm font-bold text-primary">
                      {index + 1}
                    </span>
                    <span className="text-body-sm text-on-surface-variant">Cycle {index + 1}</span>
                  </div>
                  <span className="text-label-md font-bold text-on-surface">
                    {formatBDT(isLast ? fallbackFinalInstallment : fallbackInstallment)}
                  </span>
                </div>
              );
            })}
          </div>
          {fallbackCycles > 6 && (
            <p className="mt-space-sm text-body-sm text-outline">+ {fallbackCycles - 6} more instalments through month {tenureMonths}</p>
          )}
        </>
      )}

      <ProgressBar value={progressPct} className="mt-space-md" showValue={false} />
    </section>
  );
}
