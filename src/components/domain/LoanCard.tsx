/* eslint-disable @next/next/no-img-element */
import Link from "next/link";
import { ArrowUpRight, Building2, Handshake, MapPin, TrendingUp } from "lucide-react";
import { Badge, VerifiedBadge } from "@/components/ui/Badge";
import { ProgressBar } from "@/components/ui/ProgressBar";
import { businessById } from "@/data/businesses";
import { formatBDT } from "@/data/loans";
import { personById } from "@/data/users";
import type { LoanRequest } from "@/data/types";
import { cn } from "@/lib/cn";

export function LoanCard({ loan, featured = false, className }: { loan: LoanRequest; featured?: boolean; className?: string }) {
  const business = businessById(loan.businessId);
  const owner = business ? personById(business.ownerId) : undefined;

  return (
    <article className={cn("overflow-hidden rounded-2xl bg-surface-container-lowest card-shadow", className)}>
      {featured && loan.image && (
        <div className="relative h-52 overflow-hidden bg-surface-container">
          <img src={loan.image} alt="" className="h-full w-full object-cover" />
          <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-inverse-surface/70 to-transparent p-space-md">
            <Badge tone="secondary" className="bg-white/90 text-secondary">Open request</Badge>
          </div>
        </div>
      )}
      <div className="p-space-lg">
        <div className="flex items-start gap-space-md">
          {owner && (
            <Link href={`/businesses/${business?.id}`}>
              <img src={owner.avatar} alt={owner.name} className="h-12 w-12 rounded-full object-cover ring-2 ring-surface" />
            </Link>
          )}
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <Link href={`/businesses/${business?.id}`} className="text-label-md font-bold text-on-surface hover:text-primary">
                {business?.name}
              </Link>
              {business?.verified && <VerifiedBadge compact />}
            </div>
            <p className="mt-0.5 flex items-center gap-1 text-body-sm text-outline">
              <MapPin className="h-3.5 w-3.5" aria-hidden />
              {business?.location}
            </p>
          </div>
          <Badge tone={loan.status === "open" ? "primary" : "warning"}>
            {loan.status === "open" ? "Open" : "Offers received"}
          </Badge>
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
            <p className="mt-0.5 text-label-md font-bold text-on-surface">{loan.tenureMonths} mo</p>
          </div>
          <div>
            <p className="text-label-sm text-outline">Rate</p>
            <p className="mt-0.5 text-label-md font-bold text-success">{loan.rate}% p.a.</p>
          </div>
        </div>

        <div className="mt-space-md">
          <ProgressBar value={loan.progress} label="Request progress" />
        </div>

        <div className="mt-space-md flex flex-wrap items-center justify-between gap-space-sm border-t border-surface-container-high pt-space-md">
          <div className="flex items-center gap-space-md text-body-sm text-on-surface-variant">
            <span className="flex items-center gap-1"><Handshake className="h-4 w-4 text-primary" aria-hidden /> {loan.offersCount} offers</span>
            <span className="flex items-center gap-1"><Building2 className="h-4 w-4 text-primary" aria-hidden /> {loan.connectionsCount} connections</span>
          </div>
          <div className="flex items-center gap-space-sm">
            <Link href={`/businesses/${business?.id}`} className="flex items-center gap-1 text-label-md font-semibold text-primary hover:underline">
              View profile <ArrowUpRight className="h-4 w-4" aria-hidden />
            </Link>
            <Link
              href={`/loans/offers/new?request=${loan.id}`}
              className="rounded-full bg-primary px-space-md py-2 text-label-md font-semibold text-on-primary transition-colors hover:bg-primary-container"
            >
              Make an offer
            </Link>
          </div>
        </div>
      </div>
    </article>
  );
}

export function LoanCardCompact({ loan }: { loan: LoanRequest }) {
  const business = businessById(loan.businessId);
  return (
    <Link
      href={`/loans/offers/new?request=${loan.id}`}
      className="flex items-center gap-space-md rounded-xl p-space-sm transition-colors hover:bg-surface-container-low"
    >
      <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-secondary-fixed text-secondary">
        <TrendingUp className="h-5 w-5" aria-hidden />
      </span>
      <span className="min-w-0 flex-1">
        <span className="block truncate text-label-md font-semibold text-on-surface">{business?.name}</span>
        <span className="block truncate text-body-sm text-outline">{loan.purpose}</span>
      </span>
      <span className="shrink-0 text-label-md font-bold text-primary">{formatBDT(loan.amount)}</span>
    </Link>
  );
}
