import Link from "next/link";
import { ArrowUpRight, MapPin, UsersRound } from "lucide-react";
import { VerifiedBadge } from "@/components/ui/Badge";
import { personById } from "@/data/users";
import type { Business } from "@/data/types";
import { formatBDT } from "@/lib/format";
import { Photo } from "@/components/ui/Photo";

export function BusinessCard({ business, ownerName }: { business: Business; ownerName?: string }) {
  const founder = ownerName ?? personById(business.ownerId)?.name;
  return (
    <article className="group flex flex-col overflow-hidden rounded-2xl bg-surface-container-lowest card-shadow card-interactive">
      <Link href={`/businesses/${business.id}`} className="block">
        <Photo src={business.image} alt={business.name} className="h-40" sizes="(min-width: 1280px) 25vw, (min-width: 640px) 50vw, 100vw" zoomOnHover />
      </Link>
      <div className="flex flex-1 flex-col p-space-lg">
        <div className="flex items-start justify-between gap-space-sm">
          <div className="min-w-0">
            <Link href={`/businesses/${business.id}`} className="text-headline-sm font-bold text-on-surface hover:text-primary">
              {business.name}
            </Link>
            <p className="mt-0.5 text-body-sm text-outline">{business.category}</p>
          </div>
          {business.verified && (
            <span className="shrink-0">
              <VerifiedBadge compact />
            </span>
          )}
        </div>
        <p className="mt-space-sm line-clamp-2 text-body-md text-on-surface-variant">{business.tagline}</p>
        <div className="mt-space-md flex flex-wrap gap-x-space-md gap-y-space-sm text-body-sm text-on-surface-variant">
          <span className="flex items-center gap-1"><MapPin className="h-4 w-4 text-primary" aria-hidden /> {business.location}</span>
          <span className="flex items-center gap-1"><UsersRound className="h-4 w-4 text-primary" aria-hidden /> {business.teamSize}</span>
        </div>
        {founder && <p className="mt-space-sm text-body-sm text-outline">Founded by {founder}</p>}
        <div className="mt-auto pt-space-md">
          <div className="flex items-center justify-between border-t border-surface-container-high pt-space-md">
            <div>
              <p className="text-label-sm text-outline">Monthly revenue</p>
              <p className="text-label-md font-bold text-on-surface">{formatBDT(business.monthlyRevenue)}</p>
            </div>
            <Link href={`/businesses/${business.id}`} className="flex items-center gap-1 text-label-md font-semibold text-primary hover:underline">
              View <ArrowUpRight className="h-4 w-4 transition-transform group-hover:-translate-y-0.5 group-hover:translate-x-0.5" aria-hidden />
            </Link>
          </div>
        </div>
      </div>
    </article>
  );
}
