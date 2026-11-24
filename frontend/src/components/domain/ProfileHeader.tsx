import type { ReactNode } from "react";
import { MapPin, ShieldCheck } from "lucide-react";
import { Avatar } from "@/components/ui/Avatar";
import { VerifiedBadge } from "@/components/ui/Badge";
import { Photo } from "@/components/ui/Photo";
import type { Person } from "@/data/types";

export function ProfileHeader({ person, actions }: { person: Person; actions?: ReactNode }) {
  return (
    <section className="relative rounded-3xl bg-surface-container-lowest card-shadow">
      {/* The card itself doesn't clip, so action dropdowns (Report / Block) aren't cut off; only the cover does. */}
      <div className="relative h-40 overflow-hidden rounded-t-3xl md:h-56">
        <Photo src={person.cover} alt="" className="absolute inset-0" sizes="(min-width: 1400px) 1400px, 100vw" priority>
          <div className="absolute inset-0 bg-gradient-to-t from-inverse-surface/40 to-transparent" />
        </Photo>
      </div>
      <div className="px-space-md pb-space-lg md:px-space-lg">
        {/* Only the avatar overlaps the cover; name and actions sit on the card surface. */}
        <div className="flex flex-col gap-space-md md:flex-row md:items-end md:justify-between">
          <div className="flex min-w-0 flex-col gap-space-md sm:flex-row sm:items-end">
            <Avatar
              src={person.avatar}
              alt={person.name}
              size="2xl"
              priority
              className="-mt-16 ring-4 ring-surface-container-lowest md:-mt-20"
            />
            <div className="min-w-0 pt-space-sm sm:pb-1">
              <div className="flex flex-wrap items-center gap-2">
                <h1 className="break-words text-headline-md text-on-surface md:text-headline-lg">{person.name}</h1>
                {person.verified && <VerifiedBadge />}
              </div>
              <p className="mt-1 text-body-md text-on-surface-variant">{person.headline}</p>
              <div className="mt-space-sm flex flex-wrap items-center gap-x-space-md gap-y-1 text-body-sm text-outline">
                {person.location && (
                  <span className="flex items-center gap-1">
                    <MapPin className="h-4 w-4" aria-hidden /> {person.location}
                  </span>
                )}
                <span className="flex items-center gap-1">
                  <ShieldCheck className="h-4 w-4 text-success" aria-hidden /> Trust score {person.trustScore}
                </span>
              </div>
            </div>
          </div>
          {actions && <div className="flex flex-wrap gap-space-sm md:shrink-0 md:justify-end md:pb-1">{actions}</div>}
        </div>
        {person.about && <p className="mt-space-md max-w-3xl text-body-md leading-relaxed text-on-surface-variant">{person.about}</p>}
      </div>
    </section>
  );
}
