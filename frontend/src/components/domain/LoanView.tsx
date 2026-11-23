"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowLeft, BadgeCheck, CalendarDays, CheckCircle2, Clock3, FileSignature, LoaderCircle, Percent, Printer, Repeat2, ShieldCheck, Wallet } from "lucide-react";
import { Avatar } from "@/components/ui/Avatar";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { ProgressBar } from "@/components/ui/ProgressBar";
import { FormAlert } from "@/components/auth/FormField";
import { MessageButton } from "./MessageButton";
import { api } from "@/lib/client-api";
import { formatBDT, shortDate, firstName } from "@/lib/format";
import { FREQUENCY_LABEL, tenureLabel } from "@/lib/loans";
import type { Agreement, LoanDetail, Repayment } from "@/data/types";
import { cn } from "@/lib/cn";

const REPAYMENT_BADGE: Record<Repayment["status"], { label: string; tone: "neutral" | "warning" | "success" | "error" }> = {
  UPCOMING: { label: "Upcoming", tone: "neutral" },
  OVERDUE: { label: "Overdue", tone: "error" },
  MARKED_PAID: { label: "Awaiting confirmation", tone: "warning" },
  CONFIRMED: { label: "Confirmed", tone: "success" },
};

/** A loan from agreement to final repayment, for either party. */
export function LoanView({ loan, agreement, viewerId }: { loan: LoanDetail; agreement: Agreement | null; viewerId: string }) {
  const router = useRouter();
  const isOwner = viewerId === loan.parties.owner.id;
  const counterpart = isOwner ? loan.parties.investor : loan.parties.owner;
  const confirmations = agreement?.confirmations;
  const iConfirmed = Boolean(isOwner ? confirmations?.ownerConfirmedAt : confirmations?.investorConfirmedAt);
  const awaitingAgreement = loan.status === "PENDING_AGREEMENT";
  const progress = loan.progress;
  const paidPct = progress.totalInstallments ? Math.round((progress.confirmedCount / progress.totalInstallments) * 100) : 0;

  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function run(key: string, path: string, body: unknown = {}, confirmText?: string) {
    if (confirmText && !window.confirm(confirmText)) return;
    setBusy(key);
    setError(null);
    const result = await api.post(path, body);
    setBusy(null);
    if (!result.ok) {
      setError(result.error);
      return;
    }
    router.refresh();
  }

  const terms = [
    { icon: Wallet, label: "Principal", value: formatBDT(loan.principalBdt), hint: "Paid to the business" },
    { icon: Percent, label: "Interest rate", value: `${Number(loan.interestRatePct)}% p.a.`, hint: "Fixed for the full term" },
    { icon: CalendarDays, label: "Tenure", value: tenureLabel(loan.tenureDays), hint: `${progress.totalInstallments} instalments` },
    { icon: Repeat2, label: "Repayment", value: FREQUENCY_LABEL[loan.repaymentFrequency], hint: `Total ${formatBDT(loan.totalRepayableBdt)}` },
  ];

  return (
    <div>
      <Link href={isOwner ? "/business-dashboard" : "/investor-dashboard"} className="mb-space-md inline-flex items-center gap-1.5 text-label-md font-semibold text-on-surface-variant hover:text-primary print:hidden">
        <ArrowLeft className="h-4 w-4" aria-hidden /> Back to dashboard
      </Link>

      <div className="overflow-hidden rounded-3xl bg-surface-container-lowest card-shadow">
        <div className="bg-gradient-to-r from-primary via-primary-container to-secondary-container px-space-lg py-space-xl text-on-primary">
          <div className="flex flex-wrap items-center justify-between gap-space-md">
            <div>
              <Badge tone={awaitingAgreement ? "warning" : "success"} className="bg-white/15 text-white">
                {awaitingAgreement ? <Clock3 className="h-3.5 w-3.5" aria-hidden /> : <ShieldCheck className="h-3.5 w-3.5" aria-hidden />}
                {awaitingAgreement ? "Awaiting confirmation" : loan.status === "COMPLETED" ? "Completed" : "Active loan"}
              </Badge>
              <h1 className="mt-space-md text-headline-lg">{awaitingAgreement ? "Loan agreement" : "Loan and repayments"}</h1>
              <p className="mt-1 text-body-md text-on-primary/85">{loan.parties.owner.shopName ?? loan.parties.owner.name}</p>
            </div>
            <div className="rounded-2xl bg-white/15 px-space-lg py-space-md text-center">
              <p className="text-label-sm uppercase tracking-wide text-white/70">Agreement</p>
              <p className="mt-1 text-headline-sm">SME-{(loan.agreementId ?? loan.id).slice(-8).toUpperCase()}</p>
            </div>
          </div>
        </div>

        <div className="space-y-space-lg p-space-lg">
          {error && <FormAlert>{error}</FormAlert>}

          <section className="grid gap-space-md sm:grid-cols-2">
            {[{ role: "Borrower", party: loan.parties.owner }, { role: "Investor", party: loan.parties.investor }].map(({ role, party }) => (
              <div key={role} className="flex items-center gap-space-md rounded-2xl bg-surface-container-low p-space-md">
                <Avatar src={party.image ?? ""} alt={party.name} size="lg" />
                <div>
                  <p className="text-label-sm text-outline">{role}</p>
                  <p className="text-headline-sm text-on-surface">{party.name}</p>
                  {party.verified && <Badge tone="success" className="mt-1"><BadgeCheck className="h-3.5 w-3.5" aria-hidden /> Verified</Badge>}
                </div>
              </div>
            ))}
          </section>

          <section className="grid gap-space-md sm:grid-cols-2 lg:grid-cols-4">
            {terms.map((item) => (
              <div key={item.label} className="rounded-2xl border border-surface-container-high p-space-md">
                <item.icon className="h-5 w-5 text-primary" aria-hidden />
                <p className="mt-space-sm text-label-sm text-outline">{item.label}</p>
                <p className="text-headline-sm text-on-surface">{item.value}</p>
                <p className="text-body-sm text-on-surface-variant">{item.hint}</p>
              </div>
            ))}
          </section>

          {awaitingAgreement ? (
            <section className="rounded-2xl bg-surface-container-low p-space-lg">
              <div className="flex items-center gap-space-sm">
                <FileSignature className="h-5 w-5 text-primary" aria-hidden />
                <h2 className="text-headline-sm text-on-surface">Confirm the agreement</h2>
              </div>
              <p className="mt-space-sm text-body-md text-on-surface-variant">Both parties confirm these terms. Once the second confirmation is in, the loan becomes active and the repayment schedule starts.</p>
              <ul className="mt-space-md space-y-space-sm">
                {[
                  { who: "Borrower", at: confirmations?.ownerConfirmedAt },
                  { who: "Investor", at: confirmations?.investorConfirmedAt },
                ].map((row) => (
                  <li key={row.who} className="flex items-center gap-space-sm text-body-md">
                    {row.at ? <CheckCircle2 className="h-5 w-5 text-success" aria-hidden /> : <Clock3 className="h-5 w-5 text-outline" aria-hidden />}
                    <span className="font-semibold text-on-surface">{row.who}</span>
                    <span className="text-on-surface-variant">{row.at ? `confirmed ${shortDate(row.at)}` : "hasn't confirmed yet"}</span>
                  </li>
                ))}
              </ul>
              <div className="mt-space-md flex flex-wrap gap-space-sm print:hidden">
                {agreement && !iConfirmed && (
                  <Button variant="secondary" onClick={() => run("confirm", `/agreements/${agreement.id}/confirm`, {}, "Confirm these loan terms?")} disabled={busy !== null}>
                    {busy === "confirm" ? <LoaderCircle className="h-4 w-4 animate-spin" aria-hidden /> : <CheckCircle2 className="h-4 w-4" aria-hidden />} Confirm agreement
                  </Button>
                )}
                {iConfirmed && <Badge tone="success">You&apos;ve confirmed. Waiting for {firstName(counterpart.name)}.</Badge>}
              </div>
            </section>
          ) : (
            <section>
              <div className="flex flex-wrap items-end justify-between gap-space-md">
                <div>
                  <h2 className="text-headline-md text-on-surface">Repayment schedule</h2>
                  <p className="text-body-sm text-on-surface-variant">
                    {formatBDT(progress.confirmedBdt)} repaid · {formatBDT(progress.outstandingBdt)} outstanding
                    {progress.overdueCount > 0 && <span className="font-semibold text-error"> · {progress.overdueCount} overdue</span>}
                  </p>
                </div>
                <div className="w-full sm:w-64"><ProgressBar value={paidPct} label="Instalments confirmed" tone="success" /></div>
              </div>
              <div className="mt-space-md overflow-x-auto rounded-2xl border border-surface-container-high">
                <table className="w-full min-w-[560px] text-left text-body-sm">
                  <thead className="bg-surface-container-low text-label-sm uppercase tracking-wide text-outline">
                    <tr><th className="px-space-md py-space-sm">#</th><th className="px-space-md py-space-sm">Due</th><th className="px-space-md py-space-sm">Amount</th><th className="px-space-md py-space-sm">Status</th><th className="px-space-md py-space-sm print:hidden" /></tr>
                  </thead>
                  <tbody>
                    {loan.schedule.map((repayment) => {
                      const badge = REPAYMENT_BADGE[repayment.status];
                      const canMark = isOwner && (repayment.status === "UPCOMING" || repayment.status === "OVERDUE");
                      const canConfirm = !isOwner && repayment.status === "MARKED_PAID";
                      return (
                        <tr key={repayment.id} className={cn("border-t border-surface-container-high", repayment.status === "OVERDUE" && "bg-error-container/30")}>
                          <td className="px-space-md py-space-sm font-bold text-on-surface">{repayment.installmentNo}</td>
                          <td className="px-space-md py-space-sm text-on-surface-variant">{shortDate(repayment.dueDate)}</td>
                          <td className="px-space-md py-space-sm font-semibold text-on-surface">{formatBDT(repayment.amountBdt)}</td>
                          <td className="px-space-md py-space-sm"><Badge tone={badge.tone}>{badge.label}</Badge></td>
                          <td className="px-space-md py-space-sm text-right print:hidden">
                            {canMark && (
                              <Button size="sm" variant="soft" disabled={busy !== null} onClick={() => run(repayment.id, `/repayments/${repayment.id}/mark-paid`, {}, `Mark instalment ${repayment.installmentNo} (${formatBDT(repayment.amountBdt)}) as paid?`)}>
                                {busy === repayment.id && <LoaderCircle className="h-4 w-4 animate-spin" aria-hidden />} Mark paid
                              </Button>
                            )}
                            {canConfirm && (
                              <Button size="sm" variant="success" disabled={busy !== null} onClick={() => run(repayment.id, `/repayments/${repayment.id}/confirm`, {}, `Confirm you received ${formatBDT(repayment.amountBdt)}?`)}>
                                {busy === repayment.id && <LoaderCircle className="h-4 w-4 animate-spin" aria-hidden />} Confirm receipt
                              </Button>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </section>
          )}

          <div className="flex flex-wrap justify-end gap-space-sm border-t border-surface-container-high pt-space-md print:hidden">
            <Button variant="outline" onClick={() => window.print()}><Printer className="h-4 w-4" aria-hidden /> Save as PDF</Button>
            <MessageButton participantId={counterpart.id} variant="ghost">Message {firstName(counterpart.name)}</MessageButton>
          </div>
        </div>
      </div>
    </div>
  );
}
