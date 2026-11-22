/* eslint-disable @next/next/no-img-element */
import Link from "next/link";
import { ArrowUpRight, MapPin, UsersRound } from "lucide-react";
import { VerifiedBadge } from "@/components/ui/Badge";
import { personById } from "@/data/users";
import type { Business } from "@/data/types";
import { formatBDT } from "@/data/loans";

export function BusinessCard({ business }: { business: Business }) {
  const owner = personById(business.ownerId);
  return (
    <article className="group overflow-hidden rounded-2xl bg-surface-container-lowest card-shadow transition-transform hover:-translate-y-1">
      <Link href={`/businesses/${business.id}`} className="block">
        <div className="h-40 overflow-hidden bg-surface-container">
          <img src={business.image} alt={business.name} className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105" />
        </div>
      </Link>
      <div className="p-space-lg">
        <div className="flex items-start justify-between gap-space-sm">
          <div>
            <Link href={`/businesses/${business.id}`} className="text-headline-sm font-bold text-on-surface hover:text-primary">
              {business.name}
            </Link>
            <p className="mt-0.5 text-body-sm text-outline">{business.category}</p>
          </div>
          {business.verified && <VerifiedBadge compact />}
        </div>
        <p className="mt-space-sm line-clamp-2 text-body-md text-on-surface-variant">{business.tagline}</p>
        <div className="mt-space-md flex flex-wrap gap-x-space-md gap-y-space-sm text-body-sm text-on-surface-variant">
          <span className="flex items-center gap-1"><MapPin className="h-4 w-4 text-primary" aria-hidden /> {business.location}</span>
          <span className="flex items-center gap-1"><UsersRound className="h-4 w-4 text-primary" aria-hidden /> {business.teamSize}</span>
        </div>
        <div className="mt-space-md flex items-center justify-between border-t border-surface-container-high pt-space-md">
          <div>
            <p className="text-label-sm text-outline">Monthly revenue</p>
            <p className="text-label-md font-bold text-on-surface">{formatBDT(business.monthlyRevenue)}</p>
          </div>
          <Link href={`/businesses/${business.id}`} className="flex items-center gap-1 text-label-md font-semibold text-primary hover:underline">
            View <ArrowUpRight className="h-4 w-4" aria-hidden />
          </Link>
        </div>
        {owner && <p className="mt-space-sm text-body-sm text-outline">Founded by {owner.name}</p>}
      </div>
    </article>
  );
}
