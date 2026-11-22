import Link from "next/link";
import { ArrowUpRight, MapPin, Star } from "lucide-react";
import { Avatar } from "@/components/ui/Avatar";
import { VerifiedBadge } from "@/components/ui/Badge";
import { formatBDT } from "@/data/loans";
import type { Person } from "@/data/types";

export function InvestorCard({ investor }: { investor: Person }) {
  return (
    <article className="rounded-2xl bg-surface-container-lowest p-space-lg card-shadow">
      <div className="flex items-start gap-space-md">
        <Avatar src={investor.avatar} alt={investor.name} size="lg" />
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <Link href={`/investors/${investor.id}`} className="text-headline-sm font-bold text-on-surface hover:text-primary">
              {investor.name}
            </Link>
            {investor.verified && <VerifiedBadge compact />}
          </div>
          <p className="mt-0.5 line-clamp-2 text-body-sm text-on-surface-variant">{investor.headline}</p>
          <p className="mt-1 flex items-center gap-1 text-body-sm text-outline"><MapPin className="h-3.5 w-3.5" aria-hidden /> {investor.location}</p>
        </div>
      </div>
      <div className="mt-space-md grid grid-cols-3 gap-space-sm rounded-xl bg-surface-container-low p-space-sm text-center">
        <div>
          <p className="text-label-sm text-outline">Connections</p>
          <p className="mt-0.5 text-label-md font-bold text-on-surface">{investor.connections}</p>
        </div>
        <div>
          <p className="text-label-sm text-outline">Offers</p>
          <p className="mt-0.5 text-label-md font-bold text-on-surface">{investor.offersMade ?? 0}</p>
        </div>
        <div>
          <p className="text-label-sm text-outline">Committed</p>
          <p className="mt-0.5 text-label-md font-bold text-on-surface">{formatBDT(investor.committed ?? 0)}</p>
        </div>
      </div>
      <div className="mt-space-md flex items-center justify-between">
        <span className="flex items-center gap-1 text-label-md font-semibold text-warning">
          <Star className="h-4 w-4 fill-current" aria-hidden /> {investor.rating}
        </span>
        <Link href={`/investors/${investor.id}`} className="flex items-center gap-1 text-label-md font-semibold text-primary hover:underline">
          View profile <ArrowUpRight className="h-4 w-4" aria-hidden />
        </Link>
      </div>
    </article>
  );
}
