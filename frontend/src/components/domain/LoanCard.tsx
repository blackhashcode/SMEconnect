"use client";

import Link from "next/link";
import { ArrowUpRight, MapPin, ShieldCheck, TrendingUp } from "lucide-react";
import { Avatar } from "@/components/ui/Avatar";
import { Badge, VerifiedBadge } from "@/components/ui/Badge";
import { LinkButton } from "@/components/ui/Button";
import { Photo } from "@/components/ui/Photo";
import { TimeAgo } from "@/components/ui/TimeAgo";
import { useSessionUser } from "@/components/auth/SessionProvider";
import { formatBDT } from "@/lib/format";
import { FREQUENCY_LABEL, LOAN_REQUEST_STATUS, isAcceptingOffers, tenureLabel } from "@/lib/loans";
import type { LoanRequestView } from "@/data/types";
import { cn } from "@/lib/cn";

export function LoanCard({ loan, featured = false, className }: { loan: LoanRequestView; featured?: boolean; className?: string }) {
  const viewer = useSessionUser();
  const { business, owner } = loan;
  const isOwner = viewer?.id === owner.id;
  const canOffer = viewer?.role === "investor" && !isOwner && isAcceptingOffers(loan.status);
  const badge = LOAN_REQUEST_STATUS[loan.status];

  return (
    <article className={cn("group overflow-hidden rounded-2xl bg-surface-container-lowest card-shadow card-interactive", className)}>
      {featured && business.image && (
        <Photo src={business.image} alt="" className="h-52 sm:h-60" sizes="(min-width: 1024px) 640px, 100vw" zoomOnHover>
          <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-inverse-surface/70 to-transparent p-space-md">
            <Badge tone="secondary" className="bg-white/90 text-secondary">Open request</Badge>
          </div>
        </Photo>
      )}
      <div className="p-space-lg">
        <div className="flex items-start gap-space-md">
          <Link href={`/businesses/${business.id}`} className="shrink-0 rounded-full">
            <Avatar src={owner.avatar} alt={owner.name} size="md" />
          </Link>
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <Link href={`/businesses/${business.id}`} className="text-label-md font-bold text-on-surface hover:text-primary">
                {business.name}
              </Link>
              {business.verified && <VerifiedBadge compact />}
            </div>
            <p className="mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-body-sm text-outline">
              <span className="flex items-center gap-1">
                <MapPin className="h-3.5 w-3.5" aria-hidden />
                {business.location}
              </span>
              <span aria-hidden>·</span>
              <TimeAgo iso={loan.createdAt} />
            </p>
          </div>
          <Badge tone={badge.tone} className="shrink-0">{badge.label}</Badge>
        </div>

        <h3 className="mt-space-md text-headline-sm text-on-surface">{loan.title}</h3>
        <p className="mt-space-sm line-clamp-2 text-body-md text-on-surface-variant">{loan.description}</p>

        <div className="mt-space-md grid grid-cols-3 gap-space-sm rounded-xl bg-surface-container-low p-space-sm text-center">
          <div>
            <p className="text-label-sm text-outline">Amount</p>
            <p className="mt-0.5 text-label-md font-bold text-on-surface">{formatBDT(loan.amount)}</p>
          </div>
          <div>
            <p className="text-label-sm text-outline">Tenure</p>
            <p className="mt-0.5 text-label-md font-bold text-on-surface">{tenureLabel(loan.tenureDays)}</p>
          </div>
          <div>
            <p className="text-label-sm text-outline">Rate</p>
            <p className="mt-0.5 text-label-md font-bold text-success">{loan.rate === null ? "Open" : `${loan.rate}% p.a.`}</p>
          </div>
        </div>

        <div className="mt-space-md flex flex-wrap items-center justify-between gap-space-sm border-t border-surface-container-high pt-space-md">
          <div className="flex items-center gap-space-md text-body-sm text-on-surface-variant">
            <span className="flex items-center gap-1 whitespace-nowrap"><TrendingUp className="h-4 w-4 text-primary" aria-hidden /> {FREQUENCY_LABEL[loan.frequency]}</span>
            <span className="flex items-center gap-1 whitespace-nowrap"><ShieldCheck className="h-4 w-4 text-success" aria-hidden /> Trust {business.trustScore}</span>
          </div>
          <div className="flex items-center gap-space-sm">
            <Link href={`/businesses/${business.id}`} className="flex items-center gap-1 whitespace-nowrap text-label-md font-semibold text-primary hover:underline">
              View profile <ArrowUpRight className="h-4 w-4" aria-hidden />
            </Link>
            {canOffer && (
              <LinkButton href={`/loan-requests/${loan.id}/offer`} size="sm">
                Make an offer
              </LinkButton>
            )}
            {isOwner && (
              <LinkButton href="/business-dashboard" size="sm" variant="soft">
                Manage offers
              </LinkButton>
            )}
          </div>
        </div>
      </div>
    </article>
  );
}

export function LoanCardCompact({ loan }: { loan: LoanRequestView }) {
  return (
    <Link
      href={`/loan-requests/${loan.id}/offer`}
      className="flex items-center gap-space-md rounded-xl p-space-sm transition-colors hover:bg-surface-container-low"
    >
      <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-secondary-fixed text-secondary">
        <TrendingUp className="h-5 w-5" aria-hidden />
      </span>
      <span className="min-w-0 flex-1">
        <span className="block truncate text-label-md font-semibold text-on-surface">{loan.business.name}</span>
        <span className="block truncate text-body-sm text-outline">{loan.title}</span>
      </span>
      <span className="shrink-0 text-label-md font-bold text-primary">{formatBDT(loan.amount)}</span>
    </Link>
  );
}
