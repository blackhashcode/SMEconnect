import Link from "next/link";
import { ArrowUpRight, MapPin, ShieldCheck } from "lucide-react";
import { Avatar } from "@/components/ui/Avatar";
import { VerifiedBadge } from "@/components/ui/Badge";
import type { Person } from "@/data/types";

export function InvestorCard({ investor }: { investor: Person }) {
  return (
    <article className="rounded-2xl bg-surface-container-lowest p-space-lg card-shadow card-interactive">
      <div className="flex items-start gap-space-md">
        <Avatar src={investor.avatar} alt={investor.name} size="lg" />
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <Link href={`/investors/${investor.id}`} className="text-headline-sm font-bold text-on-surface hover:text-primary">
              {investor.name}
            </Link>
            {investor.verified && <VerifiedBadge compact />}
          </div>
          <p className="mt-0.5 text-body-sm font-semibold text-primary">{investor.headline}</p>
          {investor.location && (
            <p className="mt-1 flex items-center gap-1 text-body-sm text-outline">
              <MapPin className="h-3.5 w-3.5" aria-hidden /> {investor.location}
            </p>
          )}
        </div>
      </div>
      {investor.about && <p className="mt-space-md line-clamp-2 text-body-md text-on-surface-variant">{investor.about}</p>}
      <div className="mt-space-md flex items-center justify-between border-t border-surface-container-high pt-space-md">
        <span className="flex items-center gap-1.5 text-label-md font-bold text-on-surface">
          <ShieldCheck className="h-4 w-4 text-success" aria-hidden /> Trust score {investor.trustScore}
        </span>
        <Link href={`/investors/${investor.id}`} className="flex items-center gap-1 text-label-md font-semibold text-primary hover:underline">
          View profile <ArrowUpRight className="h-4 w-4" aria-hidden />
        </Link>
      </div>
    </article>
  );
}
