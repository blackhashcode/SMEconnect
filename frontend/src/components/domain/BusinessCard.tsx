import Link from "next/link";
import { ArrowUpRight, MapPin, ShieldCheck } from "lucide-react";
import { VerifiedBadge } from "@/components/ui/Badge";
import { Photo } from "@/components/ui/Photo";
import type { Business } from "@/data/types";

export function BusinessCard({ business, ownerName }: { business: Business; ownerName?: string }) {
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
        <p className="mt-space-md flex items-center gap-1 text-body-sm text-on-surface-variant">
          <MapPin className="h-4 w-4 text-primary" aria-hidden /> {business.location}
        </p>
        {ownerName && <p className="mt-space-sm text-body-sm text-outline">Run by {ownerName}</p>}
        <div className="mt-auto pt-space-md">
          <div className="flex items-center justify-between border-t border-surface-container-high pt-space-md">
            <p className="flex items-center gap-1.5 text-label-md font-bold text-on-surface">
              <ShieldCheck className="h-4 w-4 text-success" aria-hidden /> Trust score {business.trustScore}
            </p>
            <Link href={`/businesses/${business.id}`} className="flex items-center gap-1 text-label-md font-semibold text-primary hover:underline">
              View <ArrowUpRight className="h-4 w-4 transition-transform group-hover:-translate-y-0.5 group-hover:translate-x-0.5" aria-hidden />
            </Link>
          </div>
        </div>
      </div>
    </article>
  );
}
