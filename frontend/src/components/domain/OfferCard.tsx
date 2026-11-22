"use client";

import Link from "next/link";
import { CalendarDays, MessageSquareText, Percent, Wallet } from "lucide-react";
import { Badge } from "@/components/ui/Badge";
import { Avatar } from "@/components/ui/Avatar";
import { LinkButton } from "@/components/ui/Button";
import { TimeAgo } from "@/components/ui/TimeAgo";
import { useSessionUser } from "@/components/auth/SessionProvider";
import { MessageButton } from "./MessageButton";
import { formatBDT } from "@/lib/format";
import { offerStatusTone } from "@/lib/loans";
import type { LoanOfferView } from "@/data/types";

/**
 * An offer, seen by either side. The business owner sees the investor; the
 * investor sees which request it was for.
 */
export function OfferCard({ offer, showActions = true }: { offer: LoanOfferView; showActions?: boolean }) {
  const viewer = useSessionUser();
  const viewerIsInvestor = viewer?.id === offer.investorId;
  const { investor, request } = offer;
  const awaitingYou =
    (offer.status === "pending" || offer.status === "negotiating") &&
    ((viewerIsInvestor && offer.lastActionBy === "owner") || (!viewerIsInvestor && offer.lastActionBy === "investor"));

  return (
    <article className="rounded-2xl bg-surface-container-lowest p-space-lg card-shadow card-interactive">
      <div className="flex items-start gap-space-md">
        <Avatar src={investor.avatar} alt={investor.name} size="md" />
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            {viewerIsInvestor ? (
              <Link href={`/businesses/${request.business.id}`} className="text-label-md font-bold text-on-surface hover:text-primary">
                {request.business.name}
              </Link>
            ) : (
              <Link href={`/investors/${investor.id}`} className="text-label-md font-bold text-on-surface hover:text-primary">
                {investor.name}
              </Link>
            )}
            <Badge tone={offerStatusTone[offer.status]} className="capitalize">{offer.status}</Badge>
            {awaitingYou && <Badge tone="secondary">Your turn</Badge>}
          </div>
          <p className="mt-0.5 line-clamp-1 text-body-sm text-outline">
            {request.title} · <TimeAgo iso={offer.createdAt} />
          </p>
        </div>
        <p className="shrink-0 text-numeric-stat text-primary">{formatBDT(offer.amount)}</p>
      </div>

      {offer.note && (
        <p className="mt-space-md line-clamp-3 rounded-xl bg-surface-container-low p-space-sm text-body-md text-on-surface-variant">“{offer.note}”</p>
      )}

      {offer.counter && offer.status === "negotiating" && (
        <p className="mt-space-sm rounded-xl bg-tertiary-fixed/60 p-space-sm text-body-sm text-on-tertiary-fixed">
          Owner proposed {formatBDT(offer.counter.amount)} at {offer.counter.rate}% over {offer.counter.tenureMonths} months.
        </p>
      )}

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
          <MessageButton
            participantId={viewerIsInvestor ? request.business.ownerId : investor.id}
            variant="ghost"
            size="sm"
            className="px-2"
          >
            <MessageSquareText className="h-4 w-4" aria-hidden /> {viewerIsInvestor ? "Message owner" : "Message investor"}
          </MessageButton>
          <LinkButton href={`/loans/offers/${offer.id}/review`} size="sm" variant={awaitingYou ? "primary" : "soft"}>
            {offer.status === "pending" || offer.status === "negotiating" ? (viewerIsInvestor ? "View offer" : "Review & negotiate") : "View details"}
          </LinkButton>
        </div>
      )}
    </article>
  );
}
