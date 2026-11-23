"use client";

import { CalendarDays, Percent, Repeat2 } from "lucide-react";
import { Avatar } from "@/components/ui/Avatar";
import { Badge } from "@/components/ui/Badge";
import { LinkButton } from "@/components/ui/Button";
import { TimeAgo } from "@/components/ui/TimeAgo";
import { useSessionUser } from "@/components/auth/SessionProvider";
import { formatBDT } from "@/lib/format";
import { FREQUENCY_LABEL, OFFER_STATUS, tenureLabel } from "@/lib/loans";
import type { Offer } from "@/data/types";

/** An offer as either party sees it: the owner sees the investor, the investor sees the business. */
export function OfferCard({ offer }: { offer: Offer }) {
  const viewer = useSessionUser();
  const viewerIsInvestor = viewer?.id === offer.investor.id;
  const counterpart = viewerIsInvestor ? offer.owner : offer.investor;
  const myRole = viewerIsInvestor ? "INVESTOR" : "OWNER";
  const yourTurn = offer.status === "PENDING" && offer.proposedBy !== myRole;
  const status = OFFER_STATUS[offer.status];

  return (
    <article className="rounded-2xl bg-surface-container-lowest p-space-lg card-shadow card-interactive">
      <div className="flex items-start gap-space-md">
        <Avatar src={counterpart.image ?? ""} alt={counterpart.name} size="md" />
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <p className="text-label-md font-bold text-on-surface">{viewerIsInvestor ? (offer.owner.shopName ?? offer.owner.name) : offer.investor.name}</p>
            <Badge tone={status.tone}>{status.label}</Badge>
            {yourTurn && <Badge tone="secondary">Your turn</Badge>}
            {offer.parentOfferId && <Badge tone="neutral">Counter-offer</Badge>}
          </div>
          <p className="mt-0.5 line-clamp-1 text-body-sm text-outline">
            {offer.loanRequest.purpose} · <TimeAgo iso={offer.createdAt} />
          </p>
        </div>
        <p className="shrink-0 text-numeric-stat text-primary">{formatBDT(offer.amountBdt)}</p>
      </div>

      {offer.message && <p className="mt-space-md line-clamp-3 rounded-xl bg-surface-container-low p-space-sm text-body-md text-on-surface-variant">“{offer.message}”</p>}

      <div className="mt-space-md grid grid-cols-3 gap-space-sm text-center">
        <div>
          <Percent className="mx-auto h-4 w-4 text-primary" aria-hidden />
          <p className="mt-1 text-label-md font-bold text-on-surface">{Number(offer.interestRatePct)}% p.a.</p>
          <p className="text-label-sm text-outline">Rate</p>
        </div>
        <div>
          <CalendarDays className="mx-auto h-4 w-4 text-primary" aria-hidden />
          <p className="mt-1 text-label-md font-bold text-on-surface">{tenureLabel(offer.tenureDays)}</p>
          <p className="text-label-sm text-outline">Tenure</p>
        </div>
        <div>
          <Repeat2 className="mx-auto h-4 w-4 text-primary" aria-hidden />
          <p className="mt-1 text-label-md font-bold text-on-surface">{FREQUENCY_LABEL[offer.repaymentFrequency]}</p>
          <p className="text-label-sm text-outline">Repayment</p>
        </div>
      </div>

      <div className="mt-space-md flex justify-end border-t border-surface-container-high pt-space-md">
        <LinkButton href={`/offers/${offer.id}`} size="sm" variant={yourTurn ? "primary" : "soft"}>
          {yourTurn ? "Respond" : "View details"}
        </LinkButton>
      </div>
    </article>
  );
}
