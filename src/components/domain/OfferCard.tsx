import Link from "next/link";
import { CalendarDays, MessageSquareText, Percent, Wallet } from "lucide-react";
import { Badge } from "@/components/ui/Badge";
import { Avatar } from "@/components/ui/Avatar";
import { formatBDT } from "@/data/loans";
import { personById } from "@/data/users";
import type { LoanOffer } from "@/data/types";

const statusTone = {
  pending: "primary",
  negotiating: "warning",
  accepted: "success",
  declined: "error",
} as const;

export function OfferCard({ offer, showActions = true }: { offer: LoanOffer; showActions?: boolean }) {
  const investor = personById(offer.investorId);
  if (!investor) return null;

  return (
    <article className="rounded-2xl bg-surface-container-lowest p-space-lg card-shadow">
      <div className="flex items-start gap-space-md">
        <Avatar src={investor.avatar} alt={investor.name} size="md" />
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <Link href={`/investors/${investor.id}`} className="text-label-md font-bold text-on-surface hover:text-primary">
              {investor.name}
            </Link>
            <Badge tone={statusTone[offer.status]}>{offer.status}</Badge>
          </div>
          <p className="mt-0.5 text-body-sm text-outline">{investor.headline}</p>
        </div>
        <p className="shrink-0 text-numeric-stat text-primary">{formatBDT(offer.amount)}</p>
      </div>

      <p className="mt-space-md rounded-xl bg-surface-container-low p-space-sm text-body-md text-on-surface-variant">
        “{offer.note}”
      </p>

      <div className="mt-space-md grid grid-cols-3 gap-space-sm text-center">
        <div>
          <Percent className="mx-auto h-4 w-4 text-primary" aria-hidden />
          <p className="mt-1 text-label-md font-bold text-on-surface">{offer.rate}% p.a.</p>
          <p className="text-label-sm text-outline">Rate</p>
        </div>
        <div>
          <CalendarDays className="mx-auto h-4 w-4 text-primary" aria-hidden />
          <p className="mt-1 text-label-md font-bold text-on-surface">{offer.tenureMonths} months</p>
          <p className="text-label-sm text-outline">Tenure</p>
        </div>
        <div>
          <Wallet className="mx-auto h-4 w-4 text-primary" aria-hidden />
          <p className="mt-1 text-label-md font-bold text-on-surface">{offer.frequency}</p>
          <p className="text-label-sm text-outline">Repayment</p>
        </div>
      </div>

      {showActions && (
        <div className="mt-space-md flex flex-wrap items-center justify-between gap-space-sm border-t border-surface-container-high pt-space-md">
          <Link href="/messages" className="flex items-center gap-1.5 text-label-md font-semibold text-on-surface-variant hover:text-primary">
            <MessageSquareText className="h-4 w-4" aria-hidden /> Message investor
          </Link>
          <Link
            href={`/loans/offers/${offer.id}/review`}
            className="rounded-full bg-primary px-space-md py-2 text-label-md font-semibold text-on-primary hover:bg-primary-container"
          >
            Review & negotiate
          </Link>
        </div>
      )}
    </article>
  );
}
